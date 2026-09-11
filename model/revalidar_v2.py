"""
revalidar_v2.py
Revalidación retrospectiva: re-scorea con un modelo dado los casos clínicos
que ya fueron evaluados por el especialista (los que tienen
doctor_severity_judgment poblado sobre un registro ORIGINAL v1.0 — el mismo
criterio que usa el endpoint de Kappa para v1).

Reglas:
  - NUNCA modifica el registro original (fecha real, diagnóstico del
    especialista, predicción v1 quedan intactos).
  - Inserta un registro NUEVO por caso, con las mismas variables clínicas
    de entrada, model_version=<tag>, fecha_evaluacion_clinica copiada del
    original, fecha_revalidacion_tecnica = ahora, y original_evaluation_id
    apuntando al registro original (trazabilidad).
  - No duplica el diagnóstico del especialista — el registro nuevo no llena
    doctor_agreement / doctor_severity_judgment; ese dato se sigue leyendo
    solo del original vía la FK.
  - Idempotente: si ya existe una revalidación con ese mismo model_version
    para un caso original, la salta y avisa en vez de duplicar.

Uso (desde la carpeta model/):
    venv\\Scripts\\python.exe revalidar_v2.py --model-version v2.1 --predictor predict_v2
    venv\\Scripts\\python.exe revalidar_v2.py --model-version v2.0-threshold-only --predictor predict_v2_threshold_only
"""

import os
import sys
import argparse
import importlib
from datetime import datetime, timezone

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "..", "backend")
sys.path.insert(0, os.path.abspath(BACKEND_DIR))
sys.path.insert(0, BASE_DIR)

from app.database import SessionLocal          # noqa: E402
from app import models                          # noqa: E402

FEATURE_FIELDS = [
    "horas_sueno", "vida_social", "frecuencia_ejercicio", "redes_sociales",
    "nivel_estres", "calidad_sueno", "soledad_percibida", "apoyo_familiar",
    "autoestima", "estado_civil", "genero",
]


def main():
    parser = argparse.ArgumentParser(description="Revalidación retrospectiva con un modelo v2.")
    parser.add_argument("--model-version", default="v2.1", help='Tag a asignar a los registros nuevos (ej. "v2.1").')
    parser.add_argument("--predictor", default="predict_v2", help="Módulo predictor a usar (ej. predict_v2).")
    args = parser.parse_args()

    predictor_module = importlib.import_module(args.predictor)
    predictor = predictor_module.get_modelo_v2()

    db = SessionLocal()

    originales = (
        db.query(models.Evaluation)
        .join(models.ModelPrediction)
        .filter(
            models.Evaluation.model_version == "v1.0",
            models.Evaluation.doctor_severity_judgment.isnot(None),
            models.ModelPrediction.severity.isnot(None),
            models.Evaluation.original_evaluation_id.is_(None),
        )
        .order_by(models.Evaluation.id)
        .all()
    )

    print(f"Modelo: {args.predictor}  ->  model_version destino: {args.model_version!r}")
    print(f"Casos elegibles para revalidación (con juicio del especialista): {len(originales)}\n")

    creados, saltados = [], []
    ahora = datetime.now(timezone.utc).replace(tzinfo=None)

    for original in originales:
        ya_existe = (
            db.query(models.Evaluation)
            .filter(
                models.Evaluation.original_evaluation_id == original.id,
                models.Evaluation.model_version == args.model_version,
            )
            .first()
        )
        if ya_existe:
            print(f"[SKIP] Evaluación #{original.id} ya tiene revalidación {args.model_version} (#{ya_existe.id}). No se duplica.")
            saltados.append(original.id)
            continue

        if not original.model_features:
            print(f"[WARN] Evaluación #{original.id} no tiene model_features. Se omite.")
            continue

        features = {campo: getattr(original.model_features, campo) for campo in FEATURE_FIELDS}

        resultado = predictor.predecir(features)

        nuevo = models.Evaluation(
            patient_id=original.patient_id,
            doctor_id=original.doctor_id,
            date=ahora,
            status="Completado",
            doctor_notes=f"Revalidación retrospectiva (modelo {args.model_version}) de la evaluación original #{original.id}.",
            doctor_agreement=None,
            disagreement_reason=None,
            doctor_severity_judgment=None,
            model_version=args.model_version,
            fecha_evaluacion_clinica=original.fecha_evaluacion_clinica,
            fecha_revalidacion_tecnica=ahora,
            original_evaluation_id=original.id,
        )
        nuevo.model_features = models.ModelFeatures(**features)
        nuevo.model_prediction = models.ModelPrediction(
            risk_binary=resultado.risk_binary,
            risk_probability=resultado.risk_probability,
            severity=resultado.severity,
            severity_probability=resultado.severity_probability,
            shap_values=None,
        )

        db.add(nuevo)
        db.commit()
        db.refresh(nuevo)

        print(
            f"[OK] Original #{original.id} -> Revalidación #{nuevo.id} | "
            f"especialista={original.doctor_severity_judgment!r} "
            f"v1={original.model_prediction.severity!r} "
            f"{args.model_version}={resultado.severity!r} (p={resultado.risk_probability})"
        )
        creados.append((original.id, nuevo.id))

    print(f"\nResumen: {len(creados)} revalidaciones creadas, {len(saltados)} saltadas por ya existir.")
    db.close()


if __name__ == "__main__":
    main()
