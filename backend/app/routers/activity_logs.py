"""
Router de logs de actividad.
Agregar en main.py:
  from .routers import activity_logs
  app.include_router(activity_logs.router, prefix="/admin/logs", tags=["Admin Logs"])
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from datetime import datetime

from ..database import get_db
from ..dependencies import get_current_user
from .. import models

router = APIRouter()

ACTION_LABELS = {
    "login":          "Inicio de sesión",
    "login_google":   "Inicio de sesión (Google)",
    "logout":         "Cierre de sesión",
    "account_locked": "Cuenta bloqueada",
}


@router.get("/", summary="Obtener logs de actividad")
def get_activity_logs(
    limit: int = Query(50, le=200),
    action: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder.")

    query = db.query(models.ActivityLog).options(
        joinedload(models.ActivityLog.user)
    )

    if action:
        query = query.filter(models.ActivityLog.action == action)

    logs = query.order_by(models.ActivityLog.created_at.desc()).limit(limit).all()

    return [
        {
            "id": log.id,
            "fecha": log.created_at.isoformat() if log.created_at else "",
            "usuario_email": log.user.email if log.user else "—",
            "usuario_nombre": f"{log.user.nombres} {log.user.apellidos}" if log.user else "—",
            "accion": ACTION_LABELS.get(log.action, log.action),
            "accion_key": log.action,
            "detalle": log.detail or "—",
            "ip": log.ip_address or "—",
        }
        for log in logs
    ]


@router.get("/acciones", summary="Listar tipos de acción disponibles")
def get_action_types(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder.")

    acciones = db.query(models.ActivityLog.action).distinct().all()
    return [
        {"key": a[0], "label": ACTION_LABELS.get(a[0], a[0])}
        for a in acciones
    ]