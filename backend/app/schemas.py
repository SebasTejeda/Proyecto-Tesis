from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, date


# ─── Auth ────────────────────────────────────────────────────────────────────

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


# ─── Users ───────────────────────────────────────────────────────────────────

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


# ─── Patients ────────────────────────────────────────────────────────────────

class PatientBase(BaseModel):
    nombre_completo: str
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


# ─── Model Features ──────────────────────────────────────────────────────────

class ModelFeaturesBase(BaseModel):
    sleep_hours: Optional[float] = None
    social_life: Optional[float] = None
    exercise_frequency: Optional[float] = None
    social_media_usage: Optional[float] = None
    stress_level: Optional[float] = None
    sleep_quality: Optional[float] = None
    perceived_loneliness: Optional[float] = None
    family_support: Optional[float] = None
    self_steem: Optional[float] = None
    marital_status: Optional[str] = None

class ModelFeaturesCreate(ModelFeaturesBase):
    pass

class ModelFeaturesResponse(ModelFeaturesBase):
    id: int
    evaluation_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Model Prediction ────────────────────────────────────────────────────────

class ModelPredictionBase(BaseModel):
    risk_binary: Optional[int] = None
    risk_probability: Optional[float] = None
    severity: Optional[str] = None
    severity_probability: Optional[float] = None
    shap_values: Optional[Dict[str, Any]] = None

class ModelPredictionResponse(ModelPredictionBase):
    id: int
    evaluation_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Recommendations ─────────────────────────────────────────────────────────

class RecommendationBase(BaseModel):
    source_variable: str
    alert_level: str
    recommendation: str
    priority: int

class RecommendationResponse(RecommendationBase):
    id: int
    evaluation_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Evaluations ─────────────────────────────────────────────────────────────

class EvaluationCreate(BaseModel):
    patient_id: int
    doctor_notes: Optional[str] = None
    model_features: ModelFeaturesCreate

class EvaluationResponse(BaseModel):
    id: int
    patient_id: int
    date: datetime
    status: str
    doctor_notes: Optional[str] = None
    created_at: datetime

    model_features: Optional[ModelFeaturesResponse] = None
    model_prediction: Optional[ModelPredictionResponse] = None
    recommendations: Optional[List[RecommendationResponse]] = []

    class Config:
        from_attributes = True