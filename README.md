# Mesa de Ayuda segura — S126-G07

Repositorio del grupo **S126-G07** para el *take-home* de Seguridad Informática. Contiene el backend FastAPI, el frontend Angular, la infraestructura reproducible y la documentación técnica de una arquitectura híbrida protegida por Tailscale, con MySQL bastionado, publicación HTTPS mediante Cloudflare Tunnel y monitoreo centralizado con Wazuh y SonarQube.

> **Alcance de este README:** las Partes 1 a 4 describen la implementación y las verificaciones realizadas sobre la infraestructura del grupo. Las vulnerabilidades deliberadas del código base se conservan como objeto de análisis de la Parte 6; documentar una mitigación perimetral no significa que la vulnerabilidad de aplicación ya esté corregida.

## Estado general

| Parte | Componente | Estado documentado |
|---|---|---|
| 1 | Infraestructura y red privada Tailscale | Implementada |
| 2 | MySQL nativo y bastionado | Implementada y verificada |
| 3 | Backend FastAPI en Docker | Desplegado y conectado por TLS a MySQL |
| 4 | Frontend, Nginx y HTTPS | Desplegado mediante Cloudflare Tunnel |
| 5 | Wazuh, SonarQube y detección | Documentada en `docs/` |
| 6 | Ciclo DevSecOps | Pendiente de completar y verificar |

## Integrantes y equipos de trabajo

| Equipo | Responsable | Plataforma | Uso en la arquitectura |
|---|---|---|---|
| PC1 | Fernando Jaimes | Portátil con Windows 11 Home | Administración, Tailscale y acceso SSH |
| PC2 | Julián Reyes | Escritorio con Windows 10 Pro, Ryzen 7 3700X y 15.9 GB RAM | Anfitrión de `sg-reyes-security` |
| PC3 | Alexander Peña | Escritorio con Ryzen 5 4600G | Anfitrión de las VM de base de datos, backend y frontend |

Esta tabla identifica los equipos utilizados; el reparto académico definitivo debe coincidir con los *commits*, el informe IEEE y la participación de cada integrante en el video.

## Arquitectura desplegada

| Nodo | IP Tailscale | Servicio principal | Exposición |
|---|---:|---|---|
| `sg-reyes-db` | `100.68.48.48` | MySQL nativo en `33067/tcp` | Solo red privada y backend autorizado |
| `sg-reyes-backend` | `100.70.226.73` | FastAPI en Docker, `8107/tcp` | Tailscale; consumido por Nginx |
| `sg-reyes-frontend` | `100.74.98.91` | Angular, Nginx y `cloudflared` | Aplicación pública por HTTPS |
| `sg-reyes-security` | `100.121.21.113` | Wazuh y SonarQube | Solo administración por Tailscale |

Flujo principal:

```text
Internet
   |
   | HTTPS
   v
Cloudflare Tunnel
   |
   | conexión saliente desde sg-reyes-frontend
   v
Nginx + Angular (127.0.0.1:8080)
   |
   | /api/* por Tailscale
   v
FastAPI (100.70.226.73:8107)
   |
   | TLS por Tailscale
   v
MySQL (100.68.48.48:33067)

DB / backend / frontend -- eventos --> Wazuh
Código backend y frontend -- análisis --> SonarQube
```

La base de datos y la API no se publican directamente en Internet. El único punto público es el túnel HTTPS del frontend; los servicios administrativos permanecen dentro de la *tailnet*.

## Estructura del repositorio

```text
backend/                  Código y Dockerfile de FastAPI
frontend/                 Angular, Dockerfile y configuración Nginx
infra/
  backend/                Esquema y verificación de conexión TLS
  mysql/                  Bastionado, usuario mínimo y respaldo cifrado
  wazuh/                  Decodificador, reglas y prueba controlada
  tailscale-acl.hujson     Política de segmentación de la tailnet
docs/                     Evidencias y guías de demostración de la Parte 5
```

Las contraseñas, claves privadas, tokens y credenciales de producción no deben guardarse en estas carpetas ni mostrarse en capturas.

---

## Parte 1 — Infraestructura y red privada con Tailscale

### Diseño

Se desplegaron VM Ubuntu 24.04 separadas por función. Tailscale proporciona direccionamiento privado estable y comunicación autenticada entre nodos sin abrir los servicios internos al router doméstico. La separación por roles reduce el movimiento lateral: frontend, backend, base de datos y seguridad no comparten el mismo servicio ni la misma interfaz pública.

La política versionada en [`infra/tailscale-acl.hujson`](infra/tailscale-acl.hujson) define etiquetas para `db`, `backend`, `frontend` y `security`, además de los tres equipos administrativos.

### Flujos autorizados

| Origen | Destino | Puerto | Propósito |
|---|---|---:|---|
| `tag:frontend` | `tag:backend` | `8107/tcp` | Consumir la API |
| `tag:backend` | `tag:db` | `33067/tcp` | Consultar MySQL |
| Nodos y equipos administrativos | `tag:security` | `1514`, `1515/tcp` | Envío y registro de agentes Wazuh |
| Equipos administrativos | Todos los nodos | `22/tcp` | Administración SSH |
| Equipos administrativos | `tag:security` | `443`, `9000/tcp` | Wazuh Dashboard y SonarQube |
| Equipos administrativos | `tag:backend` | `8107/tcp` | Pruebas controladas de la API |

La misma ACL incorpora pruebas declarativas: el frontend puede llegar al backend, pero no a MySQL; el backend puede llegar a MySQL, pero no administrar la base por SSH; y los equipos administrativos no reciben acceso directo al puerto de datos de MySQL.

### Controles aplicados

- Segmentación de red por etiquetas y principio de mínimo privilegio.
- MySQL escucha únicamente en la IP Tailscale `100.68.48.48` y no en `0.0.0.0`.
- El backend publica `8107` únicamente sobre su IP Tailscale.
- Nginx se publica en `127.0.0.1:8080`; `cloudflared` se conecta localmente y abre un túnel saliente.
- Wazuh y SonarQube se administran mediante la red privada.
- No se requiere redirección de puertos entrantes en el router para publicar el frontend.

### Evidencias esperadas

Para demostrar esta parte, las capturas deben incluir los *hostnames* del grupo, el panel de Tailscale con los nodos, la ACL aplicada y pruebas positivas y negativas de conectividad. Una prueba denegada es tan importante como una exitosa porque demuestra la segmentación.

---

## Parte 2 — MySQL nativo y bastionado

### Instalación y exposición

MySQL **8.0.46** se instaló directamente en Ubuntu 24.04 sobre `sg-reyes-db`, sin contenedor. El servicio escucha en `100.68.48.48:33067`, usa la base `mesa_ayuda` y deshabilita MySQL X Protocol.

La configuración reproducible se conserva en [`infra/mysql/`](infra/mysql/):

- `99-s126-g07.cnf`: puerto asignado, `bind-address`, transporte seguro y opciones del servidor.
- `10-tailscale.conf`: dependencia de arranque para esperar a que exista la IP Tailscale.
- `02-password-policy.sql`: política de contraseñas.
- `03-app-user.sql`: usuario de aplicación con privilegios mínimos.
- `05-audit.sql`: ajustes de registro y auditoría disponibles para la práctica.
- `sg-mesa-backup.sh`, `.service` y `.timer`: respaldo automatizado y cifrado.
- `backup-recipient.txt`: solo destinatario público de `age`; nunca la identidad privada.

### Bastionado aplicado

- `root` permanece limitado a `root@localhost` mediante autenticación local.
- Se eliminaron cuentas anónimas, la base de pruebas y permisos asociados.
- `validate_password` usa política `MEDIUM` y longitud mínima de 16 caracteres.
- `require_secure_transport=ON` obliga conexiones cifradas.
- `skip_name_resolve=ON` evita depender de resolución DNS para autorizar usuarios.
- `general_log=OFF` reduce la exposición accidental de consultas y datos sensibles.
- La cuenta `app_mesa@100.70.226.73` usa `caching_sha2_password`, exige SSL y solo posee `SELECT`, `INSERT`, `UPDATE` y `DELETE` sobre `mesa_ayuda.*`.
- La cuenta de aplicación no puede crear esquemas, administrar usuarios ni realizar tareas de servidor.

### Verificación

La conexión desde el backend negoció **TLS 1.3** con `TLS_AES_256_GCM_SHA384`. También se verificó que el frontend no pudiera alcanzar `33067/tcp`, cumpliendo la separación frontend → backend → base de datos.

El respaldo diario se programa a las `08:00 UTC` (`03:00` en Colombia), se genera con `mysqldump` y se cifra con `age` antes de almacenarse. `Persistent=true` permite recuperar una ejecución perdida si la VM estaba apagada. La restauración se probó sobre una base temporal y los datos de prueba se eliminaron al finalizar.

### Riesgo controlado

Usar `root` desde la aplicación convertiría una inyección SQL en compromiso total del servidor. El usuario mínimo reduce el impacto, pero **no corrige una inyección SQL**: las consultas inseguras deben parametrizarse durante la Parte 6.

Más detalle: [`infra/mysql/README.md`](infra/mysql/README.md).

---

## Parte 3 — Backend FastAPI en Docker

### Línea base y construcción

La etiqueta `v-base` identifica la línea base del código sin correcciones de seguridad. El backend se construye desde [`backend/Dockerfile`](backend/Dockerfile) y se despliega con [`backend/docker-compose.yml`](backend/docker-compose.yml).

El contenedor publica:

```text
100.70.226.73:8107 -> contenedor:8107
```

De esta forma, la API queda disponible por Tailscale, no por todas las interfaces del anfitrión. La política de reinicio es `unless-stopped`.

### Configuración sensible

El archivo Compose referencia `/etc/mesa-ayuda/backend.env`, ubicado fuera del repositorio. Allí deben vivir la contraseña de base de datos, el secreto JWT y demás variables sensibles. El repositorio solo debe conservar nombres de variables o ejemplos sin valores reales.

El esquema se prepara con [`infra/backend/01-schema.sql`](infra/backend/01-schema.sql) mediante una cuenta administrativa separada. Después, el servicio opera con `app_mesa`, que carece de permisos DDL. [`infra/backend/02-verify-db.py`](infra/backend/02-verify-db.py) permite comprobar la conexión y el transporte cifrado sin ampliar los privilegios de la aplicación.

### Ruta de comunicación

```text
Angular/Nginx
   -> GET/POST /api/*
FastAPI en 100.70.226.73:8107
   -> conexión MySQL con TLS
MySQL en 100.68.48.48:33067
```

Se verificaron el endpoint de salud desde el frontend, la documentación de la API desde equipos administrativos autorizados y la conexión TLS a MySQL desde el contenedor. La base de datos no necesita aceptar conexiones del frontend.

### Consideraciones de seguridad

- Las reglas de firewall del anfitrión deben revisarse junto con las cadenas que Docker crea en `iptables`; UFW por sí solo no siempre controla un puerto publicado por Docker.
- Los registros de la API deben enviarse a Wazuh sin incluir contraseñas, tokens ni cadenas de conexión.
- Las vulnerabilidades deliberadas del backend base —por ejemplo, consultas inseguras, exposición de configuración o validación débil de tokens— pertenecen a la Parte 6 y no deben declararse corregidas sin evidencia antes/después.

---

## Parte 4 — Frontend, reverse proxy y HTTPS

### Despliegue

Angular se compila y sirve desde Nginx en Docker mediante [`frontend/Dockerfile`](frontend/Dockerfile) y [`frontend/docker-compose.yml`](frontend/docker-compose.yml). El contenedor solo publica Nginx en el *loopback* del nodo:

```text
127.0.0.1:8080 -> contenedor:80
```

El frontend utiliza rutas relativas `/api`, evitando direcciones Tailscale en el navegador del usuario. Nginx actúa como *reverse proxy* hacia `http://100.70.226.73:8107/`; por tanto, el navegador solo habla con el origen HTTPS público y Nginx realiza internamente el salto privado hacia FastAPI.

### Controles de Nginx

[`frontend/nginx.conf`](frontend/nginx.conf) implementa:

- `server_tokens off` y `autoindex off`.
- Tamaño máximo de solicitud de `1 MiB`.
- Limitación de autenticación a `10` solicitudes por minuto, con ráfaga controlada.
- Bloqueo explícito de `/api/debug/` con respuesta `404` en el perímetro.
- `Content-Security-Policy` restrictiva; se conserva `'unsafe-inline'` únicamente en estilos por compatibilidad con Angular/PrimeNG.
- `X-Content-Type-Options: nosniff`.
- `X-Frame-Options: DENY` y `frame-ancestors 'none'`.
- `Referrer-Policy: no-referrer`.
- `Permissions-Policy` sin cámara, micrófono, geolocalización, pagos ni USB.
- Propagación de IP y protocolo originales mediante encabezados `X-Forwarded-*`.

El bloqueo perimetral de `/api/debug/` reduce exposición pública, pero no sustituye la eliminación o autorización correcta del endpoint dentro del backend.

### Cloudflare Tunnel y HTTPS

`cloudflared` establece una conexión **saliente** desde `sg-reyes-frontend` hacia Cloudflare y reenvía al origen local `http://127.0.0.1:8080`. Un servicio `systemd` mantiene el proceso y lo reinicia ante fallos. Cloudflare termina TLS para el usuario; el tráfico Nginx → backend viaja por Tailscale.

Durante las pruebas se usó un **Quick Tunnel**, cuya URL es temporal y puede cambiar al reiniciar el servicio. La evidencia debe mostrar la URL vigente, el candado HTTPS, los encabezados de seguridad y una operación real —inicio de sesión o consulta de tickets— con respuesta `200`.

### Resultado funcional

- La aplicación se carga por HTTPS sin contenido mixto.
- Las peticiones del navegador usan el mismo origen mediante `/api`.
- Nginx alcanza FastAPI por la IP privada de Tailscale.
- No se abre un puerto público directo hacia Nginx, FastAPI o MySQL.
- Las cabeceras de endurecimiento se aplican incluso en respuestas de error por el modificador `always`.

---

## Parte 5 — Monitoreo y detección

- [Implementación y alcance](docs/parte-5-centro-monitoreo.md)
- [Matriz de evidencias](docs/evidencias-parte-5.md)
- [Archivos para el informe IEEE](docs/entrega-companero-parte-5.md)
- [Plan de demostración de 11 minutos](docs/plan-demostracion-parte-5.md)
- [Reglas y decodificador Wazuh](infra/wazuh/README.md)

La prueba D3 empleó la dirección reservada para documentación `198.51.100.77`. Demuestra detección, correlación y activación del flujo de respuesta, pero no el bloqueo de un computador real.

## Evidencias y criterios de entrega

Antes de entregar, se debe comprobar que:

1. Las capturas muestran `S126-G07`, los *hostnames* y las IP asignadas al grupo.
2. La etiqueta `v-base` conserva el código inicial y la rama de trabajo usa los apellidos paternos.
3. El historial permite atribuir el trabajo a cada integrante.
4. El docente fue invitado como colaborador del repositorio.
5. `infra/` contiene las ACL, configuración de MySQL y reglas de Wazuh. La configuración activa de Nginx está en `frontend/nginx.conf`; antes de entregar se debe agregar también la copia exigida por la rúbrica dentro de `infra/` y mantener ambas sincronizadas.
6. `docs/` contiene los informes antes/después exigidos para SonarQube, Bearer y ZAP cuando se complete la Parte 6.
7. La aplicación sigue funcionando después de todas las correcciones.
8. Ningún secreto aparece en el estado actual **ni en el historial de Git**.

## Advertencias de seguridad pendientes

- Existe evidencia de que el material base pudo contener credenciales versionadas. Antes de la entrega se deben **rotar**, retirar del árbol actual y sanear del historial; borrarlas únicamente en un commit nuevo no elimina las copias anteriores.
- No se deben copiar valores reales de archivos `.env` a este README, al informe, al video ni a las capturas.
- La URL de Quick Tunnel no es permanente y no debe tratarse como un dominio estable.
- La Parte 6 requiere evidencias comparativas antes/después; no basta con describir la intención de corregir.

## Referencia rápida de controles

| Capa | Control principal | Riesgo reducido |
|---|---|---|
| Red | Tailscale + ACL por roles | Exposición y movimiento lateral |
| Datos | MySQL privado, TLS y usuario mínimo | Acceso directo y abuso de privilegios |
| Aplicación | Backend aislado y configuración externa | Exposición de servicios y secretos actuales |
| Perímetro | Nginx, HTTPS, cabeceras y *rate limiting* | Ataques web y abuso de autenticación |
| Detección | Wazuh + SonarQube | Falta de visibilidad y detección tardía |
