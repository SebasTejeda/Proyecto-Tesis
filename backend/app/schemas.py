from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, date


# ── Auth ──────────────────────────────────────────────────────────────────────
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


# ── Patients ──────────────────────────────────────────────────────────────────
class PatientBase(BaseModel):
    nombre_completo: str
    dni: str
    fecha_nacimiento: date
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
    doctor_notes: Optional[str] = None
    model_features: ModelFeaturesCreate

class DoctorAgreementUpdate(BaseModel):
    doctor_agreement: str                        # "confirmed" | "rejected"
    disagreement_reason: Optional[str] = None    # motivo si rejected

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