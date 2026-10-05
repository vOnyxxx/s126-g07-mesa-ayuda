import hashlib
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Header, HTTPException

from app import config

TOKEN_TTL = timedelta(hours=8)
CLOCK_LEEWAY_SECONDS = 10  # tolera el desfase de reloj entre nodos de la tailnet


def hash_password(password: str) -> str:
    return hashlib.md5(password.encode()).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash


def crear_token(usuario: dict) -> str:
    ahora = datetime.now(timezone.utc)
    payload = {
        "sub": str(usuario["id"]),
        "username": usuario["username"],
        "rol": usuario["rol"],
        "iat": int(ahora.timestamp()),
        "exp": int((ahora + TOKEN_TTL).timestamp()),
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)


def usuario_actual(authorization: str = Header(default="")) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token requerido")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(
            token,
            config.JWT_SECRET,
            algorithms=[config.JWT_ALGORITHM],
            leeway=CLOCK_LEEWAY_SECONDS,
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido")
    return {
        "id": int(payload["sub"]),
        "username": payload.get("username"),
        "rol": payload.get("rol", "usuario"),
    }
