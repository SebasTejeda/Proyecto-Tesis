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
    """Crea una nueva evaluación, separando síntomas y datos extra en tablas relacionales."""
    
    # 1. Seguridad: Verificar que el paciente exista y pertenezca a este doctor
    patient = db.query(models.Patient).filter(
        models.Patient.id == eval_data.patient_id,
        models.Patient.doctor_id == current_user.id
    ).first()
    
    if not patient:
        raise HTTPException(status_code=403, detail="Paciente no autorizado o no encontrado")

    # 2. Cálculo manual del PHQ-9 (Sumando los 9 síntomas del esquema anidado)
    s = eval_data.symptoms
    puntaje = sum([
        s.interes_poco_placer, s.desanimado_deprimido, s.dificultad_dormir,
        s.sentirse_cansado, s.poco_apetito, s.sentirse_mal_consigo_mismo,
        s.dificultad_concentracion, s.moverse_hablar_lento_rapido, s.pensamientos_muerte
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

    # 4. TODO: Conexión con XGBoost y SHAP (Aquí se llamará al modelo con eval_data.extra_data)
    feedback_ia = "Inferencia pendiente"

    # 5. Guardar en Base de Datos (Estructura Relacional)
    try:
        # Paso A: Crear la "Cabecera" de la evaluación
        new_eval = models.Evaluation(
            patient_id=eval_data.patient_id,
            phq9_puntaje=puntaje,
            resultado=riesgo,
            ia_feedback=feedback_ia,
            status="Completado"
        )
        
        # Paso B: Asignar los datos anidados usando las relaciones de SQLAlchemy.
        # NOTA: model_dump() es para Pydantic v2. Si usas v1, cámbialo por dict()
        new_eval.symptoms = models.PHQ9Symptoms(**eval_data.symptoms.model_dump())
        new_eval.extra_data = models.ExtraDataPatient(**eval_data.extra_data.model_dump())
        
        # Paso C: Guardar (SQLAlchemy es inteligente y guardará en las 3 tablas en orden correcto)
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
    """Retorna el historial completo, incluyendo la data relacional de síntomas y extras."""
    
    # Seguridad de aislamiento
    patient = db.query(models.Patient).filter(
        models.Patient.id == patient_id,
        models.Patient.doctor_id == current_user.id
    ).first()
    
    if not patient:
        raise HTTPException(status_code=403, detail="Paciente no autorizado")

    # Hacemos joinedload para traer las 3 tablas cruzadas en 1 sola consulta SQL (Optimización)
    evaluations = db.query(models.Evaluation).options(
        joinedload(models.Evaluation.symptoms),
        joinedload(models.Evaluation.extra_data)
    ).filter(
        models.Evaluation.patient_id == patient_id
    ).order_by(models.Evaluation.fecha.desc()).all()
    
    return evaluations