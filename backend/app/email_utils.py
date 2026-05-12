import os
from dotenv import load_dotenv
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from typing import List

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
    <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
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
        </body>
    </html>
    """

    message = MessageSchema(
        subject="Recuperación de Contraseña - NeuroMind AI",
        recipients=[email_destino],
        body=html,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    await fm.send_message(message)
    print(f"📧 Correo de recuperación enviado a {email_destino}")


# Función 2: Verificación de Cuenta (LA QUE TE FALTABA)
async def enviar_correo_verificacion(email_destino: EmailStr, codigo: str):
    """
    Función para enviar el código de activación de cuenta nueva.
    """
    html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; border-top: 5px solid #2E7D9A;">
                <h2 style="color: #2E7D9A; text-align: center;">Bienvenido a NeuroMind AI</h2>
                <p>¡Gracias por registrarte!</p>
                <p>Para activar tu cuenta, por favor ingresa el siguiente código de verificación:</p>
                
                <div style="background-color: #E0F2F1; color: #00695C; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; border-radius: 8px; margin: 20px 0;">
                    {codigo}
                </div>
                
                <p>Si no te has registrado en nuestra plataforma, puedes ignorar este correo.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #999; text-align: center;">NeuroMind AI - Sistema de Apoyo al Diagnóstico</p>
            </div>
        </body>
    </html>
    """

    message = MessageSchema(
        subject="Verifica tu cuenta - NeuroMind AI",
        recipients=[email_destino],
        body=html,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    await fm.send_message(message)
    print(f"📧 Correo de verificación enviado a {email_destino}")