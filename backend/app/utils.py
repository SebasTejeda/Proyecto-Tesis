# Importamos librería de encriptación
from passlib.context import CryptContext
from datetime import datetime, timedelta, UTC
from jose import jwt

# Configuración de JWT
SECRET_KEY = "61a241f490de8db90b19059f631017a79698fc5c772c41766cbd8e6f8bcc4164"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Configuramos el contexto de encriptación
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
