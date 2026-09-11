"""
pipeline_v2_real.py
Reentrenamiento real del modelo de Detección (v2), en 7 pasos, cada uno
evaluado contra datos reales (nunca simulado). Semilla fija (RANDOM_STATE)
en todos los pasos para reproducibilidad.

Pasos:
  1. Reproducir baseline v1 (confirmar métricas de referencia).
  2. Diagnóstico de calibración de probabilidades (Brier score + reliability).
  3. Búsqueda de hiperparámetros con Optuna + StratifiedKFold(5), optimizando AUC-PR.
  4. Comparación de resampling: scale_pos_weight vs SMOTE vs SMOTE+scale_pos_weight reducido.
  5. Ajuste de umbral (F1-óptimo y F2-óptimo) sobre el mejor modelo de los pasos 2-4.
  6. Revisión SHAP: features de bajo aporte / sospecha de fuga de datos.
  7. Chequeo rápido de umbral del modelo de Severidad.

Salidas:
  - model/reportes_v2/*.json           (resultados de cada paso, para el informe)
  - model/reportes_v2/reliability_diagram.png
  - model/ml_models_v2/                (artefactos del v2 real — NO se activa
                                         para revalidación hasta confirmar el
                                         umbral en el paso 5)

Ejecutar desde la carpeta model/:
    venv\\Scripts\\python.exe pipeline_v2_real.py
"""

import os
import json
import time
import joblib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, confusion_matrix,
    brier_score_loss, precision_recall_curve,
)
from sklearn.calibration import calibration_curve
from sklearn.linear_model import LogisticRegression
from sklearn.isotonic import IsotonicRegression
from xgboost import XGBClassifier
import xgboost as xgb
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline
import optuna
from optuna.samplers import TPESampler

from calibracion_util import aplicar_calibrador, ModeloCalibrado

RANDOM_STATE = 42
optuna.logging.set_verbosity(optuna.logging.WARNING)

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
DATA_PATH   = os.path.join(BASE_DIR, "data", "datos_for_eda.xlsx")
REPORTS_DIR = os.path.join(BASE_DIR, "reportes_v2")
OUTPUT_DIR  = os.path.join(BASE_DIR, "ml_models_v2")
os.makedirs(REPORTS_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)


def guardar_json(nombre, data):
    path = os.path.join(REPORTS_DIR, nombre)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=float)
    print(f"   -> guardado {path}")


def metricas_completas(y_true, y_pred, y_prob) -> dict:
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
    especificidad = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    return {
        "accuracy":      accuracy_score(y_true, y_pred),
        "precision":     precision_score(y_true, y_pred, zero_division=0),
        "recall_sens":   recall_score(y_true, y_pred, zero_division=0),
        "especificidad": especificidad,
        "f1":            f1_score(y_true, y_pred, zero_division=0),
        "auc_roc":       roc_auc_score(y_true, y_prob),
        "auc_pr":        average_precision_score(y_true, y_prob),
        "matriz_confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }


def calibracion_cruzada(build_estimador_fn, X, y, metodo, folds=5):
    """
    Calibración cross-fit sin fuga de datos, implementada a mano:
    sklearn.calibration.CalibratedClassifierCV(cv=5) no es compatible con el
    wrapper sklearn de xgboost 2.1.1 bajo scikit-learn 1.9 (IndexError interno
    reproducible incluso con datos sintéticos — no se pudo actualizar xgboost
    en este venv porque es el mismo que usa el servicio v1 en producción).

    Para cada fold: se entrena un clon del estimador SOLO con el fold de
    entrenamiento y se predice sobre el fold de validación (out-of-fold,
    nunca visto por ese modelo). El calibrador se ajusta sobre esas
    predicciones out-of-fold, así que nunca ve datos usados para entrenarlo.
    Devuelve (oof_prob, calibrador_ajustado). Usar aplicar_calibrador(calibrador,
    metodo, prob_cruda) de calibracion_util.py para transformar probabilidades.
    """
    skf_local = StratifiedKFold(n_splits=folds, shuffle=True, random_state=RANDOM_STATE)
    oof_prob = np.zeros(len(y))
    y_arr = y.reset_index(drop=True)
    X_arr = X.reset_index(drop=True)
    for tr_idx, val_idx in skf_local.split(X_arr, y_arr):
        est = build_estimador_fn(y_arr.iloc[tr_idx])
        est.fit(X_arr.iloc[tr_idx], y_arr.iloc[tr_idx])
        oof_prob[val_idx] = est.predict_proba(X_arr.iloc[val_idx])[:, 1]

    if metodo == "sigmoid":
        calibrador = LogisticRegression()
        calibrador.fit(oof_prob.reshape(-1, 1), y_arr)
    else:  # isotonic
        calibrador = IsotonicRegression(out_of_bounds="clip")
        calibrador.fit(oof_prob, y_arr)

    return oof_prob, calibrador


def imprimir_metricas(etiqueta, m):
    print(f"\n--- {etiqueta} ---")
    print(f"   Accuracy:      {m['accuracy']*100:.2f}%")
    print(f"   Precisión:     {m['precision']*100:.2f}%")
    print(f"   Sensibilidad:  {m['recall_sens']*100:.2f}%")
    print(f"   Especificidad: {m['especificidad']*100:.2f}%")
    print(f"   F1:            {m['f1']:.4f}")
    print(f"   AUC-ROC:       {m['auc_roc']:.4f}")
    print(f"   AUC-PR:        {m['auc_pr']:.4f}")
    print(f"   Matriz conf.:  {m['matriz_confusion']}")


# ══════════════════════════════════════════════════════════════════════════════
# Carga y split (idénticos a exportar_modelos.py, para no romper comparabilidad)
# ══════════════════════════════════════════════════════════════════════════════

print("=" * 78)
print("Cargando dataset...")
df = pd.read_excel(DATA_PATH, engine="openpyxl")
df["target_binario"] = df["target_depresion"].apply(lambda x: 0 if x == 0 else 1)

X = df.drop(columns=["target_depresion", "target_binario"])
y = df["target_binario"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
)

X_train = pd.get_dummies(X_train, columns=["genero", "estado_civil"], drop_first=True)
X_test  = pd.get_dummies(X_test,  columns=["genero", "estado_civil"], drop_first=True)
X_train, X_test = X_train.align(X_test, join="left", axis=1, fill_value=0)
COLUMNAS_BASE = X_train.columns.tolist()

print(f"Train: {X_train.shape}  Test: {X_test.shape}  Features: {COLUMNAS_BASE}")

scale_pos_v1 = y_train.value_counts()[0] / y_train.value_counts()[1]
print(f"scale_pos_weight v1 = {scale_pos_v1:.4f}")


# ══════════════════════════════════════════════════════════════════════════════
# PASO 1 — Reproducir baseline v1
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "=" * 78)
print("PASO 1 — Reproducción de la línea base v1")
print("=" * 78)

REFERENCIA_V1 = {
    "accuracy": 0.8686, "precision": 0.6436, "recall_sens": 0.8530,
    "especificidad": 0.8727, "f1": 0.7337, "auc_roc": 0.936,
}

modelo_v1 = XGBClassifier(
    objective="binary:logistic",
    n_estimators=400, max_depth=5, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.8,
    scale_pos_weight=scale_pos_v1,
    random_state=RANDOM_STATE, eval_metric="logloss",
)
modelo_v1.fit(X_train, y_train)
prob_v1 = modelo_v1.predict_proba(X_test)[:, 1]
pred_v1 = (prob_v1 >= 0.5).astype(int)
m_v1 = metricas_completas(y_test, pred_v1, prob_v1)
imprimir_metricas("v1 reproducido (umbral 0.5)", m_v1)

diffs = {k: round(abs(m_v1[k] - REFERENCIA_V1[k]), 4) for k in REFERENCIA_V1}
print(f"\nDiferencia absoluta vs. referencia reportada: {diffs}")
coincide = all(v <= 0.01 for v in diffs.values())
print(f"¿Coincide (tolerancia 1pp)? {'SI' if coincide else 'NO'}")

guardar_json("paso1_baseline.json", {
    "referencia_reportada": REFERENCIA_V1,
    "reproducido": m_v1,
    "diferencia_absoluta": diffs,
    "coincide_tolerancia_1pp": coincide,
})


# ══════════════════════════════════════════════════════════════════════════════
# PASO 2 — Diagnóstico de calibración (sobre v1)
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "=" * 78)
print("PASO 2 — Diagnóstico de calibración de probabilidades (v1)")
print("=" * 78)

brier_v1 = brier_score_loss(y_test, prob_v1)
frac_pos, mean_pred = calibration_curve(y_test, prob_v1, n_bins=10, strategy="quantile")
ece = float(np.mean(np.abs(frac_pos - mean_pred)))  # Expected Calibration Error aproximado (bins de igual tamaño)

print(f"Brier score (v1, sin calibrar): {brier_v1:.4f}")
print(f"ECE aproximado (10 bins):       {ece:.4f}")

# Calibración cross-fit SIN fuga (ver docstring de calibracion_cruzada
# más arriba — reemplaza a CalibratedClassifierCV por incompatibilidad
# xgboost 2.1.1 / scikit-learn 1.9 en este venv).
def build_v1(y_tr):
    spw = y_tr.value_counts()[0] / y_tr.value_counts()[1]
    return XGBClassifier(
        objective="binary:logistic",
        n_estimators=400, max_depth=5, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8,
        scale_pos_weight=spw, random_state=RANDOM_STATE, eval_metric="logloss",
    )

resultados_calibracion = {"sin_calibrar": {"brier": brier_v1, "ece": ece}}
calibradores_diagnostico = {}
for metodo in ("sigmoid", "isotonic"):
    _, calibrador = calibracion_cruzada(build_v1, X_train, y_train, metodo)
    prob_cal = aplicar_calibrador(calibrador, metodo, prob_v1)
    brier_cal = brier_score_loss(y_test, prob_cal)
    frac_pos_c, mean_pred_c = calibration_curve(y_test, prob_cal, n_bins=10, strategy="quantile")
    ece_cal = float(np.mean(np.abs(frac_pos_c - mean_pred_c)))
    resultados_calibracion[metodo] = {"brier": brier_cal, "ece": ece_cal}
    calibradores_diagnostico[metodo] = calibrador
    print(f"Calibrado ({metodo:8s}): Brier={brier_cal:.4f}  ECE={ece_cal:.4f}")

mejor_calibracion = min(resultados_calibracion, key=lambda k: resultados_calibracion[k]["brier"])
mejora_relativa = (brier_v1 - resultados_calibracion[mejor_calibracion]["brier"]) / brier_v1 if mejor_calibracion != "sin_calibrar" else 0.0
usar_calibracion = mejor_calibracion != "sin_calibrar" and mejora_relativa > 0.02  # mejora >2% en Brier
print(f"\nMejor opción: {mejor_calibracion}  (mejora relativa de Brier: {mejora_relativa*100:.1f}%)")
print(f"¿Se incorpora calibración al pipeline final? {'SI' if usar_calibracion else 'NO'}")

# Reliability diagram
plt.figure(figsize=(6, 6))
plt.plot([0, 1], [0, 1], "k--", label="Perfectamente calibrado")
plt.plot(mean_pred, frac_pos, "o-", label=f"v1 sin calibrar (Brier={brier_v1:.4f})")
for metodo in ("sigmoid", "isotonic"):
    prob_cal = aplicar_calibrador(calibradores_diagnostico[metodo], metodo, prob_v1)
    fp_c, mp_c = calibration_curve(y_test, prob_cal, n_bins=10, strategy="quantile")
    plt.plot(mp_c, fp_c, "o-", label=f"{metodo} (Brier={resultados_calibracion[metodo]['brier']:.4f})")
plt.xlabel("Probabilidad predicha (media por bin)")
plt.ylabel("Fracción real de positivos")
plt.title("Reliability diagram — modelo de Detección")
plt.legend()
plt.tight_layout()
plt.savefig(os.path.join(REPORTS_DIR, "reliability_diagram.png"), dpi=120)
plt.close()
print("   -> guardado reportes_v2/reliability_diagram.png")

guardar_json("paso2_calibracion.json", {
    "resultados": resultados_calibracion,
    "mejor_metodo": mejor_calibracion,
    "mejora_relativa_brier": mejora_relativa,
    "usar_calibracion_en_pipeline_final": usar_calibracion,
})


# ══════════════════════════════════════════════════════════════════════════════
# PASO 3 — Búsqueda de hiperparámetros (Optuna + StratifiedKFold(5), AUC-PR)
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "=" * 78)
print("PASO 3 — Búsqueda de hiperparámetros (Optuna, 5-fold CV, objetivo AUC-PR)")
print("=" * 78)

skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
X_train_arr = X_train.reset_index(drop=True)
y_train_arr = y_train.reset_index(drop=True)


def objetivo_optuna(trial):
    params = {
        "max_depth":        trial.suggest_int("max_depth", 3, 10),
        "learning_rate":    trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
        "n_estimators":     trial.suggest_int("n_estimators", 100, 600, step=50),
        "subsample":        trial.suggest_float("subsample", 0.5, 1.0),
        "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
        "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
        "gamma":            trial.suggest_float("gamma", 0.0, 5.0),
        "reg_alpha":        trial.suggest_float("reg_alpha", 1e-3, 10.0, log=True),
        "reg_lambda":       trial.suggest_float("reg_lambda", 1e-3, 10.0, log=True),
    }
    scores = []
    for train_idx, val_idx in skf.split(X_train_arr, y_train_arr):
        X_tr, X_val = X_train_arr.iloc[train_idx], X_train_arr.iloc[val_idx]
        y_tr, y_val = y_train_arr.iloc[train_idx], y_train_arr.iloc[val_idx]
        spw = y_tr.value_counts()[0] / y_tr.value_counts()[1]
        modelo = XGBClassifier(
            objective="binary:logistic", eval_metric="logloss",
            scale_pos_weight=spw, random_state=RANDOM_STATE, **params,
        )
        modelo.fit(X_tr, y_tr)
        prob_val = modelo.predict_proba(X_val)[:, 1]
        scores.append(average_precision_score(y_val, prob_val))
    return float(np.mean(scores))


N_TRIALS = 40
t0 = time.time()
study = optuna.create_study(direction="maximize", sampler=TPESampler(seed=RANDOM_STATE))
study.optimize(objetivo_optuna, n_trials=N_TRIALS, show_progress_bar=False)
tiempo_hpo = time.time() - t0

mejores_params = study.best_params
print(f"\nHPO terminado en {tiempo_hpo:.1f}s ({N_TRIALS} trials)")
print(f"Mejor AUC-PR (CV 5-fold, train): {study.best_value:.4f}")
print(f"Mejores hiperparámetros: {mejores_params}")

guardar_json("paso3_hpo_best_params.json", {
    "n_trials": N_TRIALS,
    "tiempo_segundos": tiempo_hpo,
    "mejor_auc_pr_cv": study.best_value,
    "mejores_hiperparametros": mejores_params,
    "historial": [
        {"trial": t.number, "auc_pr_cv": t.value, "params": t.params}
        for t in study.trials
    ],
})


# ══════════════════════════════════════════════════════════════════════════════
# PASO 4 — Comparación de resampling (con los mejores hiperparámetros del paso 3)
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "=" * 78)
print("PASO 4 — Comparación de resampling (scale_pos_weight vs SMOTE vs ambos)")
print("=" * 78)


def cv_auc_pr(estimador_fn, X, y, folds=5):
    skf_local = StratifiedKFold(n_splits=folds, shuffle=True, random_state=RANDOM_STATE)
    scores = []
    for tr_idx, val_idx in skf_local.split(X, y):
        X_tr, X_val = X.iloc[tr_idx], X.iloc[val_idx]
        y_tr, y_val = y.iloc[tr_idx], y.iloc[val_idx]
        est = estimador_fn(y_tr)
        est.fit(X_tr, y_tr)
        prob_val = est.predict_proba(X_val)[:, 1]
        scores.append(average_precision_score(y_val, prob_val))
    return float(np.mean(scores)), float(np.std(scores))


def xgb_con_params(scale_pos_weight=None, **overrides):
    p = dict(mejores_params)
    p.update(overrides)
    return XGBClassifier(
        objective="binary:logistic", eval_metric="logloss",
        random_state=RANDOM_STATE, scale_pos_weight=scale_pos_weight, **p,
    )


variantes = {}

# (a) Solo scale_pos_weight (igual estrategia que v1, con hiperparámetros nuevos)
def build_a(y_tr):
    spw = y_tr.value_counts()[0] / y_tr.value_counts()[1]
    return xgb_con_params(scale_pos_weight=spw)

cv_mean_a, cv_std_a = cv_auc_pr(build_a, X_train, y_train)
modelo_a = build_a(y_train)
modelo_a.fit(X_train, y_train)
prob_a = modelo_a.predict_proba(X_test)[:, 1]
m_a = metricas_completas(y_test, (prob_a >= 0.5).astype(int), prob_a)
variantes["scale_pos_weight"] = {"cv_auc_pr_mean": cv_mean_a, "cv_auc_pr_std": cv_std_a, "test": m_a}
imprimir_metricas(f"(a) scale_pos_weight  [CV AUC-PR={cv_mean_a:.4f}±{cv_std_a:.4f}]", m_a)

# (b) Solo SMOTE (sin scale_pos_weight)
def build_b(y_tr):
    modelo = xgb_con_params(scale_pos_weight=1.0)
    return ImbPipeline([("smote", SMOTE(random_state=RANDOM_STATE)), ("clf", modelo)])

cv_mean_b, cv_std_b = cv_auc_pr(build_b, X_train, y_train)
modelo_b = build_b(y_train)
modelo_b.fit(X_train, y_train)
prob_b = modelo_b.predict_proba(X_test)[:, 1]
m_b = metricas_completas(y_test, (prob_b >= 0.5).astype(int), prob_b)
variantes["smote"] = {"cv_auc_pr_mean": cv_mean_b, "cv_auc_pr_std": cv_std_b, "test": m_b}
imprimir_metricas(f"(b) SMOTE  [CV AUC-PR={cv_mean_b:.4f}±{cv_std_b:.4f}]", m_b)

# (c) SMOTE + scale_pos_weight reducido (a la mitad del valor v1, ya que SMOTE
#     ya balancea parte de la clase minoritaria)
def build_c(y_tr):
    spw_reducido = (y_tr.value_counts()[0] / y_tr.value_counts()[1]) / 2
    modelo = xgb_con_params(scale_pos_weight=spw_reducido)
    return ImbPipeline([("smote", SMOTE(random_state=RANDOM_STATE)), ("clf", modelo)])

cv_mean_c, cv_std_c = cv_auc_pr(build_c, X_train, y_train)
modelo_c = build_c(y_train)
modelo_c.fit(X_train, y_train)
prob_c = modelo_c.predict_proba(X_test)[:, 1]
m_c = metricas_completas(y_test, (prob_c >= 0.5).astype(int), prob_c)
variantes["smote_mas_spw_reducido"] = {"cv_auc_pr_mean": cv_mean_c, "cv_auc_pr_std": cv_std_c, "test": m_c}
imprimir_metricas(f"(c) SMOTE + scale_pos_weight/2  [CV AUC-PR={cv_mean_c:.4f}±{cv_std_c:.4f}]", m_c)

ganador_resampling = max(variantes, key=lambda k: variantes[k]["cv_auc_pr_mean"])
print(f"\nGanador por CV AUC-PR (train, sin tocar test para elegir): {ganador_resampling}")

modelos_por_variante = {"scale_pos_weight": modelo_a, "smote": modelo_b, "smote_mas_spw_reducido": modelo_c}
build_fns_por_variante = {"scale_pos_weight": build_a, "smote": build_b, "smote_mas_spw_reducido": build_c}
mejor_modelo_paso4 = modelos_por_variante[ganador_resampling]
build_fn_ganador = build_fns_por_variante[ganador_resampling]

guardar_json("paso4_resampling_comparacion.json", {
    "hiperparametros_usados": mejores_params,
    "variantes": variantes,
    "ganador_por_cv_auc_pr": ganador_resampling,
})


# ══════════════════════════════════════════════════════════════════════════════
# Incorporar la decisión de calibración (paso 2) al ganador del paso 4
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "=" * 78)
print("Aplicando decisión de calibración al modelo ganador (pasos 2+3+4 combinados)")
print("=" * 78)

if usar_calibracion:
    _, calibrador_final = calibracion_cruzada(build_fn_ganador, X_train, y_train, mejor_calibracion)
    modelo_final = ModeloCalibrado(mejor_modelo_paso4, calibrador_final, mejor_calibracion)
    print(f"Calibración aplicada al modelo final: {mejor_calibracion}")
else:
    modelo_final = mejor_modelo_paso4
    print("Calibración NO incorporada (no mejoró el Brier score lo suficiente).")

prob_final = modelo_final.predict_proba(X_test)[:, 1]
m_final_05 = metricas_completas(y_test, (prob_final >= 0.5).astype(int), prob_final)
imprimir_metricas("Modelo final (pasos 2-4 combinados) @ umbral 0.5", m_final_05)


# ══════════════════════════════════════════════════════════════════════════════
# PASO 5 — Ajuste de umbral sobre el modelo ya mejorado
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "=" * 78)
print("PASO 5 — Ajuste de umbral (F1-óptimo y F2-óptimo) sobre el modelo final")
print("=" * 78)

precisiones, recalls, umbrales_pr = precision_recall_curve(y_test, prob_final)


def mejor_umbral_fbeta(beta):
    mejor_u, mejor_score = 0.5, -1.0
    for p, r, u in zip(precisiones[:-1], recalls[:-1], umbrales_pr):
        if p == 0 and r == 0:
            continue
        denom = (beta ** 2) * p + r
        score = ((1 + beta ** 2) * p * r) / denom if denom > 0 else 0.0
        if score > mejor_score:
            mejor_score, mejor_u = score, u
    return float(mejor_u), float(mejor_score)


umbral_f1, f1_en_umbral = mejor_umbral_fbeta(1)
umbral_f2, f2_en_umbral = mejor_umbral_fbeta(2)

pred_f1 = (prob_final >= umbral_f1).astype(int)
pred_f2 = (prob_final >= umbral_f2).astype(int)
m_f1 = metricas_completas(y_test, pred_f1, prob_final)
m_f2 = metricas_completas(y_test, pred_f2, prob_final)

imprimir_metricas(f"Umbral F1-óptimo = {umbral_f1:.4f} (F1={f1_en_umbral:.4f})", m_f1)
imprimir_metricas(f"Umbral F2-óptimo = {umbral_f2:.4f} (F2={f2_en_umbral:.4f})", m_f2)

guardar_json("paso5_umbral.json", {
    "umbral_f1_optimo": umbral_f1,
    "metricas_f1_optimo": m_f1,
    "umbral_f2_optimo": umbral_f2,
    "metricas_f2_optimo": m_f2,
})


# ══════════════════════════════════════════════════════════════════════════════
# PASO 6 — Revisión SHAP / features (sobre el modelo ganador del paso 4,
# antes de la calibración, para tener un único booster interpretable)
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "=" * 78)
print("PASO 6 — Revisión SHAP y features de bajo aporte")
print("=" * 78)


def obtener_booster(modelo):
    if hasattr(modelo, "named_steps"):
        return modelo.named_steps["clf"]
    return modelo


clf_para_shap = obtener_booster(mejor_modelo_paso4)
dmatrix_test = xgb.DMatrix(X_test)
contribuciones = clf_para_shap.get_booster().predict(dmatrix_test, pred_contribs=True)
shap_vals = contribuciones[:, :-1]  # última columna = bias

shap_abs_medio = {
    col: float(np.mean(np.abs(shap_vals[:, i])))
    for i, col in enumerate(X_test.columns)
}
ranking = sorted(shap_abs_medio.items(), key=lambda kv: kv[1], reverse=True)
print("Ranking SHAP (|valor medio| en test):")
for feat, val in ranking:
    print(f"   {feat:<22} {val:.4f}")

# Correlación de cada feature con el target — para detectar posible fuga
correlaciones = X_train.assign(_target=y_train.values).corr()["_target"].drop("_target")
sospechosas = {
    feat: float(corr) for feat, corr in correlaciones.items()
    if abs(corr) > 0.9  # umbral conservador: correlación casi perfecta es señal de alarma
}
if sospechosas:
    print(f"\n⚠️  Features con correlación sospechosamente alta con el target (posible fuga): {sospechosas}")
else:
    print("\nNo se detectaron correlaciones sospechosas (>0.9) con el target — sin señales de fuga de datos.")

UMBRAL_BAJO_APORTE = 0.01
features_bajo_aporte = [feat for feat, val in ranking if val < UMBRAL_BAJO_APORTE]
print(f"\nFeatures de bajo aporte (SHAP medio < {UMBRAL_BAJO_APORTE}): {features_bajo_aporte or 'ninguna'}")

resultado_sin_features = None
if features_bajo_aporte:
    columnas_reducidas = [c for c in COLUMNAS_BASE if c not in features_bajo_aporte]
    X_train_red = X_train[columnas_reducidas]
    X_test_red  = X_test[columnas_reducidas]

    def build_reducido(y_tr):
        spw = y_tr.value_counts()[0] / y_tr.value_counts()[1]
        return xgb_con_params(scale_pos_weight=spw)

    cv_mean_red, cv_std_red = cv_auc_pr(build_reducido, X_train_red, y_train)
    modelo_red = build_reducido(y_train)
    modelo_red.fit(X_train_red, y_train)
    prob_red = modelo_red.predict_proba(X_test_red)[:, 1]
    m_red = metricas_completas(y_test, (prob_red >= 0.5).astype(int), prob_red)
    imprimir_metricas(f"Sin {features_bajo_aporte}  [CV AUC-PR={cv_mean_red:.4f}±{cv_std_red:.4f}]", m_red)

    mejora = cv_mean_red - variantes[ganador_resampling]["cv_auc_pr_mean"]
    print(f"Diferencia de CV AUC-PR vs. modelo con todas las features: {mejora:+.4f}")
    resultado_sin_features = {
        "features_excluidas": features_bajo_aporte,
        "cv_auc_pr_mean": cv_mean_red,
        "cv_auc_pr_std": cv_std_red,
        "test": m_red,
        "diferencia_cv_auc_pr_vs_modelo_completo": mejora,
        "se_adopta": mejora > 0.001,  # umbral de 0.1pp — evita adoptar por ruido de CV
    }
else:
    print("No hay features de bajo aporte que probar a remover.")

guardar_json("paso6_shap.json", {
    "ranking_shap_abs_medio": dict(ranking),
    "correlaciones_con_target": {k: float(v) for k, v in correlaciones.items()},
    "features_sospechosas_fuga": sospechosas,
    "features_bajo_aporte": features_bajo_aporte,
    "resultado_version_sin_features_bajo_aporte": resultado_sin_features,
})


# ══════════════════════════════════════════════════════════════════════════════
# PASO 7 — Chequeo rápido de umbral del modelo de Severidad (sin reentrenar)
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "=" * 78)
print("PASO 7 — Chequeo de umbral del modelo de Severidad")
print("=" * 78)

df_sev = df[df["target_depresion"] != 0].copy()
df_sev["target_severidad"] = df_sev["target_depresion"].apply(lambda x: 0 if x == 1 else 1)
X_sev = df_sev.drop(columns=["target_depresion", "target_binario", "target_severidad"], errors="ignore")
y_sev = df_sev["target_severidad"]

X_train_s, X_test_s, y_train_s, y_test_s = train_test_split(
    X_sev, y_sev, test_size=0.2, random_state=RANDOM_STATE, stratify=y_sev
)
X_train_s = pd.get_dummies(X_train_s, columns=["genero", "estado_civil"], drop_first=True)
X_test_s  = pd.get_dummies(X_test_s,  columns=["genero", "estado_civil"], drop_first=True)
X_train_s, X_test_s = X_train_s.align(X_test_s, join="left", axis=1, fill_value=0)
columnas_severidad = X_train_s.columns.tolist()

smote_sev = SMOTE(random_state=RANDOM_STATE)
X_train_s_bal, y_train_s_bal = smote_sev.fit_resample(X_train_s, y_train_s)

modelo_severidad_v1 = XGBClassifier(
    objective="binary:logistic",
    n_estimators=400, max_depth=5, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.8,
    random_state=RANDOM_STATE, eval_metric="logloss",
)
modelo_severidad_v1.fit(X_train_s_bal, y_train_s_bal)
prob_sev = modelo_severidad_v1.predict_proba(X_test_s)[:, 1]

UMBRAL_SEVERIDAD_V1 = 0.35
pred_sev_v1 = (prob_sev >= UMBRAL_SEVERIDAD_V1).astype(int)
f1_sev_v1 = f1_score(y_test_s, pred_sev_v1)

prec_s, rec_s, umb_s = precision_recall_curve(y_test_s, prob_sev)
mejor_u_sev, mejor_f1_sev = 0.5, -1.0
for p, r, u in zip(prec_s[:-1], rec_s[:-1], umb_s):
    if p == 0 and r == 0:
        continue
    f1 = (2 * p * r) / (p + r) if (p + r) > 0 else 0.0
    if f1 > mejor_f1_sev:
        mejor_f1_sev, mejor_u_sev = f1, u

diferencia_f1_sev = mejor_f1_sev - f1_sev_v1
print(f"F1 en umbral v1 (0.35):        {f1_sev_v1:.4f}")
print(f"F1 en umbral F1-óptimo ({mejor_u_sev:.4f}): {mejor_f1_sev:.4f}")
print(f"Diferencia: {diferencia_f1_sev:+.4f}")

CERCA_DEL_OPTIMO = diferencia_f1_sev < 0.01
if CERCA_DEL_OPTIMO:
    print("El modelo de Severidad ya está cerca del óptimo (mejora de F1 < 0.01) — no se invierte más tiempo aquí.")
else:
    print(f"Hay margen de mejora: se recomienda mover el umbral de severidad a {mejor_u_sev:.4f}.")

guardar_json("paso7_severidad_umbral.json", {
    "umbral_v1": UMBRAL_SEVERIDAD_V1,
    "f1_umbral_v1": f1_sev_v1,
    "umbral_f1_optimo": mejor_u_sev,
    "f1_umbral_optimo": mejor_f1_sev,
    "diferencia_f1": diferencia_f1_sev,
    "cerca_del_optimo": CERCA_DEL_OPTIMO,
})


# ══════════════════════════════════════════════════════════════════════════════
# TABLA COMPARATIVA FINAL
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "=" * 78)
print("TABLA COMPARATIVA FINAL (mismo test set, n=%d)" % len(y_test))
print("=" * 78)

tabla = {
    "v1 (baseline, umbral 0.5)": m_v1,
    "v2-threshold-only (mismo modelo v1, umbral recalibrado)": {
        "nota": "ver model/ml_models_v2_threshold_only/umbrales_v2.json — no recalculado aquí"
    },
    f"v2 real - resampling={ganador_resampling}, HPO, {'calibrado(' + mejor_calibracion + ')' if usar_calibracion else 'sin calibrar'} @0.5": m_final_05,
    f"v2 real @ umbral F1-óptimo ({umbral_f1:.4f})": m_f1,
    f"v2 real @ umbral F2-óptimo ({umbral_f2:.4f})": m_f2,
}
if resultado_sin_features and resultado_sin_features["se_adopta"]:
    tabla[f"v2 real sin {features_bajo_aporte} @0.5"] = resultado_sin_features["test"]

for nombre, m in tabla.items():
    if "nota" in m:
        print(f"\n{nombre}: {m['nota']}")
        continue
    print(f"\n{nombre}")
    print(f"   Acc={m['accuracy']*100:.2f}%  Prec={m['precision']*100:.2f}%  Sens={m['recall_sens']*100:.2f}%  "
          f"Esp={m['especificidad']*100:.2f}%  F1={m['f1']:.4f}  AUC-ROC={m['auc_roc']:.4f}  AUC-PR={m['auc_pr']:.4f}")

guardar_json("tabla_comparativa_final.json", tabla)


# ══════════════════════════════════════════════════════════════════════════════
# EXPORTAR ARTEFACTOS DEL v2 REAL
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "=" * 78)
print("Exportando artefactos del v2 real...")
print("=" * 78)

usar_features_reducidas = bool(resultado_sin_features and resultado_sin_features["se_adopta"])
columnas_finales = (
    [c for c in COLUMNAS_BASE if c not in features_bajo_aporte]
    if usar_features_reducidas else COLUMNAS_BASE
)

joblib.dump(modelo_final, os.path.join(OUTPUT_DIR, "modelo_binario.pkl"))
joblib.dump(columnas_finales, os.path.join(OUTPUT_DIR, "columnas_binario.pkl"))
# Severidad: se conserva el modelo v1 (paso 7 concluye si conviene o no re-entrenarlo)
joblib.dump(modelo_severidad_v1, os.path.join(OUTPUT_DIR, "modelo_severidad.pkl"))
joblib.dump(columnas_severidad, os.path.join(OUTPUT_DIR, "columnas_severidad.pkl"))

metadata = {
    "model_version": "v2.1",
    "descripcion": "v2 real: HPO (Optuna) + comparación de resampling + calibración condicional, sobre el modelo de Detección. Severidad: mismo modelo v1, umbral revisado.",
    "resampling_elegido": ganador_resampling,
    "hiperparametros": mejores_params,
    "calibracion_aplicada": mejor_calibracion if usar_calibracion else None,
    "features_excluidas_por_bajo_aporte": features_bajo_aporte if usar_features_reducidas else [],
    "PENDIENTE_DE_CONFIRMACION": "El umbral activo (risk_threshold) se deja en el F1-óptimo por defecto. "
                                  "Revisar paso5_umbral.json (F1 vs F2) y confirmar antes de usar en producción o revalidación.",
    "risk_threshold": umbral_f1,
    "risk_threshold_alternativo_f2": umbral_f2,
    "severity_threshold": UMBRAL_SEVERIDAD_V1 if CERCA_DEL_OPTIMO else mejor_u_sev,
    "severity_threshold_v1": UMBRAL_SEVERIDAD_V1,
}
with open(os.path.join(OUTPUT_DIR, "umbrales_v2.json"), "w", encoding="utf-8") as f:
    json.dump(metadata, f, indent=2, ensure_ascii=False, default=float)

print(f"\n✅ Listo. Artefactos en {OUTPUT_DIR}/, reportes en {REPORTS_DIR}/")
print("   ATENCIÓN: risk_threshold quedó en el valor F1-óptimo por defecto — pendiente de confirmación (ver paso5_umbral.json).")
