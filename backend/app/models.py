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
    date = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="Pendiente")
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
    """Features de entrada para el modelo XGBoost — nomenclatura del dataset."""
    __tablename__ = "model_features"

    id = Column(Integer, primary_key=True, index=True)
    evaluation_id = Column(Integer, ForeignKey("evaluations.id"), unique=True)

    horas_sueno = Column(Float, nullable=True)            # Numérico (horas diarias)
    vida_social = Column(Integer, nullable=True)          # 1=Muy baja, 2=Baja, 3=Activa, 4=Muy activa
    frecuencia_ejercicio = Column(Integer, nullable=True) # 0=Nunca, 1=Ocasionalmente, 2=Frecuentemente
    redes_sociales = Column(Float, nullable=True)         # Numérico (horas diarias)
    nivel_estres = Column(Integer, nullable=True)         # 1=Muy bajo ... 5=Muy alto
    calidad_sueno = Column(Integer, nullable=True)        # 1=Muy mala ... 4=Muy buena
    soledad_percibida = Column(Integer, nullable=True)    # 1=Nunca ... 4=Siempre
    apoyo_familiar = Column(Integer, nullable=True)       # 1=Muy bajo ... 4=Muy alto
    autoestima = Column(Integer, nullable=True)           # 1=Muy baja ... 5=Muy alta
    estado_civil = Column(Integer, nullable=True)         # 0=Soltero,1=Casado,2=Conviviente,3=Divorciado,4=Viudo,5=Otro
    genero = Column(Integer, nullable=True)               # 1=Masculino, 2=Femenino (jalado de Patient.sexo)
    created_at = Column(DateTime, default=datetime.utcnow)

    evaluation = relationship("Evaluation", back_populates="model_features")


class ModelPrediction(Base):
    """Resultados del modelo IA."""
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
    """Recomendaciones clínicas generadas a partir de los valores SHAP."""
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    evaluation_id = Column(Integer, ForeignKey("evaluations.id"))

    source_variable = Column(String)
    alert_level = Column(String)
    recommendation = Column(String)
    priority = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

    evaluation = relationship("Evaluation", back_populates="recommendations")