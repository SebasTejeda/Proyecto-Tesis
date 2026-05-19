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
    """
    Crea una evaluación y llama al servidor del modelo (puerto 8001)
    para obtener la predicción XGBoost + SHAP + recomendaciones.
    """

    # 1. Verificar que el paciente pertenezca al doctor
    patient = db.query(models.Patient).filter(
        models.Patient.id == eval_data.patient_id,
        models.Patient.doctor_id == current_user.id
    ).first()

    if not patient:
        raise HTTPException(status_code=403, detail="Paciente no autorizado o no encontrado")

    # 2. Mapear sexo → género numérico del dataset
    genero_map = {"Masculino": 1, "Femenino": 2}
    genero_numerico = genero_map.get(patient.sexo, 1)

    try:
        # 3. Cabecera de la evaluación
        new_eval = models.Evaluation(
            patient_id   = eval_data.patient_id,
            doctor_notes = eval_data.doctor_notes,
            status       = "Procesando"
        )

        # 4. Guardar features incluyendo género del paciente
        features_data = eval_data.model_features.model_dump()
        features_data["genero"] = genero_numerico
        new_eval.model_features = models.ModelFeatures(**features_data)

        # 5. Llamar al servidor del modelo
        try:
            resultado = await modelo_predecir(features_data)
        except ModelAPIError as e:
            # Si el modelo no está disponible guardamos igual con status Pendiente
            db.add(new_eval)
            db.commit()
            db.refresh(new_eval)
            raise HTTPException(
                status_code=503,
                detail=f"Evaluación guardada pero el modelo no está disponible: {str(e)}"
            )

        # 6. Guardar predicción
        new_eval.model_prediction = models.ModelPrediction(
            risk_binary          = resultado["risk_binary"],
            risk_probability     = resultado["risk_probability"],
            severity             = resultado["severity"],
            severity_probability = resultado.get("severity_probability"),
            shap_values          = resultado["shap_values"],
        )

        # 7. Guardar recomendaciones
        new_eval.recommendations = [
            models.Recommendation(
                source_variable = r["source_variable"],
                alert_level     = r["alert_level"],
                recommendation  = r["recommendation"],
                priority        = r["priority"],
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