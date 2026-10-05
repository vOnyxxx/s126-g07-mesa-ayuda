import os

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_NAME = os.getenv("DB_NAME", "mesa_ayuda")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "changeme")

JWT_SECRET = os.getenv("JWT_SECRET", "mesa-ayuda-secret-2026")
JWT_ALGORITHM = "HS256"

GRUPO_CODIGO = os.getenv("GRUPO_CODIGO", "SIN-CODIGO")
APP_PORT = int(os.getenv("APP_PORT", "8000"))

# Origenes de navegador autorizados para llamar la API directamente (CORS).
# El flujo normal del frontend usa /api como ruta relativa detrás de Nginx,
# por lo que no depende de CORS; esta lista solo habilita pruebas directas
# (p. ej. Swagger) desde orígenes explícitos. Vacío por defecto: sin
# CORS_ORIGINS configurado, ningún navegador externo puede leer la
# respuesta de una petición con credenciales.
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
