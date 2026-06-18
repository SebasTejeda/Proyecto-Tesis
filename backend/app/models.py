from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class User(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String, nullable=True)
    nombres = Column(String)
    apellidos = Column(String)
    codigo_colegiatura = Column(String, nullable=True)
    role = Column(String, default="Doctor")
    account_status = Column(String, default="pending")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    google_id = Column(String, nullable=True)
    picture = Column(String, nullable=True)
    recovery_code = Column(String, nullable=True)
    is_verified = Column(Boolean, default=False)
    verification_code = Column(String, nullable=True)

    # Bloqueo por intentos fallidos
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)  # NULL = no bloqueado

    patients = relationship("Patient", back_populates="doctor")
    activity_logs = relationship("ActivityLog", back_populates="user")


class ActivityLog(Base):
    """Registro de actividad del usuario en el sistema."""
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    action = Column(String, nullable=False)       # "login" | "logout" | "evaluation_created" | etc.
    detail = Column(String, nullable=True)         # detalle adicional
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="activity_logs")


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    nombre_completo = Column(String, index=True)
    dni = Column(String, unique=True, nullable=False, index=True)
    fecha_nacimiento = Column(Date)
    sexo = Column(String)
    telefono = Column(String, nullable=True)
    doctor_id = Column(Integer, ForeignKey("usuarios.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    doctor = relationship("User", back_populates="patients")
    evaluations = relationship("Evaluation", back_populates="patient")


class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    doctor_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    date = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="Pendiente")
    doctor_notes = Column(String, nullable=True)
    doctor_agreement = Column(String, nullable=True)
    disagreement_reason = Column(String, nullable=True)
    model_version = Column(String, default="v1.0")
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="evaluations")
    doctor = relationship("User", foreign_keys=[doctor_id])
    model_features = relationship(
        "ModelFeatures", back_populates="evaluation",
        uselist=False, cascade="all, delete-orphan"
    )
    model_prediction = relationship(
        "ModelPrediction", back_populates="evaluation",
        uselist=False, cascade="all, delete-orphan"
    )
    recommendations = relationship(
        "Recommendation", back_populates="evaluation",
        cascade="all, delete-orphan"
    )


class ModelFeatures(Base):
    __tablename__ = "model_features"

    id = Column(Integer, primary_key=True, index=True)
    evaluation_id = Column(Integer, ForeignKey("evaluations.id"), unique=True)

    horas_sueno = Column(Float, nullable=True)
    vida_social = Column(Integer, nullable=True)
    frecuencia_ejercicio = Column(Integer, nullable=True)
    redes_sociales = Column(Float, nullable=True)
    nivel_estres = Column(Integer, nullable=True)
    calidad_sueno = Column(Integer, nullable=True)
    soledad_percibida = Column(Integer, nullable=True)
    apoyo_familiar = Column(Integer, nullable=True)
    autoestima = Column(Integer, nullable=True)
    estado_civil = Column(Integer, nullable=True)
    genero = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    evaluation = relationship("Evaluation", back_populates="model_features")


class ModelPrediction(Base):
    __tablename__ = "model_predictions"

    id = Column(Integer, primary_key=True, index=True)
    evaluation_id = Column(Integer, ForeignKey("evaluations.id"), unique=True)

    risk_binary = Column(Integer, nullable=True)
    risk_probability = Column(Float, nullable=True)
    severity = Column(String, nullable=True)
    severity_probability = Column(Float, nullable=True)
    shap_values = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    evaluation = relationship("Evaluation", back_populates="model_prediction")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    evaluation_id = Column(Integer, ForeignKey("evaluations.id"))

    source_variable = Column(String)
    alert_level = Column(String)
    recommendation = Column(String)
    priority = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

    evaluation = relationship("Evaluation", back_populates="recommendations")