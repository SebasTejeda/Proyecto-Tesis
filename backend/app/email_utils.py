from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from typing import List

# --- CONFIGURACIÓN ---
# Reemplaza esto con TUS datos reales
conf = ConnectionConfig(
    MAIL_USERNAME = "tejedasebastian129@gmail.com",    # <--- PON TU GMAIL AQUÍ
    MAIL_PASSWORD = "iydx qfyo bpoi wchv",   # <--- PON LA CLAVE DE 16 LETRAS QUE ACABAS DE SACAR
    MAIL_FROM = "tejedasebastian129@gmail.com",        # <--- PON TU GMAIL AQUÍ OTRA VEZ
    MAIL_PORT = 587,
    MAIL_SERVER = "smtp.gmail.com",
    MAIL_STARTTLS = True,
    MAIL_SSL_TLS = False,
    USE_CREDENTIALS = True,
    VALIDATE_CERTS = True
)

async def enviar_correo_recuperacion(email_destino: EmailStr, codigo: str):
    """
    Función para enviar el código de recuperación al usuario.
    """
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
    print(f"📧 Correo enviado a {email_destino}")