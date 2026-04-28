import random
import cloudinary.uploader
from fastapi import APIRouter, Depends, HTTPException, status, Form, File, UploadFile
from sqlalchemy.orm import Session

# Importaciones de tu arquitectura
from ..database import get_db
from ..dependencies import get_current_user
from .. import models, schemas, utils, email_utils

router = APIRouter()


@router.post("/", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED, summary="Registrar un nuevo usuario")
async def crear_usuario(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Crea una cuenta nueva para un médico y envía el correo de verificación."""
    db_user = db.query(models.User).filter(
        models.User.email == user.email).first()
    if db_user:
        raise HTTPException(
            status_code=400, detail="El correo ya está registrado")

    codigo = str(random.randint(1000, 9999))
    hashed_password = utils.HashUtils.get_password_hash(user.password)

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
        db.add(nuevo_usuario)
        db.commit()
        db.refresh(nuevo_usuario)

        await email_utils.enviar_correo_verificacion(user.email, codigo)

    except Exception as e:
        db.delete(nuevo_usuario)
        db.commit()
        raise HTTPException(
            status_code=500, detail=f"Error al crear el usuario: {str(e)}")

    return nuevo_usuario


@router.get("/me", response_model=schemas.UserResponse, summary="Obtener perfil actual")
def read_users_me(current_user: models.User = Depends(get_current_user)):
    """Retorna los datos del médico que está autenticado actualmente."""
    return current_user


@router.put("/me", response_model=schemas.UserResponse, summary="Actualizar perfil y foto")
async def update_user_me(
    nombres: str = Form(...),
    apellidos: str = Form(...),
    codigo_colegiatura: str = Form(""),
    foto: UploadFile = File(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Actualiza la información básica del usuario y sube una nueva foto a Cloudinary si se proporciona."""
    try:
        # 1. Actualizar los campos de texto
        current_user.nombres = nombres
        current_user.apellidos = apellidos
        current_user.codigo_colegiatura = codigo_colegiatura

        # 2. Si viene una foto, validarla y subirla a Cloudinary
        if foto and foto.filename:
            if not foto.content_type.startswith("image/"):
                raise HTTPException(
                    status_code=400, detail="El archivo debe ser una imagen válida.")

            # Subir a la nube
            upload_result = cloudinary.uploader.upload(
                foto.file,
                folder="neuromind_profiles",
                public_id=f"perfil_{current_user.id}",
                overwrite=True
            )

            # Guardar la URL segura
            current_user.picture = upload_result.get("secure_url")

        # 3. Guardar todo en PostgreSQL
        db.commit()
        db.refresh(current_user)
        return current_user

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Error al actualizar el perfil: {str(e)}")
