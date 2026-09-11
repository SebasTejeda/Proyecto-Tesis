from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload, aliased
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from ..database import get_db
from ..dependencies import get_current_user
from .. import models, schemas
from ..model_client import predecir as modelo_predecir, ModelAPIError

router = APIRouter()

# Versión actual del modelo — cambiar cuando tu compañero reentrane
MODEL_VERSION = "v1.0"


# ── Schema historial ──────────────────────────────────────────────────────────

class EjecucionModeloResponse(BaseModel):
    evaluation_id: int
    fecha: datetime
    paciente_nombre: str
    paciente_dni: str
    doctor_nombre: str
    modelo: str
    model_version: str
    resultado: Optional[str]
    risk_probability: Optional[float]
    doctor_agreement: Optional[str]
    disagreement_reason: Optional[str]
    status: str

    class Config:
        from_attributes = True


# ── Crear evaluación ──────────────────────────────────────────────────────────

@router.post("/", response_model=schemas.EvaluationResponse, status_code=status.HTTP_201_CREATED)
async def create_evaluation(
    eval_data: schemas.EvaluationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role == "Admin":
        raise HTTPException(status_code=403, detail="Los administradores no pueden crear evaluaciones.")

    patient = db.query(models.Patient).filter(
        models.Patient.id == eval_data.patient_id,
        models.Patient.doctor_id == current_user.id
    ).first()

    if not patient:
        raise HTTPException(status_code=403, detail="Paciente no autorizado o no encontrado")

    genero_map = {"Masculino": 1, "Femenino": 2}
    genero_numerico = genero_map.get(patient.sexo, 1)

    try:
        new_eval = models.Evaluation(
            patient_id=eval_data.patient_id,
            doctor_id=current_user.id,
            doctor_notes=eval_data.doctor_notes,
            model_version=MODEL_VERSION,
            status="Procesando"
        )

        features_data = eval_data.model_features.model_dump()
        features_data["genero"] = genero_numerico
        new_eval.model_features = models.ModelFeatures(**features_data)

        try:
            resultado = await modelo_predecir(features_data)
        except ModelAPIError as e:
            db.add(new_eval)
            db.commit()
            db.refresh(new_eval)
            raise HTTPException(
                status_code=503,
                detail=f"Evaluación guardada pero el modelo no está disponible: {str(e)}"
            )

        new_eval.model_prediction = models.ModelPrediction(
            risk_binary=resultado["risk_binary"],
            risk_probability=resultado["risk_probability"],
            severity=resultado["severity"],
            severity_probability=resultado.get("severity_probability"),
            shap_values=resultado["shap_values"],
        )
        new_eval.recommendations = [
            models.Recommendation(
                source_variable=r["source_variable"],
                alert_level=r["alert_level"],
                recommendation=r["recommendation"],
                priority=r["priority"],
            )
            for r in resultado.get("recommendations", [])
        ]
        new_eval.status = "Completado"
        db.add(new_eval)
        db.commit()
        db.refresh(new_eval)
        return new_eval

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar evaluación: {str(e)}")


# ── Conformidad del doctor ────────────────────────────────────────────────────

@router.patch("/{evaluation_id}/agreement", response_model=schemas.EvaluationResponse)
def update_doctor_agreement(
    evaluation_id: int,
    data: schemas.DoctorAgreementUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if data.doctor_agreement not in ("confirmed", "rejected"):
        raise HTTPException(status_code=400, detail="Valor inválido. Use 'confirmed' o 'rejected'.")

    if data.doctor_agreement == "rejected" and not data.disagreement_reason:
        raise HTTPException(status_code=400, detail="Debe indicar la razón de desacuerdo.")

    if data.doctor_agreement == "rejected" and not data.doctor_severity_judgment:
        raise HTTPException(status_code=422, detail="Debe indicar la clasificación de riesgo real del paciente.")

    evaluation = db.query(models.Evaluation).join(models.Patient).filter(
        models.Evaluation.id == evaluation_id,
        models.Patient.doctor_id == current_user.id
    ).first()

    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada o acceso denegado")

    evaluation.doctor_agreement = data.doctor_agreement
    if data.doctor_agreement == "rejected":
        evaluation.disagreement_reason = data.disagreement_reason
        evaluation.doctor_severity_judgment = data.doctor_severity_judgment
    else:
        evaluation.disagreement_reason = None
        evaluation.doctor_severity_judgment = (
            evaluation.model_prediction.severity if evaluation.model_prediction else None
        )
    db.commit()
    db.refresh(evaluation)
    return evaluation


# ── Confiabilidad del modelo (Kappa de Cohen) ─────────────────────────────────

SEVERITY_LEVELS = ["Ninguno", "Leve", "Moderado/Alto"]

KAPPA_INTERPRETACION = [
    (0.00, "Sin acuerdo"),
    (0.20, "Insignificante"),
    (0.40, "Aceptable"),
    (0.60, "Moderado"),
    (0.80, "Sustancial"),
    (1.00, "Casi perfecto"),
]


def interpretar_kappa(kappa: Optional[float]) -> str:
    if kappa is None:
        return "Sin datos suficientes"
    if kappa < 0:
        return "Sin acuerdo"
    for limite, etiqueta in KAPPA_INTERPRETACION:
        if kappa <= limite:
            return etiqueta
    return "Casi perfecto"


def calcular_kappa(y1: list, y2: list, categorias: list) -> dict:
    n = len(y1)
    if n == 0:
        return {"kappa": None, "n": 0, "matriz_confusion": {}}

    matriz = {c1: {c2: 0 for c2 in categorias} for c1 in categorias}
    for a, b in zip(y1, y2):
        matriz[a][b] += 1

    p_o = sum(matriz[c][c] for c in categorias) / n

    marg_modelo = {c: sum(matriz[c].values()) / n for c in categorias}
    marg_especialista = {c: sum(matriz[c1][c] for c1 in categorias) / n for c in categorias}
    p_e = sum(marg_modelo[c] * marg_especialista[c] for c in categorias)

    kappa = (p_o - p_e) / (1 - p_e) if p_e != 1 else 1.0

    return {
        "kappa": round(kappa, 4),
        "n": n,
        "acuerdo_observado": round(p_o, 4),
        "acuerdo_esperado_azar": round(p_e, 4),
        "matriz_confusion": matriz,
    }


@router.get("/metrics/kappa", summary="Confiabilidad del modelo (Kappa de Cohen)")
def get_kappa_confiabilidad(
    model_version: str = "v1.0",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Compara la clasificación del modelo contra el juicio real del especialista
    usando el Kappa de Cohen. Admin ve todas las evaluaciones; el resto ve
    solo las suyas.

    - model_version="v1.0" (default): evaluaciones "en vivo". El juicio del
      especialista (doctor_severity_judgment) vive en el mismo registro que
      la predicción del modelo.
    - cualquier otro tag (ej. "v2.1", "v2.0-threshold-only"): revalidaciones
      retrospectivas. La predicción vive en el registro nuevo; el juicio del
      especialista (ground truth) NO se duplicó ahí — se lee del registro
      original vía original_evaluation_id.

    Nota: esto ya no filtra por Patient.origen. El juicio del especialista
    (doctor_agreement / doctor_severity_judgment) registrado sobre v1.0 se
    trata como ground truth válido para esta métrica independientemente del
    origen del paciente asociado.
    """
    if model_version != "v1.0":
        Original = aliased(models.Evaluation)
        query = (
            db.query(models.Evaluation, models.ModelPrediction, Original)
            .join(models.ModelPrediction, models.ModelPrediction.evaluation_id == models.Evaluation.id)
            .join(Original, models.Evaluation.original_evaluation_id == Original.id)
            .filter(
                models.Evaluation.model_version == model_version,
                models.ModelPrediction.severity.isnot(None),
                Original.doctor_severity_judgment.isnot(None),
            )
        )
        if current_user.role != "Admin":
            query = query.filter(models.Evaluation.doctor_id == current_user.id)

        filas = query.all()
        y_modelo = [prediccion.severity for _, prediccion, _ in filas]
        y_especialista = [original.doctor_severity_judgment for _, _, original in filas]
    else:
        query = (
            db.query(models.Evaluation)
            .join(models.ModelPrediction)
            .filter(
                models.Evaluation.doctor_agreement.isnot(None),
                models.ModelPrediction.severity.isnot(None),
                models.Evaluation.doctor_severity_judgment.isnot(None),
                models.Evaluation.model_version == model_version,
            )
        )

        if current_user.role != "Admin":
            query = query.filter(models.Evaluation.doctor_id == current_user.id)

        evaluaciones = query.all()
        y_modelo = [ev.model_prediction.severity for ev in evaluaciones]
        y_especialista = [ev.doctor_severity_judgment for ev in evaluaciones]

    resultado = calcular_kappa(y_modelo, y_especialista, SEVERITY_LEVELS)
    resultado["interpretacion"] = interpretar_kappa(resultado["kappa"])
    resultado["model_version"] = model_version
    return resultado


# ── Historial del doctor (propio) ─────────────────────────────────────────────

@router.get("/historial", response_model=List[EjecucionModeloResponse])
def get_historial_ejecuciones(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Doctor: ve solo sus propias ejecuciones."""
    evaluaciones = db.query(models.Evaluation).options(
        joinedload(models.Evaluation.patient),
        joinedload(models.Evaluation.model_prediction)
    ).filter(
        models.Evaluation.doctor_id == current_user.id,
        models.Evaluation.status == "Completado"
    ).order_by(models.Evaluation.date.desc()).all()

    return _build_historial(evaluaciones, db)


# ── Historial admin (todos los doctores) ──────────────────────────────────────

@router.get("/admin/historial", response_model=List[EjecucionModeloResponse])
def get_historial_admin(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Admin: ve todas las ejecuciones de todos los doctores."""
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder.")

    evaluaciones = db.query(models.Evaluation).options(
        joinedload(models.Evaluation.patient),
        joinedload(models.Evaluation.model_prediction),
        joinedload(models.Evaluation.doctor)
    ).filter(
        models.Evaluation.status == "Completado"
    ).order_by(models.Evaluation.date.desc()).all()

    return _build_historial(evaluaciones, db)


def _build_historial(evaluaciones, db) -> list:
    resultado = []
    for ev in evaluaciones:
        doctor = db.query(models.User).filter(models.User.id == ev.doctor_id).first()
        doctor_nombre = f"Dr/a. {doctor.nombres} {doctor.apellidos}" if doctor else "Desconocido"
        resultado.append(EjecucionModeloResponse(
            evaluation_id     = ev.id,
            fecha             = ev.date,
            paciente_nombre   = ev.patient.nombre_completo if ev.patient else "Desconocido",
            paciente_dni      = ev.patient.dni if ev.patient else "--",
            doctor_nombre     = doctor_nombre,
            modelo            = "XGBoost + SHAP",
            model_version     = ev.model_version or "v1.0",
            resultado         = ev.model_prediction.severity if ev.model_prediction else None,
            risk_probability  = ev.model_prediction.risk_probability if ev.model_prediction else None,
            doctor_agreement  = ev.doctor_agreement,
            disagreement_reason = ev.disagreement_reason,
            status            = ev.status,
        ))
    return resultado


# ── Endpoints estándar ────────────────────────────────────────────────────────

@router.get("/patient/{patient_id}", response_model=List[schemas.EvaluationResponse])
def get_patient_evaluations(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    patient = db.query(models.Patient).filter(
        models.Patient.id == patient_id,
        models.Patient.doctor_id == current_user.id
    ).first()
    if not patient:
        raise HTTPException(status_code=403, detail="Paciente no autorizado")

    return db.query(models.Evaluation).options(
        joinedload(models.Evaluation.model_features),
        joinedload(models.Evaluation.model_prediction),
        joinedload(models.Evaluation.recommendations)
    ).filter(
        models.Evaluation.patient_id == patient_id
    ).order_by(models.Evaluation.date.desc()).all()


@router.get("/{evaluation_id}", response_model=schemas.EvaluationResponse)
def get_evaluation(
    evaluation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    evaluation = db.query(models.Evaluation).options(
        joinedload(models.Evaluation.model_features),
        joinedload(models.Evaluation.model_prediction),
        joinedload(models.Evaluation.recommendations)
    ).join(models.Patient).filter(
        models.Evaluation.id == evaluation_id,
        models.Patient.doctor_id == current_user.id
    ).first()

    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada o acceso denegado")
    return evaluation