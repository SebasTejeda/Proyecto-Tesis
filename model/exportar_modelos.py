"""
exportar_modelos.py
Entrena y exporta los 2 modelos XGBoost a archivos .pkl.
Usar SMOTE en el modelo de severidad para balancear las clases.

Ejecutar desde la carpeta model/:
    python exportar_modelos.py
"""

import os
import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score
from xgboost import XGBClassifier
from imblearn.over_sampling import SMOTE

# ── Rutas ─────────────────────────────────────────────────────────────────────

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DATA_PATH  = os.path.join(BASE_DIR, "data", "datos_for_eda.xlsx")
OUTPUT_DIR = os.path.join(BASE_DIR, "ml_models")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Cargar dataset ─────────────────────────────────────────────────────────────

print("📂 Cargando dataset...")
df = pd.read_excel(DATA_PATH, engine="openpyxl")
print(f"   Shape: {df.shape}")
print(f"   Target distribución:\n{df['target_depresion'].value_counts()}\n")


# ══════════════════════════════════════════════════════════════════════════════
# MODELO 1: DETECCIÓN BINARIA DE RIESGO
# ══════════════════════════════════════════════════════════════════════════════

print("=" * 60)
print("MODELO 1: Detección Binaria de Riesgo")
print("=" * 60)

# Target binario: 0 = sin depresión, 1 = con depresión
df["target_binario"] = df["target_depresion"].apply(lambda x: 0 if x == 0 else 1)

X_binario = df.drop(columns=["target_depresion", "target_binario"])
y_binario = df["target_binario"]

print(f"Distribución target binario:\n{y_binario.value_counts()}\n")

# Train/test split
X_train_b, X_test_b, y_train_b, y_test_b = train_test_split(
    X_binario, y_binario,
    test_size=0.2, random_state=42, stratify=y_binario
)

# Encoding
X_train_b = pd.get_dummies(X_train_b, columns=["genero", "estado_civil"], drop_first=True)
X_test_b  = pd.get_dummies(X_test_b,  columns=["genero", "estado_civil"], drop_first=True)
X_train_b, X_test_b = X_train_b.align(X_test_b, join="left", axis=1, fill_value=0)

columnas_binario = X_train_b.columns.tolist()

# Scale pos weight para desbalance
scale_pos_b = y_train_b.value_counts()[0] / y_train_b.value_counts()[1]
print(f"Scale pos weight binario: {scale_pos_b:.2f}")

# Entrenar
print("Entrenando modelo binario...")
modelo_binario = XGBClassifier(
    objective="binary:logistic",
    n_estimators=400, max_depth=5, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.8,
    scale_pos_weight=scale_pos_b,
    random_state=42, eval_metric="logloss"
)
modelo_binario.fit(X_train_b, y_train_b)

# Evaluación
y_pred_b = modelo_binario.predict(X_test_b)
y_prob_b = modelo_binario.predict_proba(X_test_b)[:, 1]
print(f"AUC ROC: {roc_auc_score(y_test_b, y_prob_b):.4f}")
print(classification_report(y_test_b, y_pred_b))


# ══════════════════════════════════════════════════════════════════════════════
# MODELO 2: SEVERIDAD (con SMOTE para balancear)
# ══════════════════════════════════════════════════════════════════════════════

print("=" * 60)
print("MODELO 2: Severidad (con SMOTE)")
print("=" * 60)

# Solo casos con depresión
df_sev = df[df["target_depresion"] != 0].copy()

# Target: 0 = Leve, 1 = Moderado/Alto
df_sev["target_severidad"] = df_sev["target_depresion"].apply(
    lambda x: 0 if x == 1 else 1
)

print(f"Distribución ANTES de SMOTE:\n{df_sev['target_severidad'].value_counts()}\n")

X_sev = df_sev.drop(columns=["target_depresion", "target_binario", "target_severidad"], errors="ignore")
y_sev = df_sev["target_severidad"]

# Train/test split — IMPORTANTE: split ANTES de aplicar SMOTE
X_train_s, X_test_s, y_train_s, y_test_s = train_test_split(
    X_sev, y_sev,
    test_size=0.2, random_state=42, stratify=y_sev
)

# Encoding
X_train_s = pd.get_dummies(X_train_s, columns=["genero", "estado_civil"], drop_first=True)
X_test_s  = pd.get_dummies(X_test_s,  columns=["genero", "estado_civil"], drop_first=True)
X_train_s, X_test_s = X_train_s.align(X_test_s, join="left", axis=1, fill_value=0)

columnas_severidad = X_train_s.columns.tolist()

# Aplicar SMOTE solo al TRAIN (nunca al test)
print("Aplicando SMOTE al conjunto de entrenamiento...")
smote = SMOTE(random_state=42)
X_train_s_bal, y_train_s_bal = smote.fit_resample(X_train_s, y_train_s)

print(f"Distribución DESPUÉS de SMOTE:\n{y_train_s_bal.value_counts()}\n")

# Entrenar — sin scale_pos_weight porque SMOTE ya balanceó
print("Entrenando modelo de severidad...")
modelo_severidad = XGBClassifier(
    objective="binary:logistic",
    n_estimators=400, max_depth=5, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.8,
    random_state=42, eval_metric="logloss"
)
modelo_severidad.fit(X_train_s_bal, y_train_s_bal)

# Evaluación sobre test ORIGINAL (sin SMOTE) — así vemos rendimiento real
y_pred_s = modelo_severidad.predict(X_test_s)
y_prob_s = modelo_severidad.predict_proba(X_test_s)[:, 1]
print(f"AUC ROC: {roc_auc_score(y_test_s, y_prob_s):.4f}")
print(classification_report(y_test_s, y_pred_s))


# ══════════════════════════════════════════════════════════════════════════════
# EXPORTAR
# ══════════════════════════════════════════════════════════════════════════════

print("=" * 60)
print("Exportando modelos...")

joblib.dump(modelo_binario,    os.path.join(OUTPUT_DIR, "modelo_binario.pkl"))
joblib.dump(modelo_severidad,  os.path.join(OUTPUT_DIR, "modelo_severidad.pkl"))
joblib.dump(columnas_binario,  os.path.join(OUTPUT_DIR, "columnas_binario.pkl"))
joblib.dump(columnas_severidad,os.path.join(OUTPUT_DIR, "columnas_severidad.pkl"))

print(f"""
✅ Modelos exportados en {OUTPUT_DIR}/
   - modelo_binario.pkl     ({len(columnas_binario)} features)
   - modelo_severidad.pkl   ({len(columnas_severidad)} features) — entrenado con SMOTE
   - columnas_binario.pkl
   - columnas_severidad.pkl
""")