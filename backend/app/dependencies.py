import os
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from .database import get_db
from . import models

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        secret_key = os.getenv("SECRET_KEY")
        algorithm = os.getenv("ALGORITHM")

        payload = jwt.decode(token, secret_key, algorithms=[algorithm])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception

    return user


def log_activity(db: Session, user_id: int, action: str, detail: str = None, ip: str = None):
    """Helper para registrar actividad desde cualquier router."""
    try:
        log = models.ActivityLog(
            user_id=user_id,
            action=action,
            detail=detail,
            ip_address=ip
        )
        db.add(log)
        db.commit()
    except Exception as e:
        print(f"Error guardando log: {e}")