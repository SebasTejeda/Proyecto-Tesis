"""
xgboost_service.py
Servicio de predicción con XGBoost + SHAP nativo para NeuroMind AI.

Flujo:
  1. Modelo binario   → ¿tiene riesgo depresivo? (0/1) + probabilidad
  2. Modelo severidad → si hay riesgo, ¿qué tan severo? (Leve / Moderado-Alto)
  3. SHAP nativo      → XGBoost calcula los SHAP values internamente
                        sin necesitar la librería shap instalada
  4. Recomendaciones  → generadas automáticamente desde los SHAP values más altos
"""

import os
import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from dataclasses import dataclass, field
from typing import Optional


# ── Etiquetas de severidad ────────────────────────────────────────────────────

SEVERITY_MAP = {
    (0, None): "Ninguno",
    (1, 0):    "Leve",
    (1, 1):    "Moderado/Alto",
}

# Etiquetas legibles para el frontend y el PDF
FEATURE_LABELS = {
    "horas_sueno":          "Horas de sueño",
    "vida_social":          "Vida social",
    "frecuencia_ejercicio": "Frecuencia de ejercicio",
    "redes_sociales":       "Horas en redes sociales",
    "nivel_estres":         "Nivel de estrés",
    "calidad_sueno":        "Calidad del sueño",
    "soledad_percibida":    "Soledad percibida",
    "apoyo_familiar":       "Apoyo familiar",
    "autoestima":           "Autoestima",
    "genero_2":             "Género",
    "estado_civil_1":       "Estado civil: Casado",
    "estado_civil_2":       "Estado civil: Conviviente",
    "estado_civil_3":       "Estado civil: Divorciado",
    "estado_civil_4":       "Estado civil: Viudo",
    "estado_civil_5":       "Estado civil: Otro",
}

# Recomendaciones clínicas por feature
RECOMENDACIONES_BASE = {
    "horas_sueno": {
        "alert_level": "alto",
        "recommendation": (
            "El paciente presenta un patrón de sueño insuficiente que está contribuyendo "
            "al riesgo depresivo. Se recomienda establecer una rutina de sueño con horarios "
            "regulares, limitar el uso de pantallas 1 hora antes de dormir y evaluar posibles "
            "trastornos del sueño subyacentes."
        ),
    },
    "vida_social": {
        "alert_level": "alto",
        "recommendation": (
            "El aislamiento social identificado es un factor de riesgo significativo. "
            "Se sugiere promover actividades grupales, integración a comunidades de interés "
            "y fortalecer vínculos con familiares y amigos cercanos."
        ),
    },
    "nivel_estres": {
        "alert_level": "alto",
        "recommendation": (
            "El nivel de estrés elevado está impactando negativamente en el estado emocional. "
            "Se recomienda explorar técnicas de manejo del estrés como mindfulness, "
            "actividad física regular y, de ser necesario, derivación a psicoterapia."
        ),
    },
    "calidad_sueno": {
        "alert_level": "medio",
        "recommendation": (
            "La mala calidad del sueño está asociada al deterioro del estado de ánimo. "
            "Se sugiere implementar higiene del sueño: ambiente oscuro y fresco, evitar "
            "siestas prolongadas y reducir el consumo de cafeína después del mediodía."
        ),
    },
    "soledad_percibida": {
        "alert_level": "alto",
        "recommendation": (
            "La percepción de soledad frecuente es un predictor importante de depresión. "
            "Se recomienda evaluar la red de soporte social del paciente y considerar "
            "intervenciones psicosociales orientadas a reducir el aislamiento subjetivo."
        ),
    },
    "apoyo_familiar": {
        "alert_level": "medio",
        "recommendation": (
            "El bajo apoyo familiar percibido reduce la resiliencia ante situaciones de estrés. "
            "Se sugiere involucrar a la familia en el proceso terapéutico y explorar "
            "recursos de apoyo comunitario disponibles."
        ),
    },
    "autoestima": {
        "alert_level": "medio",
        "recommendation": (
            "La baja autoestima identificada puede perpetuar el ciclo depresivo. "
            "Se recomienda trabajar en terapia cognitivo-conductual para identificar "
            "y reestructurar creencias negativas sobre sí mismo."
        ),
    },
    "redes_sociales": {
        "alert_level": "bajo",
        "recommendation": (
            "El uso elevado de redes sociales se asocia a mayor exposición a contenido "
            "negativo y comparación social. Se sugiere establecer límites de tiempo en "
            "pantalla y fomentar actividades offline de bienestar."
        ),
    },
    "frecuencia_ejercicio": {
        "alert_level": "bajo",
        "recommendation": (
            "La escasa actividad física está relacionada con peores indicadores de salud mental. "
            "Se recomienda incorporar al menos 30 minutos de ejercicio moderado 3 veces "
            "por semana como parte del plan de intervención."
        ),
    },
}


# ── Dataclass de resultado ────────────────────────────────────────────────────

@dataclass
class PredictionResult:
    risk_binary:          int
    risk_probability:     float
    severity:             str
    severity_probability: Optional[float]
    shap_values:          dict
    recommendations:      list = field(default_factory=list)


# ── Servicio principal ────────────────────────────────────────────────────────

class XGBoostService:

    MODELS_DIR = os.path.join(os.path.dirname(__file__), "ml_models")

    def __init__(self):
        self.modelo_binario     = joblib.load(os.path.join(self.MODELS_DIR, "modelo_binario.pkl"))
        self.modelo_severidad   = joblib.load(os.path.join(self.MODELS_DIR, "modelo_severidad.pkl"))
        self.columnas_binario   = joblib.load(os.path.join(self.MODELS_DIR, "columnas_binario.pkl"))
        self.columnas_severidad = joblib.load(os.path.join(self.MODELS_DIR, "columnas_severidad.pkl"))

    # ── Preparación de features ───────────────────────────────────────────────

    def _preparar(self, features: dict, columnas: list) -> pd.DataFrame:
        df = pd.DataFrame([features])
        df = pd.get_dummies(df, columns=["genero", "estado_civil"], drop_first=True)
        df = df.reindex(columns=columnas, fill_value=0)
        return df

    # ── SHAP nativo de XGBoost ────────────────────────────────────────────────

    def _calcular_shap(self, modelo, X: pd.DataFrame) -> dict:
        """
        Usa pred_contribs=True de XGBoost — calcula SHAP values
        sin necesitar la librería shap instalada.
        La última columna del resultado es el bias (intercepto) — la excluimos.
        """
        dmatrix = xgb.DMatrix(X)
        contribuciones = modelo.get_booster().predict(dmatrix, pred_contribs=True)

        # contribuciones tiene shape (1, n_features + 1)
        # la última columna es el bias — la excluimos
        valores = contribuciones[0][:-1]

        return {
            col: float(round(float(v), 4))
            for col, v in zip(X.columns, valores)
        }

    # ── Recomendaciones desde SHAP ────────────────────────────────────────────

    def _generar_recomendaciones(
        self,
        shap_dict: dict,
        umbral: float = 0.03,
        max_recomendaciones: int = 4
    ) -> list:
        """
        Genera recomendaciones a partir de los SHAP values.
        Solo considera features con SHAP positivo > umbral
        (features que aumentan el riesgo).
        Ordena por impacto descendente → mayor prioridad primero.
        """
        # Mapear features con one-hot de vuelta a su nombre base
        # ej: "estado_civil_1" → "estado_civil" no tiene recomendación base
        # pero "nivel_estres" sí — filtramos directamente
        features_riesgo = {
            feat: val for feat, val in shap_dict.items()
            if val > umbral and feat in RECOMENDACIONES_BASE
        }

        features_ordenadas = sorted(
            features_riesgo.items(),
            key=lambda x: x[1],
            reverse=True
        )[:max_recomendaciones]

        recomendaciones = []
        for priority, (feature, shap_val) in enumerate(features_ordenadas, start=1):
            rec = RECOMENDACIONES_BASE[feature]
            recomendaciones.append({
                "source_variable": feature,
                "alert_level":     rec["alert_level"],
                "recommendation":  rec["recommendation"],
                "priority":        priority,
            })

        return recomendaciones

    # ── Método principal ──────────────────────────────────────────────────────

    def predecir(self, features: dict) -> PredictionResult:
        """
        Recibe el dict de features del paciente y devuelve PredictionResult.

        Ejemplo de entrada:
        {
            "horas_sueno": 6.0, "vida_social": 1,
            "frecuencia_ejercicio": 1, "redes_sociales": 4.0,
            "nivel_estres": 4, "calidad_sueno": 2,
            "soledad_percibida": 3, "apoyo_familiar": 2,
            "autoestima": 2, "genero": 2, "estado_civil": 0
        }
        """

        # 1. Preparar features para modelo binario
        X_binario = self._preparar(features, self.columnas_binario)

        # 2. Predicción binaria
        prob_riesgo = float(self.modelo_binario.predict_proba(X_binario)[:, 1][0])
        riesgo_bin  = 1 if prob_riesgo >= 0.5 else 0

        # 3. SHAP del modelo binario (siempre)
        shap_binario = self._calcular_shap(self.modelo_binario, X_binario)

        # 4. Si hay riesgo → modelo de severidad
        prob_severidad = None
        severidad_bin  = None

        if riesgo_bin == 1:
            X_severidad    = self._preparar(features, self.columnas_severidad)
            prob_severidad = float(self.modelo_severidad.predict_proba(X_severidad)[:, 1][0])
            print(f'Probabilidad de severidad: {prob_severidad}')  # Debug
            severidad_bin  = 1 if prob_severidad >= 0.35 else 0

            # SHAP de severidad
            shap_severidad = self._calcular_shap(self.modelo_severidad, X_severidad)

            # Promedio de ambos SHAP para el gráfico final
            todas_features = set(shap_binario) | set(shap_severidad)
            shap_final = {
                f: round((shap_binario.get(f, 0) + shap_severidad.get(f, 0)) / 2, 4)
                for f in todas_features
            }
        else:
            shap_final = shap_binario

        # 5. Etiqueta de severidad
        severity_label = SEVERITY_MAP.get((riesgo_bin, severidad_bin), "Ninguno")

        # 6. Recomendaciones desde SHAP (solo si hay riesgo)
        recomendaciones = []
        if riesgo_bin == 1:
            recomendaciones = self._generar_recomendaciones(shap_final)

        return PredictionResult(
            risk_binary          = riesgo_bin,
            risk_probability     = round(prob_riesgo, 4),
            severity             = severity_label,
            severity_probability = round(prob_severidad, 4) if prob_severidad is not None else None,
            shap_values          = shap_final,
            recommendations      = recomendaciones,
        )


# ── Singleton ─────────────────────────────────────────────────────────────────

_service_instance: Optional[XGBoostService] = None

def get_xgboost_service() -> XGBoostService:
    global _service_instance
    if _service_instance is None:
        _service_instance = XGBoostService()
    return _service_instance