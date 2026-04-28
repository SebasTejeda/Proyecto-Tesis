from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)
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

    # Relación 1 a muchos: Un doctor tiene muchos pacientes
    patients = relationship("Patient", back_populates="doctor")

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    nombre_completo = Column(String, index=True)
    fecha_nacimiento = Column(Date) # Cambiado de 'edad' a 'fecha_nacimiento'
    sexo = Column(String)
    telefono = Column(String, nullable=True)
    doctor_id = Column(Integer, ForeignKey("usuarios.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    doctor = relationship("User", back_populates="patients")
    evaluations = relationship("Evaluation", back_populates="patient")

class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    fecha = Column(DateTime, default=datetime.utcnow)
    phq9_puntaje = Column(Integer)
    resultado = Column(String)
    ia_feedback = Column(String, nullable=True)
    notas_doctor = Column(String, nullable=True)
    status = Column(String, default="Completado")

    # Relación principal
    patient = relationship("Patient", back_populates="evaluations")
    
    # Relaciones 1 a 1 (Una evaluación tiene UN registro de síntomas y UN registro de data extra)
    symptoms = relationship("PHQ9Symptoms", back_populates="evaluation", uselist=False, cascade="all, delete-orphan")
    extra_data = relationship("ExtraDataPatient", back_populates="evaluation", uselist=False, cascade="all, delete-orphan")

class PHQ9Symptoms(Base):
    __tablename__ = "PHQ9_symptoms"

    id = Column(Integer, primary_key=True, index=True)
    evaluation_id = Column(Integer, ForeignKey("evaluations.id"), unique=True) # unique=True garantiza 1 a 1
    
    # Las 9 preguntas (Puntajes 0 a 3)
    interes_poco_placer = Column(Integer)
    desanimado_deprimido = Column(Integer)
    dificultad_dormir = Column(Integer)
    sentirse_cansado = Column(Integer)
    poco_apetito = Column(Integer)
    sentirse_mal_consigo_mismo = Column(Integer)
    dificultad_concentracion = Column(Integer)
    moverse_hablar_lento_rapido = Column(Integer)
    pensamientos_muerte = Column(Integer)

    # Relación inversa
    evaluation = relationship("Evaluation", back_populates="symptoms")

class ExtraDataPatient(Base):
    __tablename__ = "extra_data_patients"

    id = Column(Integer, primary_key=True, index=True)
    evaluation_id = Column(Integer, ForeignKey("evaluations.id"), unique=True)
    
    # Variables ENDES y clínicas para XGBoost
    estado_civil = Column(String, nullable=True)
    nivel_educativo = Column(String, nullable=True)
    peso = Column(Float, nullable=True)
    talla = Column(Float, nullable=True)
    imc = Column(Float, nullable=True)
    fuma_30_dias = Column(String, nullable=True)
    bebe_30_dias = Column(String, nullable=True)
    alcohol_dificultad_estudio = Column(String, nullable=True)
    violencia_fisica_pareja = Column(String, nullable=True)
    diagnostico_hipertension = Column(String, nullable=True)
    diagnostico_diabetes = Column(String, nullable=True)

    # Relación inversa
    evaluation = relationship("Evaluation", back_populates="extra_data")