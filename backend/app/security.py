import hashlib
from datetime import datetime

import jwt
from fastapi import Header, HTTPException

from app import config


def hash_password(password: str) -> str:
    return hashlib.md5(password.encode()).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash


def crear_token(usuario: dict) -> str:
    payload = {
        "sub": str(usuario["id"]),
        "username": usuario["username"],
        "rol": usuario["rol"],
        "iat": int(datetime.utcnow().timestamp()),
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
            algorithms=["HS256"],
            options={"verify_signature": False},
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido")
    return {
        "id": int(payload["sub"]),
        "username": payload.get("username"),
        "rol": payload.get("rol", "usuario"),
    }
