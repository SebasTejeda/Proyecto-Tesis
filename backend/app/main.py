from fastapi import FastAPI, HTTPException, Depends, status
from sqlalchemy.orm import Session
from . import models, schemas, utils
from .database import engine, get_db
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from datetime import timedelta

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
def crear_usuario(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Verificar si el correo electrónico ya existe
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="El correo electrónico ya está registrado.")
    
    # Hashear la contraseña
    hashed_password = utils.HashUtils.get_password_hash(user.password)
    
    # Crear una nueva instancia de usuario
    nuevo_usuario = models.User(
        email=user.email,
        password=hashed_password,
        nombres=user.nombres,
        apellidos=user.apellidos,
        codigo_colegiatura=user.codigo_colegiatura
    )
    
    # Agregar el nuevo usuario a la base de datos
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    
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
    
    if not utils.HashUtils.verify_password(form_data.password, user.password):
        raise HTTPException(status_code=400, detail="Correo electrónico o contraseña incorrectos.")
    
    access_token = utils.HashUtils.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me/", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user
