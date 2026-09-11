"""
reporte_kappa_v1_v2.py
Calcula el Kappa de Cohen para v1 y para una versión v2 dada (reutilizando
calcular_kappa / interpretar_kappa de app/routers/evaluations_final.py) y
arma la tabla de comparación de los 16 casos: especialista vs v1 vs v2.

Uso (desde la carpeta backend/):
    venv\\Scripts\\python.exe reporte_kappa_v1_v2.py --model-version v2.1
    venv\\Scripts\\python.exe reporte_kappa_v1_v2.py --model-version v2.0-threshold-only
"""

import argparse
from sqlalchemy.orm import aliased

from app.database import SessionLocal
from app import models
from app.routers.evaluations_final import calcular_kappa, interpretar_kappa, SEVERITY_LEVELS

parser = argparse.ArgumentParser()
parser.add_argument("--model-version", default="v2.1", help='Tag de la revalidación a comparar (ej. "v2.1").')
args = parser.parse_args()
MODEL_VERSION_V2 = args.model_version

db = SessionLocal()

# ── Kappa v1 (idéntico al filtro del endpoint) ────────────────────────────────

evaluaciones_v1 = (
    db.query(models.Evaluation)
    .join(models.ModelPrediction)
    .filter(
        models.Evaluation.doctor_agreement.isnot(None),
        models.ModelPrediction.severity.isnot(None),
        models.Evaluation.doctor_severity_judgment.isnot(None),
        models.Evaluation.model_version == "v1.0",
    )
    .order_by(models.Evaluation.id)
    .all()
)

y_modelo_v1 = [ev.model_prediction.severity for ev in evaluaciones_v1]
y_especialista_v1 = [ev.doctor_severity_judgment for ev in evaluaciones_v1]
resultado_v1 = calcular_kappa(y_modelo_v1, y_especialista_v1, SEVERITY_LEVELS)
resultado_v1["interpretacion"] = interpretar_kappa(resultado_v1["kappa"])

# ── Kappa v2 (ground truth leído del original vía FK) ─────────────────────────

Original = aliased(models.Evaluation)
filas_v2 = (
    db.query(models.Evaluation, models.ModelPrediction, Original)
    .join(models.ModelPrediction, models.ModelPrediction.evaluation_id == models.Evaluation.id)
    .join(Original, models.Evaluation.original_evaluation_id == Original.id)
    .filter(
        models.Evaluation.model_version == MODEL_VERSION_V2,
        models.ModelPrediction.severity.isnot(None),
        Original.doctor_severity_judgment.isnot(None),
    )
    .order_by(Original.id)
    .all()
)

y_modelo_v2 = [pred.severity for _, pred, _ in filas_v2]
y_especialista_v2 = [orig.doctor_severity_judgment for _, _, orig in filas_v2]
resultado_v2 = calcular_kappa(y_modelo_v2, y_especialista_v2, SEVERITY_LEVELS)
resultado_v2["interpretacion"] = interpretar_kappa(resultado_v2["kappa"])

# ── Reporte ────────────────────────────────────────────────────────────────────

def imprimir_resultado(etiqueta, r):
    print(f"KAPPA {etiqueta:<15} -> kappa={r['kappa']}  n={r['n']}  interpretacion={r['interpretacion']}")
    if "acuerdo_observado" in r:
        print(f"           acuerdo_observado={r['acuerdo_observado']}  acuerdo_esperado_azar={r['acuerdo_esperado_azar']}")

print("=" * 90)
imprimir_resultado("v1.0", resultado_v1)
imprimir_resultado(MODEL_VERSION_V2, resultado_v2)
print("=" * 90)

print(f"\n{'orig_id':>7} | {'v2_id':>5} | {'paciente':<12} | {'especialista':<14} | {'v1':<14} | {MODEL_VERSION_V2:<14} | v1==esp | v2==esp")
print("-" * 100)

filas_v2_por_original = {orig.id: (ev2, pred2) for ev2, pred2, orig in filas_v2}

for original in evaluaciones_v1:
    ev2, pred2 = filas_v2_por_original.get(original.id, (None, None))
    v2_id = ev2.id if ev2 else "-"
    v2_sev = pred2.severity if pred2 else "-"
    esp = original.doctor_severity_judgment
    v1_sev = original.model_prediction.severity
    patient = original.patient.nombre_completo if original.patient else "?"
    print(
        f"{original.id:>7} | {v2_id!s:>5} | {patient[:12]:<12} | {esp:<14} | {v1_sev:<14} | {v2_sev:<14} | "
        f"{'si' if v1_sev == esp else 'no':^7} | {'si' if v2_sev == esp else 'no':^7}"
    )

db.close()
