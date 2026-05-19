"""
main.py — Servidor FastAPI del modelo NeuroMind AI
Puerto: 8001

Ejecutar con:
    uvicorn main:app --host 0.0.0.0 --port 8001 --reload
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import logging

from xgboost_service import get_xgboost_service

# ── Logger ────────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("neuromind-model")

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="NeuroMind AI — Modelo Predictivo",
    description="Servidor de inferencia XGBoost + SHAP para predicción de riesgo depresivo",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000"],  # Solo el backend puede llamarlo
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ── Cargar modelos al arrancar ────────────────────────────────────────────────
@app.on_event("startup")
def cargar_modelos():
    logger.info("Cargando modelos XGBoost...")
    get_xgboost_service()  # Instancia el singleton una sola vez
    logger.info("Modelos cargados correctamente ✅")


# ── Schemas de entrada/salida ─────────────────────────────────────────────────

class ModelFeaturesInput(BaseModel):
    horas_sueno:          float
    vida_social:          int
    frecuencia_ejercicio: int
    redes_sociales:       float
    nivel_estres:         int
    calidad_sueno:        int
    soledad_percibida:    int
    apoyo_familiar:       int
    autoestima:           int
    estado_civil:         int
    genero:               int   # 1=Masculino, 2=Femenino — enviado por el backend


class RecomendacionOutput(BaseModel):
    source_variable: str
    alert_level:     str
    recommendation:  str
    priority:        int


class PredictionOutput(BaseModel):
    risk_binary:          int
    risk_probability:     float
    severity:             str
    severity_probability: Optional[float]
    shap_values:          dict
    recommendations:      list[RecomendacionOutput]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "mensaje": "Servidor del modelo NeuroMind AI operativo"}


@app.get("/health")
def health():
    """El backend puede hacer ping aquí para verificar que el modelo está vivo."""
    return {"status": "healthy"}


@app.post("/predecir", response_model=PredictionOutput)
def predecir(features: ModelFeaturesInput):
    """
    Recibe las features del paciente y devuelve:
    - Predicción binaria de riesgo
    - Probabilidad de riesgo
    - Severidad (Ninguno / Leve / Moderado-Alto)
    - Probabilidad de severidad
    - SHAP values por feature
    - Recomendaciones clínicas priorizadas
    """
    try:
        service = get_xgboost_service()
        resultado = service.predecir(features.model_dump())

        return PredictionOutput(
            risk_binary          = resultado.risk_binary,
            risk_probability     = resultado.risk_probability,
            severity             = resultado.severity,
            severity_probability = resultado.severity_probability,
            shap_values          = resultado.shap_values,
            recommendations      = [
                RecomendacionOutput(
                    source_variable = r["source_variable"],
                    alert_level     = r["alert_level"],
                    recommendation  = r["recommendation"],
                    priority        = r["priority"],
                )
                for r in resultado.recommendations
            ]
        )

    except Exception as e:
        logger.error(f"Error en predicción: {e}")
        raise HTTPException(status_code=500, detail=f"Error en el modelo: {str(e)}")