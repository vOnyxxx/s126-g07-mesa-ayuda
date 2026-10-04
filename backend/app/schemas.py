from pydantic import BaseModel


class RegistroIn(BaseModel):
    username: str
    email: str
    password: str


class LoginIn(BaseModel):
    username: str
    password: str


class TicketIn(BaseModel):
    titulo: str
    descripcion: str
    prioridad: str = "media"


class EstadoIn(BaseModel):
    estado: str
