from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List

from ..database import get_db
from ..dependencies import get_current_user
from .. import models, schemas

router = APIRouter()


@router.post("/", response_model=schemas.EvaluationResponse, status_code=status.HTTP_201_CREATED)
def create_evaluation(
    eval_data: schemas.EvaluationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Crea una nueva evaluación con sus features de entrada.
    La predicción del modelo (ModelPrediction) y las recomendaciones (Recommendation)
    se generan en un paso posterior cuando el modelo XGBoost esté integrado.
    """

    # 1. Verificar que el paciente pertenezca al doctor autenticado
    patient = db.query(models.Patient).filter(
        models.Patient.id == eval_data.patient_id,
        models.Patient.doctor_id == current_user.id
    ).first()

    if not patient:
        raise HTTPException(status_code=403, detail="Paciente no autorizado o no encontrado")

    try:
        # 2. Crear la cabecera de la evaluación
        new_eval = models.Evaluation(
            patient_id=eval_data.patient_id,
            doctor_notes=eval_data.doctor_notes,
            status="Pendiente"   # Pasa a "Completado" una vez que el modelo infiera
        )

        # 3. Guardar las features de entrada del modelo
        new_eval.model_features = models.ModelFeatures(
            **eval_data.model_features.model_dump()
        )

        # 4. TODO: Llamar al modelo XGBoost con las features y guardar ModelPrediction
        #    Ejemplo de integración futura:
        #
        #    prediction = xgboost_service.predict(eval_data.model_features)
        #
        #    new_eval.model_prediction = models.ModelPrediction(
        #        risk_binary=prediction.risk_binary,
        #        risk_probability=prediction.risk_probability,
        #        severity=prediction.severity,
        #        severity_probability=prediction.severity_probability,
        #        shap_values=prediction.shap_values
        #    )
        #
        #    new_eval.recommendations = [
        #        models.Recommendation(**r) for r in prediction.recommendations
        #    ]
        #
        #    new_eval.status = "Completado"

        db.add(new_eval)
        db.commit()
        db.refresh(new_eval)

        return new_eval

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar evaluación: {str(e)}")


@router.get("/patient/{patient_id}", response_model=List[schemas.EvaluationResponse])
def get_patient_evaluations(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retorna el historial completo de evaluaciones de un paciente, con features, predicción y recomendaciones."""

    # Verificar acceso
    patient = db.query(models.Patient).filter(
        models.Patient.id == patient_id,
        models.Patient.doctor_id == current_user.id
    ).first()

    if not patient:
        raise HTTPException(status_code=403, detail="Paciente no autorizado")

    # joinedload trae las 4 tablas relacionadas en una sola consulta SQL
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
    """Retorna el detalle completo de una evaluación específica."""

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