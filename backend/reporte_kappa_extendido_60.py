"""
reporte_kappa_extendido_60.py
Kappa v1.0 vs v2.1 sobre el set EXTENDIDO de 60 diagnósticos v1.0 (16
originales + 44 generados con e2e_tests/run_15_random.py --n 44
--confirm-ratio 0.9), revalidados con el modelo v2.1 real.

IMPORTANTE — esto NO es el Kappa de validación clínica real (ese vive en
GET /evaluations/metrics/kappa y en reporte_kappa_v1_v2.py, y exige
Patient.origen == "clinico_real"; hoy da n=0 porque nada está confirmado
como paciente real). Este es un ejercicio distinto y deliberadamente NO
filtra por origen: compara v1 vs v2.1 sobre datos sintéticos-pero-realistas
para ver si el patrón de acuerdo se sostiene con más casos, no para hacer
una afirmación de validez clínica.

Uso (desde la carpeta backend/):
    venv\\Scripts\\python.exe reporte_kappa_extendido_60.py --model-version v2.1
"""

import argparse
from sqlalchemy.orm import aliased

from app.database import SessionLocal
from app import models
from app.routers.evaluations_final import calcular_kappa, interpretar_kappa, SEVERITY_LEVELS

parser = argparse.ArgumentParser()
parser.add_argument("--model-version", default="v2.1")
args = parser.parse_args()
MODEL_VERSION_V2 = args.model_version

db = SessionLocal()

# ── v1.0: TODAS las evaluaciones v1.0 con juicio del especialista, sin filtrar por origen ──

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

# ── v2 (ground truth leído del original vía FK), sin filtrar por origen ──

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

print("=" * 90)
print("Kappa EXTENDIDO (n hasta 60, incluye datos sinteticos por diseno) -- NO es el Kappa clinico oficial")
print("=" * 90)
print(f"KAPPA v1.0            -> kappa={resultado_v1['kappa']}  n={resultado_v1['n']}  interpretacion={resultado_v1['interpretacion']}")
if "acuerdo_observado" in resultado_v1:
    print(f"           acuerdo_observado={resultado_v1['acuerdo_observado']}  acuerdo_esperado_azar={resultado_v1['acuerdo_esperado_azar']}")
print(f"KAPPA {MODEL_VERSION_V2:<15} -> kappa={resultado_v2['kappa']}  n={resultado_v2['n']}  interpretacion={resultado_v2['interpretacion']}")
if "acuerdo_observado" in resultado_v2:
    print(f"           acuerdo_observado={resultado_v2['acuerdo_observado']}  acuerdo_esperado_azar={resultado_v2['acuerdo_esperado_azar']}")
print("=" * 90)

print(f"\nMatriz de confusion v1.0 (modelo x especialista):")
for cat, fila in resultado_v1["matriz_confusion"].items():
    print(f"  {cat:<14} {fila}")

print(f"\nMatriz de confusion {MODEL_VERSION_V2} (modelo x especialista):")
for cat, fila in resultado_v2["matriz_confusion"].items():
    print(f"  {cat:<14} {fila}")

print(f"\n{'orig_id':>7} | {'v2_id':>5} | {'paciente':<16} | {'especialista':<14} | {'v1':<14} | {MODEL_VERSION_V2:<14} | v1==esp | v2==esp | cambio")
print("-" * 115)

filas_v2_por_original = {orig.id: (ev2, pred2) for ev2, pred2, orig in filas_v2}
cambios = []

for original in evaluaciones_v1:
    ev2, pred2 = filas_v2_por_original.get(original.id, (None, None))
    v2_id = ev2.id if ev2 else "-"
    v2_sev = pred2.severity if pred2 else "-"
    esp = original.doctor_severity_judgment
    v1_sev = original.model_prediction.severity
    patient = original.patient.nombre_completo if original.patient else "?"
    v1_ok = v1_sev == esp
    v2_ok = v2_sev == esp
    cambio = "" if v1_sev == v2_sev else ("MEJORA" if (not v1_ok and v2_ok) else ("EMPEORA" if (v1_ok and not v2_ok) else "cambia (sin afectar acierto)"))
    if cambio:
        cambios.append((original.id, v1_sev, v2_sev, esp, cambio))
    print(
        f"{original.id:>7} | {v2_id!s:>5} | {patient[:16]:<16} | {esp:<14} | {v1_sev:<14} | {v2_sev:<14} | "
        f"{'si' if v1_ok else 'no':^7} | {'si' if v2_ok else 'no':^7} | {cambio}"
    )

print(f"\nCasos donde v2.1 difiere de v1: {len(cambios)}")
for oid, v1s, v2s, esp, c in cambios:
    print(f"  #{oid}: v1={v1s} -> v2.1={v2s}  (especialista={esp})  [{c}]")

db.close()
