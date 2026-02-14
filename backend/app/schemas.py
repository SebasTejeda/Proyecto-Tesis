# Importación de las librerías
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: str | None = None
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

class GoogleLoginRequest(BaseModel):
    credential: str

class EmailRequest(BaseModel):
    email: str

class VerifyCodeRequest(BaseModel):
    email: str
    codigo: str

class NewPasswordRequest(BaseModel):
    email: str
    codigo: str
    new_password: str

