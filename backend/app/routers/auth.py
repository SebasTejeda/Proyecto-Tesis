import os
import random
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from ..database import get_db
from .. import models, schemas, utils, email_utils
from ..limiter import limiter

router = APIRouter()

MAX_INTENTOS = 5
BLOQUEO_MINUTOS = 15


def registrar_actividad(db: Session, user_id: int, action: str, detail: str = None, ip: str = None):
    """Guarda una entrada en el log de actividad."""
    log = models.ActivityLog(
        user_id=user_id,
        action=action,
        detail=detail,
        ip_address=ip
    )
    db.add(log)
    db.commit()


@router.post("/token", response_model=schemas.Token, summary="Inicio de sesión estándar")
@limiter.limit("10/minute")
def login_para_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    ip = request.client.host if request.client else "unknown"

    # Usuario no existe
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo electrónico o contraseña incorrectos.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Cuenta suspendida o eliminada: no debe poder autenticarse
    if user.account_status in ("suspended", "deleted"):
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Esta cuenta ha sido suspendida o eliminada. Contacta al administrador."
        )

    # Verificar si está bloqueado
    if user.locked_until and datetime.utcnow() < user.locked_until:
        minutos_restantes = int((user.locked_until - datetime.utcnow()).total_seconds() / 60) + 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intenta nuevamente en {minutos_restantes} minuto(s)."
        )

    # Contraseña incorrecta
    if not utils.HashUtils.verify_password(form_data.password, user.password):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1

        if user.failed_login_attempts >= MAX_INTENTOS:
            user.locked_until = datetime.utcnow() + timedelta(minutes=BLOQUEO_MINUTOS)
            user.failed_login_attempts = 0
            db.commit()
            registrar_actividad(db, user.id, "account_locked", f"Bloqueado por {MAX_INTENTOS} intentos fallidos", ip)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Cuenta bloqueada por {BLOQUEO_MINUTOS} minutos debido a múltiples intentos fallidos."
            )

        db.commit()
        intentos_restantes = MAX_INTENTOS - user.failed_login_attempts
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Contraseña incorrecta. Te quedan {intentos_restantes} intento(s) antes de bloquear la cuenta.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verificación de correo
    if not user.is_verified:
        raise HTTPException(
            status_code=400,
            detail="Cuenta no verificada. Por favor revisa tu correo para verificar tu cuenta."
        )

    # Login exitoso — resetear intentos fallidos
    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()

    registrar_actividad(db, user.id, "login", "Inicio de sesión exitoso", ip)

    token_data = {
        "sub": user.email,
        "name": f"{user.nombres} {user.apellidos}",
        "picture": user.picture if user.picture else ""
    }
    access_token = utils.HashUtils.create_access_token(data=token_data)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "role": user.role,
        "account_status": user.account_status
    }


@router.post("/google", response_model=schemas.Token, summary="Inicio de sesión con Google (SSO)")
def google_login(login_data: schemas.GoogleLoginRequest, db: Session = Depends(get_db), request: Request = None):
    google_client_id = os.getenv("GOOGLE_CLIENT_ID")
    ip = request.client.host if request and request.client else "unknown"

    try:
        id_info = id_token.verify_oauth2_token(
            login_data.credential, google_requests.Request(), google_client_id
        )
        email           = id_info["email"]
        nombre_google   = id_info.get("given_name", "")
        apellido_google = id_info.get("family_name", "")
        foto            = id_info.get("picture", "")
        google_id       = id_info["sub"]
    except ValueError:
        raise HTTPException(status_code=400, detail="Token de Google no válido")

    user = db.query(models.User).filter(models.User.email == email).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="No existe una cuenta registrada con este correo. Debes registrarte primero con el formulario completo (incluye tu código de colegiatura)."
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=403,
            detail="Debes completar la verificación de tu correo (OTP) antes de poder iniciar sesión con Google."
        )

    if user.account_status in ("suspended", "deleted"):
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Esta cuenta ha sido suspendida o eliminada. Contacta al administrador."
        )

    if not user.google_id:
        user.google_id = google_id
    user.picture = foto
    db.commit()

    registrar_actividad(db, user.id, "login_google", "Inicio de sesión con Google", ip)

    token_data = {
        "sub": user.email,
        "name": f"{user.nombres} {user.apellidos}",
        "picture": user.picture
    }
    access_token = utils.HashUtils.create_access_token(data=token_data)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "role": user.role,
        "account_status": user.account_status
    }


@router.post("/logout", summary="Registrar cierre de sesión")
def logout(request: Request, db: Session = Depends(get_db), current_user: models.User = Depends()):
    """Opcional — registra el logout en el log de actividad."""
    from ..dependencies import get_current_user
    ip = request.client.host if request.client else "unknown"
    registrar_actividad(db, current_user.id, "logout", "Cierre de sesión", ip)
    return {"message": "Sesión cerrada correctamente"}


@router.post("/verify-account", summary="Verificación de cuenta nueva")
def verify_account(request: schemas.VerifyCodeRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.is_verified:
        return {"message": "Cuenta ya verificada"}
    if user.verification_code != request.codigo:
        raise HTTPException(status_code=400, detail="Código de verificación incorrecto")
    user.is_verified = True
    user.verification_code = None
    db.commit()
    return {"message": "Cuenta verificada correctamente"}


@router.post("/forgot-password", summary="Solicitud de recuperación de contraseña")
async def forgot_password(request: schemas.EmailRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user:
        return {"message": "Si el correo existe, se envió un código."}
    if user.google_id:
        raise HTTPException(
            status_code=403,
            detail="Esta cuenta está vinculada a Google. Por favor inicia sesión con el botón de Google."
        )
    codigo = str(random.randint(1000, 9999))
    user.recovery_code = codigo
    db.commit()
    try:
        await email_utils.enviar_correo_recuperacion(user.email, codigo)
    except Exception as e:
        print(f"Error enviando correo: {e}")
        raise HTTPException(status_code=500, detail="Error al enviar el correo")
    return {"message": "Correo enviado correctamente"}


@router.post("/verify-code", summary="Validación de código de recuperación")
def verify_recovery_code(request: schemas.VerifyCodeRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.recovery_code != request.codigo:
        raise HTTPException(status_code=400, detail="Código incorrecto o expirado")
    return {"message": "Código válido"}


@router.post("/reset-password", summary="Cambio definitivo de contraseña")
def reset_password(request: schemas.NewPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.recovery_code != request.codigo:
        raise HTTPException(status_code=400, detail="Código inválido")
    hashed_password = utils.HashUtils.get_password_hash(request.new_password)
    user.password = hashed_password
    user.recovery_code = None
    db.commit()
    return {"message": "Contraseña actualizada correctamente"}