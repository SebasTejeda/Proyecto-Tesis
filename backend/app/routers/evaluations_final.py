from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List

from ..database import get_db
from ..dependencies import get_current_user
from .. import models, schemas
from ..model_client import predecir as modelo_predecir, ModelAPIError

router = APIRouter()


@router.post("/", response_model=schemas.EvaluationResponse, status_code=status.HTTP_201_CREATED)
async def create_evaluation(
    eval_data: schemas.EvaluationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
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
            doctor_id=current_user.id,  # trazabilidad US007
            doctor_notes=eval_data.doctor_notes,
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


@router.patch("/{evaluation_id}/agreement", response_model=schemas.EvaluationResponse)
def update_doctor_agreement(
    evaluation_id: int,
    data: schemas.DoctorAgreementUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """US007 — El doctor confirma o rechaza la predicción del modelo."""
    if data.doctor_agreement not in ("confirmed", "rejected"):
        raise HTTPException(status_code=400, detail="Valor inválido. Use 'confirmed' o 'rejected'.")

    evaluation = db.query(models.Evaluation).join(models.Patient).filter(
        models.Evaluation.id == evaluation_id,
        models.Patient.doctor_id == current_user.id
    ).first()

    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada o acceso denegado")

    evaluation.doctor_agreement = data.doctor_agreement
    db.commit()
    db.refresh(evaluation)
    return evaluation


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

    evaluations = db.query(models.Evaluation).options(
        joinedload(models.Evaluation.model_features),
        joinedload(models.Evaluation.model_prediction),
        joinedload(models.Evaluation.recommendations)
    ).filter(
        models.Evaluation.patient_id == patient_id
    ).order_by(models.Evaluation.date.desc()).all()

    return evaluations


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