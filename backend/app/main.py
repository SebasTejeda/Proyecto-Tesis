from fastapi import FastAPI, HTTPException, Depends, status
from sqlalchemy.orm import Session
from . import models, schemas, utils, email_utils
from .database import engine, get_db
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from datetime import timedelta
import random

# Crear las tablas en la base de datos
models.Base.metadata.create_all(bind=engine)

GOOGLE_CLIENT_ID = "122329310552-6f3g3hn3fuj6fngiqfnef1aknddqi01v.apps.googleusercontent.com"

app = FastAPI(title="API Tesis de Salud Mental")

origins = [
    "http://localhost:4200",
    "http://127.0.0.1:4200",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


@app.post("/auth/forgot-password")
async def forgot_password(request: schemas.EmailRequest, db: Session = Depends(get_db)):
    # 1. Buscamos al usuario por correo
    user = db.query(models.User).filter(models.User.email == request.email).first()

    if not user:
        # Por seguridad, respondemos genérico
        return {"message": "Si el correo existe, se envió un código."}

    # --- NUEVA LÓGICA: Verificar si es usuario de Google ---
    # Si el usuario tiene un google_id, significa que entró con Google
    if user.google_id:
        raise HTTPException(
            status_code=403, # Forbidden
            detail="Esta cuenta está vinculada a Google. Por favor inicia sesión con el botón de Google."
        )
    # -------------------------------------------------------

    # 2. Generamos un código simple de 4 dígitos
    codigo = str(random.randint(1000, 9999))

    # 3. Guardamos el código
    user.recovery_code = codigo
    db.commit()

    # 4. Enviamos el correo
    try:
        await email_utils.enviar_correo_recuperacion(user.email, codigo)
    except Exception as e:
        print(f"Error enviando correo: {e}")
        raise HTTPException(status_code=500, detail="Error al enviar el correo")

    return {"message": "Correo enviado correctamente"}
# 1. Ruta para verificar si el código es correcto (Paso intermedio)
@app.post("/auth/verify-code")
def verify_recovery_code(request: schemas.VerifyCodeRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == request.email).first()

    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Comparamos el código que envió el usuario con el que guardamos en la BD
    if user.recovery_code != request.codigo:
        raise HTTPException(status_code=400, detail="Código incorrecto o expirado")

    return {"message": "Código válido"}


# 2. Ruta para CAMBIAR la contraseña definitivamente
@app.post("/auth/reset-password")
def reset_password(request: schemas.NewPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == request.email).first()

    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Verificamos el código UNA VEZ MÁS por seguridad
    if user.recovery_code != request.codigo:
        raise HTTPException(status_code=400, detail="Código inválido")

    # ¡IMPORTANTE! Encriptamos la nueva contraseña antes de guardarla
    hashed_password = utils.HashUtils.get_password_hash(request.new_password)
    
    user.password = hashed_password
    
    # Borramos el código de recuperación para que no se pueda usar dos veces
    user.recovery_code = None 
    
    db.commit()

    return {"message": "Contraseña actualizada correctamente"}

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, utils.SECRET_KEY, algorithms=[utils.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

@app.post("/auth/google", response_model=schemas.Token)
def google_login(login_data: schemas.GoogleLoginRequest, db: Session = Depends(get_db)):
    try:
        id_info = id_token.verify_oauth2_token(
            login_data.credential, google_requests.Request(), GOOGLE_CLIENT_ID
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
            role = "doctor"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if not user.google_id:
            user.google_id = google_id
        user.picture = foto
        db.commit()

    # Guardamos datos extra en el token para que el frontend no tenga que pedirlos
    token_data = {
        "sub": user.email,
        "name": f"{user.nombres} {user.apellidos}",   # <--- Nuevo
        "picture": user.picture # <--- Nuevo
    }
    access_token = utils.HashUtils.create_access_token(data=token_data)

    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/usuarios/", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
async def crear_usuario(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="El correo ya está registrado")
    
    hashed_password = utils.HashUtils.get_password_hash(user.password)
    
    codigo = str(random.randint(1000, 9999))
    
    # Hashear la contraseña
    hashed_password = utils.HashUtils.get_password_hash(user.password)
    
    # Crear una nueva instancia de usuario
    nuevo_usuario = models.User(
        email=user.email,
        password=hashed_password,
        nombres=user.nombres,
        apellidos=user.apellidos,
        codigo_colegiatura=user.codigo_colegiatura,
        is_verified=False,
        verification_code=codigo
    )
    
    try:
        # Agregar el nuevo usuario a la base de datos
        db.add(nuevo_usuario)
        db.commit()
        db.refresh(nuevo_usuario)

        await email_utils.enviar_correo_verificacion(user.email, codigo)
    
    except Exception as e:
        db.delete(nuevo_usuario)
        db.commit()

        raise HTTPException(status_code=500, detail=f"Error al crear el usuario: {str(e)}")
    
    return nuevo_usuario

@app.get("/")
def read_root():
    return {"message": "API Tesis de Salud Mental"}

@app.get("/test-db")
def test_db(db: Session = Depends(get_db)):
    try:
        # Realizar una consulta simple
        user_count = db.query(models.User).count()
        return {"status": "Database connection successful"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")

@app.post("/token")
def login_para_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not utils.HashUtils.verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Correo electrónico o contraseña incorrectos.",
            headers={"WWW-Authenticate": "Bearer"},)
    
    if not user.is_verified:
        raise HTTPException(status_code=400, detail="Cuenta no verificada. Por favor revisa tu correo para verificar tu cuenta.")
    
    token_data = {
        "sub": user.email,
        "name": f"{user.nombres} {user.apellidos}",
        "picture": user.picture if user.picture else ""
    }


    access_token = utils.HashUtils.create_access_token(data=token_data)
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me/", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.post("/auth/verify-account")
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
