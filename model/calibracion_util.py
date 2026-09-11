"""
calibracion_util.py
Utilidades de calibración compartidas entre pipeline_v2_real.py (entrena y
exporta) y predict_v2.py (carga y predice). Deben vivir en un módulo propio
(no como closures/lambdas) para que joblib pueda serializar y deserializar
el modelo calibrado.
"""

import numpy as np


def aplicar_calibrador(calibrador, metodo, prob_cruda):
    prob_cruda = np.asarray(prob_cruda)
    if metodo == "sigmoid":
        return calibrador.predict_proba(prob_cruda.reshape(-1, 1))[:, 1]
    return calibrador.predict(prob_cruda)  # isotonic


class ModeloCalibrado:
    """Envuelve un clasificador ya entrenado + un calibrador ajustado sobre
    probabilidades out-of-fold (ver pipeline_v2_real.calibracion_cruzada)."""

    def __init__(self, modelo_base, calibrador, metodo):
        self.modelo_base = modelo_base
        self.calibrador = calibrador
        self.metodo = metodo

    def predict_proba(self, X):
        prob_cruda = self.modelo_base.predict_proba(X)[:, 1]
        prob_cal = aplicar_calibrador(self.calibrador, self.metodo, prob_cruda)
        prob_cal = np.clip(prob_cal, 0.0, 1.0)
        return np.column_stack([1 - prob_cal, prob_cal])
