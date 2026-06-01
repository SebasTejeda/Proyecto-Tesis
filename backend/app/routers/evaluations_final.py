from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
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

    evaluation = db.query(models.Evaluation).join(models.Patient).filter(
        models.Evaluation.id == evaluation_id,
        models.Patient.doctor_id == current_user.id
    ).first()

    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada o acceso denegado")

    evaluation.doctor_agreement = data.doctor_agreement
    evaluation.disagreement_reason = data.disagreement_reason if data.doctor_agreement == "rejected" else None
    db.commit()
    db.refresh(evaluation)
    return evaluation


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