import pymysql
from pymysql.cursors import DictCursor

from app import config


def get_connection():
    return pymysql.connect(
        host=config.DB_HOST,
        port=config.DB_PORT,
        db=config.DB_NAME,
        user=config.DB_USER,
        password=config.DB_PASSWORD,
        cursorclass=DictCursor,
        autocommit=True,
    )


def fetch_one(sql, params=None):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchone()


def fetch_all(sql, params=None):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()


def execute(sql, params=None):
    """Ejecuta un INSERT/UPDATE y devuelve el id afectado."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.lastrowid


def init_db():
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS usuarios (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    email VARCHAR(120) NOT NULL,
                    password_hash VARCHAR(64) NOT NULL,
                    rol VARCHAR(20) NOT NULL DEFAULT 'usuario',
                    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tickets (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    titulo VARCHAR(150) NOT NULL,
                    descripcion TEXT NOT NULL,
                    prioridad VARCHAR(10) NOT NULL DEFAULT 'media',
                    estado VARCHAR(20) NOT NULL DEFAULT 'abierto',
                    usuario_id INT,
                    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
                )
                """
            )
