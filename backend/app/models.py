# Importación de las librerías
from datetime import datetime

from sqlalchemy import Column, ForeignKey, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
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

class Patient(Base):
    __tablename__ = 'patients'

    id = Column(Integer, primary_key=True, index=True)
    nombre_completo = Column(String, index=True)
    edad = Column(Integer)
    sexo = Column(String)
    telefono = Column(String, nullable=True)

    doctor_id = Column(Integer, ForeignKey('usuarios.id')) 
    created_at = Column(DateTime, default=datetime.utcnow)

class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id")) # <--- La conexión clave
    
    # Los puntajes (del 0 al 10)
    ansiedad = Column(Integer)
    estres = Column(Integer)
    sueno = Column(Integer)
    tristeza = Column(String) # "Si" o "No" (o 0/1)
    historial = Column(String) # "Si" o "No"
    
    # Resultado de la IA (lo guardaremos aquí después)
    resultado_ia = Column(String, nullable=True) 
    fecha = Column(DateTime, default=datetime.utcnow)

