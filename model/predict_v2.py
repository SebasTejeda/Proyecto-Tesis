"""
predict_v2.py
Predictor de inferencia para el modelo v2 REAL (reentrenado: HPO + resampling
+ calibración condicional — ver pipeline_v2_real.py). Carga ml_models_v2/.

No se usa en el servicio en vivo (xgboost_service.py / v1 no se tocan) —
solo lo usa el script de revalidación retrospectiva.
"""

import os
import json
import joblib
import pandas as pd
from dataclasses import dataclass
from typing import Optional

from calibracion_util import ModeloCalibrado  # necesario para poder deserializar modelo_binario.pkl si está calibrado

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR  = os.path.join(BASE_DIR, "ml_models_v2")
MODELS_DIR_V1 = os.path.join(BASE_DIR, "ml_models")  # severidad: se reusa el artefacto real de v1, no un clon reentrenado

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
        self.columnas_binario   = joblib.load(os.path.join(MODELS_DIR, "columnas_binario.pkl"))
        # Severidad: se reusa el artefacto ORIGINAL de v1 (no una copia reentrenada) —
        # XGBoost con hist/multi-thread no es perfectamente determinista incluso con
        # random_state fijo; un "clon" reentrenado dio probabilidades distintas al
        # original en casos límite y eso cambiaba clasificaciones (ver evaluaciones
        # #191 y #203 en la revalidación de 60 casos). Cargar el .pkl real elimina
        # esa deriva por completo.
        self.modelo_severidad   = joblib.load(os.path.join(MODELS_DIR_V1, "modelo_severidad.pkl"))
        self.columnas_severidad = joblib.load(os.path.join(MODELS_DIR_V1, "columnas_severidad.pkl"))

        with open(os.path.join(MODELS_DIR, "umbrales_v2.json"), encoding="utf-8") as f:
            self.metadata = json.load(f)
        self.umbral_riesgo    = self.metadata["risk_threshold"]
        self.umbral_severidad = self.metadata["severity_threshold"]

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
            risk_binary=riesgo_bin,
            risk_probability=round(prob_riesgo, 4),
            severity=severity_label,
            severity_probability=round(prob_severidad, 4) if prob_severidad is not None else None,
        )


_instance: Optional[ModeloV2Predictor] = None

def get_modelo_v2() -> ModeloV2Predictor:
    global _instance
    if _instance is None:
        _instance = ModeloV2Predictor()
    return _instance
