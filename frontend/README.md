# 🎫 Mesa de Ayuda — Frontend (Angular + PrimeNG)

Cliente web de la Mesa de Ayuda: inicio de sesión, registro, tickets (crear, buscar, ver, cambiar estado) y listado de usuarios para administradores. Base para el **Examen Aplicado — Segundo Corte 2026-II** de Seguridad Informática (UMNG).

> Este código fue generado con asistentes de IA y se entrega **tal como salió**. Parte de su trabajo es auditarlo.

---

## 📋 Requisitos

- Node.js 22+ y npm
- Backend `mesa_ayuda_backend` en ejecución
- Docker (para el despliegue en `sg-frontend`)

## ▶️ Ejecución local

```bash
npm install
npm start          # http://localhost:4200
```

La URL del backend está definida en `src/app/services/api.service.ts`.

## 🐳 Docker

```bash
docker compose up -d --build     # sirve la aplicación con Nginx en el puerto 80
```

La configuración de Nginx está en `nginx.conf`.

## 📁 Estructura

```
mesa_ayuda_front/
├── src/app/
│   ├── app.ts / app.html        # Vistas: login, tickets, detalle, admin
│   ├── app-module.ts
│   └── services/api.service.ts  # Cliente HTTP y manejo de sesión
├── nginx.conf
├── Dockerfile
└── docker-compose.yml
```
