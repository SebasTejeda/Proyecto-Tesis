# Importación de las librerías
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: str | None = None

class UserBase(BaseModel):
    email: EmailStr
    nombres: str
    apellidos: str
    codigo_colegiatura: str

class UserCreate(UserBase):
    password: str

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

    class Config:
        from_attributes = True

class GoogleLoginRequest(BaseModel):
    credential: str

class EmailRequest(BaseModel):
    email: str

class VerifyCodeRequest(BaseModel):
    email: str
    codigo: str

class NewPasswordRequest(BaseModel):
    email: str
    codigo: str
    new_password: str

class UserUpdate(BaseModel):
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    codigo_colegiatura: Optional[str] = None

class PatientCreate(BaseModel):
    nombre: str
    edad: int
    sexo: str
    telefono: Optional[str] = None

class PatientResponse(BaseModel):
    id: int
    nombre_completo: str
    edad: int
    sexo: str
    created_at: datetime

    class Config:
        from_attributes = True

class EvaluationCreate(BaseModel):
    patient_id: int
    phq_1: int
    phq_2: int
    phq_3: int
    phq_4: int
    phq_5: int
    phq_6: int
    phq_7: int
    phq_8: int
    phq_9: int
    historial_familiar: Optional[str] = "No" # Campo extra preparatorio

class EvaluationResponse(EvaluationCreate):
    id: int
    puntaje_total: int
    nivel_riesgo: str
    resultado_ia: Optional[str] = None
    fecha: datetime
    
    class Config:
        from_attributes = True
