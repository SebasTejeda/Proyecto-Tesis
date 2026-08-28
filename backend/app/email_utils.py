import os
from dotenv import load_dotenv
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from typing import Optional

load_dotenv(override=True)

conf = ConnectionConfig(
    MAIL_USERNAME = os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD"),
    MAIL_FROM = os.getenv("MAIL_FROM"),
    MAIL_PORT = int(os.getenv("MAIL_PORT")),
    MAIL_SERVER = os.getenv("MAIL_SERVER"),
    MAIL_STARTTLS = True,
    MAIL_SSL_TLS = False,
    USE_CREDENTIALS = True,
    VALIDATE_CERTS = True
)


async def enviar_correo_recuperacion(email_destino: EmailStr, codigo: str):
    html = f"""
    <html><body style="font-family: Arial, sans-serif; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #0d9488; text-align: center;">NeuroMind AI</h2>
            <p>Hola,</p>
            <p>Recibimos una solicitud para restablecer tu contraseña.</p>
            <p>Tu código de recuperación es:</p>
            <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 5px;">
                {codigo}
            </div>
            <p>Este código expirará en 15 minutos.</p>
            <p style="font-size: 12px; color: #777;">Si no solicitaste esto, ignora este mensaje.</p>
        </div>
    </body></html>
    """
    message = MessageSchema(subject="Recuperación de Contraseña - NeuroMind AI",
                            recipients=[email_destino], body=html, subtype=MessageType.html)
    await FastMail(conf).send_message(message)
    print(f"📧 Correo de recuperación enviado a {email_destino}")


async def enviar_correo_verificacion(email_destino: EmailStr, codigo: str):
    html = f"""
    <html><body style="font-family: Arial, sans-serif; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; border-top: 5px solid #2E7D9A;">
            <h2 style="color: #2E7D9A; text-align: center;">Bienvenido a NeuroMind AI</h2>
            <p>¡Gracias por registrarte!</p>
            <p>Para activar tu cuenta, ingresa el siguiente código de verificación:</p>
            <div style="background-color: #E0F2F1; color: #00695C; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; border-radius: 8px; margin: 20px 0;">
                {codigo}
            </div>
            <p>Una vez verificado tu correo, tu cuenta será revisada por nuestro equipo de administración antes de poder acceder al sistema.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">NeuroMind AI - Sistema de Apoyo al Diagnóstico</p>
        </div>
    </body></html>
    """
    message = MessageSchema(subject="Verifica tu cuenta - NeuroMind AI",
                            recipients=[email_destino], body=html, subtype=MessageType.html)
    await FastMail(conf).send_message(message)
    print(f"📧 Correo de verificación enviado a {email_destino}")


async def enviar_correo_aprobacion(email_destino: EmailStr, nombre: str):
    """Notifica al médico que su cuenta fue aprobada por el administrador."""
    html = f"""
    <html><body style="font-family: Arial, sans-serif; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; border-top: 5px solid #10b981;">
            <h2 style="color: #10b981; text-align: center;">¡Cuenta Aprobada! ✓</h2>
            <p>Estimado/a <strong>{nombre}</strong>,</p>
            <p>Nos complace informarte que tu solicitud de acceso a <strong>NeuroMind AI</strong> ha sido <strong>aprobada</strong> por nuestro equipo de administración.</p>
            <p>Ya puedes iniciar sesión y comenzar a utilizar el sistema de apoyo al diagnóstico.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="http://localhost:4200/login"
                   style="background-color: #10b981; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                    Iniciar Sesión
                </a>
            </div>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">NeuroMind AI - Sistema de Apoyo al Diagnóstico</p>
        </div>
    </body></html>
    """
    message = MessageSchema(subject="✓ Cuenta Aprobada - NeuroMind AI",
                            recipients=[email_destino], body=html, subtype=MessageType.html)
    await FastMail(conf).send_message(message)
    print(f"📧 Correo de aprobación enviado a {email_destino}")


async def enviar_correo_rechazo(email_destino: EmailStr, nombre: str, motivo: Optional[str] = None):
    """Notifica al médico que su cuenta fue rechazada."""
    motivo_html = f"""
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 4px; margin: 16px 0;">
            <strong>Motivo:</strong> {motivo}
        </div>
    """ if motivo else ""

    html = f"""
    <html><body style="font-family: Arial, sans-serif; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; border-top: 5px solid #ef4444;">
            <h2 style="color: #ef4444; text-align: center;">Solicitud No Aprobada</h2>
            <p>Estimado/a <strong>{nombre}</strong>,</p>
            <p>Lamentamos informarte que tu solicitud de acceso a <strong>NeuroMind AI</strong> no ha podido ser aprobada en este momento.</p>
            {motivo_html}
            <p>Si crees que hay un error o deseas más información, por favor contacta a nuestro equipo de soporte.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">NeuroMind AI - Sistema de Apoyo al Diagnóstico</p>
        </div>
    </body></html>
    """
    message = MessageSchema(subject="Solicitud de acceso - NeuroMind AI",
                            recipients=[email_destino], body=html, subtype=MessageType.html)
    await FastMail(conf).send_message(message)
    print(f"📧 Correo de rechazo enviado a {email_destino}")


async def enviar_correo_suspension(email_destino: EmailStr, nombre: str, motivo: Optional[str] = None):
    """Notifica al médico que su cuenta fue suspendida por el administrador."""
    motivo_html = f"""
        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin: 16px 0;">
            <strong>Motivo:</strong> {motivo}
        </div>
    """ if motivo else ""

    html = f"""
    <html><body style="font-family: Arial, sans-serif; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; border-top: 5px solid #f59e0b;">
            <h2 style="color: #f59e0b; text-align: center;">Cuenta Suspendida</h2>
            <p>Estimado/a <strong>{nombre}</strong>,</p>
            <p>Tu cuenta en <strong>NeuroMind AI</strong> ha sido <strong>suspendida temporalmente</strong> por nuestro equipo de administración.</p>
            {motivo_html}
            <p>Si crees que hay un error o deseas más información, por favor contacta a nuestro equipo de soporte.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">NeuroMind AI - Sistema de Apoyo al Diagnóstico</p>
        </div>
    </body></html>
    """
    message = MessageSchema(subject="Cuenta suspendida - NeuroMind AI",
                            recipients=[email_destino], body=html, subtype=MessageType.html)
    await FastMail(conf).send_message(message)
    print(f"📧 Correo de suspensión enviado a {email_destino}")


async def enviar_correo_eliminacion(email_destino: EmailStr, nombre: str, motivo: Optional[str] = None):
    """Notifica al médico que su cuenta fue eliminada por el administrador."""
    motivo_html = f"""
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 4px; margin: 16px 0;">
            <strong>Motivo:</strong> {motivo}
        </div>
    """ if motivo else ""

    html = f"""
    <html><body style="font-family: Arial, sans-serif; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; border-top: 5px solid #ef4444;">
            <h2 style="color: #ef4444; text-align: center;">Cuenta Eliminada</h2>
            <p>Estimado/a <strong>{nombre}</strong>,</p>
            <p>Tu cuenta en <strong>NeuroMind AI</strong> ha sido <strong>eliminada</strong> por nuestro equipo de administración y ya no podrás acceder al sistema.</p>
            {motivo_html}
            <p>Si crees que hay un error o deseas más información, por favor contacta a nuestro equipo de soporte.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">NeuroMind AI - Sistema de Apoyo al Diagnóstico</p>
        </div>
    </body></html>
    """
    message = MessageSchema(subject="Cuenta eliminada - NeuroMind AI",
                            recipients=[email_destino], body=html, subtype=MessageType.html)
    await FastMail(conf).send_message(message)
    print(f"📧 Correo de eliminación enviado a {email_destino}")