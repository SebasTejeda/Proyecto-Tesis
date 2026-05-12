import os
import random
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

# Importaciones relativas de nuestro proyecto
from ..database import get_db
from .. import models, schemas, utils, email_utils

# Creamos el enrutador
router = APIRouter()

@router.post("/token", response_model=schemas.Token, summary="Inicio de sesión estándar")
def login_para_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Valida las credenciales del usuario y retorna un JWT Access Token."""
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    
    if not user or not utils.HashUtils.verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Correo electrónico o contraseña incorrectos.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_verified:
        raise HTTPException(
            status_code=400, 
            detail="Cuenta no verificada. Por favor revisa tu correo para verificar tu cuenta."
        )
    
    token_data = {
        "sub": user.email,
        "name": f"{user.nombres} {user.apellidos}",
        "picture": user.picture if user.picture else ""
    }

    access_token = utils.HashUtils.create_access_token(data=token_data)
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user_id": user.id,      # <--- Agregado
        "role": user.role        # <--- Agregado
    }

@router.post("/google", response_model=schemas.Token, summary="Inicio de sesión con Google (SSO)")
def google_login(login_data: schemas.GoogleLoginRequest, db: Session = Depends(get_db)):
    """Verifica el token de Google y crea/actualiza al usuario en la base de datos."""
    google_client_id = os.getenv("GOOGLE_CLIENT_ID") # <-- Leemos la variable segura
    
    try:
        id_info = id_token.verify_oauth2_token(
            login_data.credential, google_requests.Request(), google_client_id
        )
        email = id_info["email"]
        nombre_google = id_info.get("given_name", "")
        apellido_google = id_info.get("family_name", "")
        foto = id_info.get("picture", "")
        google_id = id_info["sub"]
    except ValueError:
        raise HTTPException(status_code=400, detail="Token de Google no válido")
    
    user = db.query(models.User).filter(models.User.email == email).first()

    if not user:
        user = models.User(
            email=email,
            nombres=nombre_google,
            apellidos=apellido_google,
            google_id=google_id,
            picture=foto,
            password=None,  
            role="doctor",
            codigo_colegiatura=None,
            is_verified=True, # Google ya validó el correo
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if not user.google_id:
            user.google_id = google_id
            user.is_verified = True
        user.picture = foto
        db.commit()

    token_data = {
        "sub": user.email,
        "name": f"{user.nombres} {user.apellidos}",
        "picture": user.picture
    }
    access_token = utils.HashUtils.create_access_token(data=token_data)
    return {"access_token": access_token, "token_type": "bearer", "user_id": user.id, "role": user.role}

@router.post("/verify-account", summary="Verificación de cuenta nueva")
def verify_account(request: schemas.VerifyCodeRequest, db: Session = Depends(get_db)):
    """Activa una cuenta de usuario usando el código enviado por correo."""
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
    """Genera un código de 4 dígitos y lo envía al correo del usuario."""
    user = db.query(models.User).filter(models.User.email == request.email).first()

    if not user:
        return {"message": "Si el correo existe, se envió un código."}

    # Protección para cuentas de Google
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
    """Paso intermedio para confirmar que el usuario posee el código de recuperación válido."""
    user = db.query(models.User).filter(models.User.email == request.email).first()

    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.recovery_code != request.codigo:
        raise HTTPException(status_code=400, detail="Código incorrecto o expirado")

    return {"message": "Código válido"}

@router.post("/reset-password", summary="Cambio definitivo de contraseña")
def reset_password(request: schemas.NewPasswordRequest, db: Session = Depends(get_db)):
    """Establece la nueva contraseña encriptada en la base de datos."""
    user = db.query(models.User).filter(models.User.email == request.email).first()

    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.recovery_code != request.codigo:
        raise HTTPException(status_code=400, detail="Código inválido")

    # Encriptación usando nuestra clase de Utils
    hashed_password = utils.HashUtils.get_password_hash(request.new_password)
    
    user.password = hashed_password
    user.recovery_code = None  # Invalida el código para un solo uso
    db.commit()

    return {"message": "Contraseña actualizada correctamente"}