"""
predict_v2_threshold_only.py
[ITERACIÓN INTERMEDIA — conservada solo por trazabilidad histórica]
Predictor para el placeholder "v2.0-threshold-only": mismo modelo entrenado
que v1, solo con el umbral de decisión recalibrado. Reemplazado por el v2
real (ver entrenar_modelo_v2.py / predict_v2.py), que sí reentrena con
búsqueda de hiperparámetros, resampling y calibración de probabilidades.

No se usa en el servicio en vivo (xgboost_service.py / v1 no se tocan).
"""

import os
import json
import joblib
import pandas as pd
from dataclasses import dataclass
from typing import Optional

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "ml_models_v2_threshold_only")

# Misma semántica que SEVERITY_MAP en xgboost_service.py
SEVERITY_MAP = {
    (0, None): "Ninguno",
    (1, 0):    "Leve",
    (1, 1):    "Moderado/Alto",
}


@dataclass
class PredictionResultV2:
    risk_binary:          int
    risk_probability:     float
    severity:             str
    severity_probability: Optional[float]


class ModeloV2Predictor:

    def __init__(self):
        self.modelo_binario     = joblib.load(os.path.join(MODELS_DIR, "modelo_binario.pkl"))
        self.modelo_severidad   = joblib.load(os.path.join(MODELS_DIR, "modelo_severidad.pkl"))
        self.columnas_binario   = joblib.load(os.path.join(MODELS_DIR, "columnas_binario.pkl"))
        self.columnas_severidad = joblib.load(os.path.join(MODELS_DIR, "columnas_severidad.pkl"))

        with open(os.path.join(MODELS_DIR, "umbrales_v2.json"), encoding="utf-8") as f:
            umbrales = json.load(f)
        self.umbral_riesgo    = umbrales["risk_threshold"]
        self.umbral_severidad = umbrales["severity_threshold"]

    def _preparar(self, features: dict, columnas: list) -> pd.DataFrame:
        df = pd.DataFrame([features])
        df = pd.get_dummies(df, columns=["genero", "estado_civil"], drop_first=True)
        df = df.reindex(columns=columnas, fill_value=0)
        return df

    def predecir(self, features: dict) -> PredictionResultV2:
        X_binario = self._preparar(features, self.columnas_binario)
        prob_riesgo = float(self.modelo_binario.predict_proba(X_binario)[:, 1][0])
        riesgo_bin  = 1 if prob_riesgo >= self.umbral_riesgo else 0

        prob_severidad = None
        severidad_bin  = None
        if riesgo_bin == 1:
            X_severidad    = self._preparar(features, self.columnas_severidad)
            prob_severidad = float(self.modelo_severidad.predict_proba(X_severidad)[:, 1][0])
            severidad_bin  = 1 if prob_severidad >= self.umbral_severidad else 0

        severity_label = SEVERITY_MAP.get((riesgo_bin, severidad_bin), "Ninguno")

        return PredictionResultV2(
            risk_binary          = riesgo_bin,
            risk_probability     = round(prob_riesgo, 4),
            severity              = severity_label,
            severity_probability = round(prob_severidad, 4) if prob_severidad is not None else None,
        )


_instance: Optional[ModeloV2Predictor] = None

def get_modelo_v2() -> ModeloV2Predictor:
    global _instance
    if _instance is None:
        _instance = ModeloV2Predictor()
    return _instance
