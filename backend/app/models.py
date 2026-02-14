# Importación de las librerías
from sqlalchemy import Column, Integer, String, Boolean, DateTime
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

