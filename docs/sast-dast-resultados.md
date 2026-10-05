# Parte 6.3 — Resultados SAST/DAST (Bearer CLI y OWASP ZAP)

Grupo S126-G07 · Ejecutado el 4 de octubre de 2026

**Alcance de esta ejecución.** Bearer y ZAP se corrieron contra una instancia
local y aislada (backend FastAPI + MariaDB, sin tocar `sg-security` ni la
infraestructura real del grupo), sobre dos versiones del código: `v-base`
(antes) y la rama `parte6-devsecops` (después). El equipo debe repetir esta
misma secuencia contra `sg-backend`/`sg-frontend` reales y, para ZAP, contra
la URL pública de Cloudflare Tunnel, como exige 6.3; esta ejecución sirve como
plantilla y como evidencia de que las correcciones SÍ se reflejan en las
herramientas.

No se instaló SonarQube en esta sesión (requiere un servidor con base de
datos propia, más apto para `sg-security`); el grupo ya tiene el suyo
desplegado según la Parte 5 y debe correrlo sobre esta misma rama.

---

## Bearer CLI 1.49.0

Instalado desde el binario oficial de GitHub (`Bearer/bearer`) y ejecutado con
el ruleset oficial de `bearer/bearer-rules` (clonado directamente porque la
API de GitHub no es alcanzable desde este entorno; no afecta el resultado,
son las mismas reglas que descarga el CLI en una ejecución normal).

```
bearer scan backend  --external-rule-dir bearer-rules/rules --format html --output docs/bearer/bearer-backend-<version>.html
bearer scan frontend --external-rule-dir bearer-rules/rules --format html --output docs/bearer/bearer-frontend-<version>.html
```

### Backend

| | v-base (antes) | parte6-devsecops (después) |
|---|---|---|
| Critical | 4 | 3 |
| Medium | 3 | 3 |
| Low | 0 | 0 |

**Hallazgos críticos en v-base:**
- `python_lang_jwt_verification_bypass` — `security.py:33` (hallazgo 3 ⭐)
- `python_lang_sql_injection` — `database.py:22,29,37` (los tres helpers
  genéricos `fetch_one`/`fetch_all`/`execute`)

**Hallazgos críticos tras la corrección:** solo persisten los tres de
`database.py`. **Esto es un falso positivo explicable, no una falla real
pendiente**: Bearer marca la *función genérica* que ejecuta cualquier cadena
SQL recibida como parámetro (`cursor.execute(sql, params)`), sin poder
rastrear si cada *llamador* de esa función ya parametriza correctamente. Tras
la corrección, los dos llamadores reales que antes concatenaban strings
(`login`, `buscar_tickets`, hallazgos 1 y 2) ya pasan `%s` + una tupla de
parámetros — se verificó manualmente leyendo `main.py` línea por línea — pero
Bearer sigue señalando el *sumidero* (`database.py`) porque, en abstracto,
nada impide que un futuro desarrollador vuelva a llamarlo con una cadena ya
concatenada. Es exactamente el caso que describe 6.2: "si una herramienta no
reporta [o, en este caso, sigue reportando] una falla que ustedes sí
[entienden], expliquen por qué". La corrección real se confirma por otra vía:
el payload `UNION SELECT` que antes devolvía un token admin ahora responde
`401` (ver `docs/hallazgos-parte6.md`, hallazgo 1).

El hallazgo crítico de JWT (`verify_signature: False`) **sí desapareció**
limpiamente tras la corrección — ejemplo de un caso donde la herramienta
detecta tanto la falla como su corrección sin ambigüedad.

**Hallazgos medium que persisten (ambas versiones):** `python_lang_logger` en
las tres llamadas a `logger.info`/`logger.warning` de `main.py`. Bearer
clasifica como "medium" cualquier log que incluya variables que su
clasificador considera dato personal (`username`, `email`), sin distinguir
que ya no se registra la contraseña (lo que sí corregimos, hallazgo 6). Es
otro falso positivo razonable: el username en un log de autenticación es
información operativa normal (y necesaria para la regla D2 de Wazuh); lo que
sí había que eliminar — y se eliminó — era la contraseña en texto plano.

**Hallazgo que desapareció:** `python_lang_weak_hash_md5` (hallazgo 4, MD5 →
bcrypt) — confirmado limpiamente por la herramienta.

### Frontend

| | v-base (antes) | parte6-devsecops (después) |
|---|---|---|
| Low | 2 | 1 |

El ruleset por defecto de Bearer para TypeScript/Angular **no tiene una regla
específica para `bypassSecurityTrustHtml`** (el XSS almacenado, hallazgo 9
⭐), por lo que ni antes ni después aparece como hallazgo "crítico" en este
reporte — es un ejemplo exacto de lo que pide documentar 6.1 ("por qué esa
herramienta lo ve o no lo ve"): Bearer está orientado principalmente a
flujos de datos sensibles y fallas de backend; una API insegura de
sanitización de Angular específica queda fuera de su ruleset estándar. Ese
hallazgo se evidenció por revisión manual del código y se confirmó con una
prueba E2E en navegador real (Playwright), no con esta herramienta — ver
`docs/hallazgos-parte6.md`, hallazgo 9.

Archivos: `docs/bearer/bearer-{backend,frontend}-{antes-vbase,despues-corregido}.html`

---

## OWASP ZAP 2.16.1 (baseline — spider + active scan pasivo/activo sin auth)

Instalado desde el paquete oficial `ZAP_2.16.1_Linux.tar.gz` de
`zaproxy/zaproxy` en GitHub (el registro de contenedores `ghcr.io` no es
alcanzable desde este entorno; el paquete standalone es funcionalmente
equivalente al baseline scan de la imagen Docker). Ejecutado con:

```
zap.sh -cmd -quickurl <url> -quickout docs/zap/zap-<componente>-<version>.html -quickprogress
```

### Backend (`/docs`, Swagger)

| | v-base (antes) | parte6-devsecops (después) |
|---|---|---|
| High | 0 | 0 |
| Medium | 2 (CSP ausente, sin header anti-clickjacking) | 2 (idénticos) |
| Low | 2 (inclusión JS cross-domain, X-Content-Type-Options ausente) | 2 (idénticos) |

**Resultado idéntico antes y después, y es lo esperado.** Estos hallazgos son
encabezados de seguridad HTTP (CSP, X-Frame-Options, X-Content-Type-Options)
que, en la arquitectura real del examen, son responsabilidad de **Nginx en
sg-frontend** (Parte 4), no del backend FastAPI — el backend nunca debe ser
accedido directamente por un navegador en producción (solo por
`sg-frontend` vía la tailnet). El propio informe de la Parte 4 del grupo ya
documenta que esos encabezados sí están configurados correctamente en
`frontend/nginx.conf`. Este hallazgo de ZAP confirma que el backend "desnudo"
carece de ellos (correcto, nunca se agregaron ahí) y no debe interpretarse
como una regresión de la Parte 6.

### Frontend (build compilado, servido sin autenticación)

| | v-base (antes) | parte6-devsecops (después) |
|---|---|---|
| High | 0 | 0 |
| Medium | 2 | 2 (idénticos) |
| Low | 2 | 2 (idénticos) |

**Resultado idéntico antes y después — y esto es precisamente el punto que
señala 6.2.** Un baseline scan de ZAP sin credenciales configuradas solo
puede rastrear (`spider`) las páginas públicas (login/registro); nunca
alcanza la vista de detalle de un ticket porque esa ruta requiere sesión
autenticada. El **XSS almacenado (hallazgo 9 ⭐) no aparece en ningún reporte
de ZAP de esta ejecución**, ni antes ni después, no porque esté ausente o
corregido según la herramienta, sino porque ZAP nunca llegó a ejecutarse
contra el único flujo donde vive: crear un ticket autenticado y abrirlo. Para
que ZAP lo detectara haría falta un *Authentication Script* o un contexto con
credenciales de prueba, que no se configuró en este baseline. Esto confirma
textualmente el punto de la consigna: "no todas las fallas las ve una
herramienta automática" — el hallazgo 9 se encontró y se verificó por lectura
de código y por una prueba E2E manual con Playwright (ver
`docs/hallazgos-parte6.md`), no por ZAP.

Archivos: `docs/zap/zap-{backend,frontend}-{antes-vbase,despues-corregido}.html`

---

## Conclusión metodológica

Esta ejecución confirma tres cosas distintas, y es importante no mezclarlas:

1. **Lo que las herramientas detectaron y confirmaron corregido**: JWT sin
   verificar firma (Bearer) y MD5 sin sal (Bearer).
2. **Lo que las herramientas no pueden confirmar por su propia naturaleza**:
   SQLi en los llamadores reales (Bearer solo ve el sumidero genérico, no
   discrimina por sitio de llamada) y logging de contraseñas (Bearer marca
   cualquier log con username, no distingue si incluye o no la contraseña).
   Ambos se confirman por lectura de código y por explotación controlada
   (ver fichas de hallazgos 1, 2 y 6).
3. **Lo que ninguna herramienta automática de esta ejecución alcanzó a ver**:
   el XSS almacenado y el IDOR de tickets, ambos detrás de autenticación y
   de lógica de negocio que un escáner genérico sin contexto de sesión no
   puede evaluar. Se encontraron y verificaron manualmente (ver
   `docs/hallazgos-parte6.md`, hallazgos 5 y 9).

Un Quality Gate o un reporte "limpio" de cualquier herramienta nunca certifica
ausencia de vulnerabilidades — certifica que esa herramienta, con ese
alcance y esa configuración, no encontró nada dentro de lo que sabe buscar.
