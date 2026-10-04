import re
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from zoneinfo import ZoneInfo

ZONA_HORARIA_CLINICA = ZoneInfo("America/Lima")


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
TIPOS_DOCUMENTO = ("DNI", "CE")

class PatientBase(BaseModel):
    nombre_completo: str
    tipo_documento: str
    numero_documento: str
    fecha_nacimiento: date
    sexo: str
    telefono: Optional[str] = None

class PatientCreate(PatientBase):
    @field_validator("tipo_documento")
    @classmethod
    def validar_tipo_documento(cls, v: str) -> str:
        if v not in TIPOS_DOCUMENTO:
            raise ValueError(f"tipo_documento debe ser uno de: {', '.join(TIPOS_DOCUMENTO)}")
        return v

    @field_validator("numero_documento")
    @classmethod
    def validar_numero_documento(cls, v: str, info) -> str:
        tipo = info.data.get("tipo_documento")
        if tipo == "DNI":
            if not re.fullmatch(r"[0-9]{8}", v):
                raise ValueError("El DNI debe tener exactamente 8 dígitos numéricos")
        elif tipo == "CE":
            if not re.fullmatch(r"[A-Za-z0-9]{9,12}", v):
                raise ValueError("El Carnet de Extranjería debe ser alfanumérico, entre 9 y 12 caracteres")
        return v

    @field_validator("fecha_nacimiento")
    @classmethod
    def validar_fecha_nacimiento(cls, v: date) -> date:
        # "Hoy" en America/Lima explícitamente — no el TZ del SO del servidor
        # (que en producción suele ser UTC, y en Perú va 5 horas detrás).
        hoy = datetime.now(ZONA_HORARIA_CLINICA).date()
        if v > hoy:
            raise ValueError("La fecha de nacimiento no puede ser futura")
        # Años cumplidos: resta 1 si (mes, día) de hoy todavía no alcanza a
        # (mes, día) de nacimiento. Para nacidos el 29 de feb., en años no
        # bisiestos (mes, día)=(2,29) nunca es <= ningún (mes, día) real de
        # ese año salvo el propio 29/2, así que la comparación cae del lado
        # del 1 de marzo de forma natural (ver verificación en el chat).
        edad = hoy.year - v.year - ((hoy.month, hoy.day) < (v.month, v.day))
        if edad < 18 or edad > 25:
            raise ValueError("El paciente debe tener entre 18 y 25 años cumplidos")
        return v

    @field_validator("telefono")
    @classmethod
    def validar_telefono(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return v
        if not re.fullmatch(r"9[0-9]{8}", v):
            raise ValueError("Ingrese un número de celular válido de 9 dígitos que comience con 9")
        return v

class PatientResponse(PatientBase):
    id: int
    doctor_id: int
    created_at: datetime
    origen: str = "clinico_real"
    consentimiento_informado: bool = False
    consentimiento_fecha: Optional[datetime] = None

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

SEVERITY_LEVELS = ("Ninguno", "Leve", "Moderado/Alto")

class DoctorAgreementUpdate(BaseModel):
    doctor_agreement: str
    disagreement_reason: Optional[str] = None
    doctor_severity_judgment: Optional[str] = None

    @field_validator("doctor_severity_judgment")
    @classmethod
    def validar_severity_judgment(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in SEVERITY_LEVELS:
            raise ValueError(f"doctor_severity_judgment debe ser uno de: {', '.join(SEVERITY_LEVELS)}")
        return v

class EvaluationResponse(BaseModel):
    id: int
    patient_id: int
    doctor_id: Optional[int] = None
    date: datetime
    status: str
    doctor_notes: Optional[str] = None
    doctor_agreement: Optional[str] = None
    disagreement_reason: Optional[str] = None
    doctor_severity_judgment: Optional[str] = None
    model_version: Optional[str] = "v1.0"
    created_at: datetime
    fecha_evaluacion_clinica: datetime
    fecha_revalidacion_tecnica: Optional[datetime] = None
    original_evaluation_id: Optional[int] = None

    model_features: Optional[ModelFeaturesResponse] = None
    model_prediction: Optional[ModelPredictionResponse] = None
    recommendations: Optional[List[RecommendationResponse]] = []

    class Config:
        from_attributes = True