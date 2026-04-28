from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
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
    """Crea una nueva evaluación basada en PHQ-9, calcula el riesgo y ejecuta el modelo de IA."""
    
    # 1. Seguridad: Verificar que el paciente exista y pertenezca a este doctor
    patient = db.query(models.Patient).filter(
        models.Patient.id == eval_data.patient_id,
        models.Patient.doctor_id == current_user.id
    ).first()
    
    if not patient:
        raise HTTPException(status_code=403, detail="Paciente no autorizado o no encontrado")

    # 2. Cálculo manual del PHQ-9 (Sumatoria de 0 a 27 puntos)
    puntaje = sum([
        eval_data.phq_1, eval_data.phq_2, eval_data.phq_3, 
        eval_data.phq_4, eval_data.phq_5, eval_data.phq_6, 
        eval_data.phq_7, eval_data.phq_8, eval_data.phq_9
    ])

    # 3. Clasificación clínica estándar
    if puntaje <= 4:
        riesgo = "Mínimo"
    elif puntaje <= 9:
        riesgo = "Leve"
    elif puntaje <= 14:
        riesgo = "Moderado"
    elif puntaje <= 19:
        riesgo = "Moderadamente Severo"
    else:
        riesgo = "Severo"

    # 4. TODO: Conexión con XGBoost y SHAP (Aquí se llamará al modelo)
    resultado_ia = "Inferencia pendiente"

    # 5. Guardar en Base de Datos
    new_eval = models.Evaluation(
        patient_id=eval_data.patient_id,
        phq_1=eval_data.phq_1, phq_2=eval_data.phq_2, phq_3=eval_data.phq_3,
        phq_4=eval_data.phq_4, phq_5=eval_data.phq_5, phq_6=eval_data.phq_6,
        phq_7=eval_data.phq_7, phq_8=eval_data.phq_8, phq_9=eval_data.phq_9,
        historial_familiar=eval_data.historial_familiar,
        puntaje_total=puntaje,
        nivel_riesgo=riesgo,
        resultado_ia=resultado_ia
    )
    
    db.add(new_eval)
    db.commit()
    db.refresh(new_eval)
    return new_eval


@router.get("/patient/{patient_id}", response_model=List[schemas.EvaluationResponse])
def get_patient_evaluations(
    patient_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retorna el historial completo de evaluaciones de un paciente específico."""
    
    # Seguridad de aislamiento (Tenant isolation)
    patient = db.query(models.Patient).filter(
        models.Patient.id == patient_id,
        models.Patient.doctor_id == current_user.id
    ).first()
    
    if not patient:
        raise HTTPException(status_code=403, detail="Paciente no autorizado")

    evaluations = db.query(models.Evaluation).filter(
        models.Evaluation.patient_id == patient_id
    ).order_by(models.Evaluation.fecha.desc()).all()
    
    return evaluations