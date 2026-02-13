# Importación de las librerías
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# URL de la base de datos
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:1234@localhost/tesis_db"

# Creación del motor de la base de datos
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Creación de la sesión de la base de datos
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Creación de la clase base para los modelos
Base = declarative_base()

# Función para obtener una sesión de la base de datos
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
