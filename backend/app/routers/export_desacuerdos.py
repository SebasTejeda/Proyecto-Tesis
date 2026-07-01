"""
Endpoint adicional para el admin — exportar desacuerdos para reentrenamiento del modelo.
Agregar este router en main.py:
  from .routers import export_desacuerdos
  app.include_router(export_desacuerdos.router, prefix="/admin/export", tags=["Admin Export"])
"""
import csv
import io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..dependencies import get_current_user
from .. import models

router = APIRouter()


@router.get("/desacuerdos", summary="Exportar desacuerdos del modelo como CSV")
def exportar_desacuerdos(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Admin: exporta todas las evaluaciones donde el doctor no concordó con el modelo.
    Útil para reentrenar el modelo con los casos objetados.
    """
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Solo administradores pueden exportar.")

    evaluaciones = db.query(models.Evaluation).options(
        joinedload(models.Evaluation.model_features),
        joinedload(models.Evaluation.model_prediction),
        joinedload(models.Evaluation.patient),
        joinedload(models.Evaluation.doctor)
    ).filter(
        models.Evaluation.doctor_agreement == "rejected",
        models.Evaluation.status == "Completado"
    ).order_by(models.Evaluation.date.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)

    # Encabezados
    writer.writerow([
        "evaluation_id", "fecha", "doctor_email",
        "paciente_id", "severidad_modelo", "razon_desacuerdo",
        "model_version",
        # Features del modelo
        "horas_sueno", "vida_social", "frecuencia_ejercicio",
        "redes_sociales", "nivel_estres", "calidad_sueno",
        "soledad_percibida", "apoyo_familiar", "autoestima",
        "estado_civil", "genero",
        # Predicción
        "risk_binary", "risk_probability", "severity"
    ])

    for ev in evaluaciones:
        f = ev.model_features
        p = ev.model_prediction
        doctor_email = ev.doctor.email if ev.doctor else ""

        writer.writerow([
            ev.id,
            ev.date.isoformat() if ev.date else "",
            doctor_email,
            ev.patient_id,
            p.severity if p else "",
            ev.disagreement_reason or "",
            ev.model_version or "v1.0",
            f.horas_sueno if f else "", f.vida_social if f else "",
            f.frecuencia_ejercicio if f else "", f.redes_sociales if f else "",
            f.nivel_estres if f else "", f.calidad_sueno if f else "",
            f.soledad_percibida if f else "", f.apoyo_familiar if f else "",
            f.autoestima if f else "", f.estado_civil if f else "",
            f.genero if f else "",
            p.risk_binary if p else "", p.risk_probability if p else "",
            p.severity if p else ""
        ])

    output.seek(0)
    filename = f"desacuerdos_modelo_{models.Evaluation.__tablename__}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/resumen-desacuerdos", summary="Resumen estadístico de desacuerdos")
def resumen_desacuerdos(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Admin: resumen de los motivos de desacuerdo más frecuentes."""
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Solo administradores pueden acceder.")

    evaluaciones = db.query(models.Evaluation).filter(
        models.Evaluation.doctor_agreement == "rejected"
    ).all()

    total = len(evaluaciones)
    motivos: dict = {}
    por_version: dict = {}

    for ev in evaluaciones:
        motivo = ev.disagreement_reason or "Sin motivo especificado"
        motivos[motivo] = motivos.get(motivo, 0) + 1

        version = ev.model_version or "v1.0"
        por_version[version] = por_version.get(version, 0) + 1

    return {
        "total_desacuerdos": total,
        "motivos_frecuentes": sorted(
            [{"motivo": k, "cantidad": v} for k, v in motivos.items()],
            key=lambda x: x["cantidad"], reverse=True
        ),
        "por_version_modelo": por_version
    }