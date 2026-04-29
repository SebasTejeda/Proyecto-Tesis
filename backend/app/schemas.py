from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, date

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    role: str

class TokenData(BaseModel):
    email: Optional[str] = None
    
class GoogleLoginRequest(BaseModel):
    credential: str

class VerifyCodeRequest(BaseModel):
    email: EmailStr
    codigo: str

class EmailRequest(BaseModel): 
    email: EmailStr

class NewPasswordRequest(BaseModel): # <--- CAMBIA EL NOMBRE AQUÍ
    email: EmailStr
    codigo: str
    new_password: str

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str
    nombres: str
    apellidos: str
    codigo_colegiatura: Optional[str] = None

class UserResponse(UserBase):
    id: int
    role: str
    is_active: bool
    created_at: datetime
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    codigo_colegiatura: Optional[str] = None
    picture: Optional[str] = None
    is_verified: bool = False
    google_id: Optional[str] = None 

    class Config:
        from_attributes = True

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
    notas_doctor: Optional[str] = None

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