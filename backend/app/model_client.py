"""
model_client.py
Cliente HTTP que el backend (puerto 8000) usa para llamar
al servidor del modelo (puerto 8001).

Ubicación: backend/app/model_client.py
"""

import os
import httpx
from typing import Optional

MODEL_URL = os.getenv("MODEL_API_URL", "http://localhost:8001")


class ModelAPIError(Exception):
    """Se lanza cuando el servidor del modelo devuelve un error."""
    pass


async def predecir(features: dict) -> dict:
    """
    Envía las features al servidor del modelo y devuelve el resultado.

    Parámetros:
        features: dict con los 11 campos (incluyendo genero ya mapeado)

    Retorna:
        dict con risk_binary, risk_probability, severity,
        severity_probability, shap_values y recommendations

    Lanza:
        ModelAPIError si el servidor del modelo no responde o devuelve error
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{MODEL_URL}/predecir",
                json=features
            )
            response.raise_for_status()
            return response.json()

    except httpx.TimeoutException:
        raise ModelAPIError("El servidor del modelo no respondió a tiempo (timeout 30s)")
    except httpx.ConnectError:
        raise ModelAPIError("No se pudo conectar al servidor del modelo. ¿Está corriendo en el puerto 8001?")
    except httpx.HTTPStatusError as e:
        raise ModelAPIError(f"Error del servidor del modelo: {e.response.status_code} — {e.response.text}")


async def health_check() -> bool:
    """Verifica que el servidor del modelo esté vivo."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{MODEL_URL}/health")
            return response.status_code == 200
    except Exception:
        return False