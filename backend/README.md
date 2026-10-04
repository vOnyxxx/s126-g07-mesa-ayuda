# 🎫 Mesa de Ayuda — Backend (FastAPI + MySQL)

API REST de una mesa de ayuda: registro e inicio de sesión con JWT, creación y consulta de tickets, y un módulo de administración. Base para el **Examen Aplicado — Segundo Corte 2026-II** de Seguridad Informática (UMNG).

> Este código fue generado con asistentes de IA y se entrega **tal como salió**. Parte de su trabajo es auditarlo.

---

## 📋 Requisitos

- Python 3.12+
- MySQL 8 / MariaDB 10.11+ accesible por red (en el examen: nodo `sg-db`, instalado **sin Docker**)
- Docker (para el despliegue en `sg-backend`)

## ⚙️ Variables de entorno

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DB_HOST` | Host de MySQL | IP Tailscale de `sg-db` |
| `DB_PORT` | Puerto de MySQL | `3306` |
| `DB_NAME` | Base de datos | `mesa_ayuda` |
| `DB_USER` / `DB_PASSWORD` | Credenciales | — |
| `JWT_SECRET` | Clave para firmar tokens | — |
| `GRUPO_CODIGO` | Código asignado a su grupo | `G07-XXXX` |
| `APP_PORT` | Puerto de la API | el asignado a su grupo |

## ▶️ Ejecución local

```bash
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
export DB_HOST=localhost DB_PASSWORD=... GRUPO_CODIGO=...
uvicorn app.main:app --reload --port 8000
```

Las tablas se crean automáticamente al arrancar.

## 🐳 Docker

```bash
# Ajuste .env con los valores de su grupo
docker compose up -d --build
docker compose logs -f
```

## 🔗 Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado y código del grupo |
| POST | `/auth/registro` | Crear usuario |
| POST | `/auth/login` | Obtener token JWT |
| GET | `/tickets` | Mis tickets |
| GET | `/tickets/buscar?q=` | Buscar en mis tickets |
| GET | `/tickets/{id}` | Ver ticket |
| POST | `/tickets` | Crear ticket |
| PATCH | `/tickets/{id}/estado` | Cambiar estado |
| GET | `/admin/usuarios` | Listado de usuarios (solo admin) |
| GET | `/docs` | Swagger UI |

Para crear un administrador:

```sql
UPDATE usuarios SET rol = 'admin' WHERE username = 'su_usuario';
```

## 📁 Estructura

```
mesa_ayuda_backend/
├── app/
│   ├── main.py        # Rutas
│   ├── security.py    # Hash de contraseñas y JWT
│   ├── database.py    # Conexión MySQL y creación de tablas
│   ├── schemas.py     # Modelos Pydantic
│   └── config.py      # Configuración por variables de entorno
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── .env
```
