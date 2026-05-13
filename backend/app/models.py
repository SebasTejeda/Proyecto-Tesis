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
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    google_id = Column(String, nullable=True)
    picture = Column(String, nullable=True)
    recovery_code = Column(String, nullable=True)
    is_verified = Column(Boolean, default=False)
    verification_code = Column(String, nullable=True)

    patients = relationship("Patient", back_populates="doctor")


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    nombre_completo = Column(String, index=True)
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
    date = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="Completado")
    doctor_notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="evaluations")
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
    """Features de entrada para el modelo XGBoost."""
    __tablename__ = "model_features"

    id = Column(Integer, primary_key=True, index=True)
    evaluation_id = Column(Integer, ForeignKey("evaluations.id"), unique=True)

    # Lifestyle features
    sleep_hours = Column(Float, nullable=True)
    social_life = Column(Float, nullable=True)
    exercise_frequency = Column(Float, nullable=True)
    social_media_usage = Column(Float, nullable=True)
    stress_level = Column(Float, nullable=True)
    sleep_quality = Column(Float, nullable=True)
    perceived_loneliness = Column(Float, nullable=True)
    family_support = Column(Float, nullable=True)
    self_steem = Column(Float, nullable=True)
    marital_status = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    evaluation = relationship("Evaluation", back_populates="model_features")


class ModelPrediction(Base):
    """Resultados del modelo IA: predicción binaria, probabilidades y valores SHAP."""
    __tablename__ = "model_predictions"

    id = Column(Integer, primary_key=True, index=True)
    evaluation_id = Column(Integer, ForeignKey("evaluations.id"), unique=True)

    risk_binary = Column(Integer, nullable=True)           # 0 = sin riesgo, 1 = con riesgo
    risk_probability = Column(Float, nullable=True)        # probabilidad de riesgo (0.0 - 1.0)
    severity = Column(String, nullable=True)               # Mínimo / Leve / Moderado / Severo
    severity_probability = Column(Float, nullable=True)    # probabilidad de la severidad predicha
    shap_values = Column(JSON, nullable=True)              # dict con el aporte de cada feature
    created_at = Column(DateTime, default=datetime.utcnow)

    evaluation = relationship("Evaluation", back_populates="model_prediction")


class Recommendation(Base):
    """Recomendaciones clínicas generadas a partir de los valores SHAP del modelo."""
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    evaluation_id = Column(Integer, ForeignKey("evaluations.id"))

    source_variable = Column(String)       # feature SHAP que originó la recomendación
    alert_level = Column(String)           # bajo / medio / alto
    recommendation = Column(String)        # texto de la recomendación
    priority = Column(Integer)             # 1 = más urgente
    created_at = Column(DateTime, default=datetime.utcnow)

    evaluation = relationship("Evaluation", back_populates="recommendations")