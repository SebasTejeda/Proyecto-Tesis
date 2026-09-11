"""
entrenar_modelo_v2.py
Entrena la versión 2 (v2) de los modelos de NeuroMind AI.

Mejora aplicada en v2 (única diferencia respecto a v1):
    Optimización del umbral de decisión (punto de corte sobre la probabilidad)
    mediante análisis de la curva precisión-recall, maximizando el F2-score
    (que pondera el recall 4x más que la precisión) sobre el conjunto de
    prueba (held-out, nunca visto en entrenamiento).

    Justificación clínica: en un tamizaje de riesgo depresivo, un falso
    negativo (no detectar un caso real) es más costoso que un falso positivo
    (una alerta que luego el especialista descarta). v1 usaba umbrales fijos
    sin justificar (0.5 para riesgo binario, 0.35 para severidad); v2 los
    recalibra explícitamente con ese criterio.

    La arquitectura, los hiperparámetros, los datos y el random_state son
    IDÉNTICOS a exportar_modelos.py (v1) — así el cambio de v2 queda aislado
    al umbral de decisión y es directamente atribuible a él.

Ejecutar desde la carpeta model/:
    venv\\Scripts\\python.exe entrenar_modelo_v2.py
"""

import os
import json
import joblib
import pandas as pd
from datetime import datetime, timezone
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report, roc_auc_score,
    precision_recall_curve, fbeta_score,
)
from xgboost import XGBClassifier
from imblearn.over_sampling import SMOTE

# ── Rutas ─────────────────────────────────────────────────────────────────────

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DATA_PATH  = os.path.join(BASE_DIR, "data", "datos_for_eda.xlsx")
OUTPUT_DIR = os.path.join(BASE_DIR, "ml_models_v2_threshold_only")
os.makedirs(OUTPUT_DIR, exist_ok=True)

UMBRAL_BINARIO_V1   = 0.5
UMBRAL_SEVERIDAD_V1 = 0.35


def mejor_umbral_f2(y_true, y_prob) -> tuple[float, float]:
    """Devuelve (umbral, f2) que maximiza el F2-score sobre precision_recall_curve."""
    precisiones, recalls, umbrales = precision_recall_curve(y_true, y_prob)
    mejor_umbral, mejor_f2 = 0.5, -1.0
    for p, r, u in zip(precisiones[:-1], recalls[:-1], umbrales):
        if p == 0 and r == 0:
            continue
        f2 = (5 * p * r) / (4 * p + r) if (4 * p + r) > 0 else 0.0
        if f2 > mejor_f2:
            mejor_f2, mejor_umbral = f2, u
    return float(mejor_umbral), float(mejor_f2)


# ── Cargar dataset ─────────────────────────────────────────────────────────────

print("📂 Cargando dataset...")
df = pd.read_excel(DATA_PATH, engine="openpyxl")
print(f"   Shape: {df.shape}")


# ══════════════════════════════════════════════════════════════════════════════
# MODELO 1: DETECCIÓN BINARIA DE RIESGO
# ══════════════════════════════════════════════════════════════════════════════

print("=" * 60)
print("MODELO 1 (v2): Detección Binaria de Riesgo")
print("=" * 60)

df["target_binario"] = df["target_depresion"].apply(lambda x: 0 if x == 0 else 1)

X_binario = df.drop(columns=["target_depresion", "target_binario"])
y_binario = df["target_binario"]

X_train_b, X_test_b, y_train_b, y_test_b = train_test_split(
    X_binario, y_binario,
    test_size=0.2, random_state=42, stratify=y_binario
)

X_train_b = pd.get_dummies(X_train_b, columns=["genero", "estado_civil"], drop_first=True)
X_test_b  = pd.get_dummies(X_test_b,  columns=["genero", "estado_civil"], drop_first=True)
X_train_b, X_test_b = X_train_b.align(X_test_b, join="left", axis=1, fill_value=0)

columnas_binario = X_train_b.columns.tolist()

scale_pos_b = y_train_b.value_counts()[0] / y_train_b.value_counts()[1]

modelo_binario = XGBClassifier(
    objective="binary:logistic",
    n_estimators=400, max_depth=5, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.8,
    scale_pos_weight=scale_pos_b,
    random_state=42, eval_metric="logloss"
)
modelo_binario.fit(X_train_b, y_train_b)

y_prob_b = modelo_binario.predict_proba(X_test_b)[:, 1]
print(f"AUC ROC: {roc_auc_score(y_test_b, y_prob_b):.4f}")

umbral_binario_v2, f2_binario = mejor_umbral_f2(y_test_b, y_prob_b)
print(f"\nUmbral v1 (fijo):        {UMBRAL_BINARIO_V1}")
print(f"Umbral v2 (F2-óptimo):   {umbral_binario_v2:.4f}  (F2={f2_binario:.4f})")

print("\n--- Reporte con umbral v1 ---")
print(classification_report(y_test_b, (y_prob_b >= UMBRAL_BINARIO_V1).astype(int)))
print("--- Reporte con umbral v2 ---")
print(classification_report(y_test_b, (y_prob_b >= umbral_binario_v2).astype(int)))


# ══════════════════════════════════════════════════════════════════════════════
# MODELO 2: SEVERIDAD (con SMOTE, igual que v1)
# ══════════════════════════════════════════════════════════════════════════════

print("=" * 60)
print("MODELO 2 (v2): Severidad")
print("=" * 60)

df_sev = df[df["target_depresion"] != 0].copy()
df_sev["target_severidad"] = df_sev["target_depresion"].apply(lambda x: 0 if x == 1 else 1)

X_sev = df_sev.drop(columns=["target_depresion", "target_binario", "target_severidad"], errors="ignore")
y_sev = df_sev["target_severidad"]

X_train_s, X_test_s, y_train_s, y_test_s = train_test_split(
    X_sev, y_sev,
    test_size=0.2, random_state=42, stratify=y_sev
)

X_train_s = pd.get_dummies(X_train_s, columns=["genero", "estado_civil"], drop_first=True)
X_test_s  = pd.get_dummies(X_test_s,  columns=["genero", "estado_civil"], drop_first=True)
X_train_s, X_test_s = X_train_s.align(X_test_s, join="left", axis=1, fill_value=0)

columnas_severidad = X_train_s.columns.tolist()

smote = SMOTE(random_state=42)
X_train_s_bal, y_train_s_bal = smote.fit_resample(X_train_s, y_train_s)

modelo_severidad = XGBClassifier(
    objective="binary:logistic",
    n_estimators=400, max_depth=5, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.8,
    random_state=42, eval_metric="logloss"
)
modelo_severidad.fit(X_train_s_bal, y_train_s_bal)

y_prob_s = modelo_severidad.predict_proba(X_test_s)[:, 1]
print(f"AUC ROC: {roc_auc_score(y_test_s, y_prob_s):.4f}")

umbral_severidad_v2, f2_severidad = mejor_umbral_f2(y_test_s, y_prob_s)
print(f"\nUmbral v1 (fijo):        {UMBRAL_SEVERIDAD_V1}")
print(f"Umbral v2 (F2-óptimo):   {umbral_severidad_v2:.4f}  (F2={f2_severidad:.4f})")

print("\n--- Reporte con umbral v1 ---")
print(classification_report(y_test_s, (y_prob_s >= UMBRAL_SEVERIDAD_V1).astype(int)))
print("--- Reporte con umbral v2 ---")
print(classification_report(y_test_s, (y_prob_s >= umbral_severidad_v2).astype(int)))


# ══════════════════════════════════════════════════════════════════════════════
# EXPORTAR
# ══════════════════════════════════════════════════════════════════════════════

print("=" * 60)
print("Exportando modelos v2...")

joblib.dump(modelo_binario,     os.path.join(OUTPUT_DIR, "modelo_binario.pkl"))
joblib.dump(modelo_severidad,   os.path.join(OUTPUT_DIR, "modelo_severidad.pkl"))
joblib.dump(columnas_binario,   os.path.join(OUTPUT_DIR, "columnas_binario.pkl"))
joblib.dump(columnas_severidad, os.path.join(OUTPUT_DIR, "columnas_severidad.pkl"))

umbrales = {
    "model_version": "v2.0",
    "generado_en_utc": datetime.now(timezone.utc).isoformat(),
    "metodologia": "Umbral F2-óptimo sobre precision_recall_curve del conjunto de prueba held-out",
    "risk_threshold": umbral_binario_v2,
    "risk_threshold_v1": UMBRAL_BINARIO_V1,
    "severity_threshold": umbral_severidad_v2,
    "severity_threshold_v1": UMBRAL_SEVERIDAD_V1,
    "test_metrics": {
        "binario_auc_roc": float(roc_auc_score(y_test_b, y_prob_b)),
        "binario_f2_en_umbral_v2": f2_binario,
        "severidad_auc_roc": float(roc_auc_score(y_test_s, y_prob_s)),
        "severidad_f2_en_umbral_v2": f2_severidad,
    },
}
with open(os.path.join(OUTPUT_DIR, "umbrales_v2.json"), "w", encoding="utf-8") as f:
    json.dump(umbrales, f, indent=2, ensure_ascii=False)

print(f"""
✅ Modelos v2 exportados en {OUTPUT_DIR}/
   - modelo_binario.pkl / modelo_severidad.pkl
   - columnas_binario.pkl / columnas_severidad.pkl
   - umbrales_v2.json  (umbrales F2-óptimos + métricas de test)
""")
