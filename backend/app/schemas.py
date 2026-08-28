from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date


DOCTOR_NOTES_MAX_LENGTH = 1000


# ── Auth ──────────────────────────────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    role: str
    account_status: str = 'pending'

class TokenData(BaseModel):
    email: Optional[str] = None

class GoogleLoginRequest(BaseModel):
    credential: str

class VerifyCodeRequest(BaseModel):
    email: EmailStr
    codigo: str

class EmailRequest(BaseModel):
    email: EmailStr

class NewPasswordRequest(BaseModel):
    email: EmailStr
    codigo: str
    new_password: str


# ── Users ─────────────────────────────────────────────────────────────────────
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
    account_status: str = "pending"
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

# Schema para aprobar o rechazar un médico
class AccountStatusUpdate(BaseModel):
    action: str  # "approve" | "reject" | "suspend" | "delete" | "reactivate"
    reason: Optional[str] = None  # motivo opcional (rechazo, suspensión o eliminación)

# Schema para listar médicos pendientes en el panel admin
class DoctorPendingResponse(BaseModel):
    id: int
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    email: str
    codigo_colegiatura: Optional[str] = None
    account_status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Patients ──────────────────────────────────────────────────────────────────
class PatientBase(BaseModel):
    nombre_completo: str
    dni: str
    fecha_nacimiento: date
    sexo: str
    telefono: Optional[str] = None

class PatientCreate(PatientBase):
    @field_validator("fecha_nacimiento")
    @classmethod
    def validar_fecha_nacimiento(cls, v: date) -> date:
        hoy = date.today()
        if v > hoy:
            raise ValueError("La fecha de nacimiento no puede ser futura")
        edad = hoy.year - v.year - ((hoy.month, hoy.day) < (v.month, v.day))
        if edad < 18 or edad > 25:
            raise ValueError("El paciente debe tener entre 18 y 25 años")
        return v

class PatientResponse(PatientBase):
    id: int
    doctor_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── Model Features ────────────────────────────────────────────────────────────
class ModelFeaturesBase(BaseModel):
    horas_sueno: Optional[float] = None
    vida_social: Optional[int] = None
    frecuencia_ejercicio: Optional[int] = None
    redes_sociales: Optional[float] = None
    nivel_estres: Optional[int] = None
    calidad_sueno: Optional[int] = None
    soledad_percibida: Optional[int] = None
    apoyo_familiar: Optional[int] = None
    autoestima: Optional[int] = None
    estado_civil: Optional[int] = None
    genero: Optional[int] = None

class ModelFeaturesCreate(ModelFeaturesBase):
    pass

class ModelFeaturesResponse(ModelFeaturesBase):
    id: int
    evaluation_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── Model Prediction ──────────────────────────────────────────────────────────
class ModelPredictionResponse(BaseModel):
    id: int
    evaluation_id: int
    risk_binary: Optional[int] = None
    risk_probability: Optional[float] = None
    severity: Optional[str] = None
    severity_probability: Optional[float] = None
    shap_values: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Recommendations ───────────────────────────────────────────────────────────
class RecommendationResponse(BaseModel):
    id: int
    evaluation_id: int
    source_variable: str
    alert_level: str
    recommendation: str
    priority: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── Evaluations ───────────────────────────────────────────────────────────────
class EvaluationCreate(BaseModel):
    patient_id: int
    doctor_notes: Optional[str] = Field(default=None, max_length=DOCTOR_NOTES_MAX_LENGTH)
    model_features: ModelFeaturesCreate

class DoctorAgreementUpdate(BaseModel):
    doctor_agreement: str
    disagreement_reason: Optional[str] = None

class EvaluationResponse(BaseModel):
    id: int
    patient_id: int
    doctor_id: Optional[int] = None
    date: datetime
    status: str
    doctor_notes: Optional[str] = None
    doctor_agreement: Optional[str] = None
    disagreement_reason: Optional[str] = None
    model_version: Optional[str] = "v1.0"
    created_at: datetime

    model_features: Optional[ModelFeaturesResponse] = None
    model_prediction: Optional[ModelPredictionResponse] = None
    recommendations: Optional[List[RecommendationResponse]] = []

    class Config:
        from_attributes = True