# Importamos librería de encriptación
from dotenv import load_dotenv
from passlib.context import CryptContext
from datetime import datetime, timedelta, UTC
from jose import jwt
import os

load_dotenv(override=True)

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class HashUtils:
    @staticmethod
    def get_password_hash(password: str) -> str:
        """Genera un hash para la contraseña proporcionada."""
        return pwd_context.hash(password)
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verifica si la contraseña proporcionada coincide con el hash almacenado."""
        return pwd_context.verify(plain_password, hashed_password)
    
    @staticmethod
    def create_access_token(data: dict):
        """Crea un token de acceso JWT."""
        to_encode = data.copy()
        expire = datetime.now(UTC) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
