from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from .. import schemas, models
from ..dependencies import get_current_user
from ..database import get_db
router = APIRouter()

@router.post("/", response_model=schemas.PatientResponse)
def create_patient(patient: schemas.PatientCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    new_patient = models.Patient(
        nombre_completo=patient.nombre,
        edad=patient.edad,
        sexo=patient.sexo,
        telefono =patient.telefono,
        doctor_id = current_user.id
    )
    db.add(new_patient)
    db.commit()
    db.refresh(new_patient)
    return new_patient

@router.get("/", response_model=List[schemas.PatientResponse])
def get_patients(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    patients = db.query(models.Patient).filter(models.Patient.doctor_id == current_user.id).offset(skip).limit(limit).all()
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

