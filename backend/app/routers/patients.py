from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from .. import schemas, models
from ..dependencies import get_current_user
from ..database import get_db

router = APIRouter()

@router.post("/", response_model=schemas.PatientResponse, status_code=status.HTTP_201_CREATED)
def create_patient(
    patient: schemas.PatientCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """Crea un nuevo paciente vinculado al doctor autenticado."""
    new_patient = models.Patient(
        nombre_completo=patient.nombre_completo,
        fecha_nacimiento=patient.fecha_nacimiento,
        sexo=patient.sexo,
        telefono=patient.telefono,
        dni=patient.dni,
        doctor_id=current_user.id
    )
    
    try:
        db.add(new_patient)
        db.commit()
        db.refresh(new_patient)
        return new_patient
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al registrar paciente: {str(e)}")

@router.get("/", response_model=List[schemas.PatientResponse])
def get_patients(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """Retorna la lista de pacientes del doctor actual."""
    patients = db.query(models.Patient).filter(
        models.Patient.doctor_id == current_user.id
    ).order_by(models.Patient.created_at.desc()).offset(skip).limit(limit).all()
    
    return patients

@router.get("/{patient_id}", response_model=schemas.PatientResponse)
def get_patient(
    patient_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """Obtiene los detalles de un paciente específico asegurando que pertenezca al doctor actual."""
    patient = db.query(models.Patient).filter(
        models.Patient.id == patient_id,
        models.Patient.doctor_id == current_user.id
    ).first()
    
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado o acceso denegado")
    
    return patient

@router.put("/{patient_id}", response_model=schemas.PatientResponse)
def update_patient(
    patient_id: int, 
    patient_data: schemas.PatientCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """Actualiza la información de un paciente."""
    patient = db.query(models.Patient).filter(
        models.Patient.id == patient_id,
        models.Patient.doctor_id == current_user.id
    ).first()
    
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado o acceso denegado")
    
    # Actualizamos los campos
    patient.nombre_completo = patient_data.nombre_completo
    patient.fecha_nacimiento = patient_data.fecha_nacimiento
    patient.sexo = patient_data.sexo
    patient.telefono = patient_data.telefono
    patient.dni = patient_data.dni
    try:
        db.commit()
        db.refresh(patient)
        return patient
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar: {str(e)}")
