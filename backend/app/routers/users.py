import random
import cloudinary.uploader
from fastapi import APIRouter, Depends, HTTPException, status, Form, File, UploadFile
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..dependencies import get_current_user
from .. import models, schemas, utils, email_utils

router = APIRouter()


@router.post("/", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
async def crear_usuario(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Registra un médico nuevo. Queda en estado 'pending' hasta que el admin lo apruebe."""
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="El correo ya está registrado")

    codigo = str(random.randint(1000, 9999))
    hashed_password = utils.HashUtils.get_password_hash(user.password)

    nuevo_usuario = models.User(
        email=user.email,
        password=hashed_password,
        nombres=user.nombres,
        apellidos=user.apellidos,
        codigo_colegiatura=user.codigo_colegiatura,
        is_verified=False,
        verification_code=codigo,
        account_status="pending",  # siempre empieza pendiente
        role="Doctor"
    )

    try:
        db.add(nuevo_usuario)
        db.commit()
        db.refresh(nuevo_usuario)
        await email_utils.enviar_correo_verificacion(user.email, codigo)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al crear el usuario: {str(e)}")

    return nuevo_usuario


@router.get("/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=schemas.UserResponse)
async def update_user_me(
    nombres: str = Form(...),
    apellidos: str = Form(...),
    codigo_colegiatura: str = Form(""),
    foto: UploadFile = File(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        current_user.nombres = nombres
        current_user.apellidos = apellidos
        current_user.codigo_colegiatura = codigo_colegiatura

        if foto and foto.filename:
            if foto.content_type not in ("image/jpeg", "image/png"):
                raise HTTPException(status_code=400, detail="Formato no soportado, use JPG o PNG")
            upload_result = cloudinary.uploader.upload(
                foto.file,
                folder="neuromind_profiles",
                public_id=f"perfil_{current_user.id}",
                overwrite=True
            )
            current_user.picture = upload_result.get("secure_url")

        db.commit()
        db.refresh(current_user)
        return current_user
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar el perfil: {str(e)}")


# ── Endpoints de administración de cuentas ────────────────────────────────────

@router.get("/admin/pending", response_model=List[schemas.DoctorPendingResponse])
def listar_medicos_pendientes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Admin: lista todos los médicos con cuenta pendiente de aprobación."""
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder.")

    pendientes = db.query(models.User).filter(
        models.User.role == "Doctor",
        models.User.account_status == "pending",
        models.User.is_verified == True  # solo los que ya verificaron su correo
    ).order_by(models.User.created_at.desc()).all()

    return pendientes


@router.get("/admin/all-doctors", response_model=List[schemas.DoctorPendingResponse])
def listar_todos_medicos(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Admin: lista todos los médicos con cualquier estado."""
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder.")

    doctores = db.query(models.User).filter(
        models.User.role == "Doctor"
    ).order_by(models.User.created_at.desc()).all()

    return doctores


@router.patch("/admin/{user_id}/status")
async def actualizar_estado_cuenta(
    user_id: int,
    data: schemas.AccountStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Admin: aprueba, rechaza, suspende, reactiva o elimina (lógicamente) la cuenta de un médico."""
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder.")

    acciones_validas = ("approve", "reject", "suspend", "delete", "reactivate")
    if data.action not in acciones_validas:
        raise HTTPException(status_code=400, detail=f"Acción inválida. Use una de: {', '.join(acciones_validas)}.")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    if data.action == "approve":
        user.account_status = "approved"
        db.commit()
        try:
            await email_utils.enviar_correo_aprobacion(user.email, user.nombres)
        except Exception as e:
            print(f"Error enviando correo de aprobación: {e}")
        return {"message": f"Cuenta de {user.nombres} aprobada correctamente."}

    if data.action == "reject":
        user.account_status = "rejected"
        db.commit()
        try:
            await email_utils.enviar_correo_rechazo(user.email, user.nombres, data.reason)
        except Exception as e:
            print(f"Error enviando correo de rechazo: {e}")
        return {"message": f"Cuenta de {user.nombres} rechazada."}

    if data.action == "suspend":
        user.account_status = "suspended"
        db.commit()
        try:
            await email_utils.enviar_correo_suspension(user.email, user.nombres, data.reason)
        except Exception as e:
            print(f"Error enviando correo de suspensión: {e}")
        return {"message": f"Cuenta de {user.nombres} suspendida."}

    if data.action == "reactivate":
        user.account_status = "approved"
        db.commit()
        try:
            await email_utils.enviar_correo_aprobacion(user.email, user.nombres)
        except Exception as e:
            print(f"Error enviando correo de reactivación: {e}")
        return {"message": f"Cuenta de {user.nombres} reactivada."}

    # delete (borrado lógico: conserva la fila para no romper relaciones con pacientes/evaluaciones)
    user.account_status = "deleted"
    db.commit()
    try:
        await email_utils.enviar_correo_eliminacion(user.email, user.nombres, data.reason)
    except Exception as e:
        print(f"Error enviando correo de eliminación: {e}")
    return {"message": f"Cuenta de {user.nombres} eliminada."}