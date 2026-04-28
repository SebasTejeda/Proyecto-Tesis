from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date

# ==========================================
# SCHEMAS DE PACIENTES
# ==========================================
class PatientBase(BaseModel):
    nombre_completo: str
    fecha_nacimiento: date  # Cambiado de edad (int) a fecha_nacimiento (date)
    sexo: str
    telefono: Optional[str] = None

class PatientCreate(PatientBase):
    pass

class PatientResponse(PatientBase):
    id: int
    doctor_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# SCHEMAS DE SÍNTOMAS (PHQ-9)
# ==========================================
class PHQ9SymptomsBase(BaseModel):
    interes_poco_placer: int
    desanimado_deprimido: int
    dificultad_dormir: int
    sentirse_cansado: int
    poco_apetito: int
    sentirse_mal_consigo_mismo: int
    dificultad_concentracion: int
    moverse_hablar_lento_rapido: int
    pensamientos_muerte: int

class PHQ9SymptomsCreate(PHQ9SymptomsBase):
    pass

class PHQ9SymptomsResponse(PHQ9SymptomsBase):
    id: int
    evaluation_id: int

    class Config:
        from_attributes = True


# ==========================================
# SCHEMAS DE DATA EXTRA (ENDES / Clínico)
# ==========================================
class ExtraDataPatientBase(BaseModel):
    estado_civil: Optional[str] = None
    nivel_educativo: Optional[str] = None
    peso: Optional[float] = None
    talla: Optional[float] = None
    imc: Optional[float] = None
    fuma_30_dias: Optional[str] = None
    bebe_30_dias: Optional[str] = None
    alcohol_dificultad_estudio: Optional[str] = None
    violencia_fisica_pareja: Optional[str] = None
    diagnostico_hipertension: Optional[str] = None
    diagnostico_diabetes: Optional[str] = None

class ExtraDataPatientCreate(ExtraDataPatientBase):
    pass

class ExtraDataPatientResponse(ExtraDataPatientBase):
    id: int
    evaluation_id: int

    class Config:
        from_attributes = True


# ==========================================
# SCHEMAS DE EVALUACIÓN GENERAL
# ==========================================
class EvaluationBase(BaseModel):
    patient_id: int

class EvaluationCreate(EvaluationBase):
    # Aquí anidamos los schemas para que Angular envíe todo en una sola petición POST
    symptoms: PHQ9SymptomsCreate
    extra_data: ExtraDataPatientCreate

class EvaluationResponse(EvaluationBase):
    id: int
    fecha: datetime
    phq9_puntaje: int
    resultado: str
    ia_feedback: Optional[str] = None
    notas_doctor: Optional[str] = None
    status: str
    
    # Anidamos las respuestas para que al pedir el historial, venga todo junto
    symptoms: Optional[PHQ9SymptomsResponse] = None
    extra_data: Optional[ExtraDataPatientResponse] = None

    class Config:
        from_attributes = True