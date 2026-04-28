from datetime import datetime
from sqlalchemy import Column, ForeignKey, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=True)
    nombres = Column(String, nullable=False)
    apellidos = Column(String, nullable=False)
    codigo_colegiatura = Column(String, unique=True, index=True, nullable=True)
    role = Column(String, nullable=False, default="doctor")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    google_id = Column(String, unique=True, index=True, nullable=True)
    picture = Column(String, nullable=True)
    recovery_code = Column(String, nullable=True)
    is_verified = Column(Boolean, default=False)
    verification_code = Column(String, nullable=True)

    # Relación
    patients = relationship("Patient", back_populates="doctor")


class Patient(Base):
    __tablename__ = 'patients'

    id = Column(Integer, primary_key=True, index=True)
    nombre_completo = Column(String, index=True)
    edad = Column(Integer)
    sexo = Column(String)
    telefono = Column(String, nullable=True)
    doctor_id = Column(Integer, ForeignKey('usuarios.id'))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    doctor = relationship("User", back_populates="patients")
    evaluations = relationship(
        "Evaluation", back_populates="patient", cascade="all, delete-orphan")


class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))

    # Preguntas del estándar PHQ-9 (Valores del 0 al 3)
    phq_1 = Column(Integer)  # Poco interés o placer
    phq_2 = Column(Integer)  # Decaído, deprimido
    phq_3 = Column(Integer)  # Problemas de sueño
    phq_4 = Column(Integer)  # Cansancio
    phq_5 = Column(Integer)  # Apetito
    phq_6 = Column(Integer)  # Culpa / inutilidad
    phq_7 = Column(Integer)  # Dificultad para concentrarse
    phq_8 = Column(Integer)  # Lentitud / Agitación
    phq_9 = Column(Integer)  # Pensamientos suicidas

    # Variables adicionales que definirán con el especialista
    historial_familiar = Column(String, nullable=True)  # Ej: "Si" o "No"

    # Resultados calculados
    puntaje_total = Column(Integer)
    nivel_riesgo = Column(String)  # Mínimo, Leve, Moderado, Severo, etc.

    # Resultado de tu modelo XGBoost (Lo separo del puntaje manual)
    resultado_ia = Column(String, nullable=True)
    fecha = Column(DateTime, default=datetime.utcnow)

    # Relación bidireccional
    patient = relationship("Patient", back_populates="evaluations")
