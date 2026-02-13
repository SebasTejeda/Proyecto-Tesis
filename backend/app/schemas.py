# Importación de las librerías
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

# Datos enviados
class UserBase(BaseModel):
    email: EmailStr
    nombres: str
    apellidos: str
    codigo_colegiatura: str

class UserCreate(UserBase):
    password: str

# Datos recibidos
class UserResponse(UserBase):
    id: int
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
