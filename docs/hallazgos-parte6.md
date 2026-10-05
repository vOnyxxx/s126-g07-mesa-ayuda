# Parte 6 — Ciclo DevSecOps: hallazgos, causa raíz, corrección y verificación

Grupo S126-G07 · Mesa de Ayuda S.A.S. · Repositorio base, commit `v-base` (a0e290b)
Rama de corrección: `parte6-devsecops` (commits `c168522` → `94c441a`)

Metodología: cada hallazgo se explotó primero contra una instancia local de
`v-base` (MariaDB 10.11 + backend FastAPI, aislada, sin tocar la infraestructura
real del grupo), con evidencia de consola guardada en `evidencia/`. Después se
corrigió en un commit propio (o grupo lógico de commits) y se repitió el mismo
ataque contra el backend ya corregido para confirmar que deja de funcionar sin
romper el uso legítimo. Dos hallazgos (XSS, #9) se verificaron además con
Playwright/Chromium en un navegador real, con y sin el parche.

Se cubrieron los 11 hallazgos listados en la consigna (el mínimo exigido es 7,
incluyendo las 4 marcadas con ⭐).

---

## Hallazgo 1 ⭐ — Inyección SQL en el login

**Identificación.** `backend/app/main.py`, función `login` (línea 70-73 en
`v-base`):
```python
query = (
    f"SELECT id, username, rol, password_hash FROM usuarios "
    f"WHERE username = '{datos.username}'"
)
usuario = fetch_one(query)
```

**Clasificación.** OWASP A03:2021 – Inyección. CWE-89 (SQL Injection).

**Causa raíz.** El valor que llega del cliente (`datos.username`) se concatena
directamente dentro de la cadena SQL con un f-string, en vez de pasarse como
parámetro al driver (`pymysql`). El motor de base de datos no puede distinguir
entre "datos" y "código SQL": cualquier comilla simple en el username rompe la
intención original de la consulta y permite inyectar cláusulas SQL arbitrarias.

**Cómo se detecta.** Un SAST como SonarQube o Bearer marca este patrón como
`java:S2077`/regla equivalente de "SQL built from user input" apenas ve un
f-string u concatenación de cadenas pasada a `cursor.execute`. ZAP (DAST) lo
detectaría con su escáner activo de SQLi si se prueba el endpoint
`/auth/login`, aunque puede requerir payloads específicos de autenticación
porque el endpoint no refleja el error SQL en la respuesta (fallo "silencioso"
que dificulta la inyección a ciegas clásica basada en errores).

**Demostración del impacto.** Contra la instancia local:
```
POST /auth/login
{"username": "noexiste' UNION SELECT 1,'admin','admin','6b5e7fab1c26eb98ced96aa5f7cae5d7' -- -",
 "password": "hacked123"}
```
`6b5e7fab1c26eb98ced96aa5f7cae5d7` es `MD5("hacked123")`, precalculado por el
atacante. La consulta queda:
```sql
SELECT id, username, rol, password_hash FROM usuarios
WHERE username = 'noexiste' UNION SELECT 1,'admin','admin','6b5e7...' -- -'
```
`fetch_one` devuelve la fila **fabricada por el atacante**, con el hash que él
mismo controla. `verify_password` compara ese hash con `MD5("hacked123")` y
coincide. Resultado real: `HTTP 200`, token válido con `rol: admin`, sin
conocer ninguna credencial real (`evidencia/antes-sqli-login.txt`).

**Corrección.** Commit `c168522`. Se reemplaza el f-string por una consulta
parametrizada:
```python
usuario = fetch_one(
    "SELECT id, username, rol, password_hash FROM usuarios WHERE username = %s",
    (datos.username,),
)
```
`pymysql` escapa el valor correctamente antes de enviarlo al servidor; el
contenido del campo ya no puede alterar la estructura de la consulta.

**Verificación.** El mismo payload exacto contra el backend corregido responde
`401 Unauthorized`; el login legítimo de un usuario real sigue funcionando sin
cambios (`evidencia/` + salida de consola en la sesión de pruebas).

---

## Hallazgo 2 — Inyección SQL en la búsqueda de tickets

**Identificación.** `backend/app/main.py`, función `buscar_tickets`
(línea 90-96 en `v-base`):
```python
query = (
    f"SELECT * FROM tickets WHERE usuario_id = {usuario['id']} "
    f"AND titulo LIKE '%{q}%' ORDER BY id DESC"
)
return fetch_all(query)
```

**Clasificación.** OWASP A03:2021 – Inyección. CWE-89.

**Causa raíz.** Aunque `usuario['id']` proviene del JWT ya validado (no del
cliente directamente), el término de búsqueda `q` sí es 100% controlado por el
atacante y se concatena sin escapar dentro de un `LIKE`. Al romper las comillas
del patrón `LIKE`, el atacante puede añadir una cláusula `OR` que anule el
filtro `usuario_id`, convirtiendo un buscador de "mis tickets" en un buscador
de "todos los tickets".

**Cómo se detecta.** Igual que el hallazgo 1: SAST marca la construcción de
SQL por concatenación. Un DAST o una prueba manual lo encuentra probando
caracteres especiales (`'`, `%`, `--`) en el parámetro `q` y observando que
aparecen resultados que no deberían pertenecer al usuario autenticado.

**Demostración del impacto.** Con el token de `alice` (usuario_id=1):
```
GET /tickets/buscar?q=x%' OR usuario_id=2 -- -
```
Devuelve el ticket de `bob` (usuario_id=2), que no le pertenece a alice
(`evidencia/antes-sqli-buscar.txt`).

**Corrección.** Commit `c168522`. Parametrización completa y escape explícito
de los comodines de `LIKE` (`%`, `_`, `\`) para que el propio usuario no pueda
inyectar su patrón dentro del patrón:
```python
patron = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
return fetch_all(
    "SELECT * FROM tickets WHERE usuario_id = %s AND titulo LIKE %s ORDER BY id DESC",
    (usuario["id"], f"%{patron}%"),
)
```

**Verificación.** El mismo payload contra el backend corregido devuelve una
lista vacía (alice no tiene ningún ticket con ese texto literal en el título);
una búsqueda normal (`q=Secreto`) sigue funcionando sobre los tickets propios.

---

## Hallazgo 3 ⭐ — El servidor no verifica la firma del JWT

**Identificación.** `backend/app/security.py`, función `usuario_actual`
(línea 32-38 en `v-base`):
```python
payload = jwt.decode(
    token,
    config.JWT_SECRET,
    algorithms=["HS256"],
    options={"verify_signature": False},
)
```

**Clasificación.** OWASP A07:2021 – Fallas de identificación y autenticación
(y A02 – Fallas criptográficas, por el mal uso de la primitiva JWT). CWE-347
(Improper Verification of Cryptographic Signature).

**Causa raíz.** `verify_signature: False` le indica a PyJWT que **no**
compruebe que el token fue firmado con el secreto del servidor. JWT decodifica
el payload en base64 sin más: cualquiera puede escribir su propio JSON
(`{"sub": "2", "rol": "admin", ...}`), codificarlo y firmarlo con cualquier
cadena arbitraria (ni siquiera necesita el secreto real), y el servidor lo
acepta igual porque nunca compara la firma.

**Cómo se detecta.** SAST (Bearer tiene una regla específica para
`verify_signature=False`/`algorithms=none` en librerías JWT de varios
lenguajes; SonarQube con reglas de seguridad también la marca). Manualmente
también es trivial: basta con generar cualquier JWT con `pyjwt`/jwt.io sin
conocer el secreto y probarlo contra un endpoint protegido.

**Demostración del impacto.** Un atacante sin ninguna credencial genera:
```python
jwt.encode({"sub": "2", "username": "bob", "rol": "admin", "iat": 0},
           "clave-totalmente-inventada", algorithm="HS256")
```
y lo envía a `GET /admin/usuarios`. El servidor responde `200 OK` con la lista
completa de usuarios y sus hashes (`evidencia/antes-jwt-sin-firma.txt`).

**Corrección.** Commit `7ee5aa1`. Se quita la opción y se deja que PyJWT
valide la firma con el secreto real:
```python
payload = jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM],
                      leeway=CLOCK_LEEWAY_SECONDS)
```
Al activar la verificación completa apareció un bug latente que la propia
falla ocultaba: `crear_token` generaba `iat` con
`datetime.utcnow().timestamp()`, que interpreta un datetime *naive* como hora
local y lo reconvierte a época, desplazando el `iat` varias horas según la
zona horaria del proceso. Con `verify_signature=False`, PyJWT tampoco valida
`iat`/`exp`, así que el bug nunca se manifestaba. Se corrige con
`datetime.now(timezone.utc)`, se añade `exp` (vigencia de 8 horas) y un
*leeway* de reloj para tolerar el desfase normal entre nodos de la tailnet.

**Verificación.** El mismo token forjado con secreto arbitrario que antes
devolvía `200` en `/admin/usuarios` ahora responde `401 Token inválido`; un
token emitido legítimamente por `/auth/login` sigue siendo aceptado por los
endpoints protegidos.

---

## Hallazgo 4 — Contraseñas con MD5 sin sal

**Identificación.** `backend/app/security.py` (línea 10-11 en `v-base`):
```python
def hash_password(password: str) -> str:
    return hashlib.md5(password.encode()).hexdigest()
```

**Clasificación.** OWASP A02:2021 – Fallas criptográficas. CWE-916 (Use of
Password Hash With Insufficient Computational Effort) / CWE-759 (sin sal).

**Causa raíz.** MD5 fue diseñado para verificar integridad, no para proteger
contraseñas: es extremadamente rápido (miles de millones de hashes/segundo en
una GPU de consumo), por lo que un atacante con la tabla `usuarios` puede
probar diccionarios completos en minutos. Al no usar sal, dos usuarios con la
misma contraseña producen el mismo hash, lo que además habilita tablas
arcoíris precalculadas y permite a cualquiera con lectura de la tabla (por
ejemplo vía el propio endpoint `/admin/usuarios`, o un volcado de base de
datos) comparar hashes entre sí para detectar contraseñas repetidas.

**Cómo se detecta.** SAST (regla estándar "uso de algoritmo hash débil para
contraseñas" en SonarQube/Bearer, activa para MD5/SHA1 sin factor de costo).
Manualmente, basta con mirar la longitud del hash (32 hex = MD5) y confirmarlo
recalculando `md5(password)`.

**Demostración del impacto.** Los hashes reales de `alice` y `bob` en la base
de prueba se recalcularon offline en milisegundos con `hashlib.md5` —
`evidencia/antes-md5-passwords.txt` muestra que ambos corresponden
exactamente a `MD5("Clave123!")` y `MD5("Clave456!")`.

**Corrección.** Commit `2a57f71`. Se reemplaza por `bcrypt` (sal aleatoria por
hash, factor de costo configurable):
```python
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:
        return False  # hash legado MD5: ya no autentica, requiere reset
```
Se amplía `password_hash` a `VARCHAR(100)` (bcrypt produce 60 caracteres) en
`infra/backend/01-schema.sql` y en el `init_db()` del backend, y se agrega
`bcrypt` a `requirements.txt`.

**Verificación.** Un usuario con hash MD5 heredado ya no puede iniciar sesión
con su contraseña correcta (debe resetearla); un usuario nuevo se registra, su
hash en la base ya no es MD5 (prefijo `$2b$`) y el login funciona de extremo a
extremo con ese hash.

---

## Hallazgo 5 ⭐ — Control de acceso roto (IDOR) en tickets

**Identificación.** `backend/app/main.py`, funciones `ver_ticket` y
`cambiar_estado` (líneas 99-104 y 117-123 en `v-base`):
```python
@app.get("/tickets/{ticket_id}")
def ver_ticket(ticket_id: int, usuario: dict = Depends(usuario_actual)):
    ticket = fetch_one("SELECT * FROM tickets WHERE id = %s", (ticket_id,))
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    return ticket
```

**Clasificación.** OWASP A01:2021 – Control de acceso roto. CWE-639
(Insecure Direct Object Reference / Authorization Bypass Through User-
Controlled Key).

**Causa raíz.** El endpoint exige un token válido (`Depends(usuario_actual)`),
pero nunca compara el `usuario_id` del ticket con el id del usuario
autenticado. Autenticación (¿quién eres?) no es lo mismo que autorización
(¿qué puedes ver?); aquí solo se validó lo primero. Como los ids de ticket son
consecutivos y predecibles, cualquier usuario autenticado puede iterar
`/tickets/1`, `/tickets/2`, ... y leer (o cerrar) tickets de otras personas.

**Cómo se detecta.** Un SAST no suele detectar esto de forma fiable: requiere
entender la relación semántica entre "el id del path" y "el id del usuario en
sesión", que es lógica de negocio, no un patrón sintáctico. Esta es
precisamente una de las fallas que la consigna señala como detectable
"leyendo y probando la aplicación" y no por herramienta automática: se
encuentra con dos cuentas de prueba, creando un recurso con una y pidiéndolo
con la otra.

**Demostración del impacto.** `bob` crea el ticket `id=2` ("Ticket privado de
Bob"). `alice` (otra cuenta, con su propio token válido) pide
`GET /tickets/2` y recibe el contenido completo del ticket ajeno
(`evidencia/antes-idor-tickets.txt`). Lo mismo aplica a
`PATCH /tickets/2/estado`: alice podría cerrar un ticket que no es suyo.

**Corrección.** Commit `365f24b`. Ambos endpoints ahora comprueban
pertenencia (o rol de administrador):
```python
if not ticket or (ticket["usuario_id"] != usuario["id"] and usuario["rol"] != "admin"):
    raise HTTPException(status_code=404, detail="Ticket no encontrado")
```
Se responde `404` en vez de `403` tanto si el ticket no existe como si no le
pertenece al usuario, para no confirmar por enumeración que un id ajeno existe.

**Verificación.** Con el backend corregido, `carla` (usuaria sin relación con
el ticket) recibe `404` tanto al leer `GET /tickets/2` como al intentar
`PATCH /tickets/2/estado`; el dueño sigue operando su propio ticket con
normalidad.

---

## Hallazgo 6 — Contraseñas en texto plano en los logs

**Identificación.** `backend/app/main.py` (líneas 55 y 76 en `v-base`):
```python
logger.info(f"Registro de usuario: {datos.username} / {datos.password} / {datos.email}")
...
logger.warning(f"Login fallido para {datos.username} con clave {datos.password}")
```

**Clasificación.** OWASP A09:2021 – Fallas de registro y monitoreo (exposición
de datos sensibles en logs) / A04 – Diseño inseguro. CWE-532 (Insertion of
Sensitive Information into Log File).

**Causa raíz.** El registro de eventos trata la contraseña como un dato más a
imprimir para depuración, sin considerar que los logs suelen tener una
retención larga, se replican a sistemas de monitoreo (Wazuh, en este mismo
examen) y son leídos por más personas/equipos de los que deberían poder ver
una contraseña en claro.

**Cómo se detecta.** SAST (Bearer tiene reglas específicas de "logging de
datos sensibles"; detecta variables con nombre `password` pasadas a funciones
de logging). Manualmente, con un intento de login fallido y leyendo el log del
backend.

**Demostración del impacto.** Un login fallido de alice generó en el log real:
```
2026-10-04 22:42:08,308 WARNING Login fallido para alice con clave IntentoFallido!
```
(`evidencia/antes-log-password.txt`). Cualquiera con acceso a los logs, o a
Wazuh una vez indexados, ve la contraseña en claro — incluyendo, en este
mismo examen, una contraseña real que el usuario pudo haber reutilizado en
otro servicio.

**Corrección.** Commit `c168522`, junto al hallazgo 1 (misma función). Se
reemplazan los mensajes por eventos estructurados y sin datos sensibles:
```python
logger.info("REGISTRO_USUARIO username=%s email=%s", datos.username, datos.email)
...
logger.warning("AUTH_LOGIN_FAILED username=%s", datos.username)
...
logger.info("AUTH_LOGIN_SUCCESS username=%s", datos.username)
```
Estos tres eventos (`AUTH_LOGIN_FAILED`, `AUTH_LOGIN_SUCCESS`,
`REGISTRO_USUARIO`) quedan además como el formato estable sobre el que debe
escribirse el decodificador/regla de Wazuh de la Parte 5 (D2): identifican
usuario y resultado sin exponer la contraseña.

**Verificación.** El mismo intento de login fallido contra el backend
corregido genera `AUTH_LOGIN_FAILED username=alice`, sin ningún rastro de la
contraseña usada.

---

## Hallazgo 7 — Endpoint de depuración expone configuración y variables de entorno

**Identificación.** `backend/app/main.py` (líneas 39-48 en `v-base`):
```python
@app.get("/debug/config")
def debug_config():
    return {
        "db_host": config.DB_HOST, "db_password": config.DB_PASSWORD,
        "jwt_secret": config.JWT_SECRET, "env": dict(os.environ),
    }
```

**Clasificación.** OWASP A05:2021 – Configuración de seguridad incorrecta.
CWE-215 (Information Exposure Through Debug Information) / CWE-497 (Exposure
of sensitive system information).

**Causa raíz.** Un endpoint de depuración, pensado para desarrollo, quedó
accesible sin autenticación en el mismo proceso que sirve producción. No
distingue entornos ni exige ningún rol: cualquiera con la URL expone de un
solo golpe la contraseña de la base de datos, el secreto usado para firmar
los JWT y el entorno completo del contenedor (que puede incluir más secretos
inyectados por Docker Compose).

**Cómo se detecta.** Un escaneo DAST (ZAP) contra rutas conocidas o un
spidering de la API lo encuentra fácilmente porque no requiere autenticación
ni payloads especiales; SonarQube/Bearer no lo detectan bien porque
sintácticamente es "una función que arma un diccionario", no un patrón de
vulnerabilidad reconocible sin entender que ese diccionario se sirve en un
endpoint HTTP público. Es otro ejemplo de hallazgo que se encuentra mejor
leyendo el código o probando la aplicación.

**Demostración del impacto.** `GET /debug/config` sin ningún header de
autenticación devuelve `db_password`, `jwt_secret` y el `env` completo
(`evidencia/antes-debug-config.txt`). Con el secreto JWT expuesto aquí, el
hallazgo 3 (forjar un token admin) deja de requerir siquiera encontrar el bug
de `verify_signature=False`: el atacante podría firmar tokens válidos
directamente.

**Corrección.** Commit `365f24b`. Se elimina el endpoint por completo (no se
reemplaza por una versión "protegida"): un endpoint que vuelca configuración y
variables de entorno no debe existir en ningún ambiente servido por este
proceso.

**Verificación.** `GET /debug/config` contra el backend corregido responde
`404 Not Found` (ruta inexistente), igual que cualquier URL no definida.

---

## Hallazgo 8 — CORS abierto con credenciales

**Identificación.** `backend/app/main.py` (líneas 21-27 en `v-base`):
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Clasificación.** OWASP A05:2021 – Configuración de seguridad incorrecta.
CWE-942 (Permissive Cross-domain Policy with Untrusted Domains).

**Causa raíz.** `allow_origins=["*"]` le dice al navegador que cualquier sitio
web puede leer la respuesta de la API; combinado con `allow_credentials=True`
(necesario para que el header `Authorization` viaje), el middleware de
Starlette **refleja** el origen recibido en el header
`Access-Control-Allow-Origin` en vez de negarlo. El resultado práctico es
idéntico a confiar en cualquier origen: un sitio malicioso cargado en el
navegador de una víctima autenticada puede hacer peticiones a la API de Mesa
de Ayuda con las credenciales de la víctima y leer la respuesta en JavaScript.

**Cómo se detecta.** SAST (regla estándar sobre configuración de CORS
permisiva, presente en SonarQube/Bearer para frameworks web). También es
trivial de confirmar con una petición `OPTIONS`/`fetch` real desde un origen
arbitrario y observando los headers `Access-Control-Allow-*` en la respuesta.

**Demostración del impacto.**
```
OPTIONS /tickets
Origin: https://sitio-malicioso.evil
```
responde con:
```
access-control-allow-credentials: true
access-control-allow-origin: https://sitio-malicioso.evil
```
(`evidencia/antes-cors.txt`). El navegador de la víctima permitiría que ese
sitio lea la respuesta de endpoints autenticados.

**Corrección.** Commit `365f24b`. El flujo normal del frontend llama a
`/api` como ruta relativa detrás de Nginx (mismo origen que el usuario ve en
el navegador), por lo que no depende de CORS en absoluto. Se reemplaza la
configuración por una lista explícita, vacía por defecto, controlable por
variable de entorno (`CORS_ORIGINS`) solo para pruebas directas (Swagger desde
un PC autorizado), y se acotan métodos/encabezados a los realmente usados por
la API:
```python
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
...
allow_origins=config.CORS_ORIGINS, allow_credentials=True,
allow_methods=["GET", "POST", "PATCH"], allow_headers=["Authorization", "Content-Type"],
```

**Verificación.** La misma petición `OPTIONS` con `Origin` no autorizado ya no
incluye `access-control-allow-origin` en la respuesta; sin ese header, el
navegador bloquea la lectura de la respuesta desde JavaScript aunque la
petición de red haya ocurrido.

---

## Hallazgo 9 ⭐ — XSS almacenado en la descripción del ticket

**Identificación.** `frontend/src/app/app.ts` (línea 140 en `v-base`) y
`frontend/src/app/app.html` (línea 201):
```typescript
this.descripcionHtml = this.sanitizer.bypassSecurityTrustHtml(t.descripcion);
```
```html
<div class="p-3 border-round surface-50 mb-3" [innerHTML]="descripcionHtml"></div>
```

**Clasificación.** OWASP A03:2021 – Inyección (Cross-Site Scripting
almacenado). CWE-79.

**Causa raíz.** Angular sanitiza automáticamente cualquier *string* plano que
se vincule a `[innerHTML]`, eliminando `<script>`, atributos de evento
(`onerror`, `onclick`...) y esquemas peligrosos (`javascript:`). El método
`bypassSecurityTrustHtml` existe para los casos (raros) donde el desarrollador
ya confía plenamente en el contenido y necesita omitir esa protección — aquí
se usó sobre `t.descripcion`, un campo que el backend guarda y devuelve tal
cual fue escrito por **cualquier usuario**, sin ningún tipo de confianza
especial. El resultado es que cualquier usuario puede guardar HTML/JS activo
en un ticket y ejecutarlo en el navegador de quien lo abra.

**Cómo se detecta.** SAST (Bearer y reglas de seguridad de SonarQube para
Angular marcan específicamente `bypassSecurityTrustHtml`/`bypassSecurityTrust*`
como sumidero peligroso). ZAP también lo detecta con su escáner de XSS activo
si prueba el formulario de creación de tickets y luego visualiza el ticket
creado.

**Demostración del impacto (navegador real, Playwright + Chromium).** Se creó
un ticket con la descripción exacta `<img src=x onerror=alert(1)>Secreto
inyectado` y se abrió en un navegador real apuntando al frontend compilado de
`v-base`:
- DOM resultante: `<img src="x" onerror="alert(1)">Secreto inyectado`
- Se disparó un diálogo `alert` con el mensaje `"1"` → el script se ejecutó
  (`evidencia/antes-despues-xss.txt`).

**Corrección.** Commit `dfc2481`. Se retira el *bypass* y se usa el
saneador explícito de Angular, que preserva etiquetas de formato inofensivas y
elimina atributos de evento:
```typescript
this.descripcionHtml = this.sanitizer.sanitize(SecurityContext.HTML, t.descripcion) ?? '';
```

**Verificación (mismo navegador real, mismo payload exacto).** Contra el
frontend corregido:
- DOM resultante: `<img src="x">Secreto inyectado` (sin `onerror`)
- Ningún diálogo se disparó; el texto del ticket se sigue mostrando con
  normalidad (`evidencia/antes-despues-xss.txt`).

---

## Hallazgo 10 — El token de sesión se guarda en `localStorage`

**Identificación.** `frontend/src/app/services/api.service.ts` (líneas 37-61
en `v-base`):
```typescript
localStorage.setItem('token', res.access_token);
...
console.log('Sesión iniciada', username, res.access_token);
```

**Clasificación.** OWASP A07:2021 – buenas prácticas de manejo de sesión
(relacionado con A03/XSS: el impacto de un XSS exitoso se amplifica si hay un
token robable en Web Storage). CWE-522 (Insufficiently Protected Credentials).

**Causa raíz.** Cualquier script que logre ejecutarse en el origen de la
página (por ejemplo, vía el XSS del hallazgo 9, o una dependencia de terceros
comprometida) puede leer `localStorage` completo con una sola línea de
JavaScript y exfiltrar el token a un servidor externo. Además, `localStorage`
persiste indefinidamente en disco (sobrevive cierres de navegador) y el propio
código imprimía el token en la consola del navegador en cada login, quedando
visible en herramientas de desarrollo y en cualquier integración que capture
logs del navegador.

**Cómo se detecta.** Revisión manual del código fuente del frontend buscando
`localStorage`/`sessionStorage` cerca del manejo de tokens; no es un hallazgo
típico de SAST de backend. Un pentest de frontend o una revisión de buenas
prácticas de OWASP ASVS para SPAs lo señala directamente.

**Demostración del impacto.** `localStorage.getItem('token')` desde la consola
del navegador (o desde cualquier script inyectado) devuelve el JWT completo;
el propio `console.log` del código imprimía `res.access_token` en cada login
exitoso.

**Corrección.** Commit `dfc2481`. El token de acceso se traslada a una
variable privada en memoria del `ApiService` (no persiste en ningún Storage
API, no sobrevive a un F5, no es legible desde fuera de esa instancia). `rol`
y `username` (no sensibles, solo controlan qué ve la UI) quedan en
`sessionStorage`. Se elimina el `console.log` que exponía el token, y se migra
`buscar()` a `encodeURIComponent` para el término de búsqueda.

**Limitación reconocida.** Esta mitigación reduce la superficie de robo (un
XSS que logre ejecutarse igual podría leer la variable en memoria mientras la
página está abierta, pero ya no puede leer el token desde otra pestaña, otro
script cargado más tarde, ni después de cerrar la sesión) a costa de perder la
sesión al refrescar la página. Una solución completa requeriría cookies
`httpOnly` + `Secure` emitidas por el backend con protección CSRF, lo que
implica rediseñar la autenticación del backend (fuera del alcance de este
ciclo de corrección, documentado aquí como trabajo futuro).

**Verificación.** `localStorage` ya no contiene ninguna clave `token`;
`autenticado`/`rol`/`username` siguen funcionando igual para la UI.

---

## Hallazgo 11 — Archivo de credenciales commiteado al repositorio

**Identificación.** `backend/env_del_examen.txt`, presente en el repositorio
desde el commit `v-base` (`a0e290b`) y todavía en `HEAD` de `main` antes de
esta corrección:
```
DB_PASSWORD=Umng2026*
JWT_SECRET=mesa-ayuda-secret-2026
```

**Clasificación.** OWASP A05:2021 – Configuración de seguridad incorrecta /
gestión de secretos. CWE-798 (Use of Hard-coded Credentials) / CWE-532 visto
desde el control de versiones.

**Causa raíz.** Un archivo con credenciales reales (o que un desarrollador
pudo confundir con reales) quedó en el árbol de un repositorio Git **público**
en GitHub. `.gitignore` solo evita que Git *proponga* trackear un archivo
nuevo que coincide con el patrón; no afecta a un archivo que ya fue agregado
explícitamente con `git add` bajo un nombre distinto (aquí, renombrado para
evitar el patrón `.env`).

**Cómo se detecta.** Herramientas de escaneo de secretos (gitleaks,
trufflehog, el propio *secret scanning* de GitHub) lo detectan por patrón de
nombre de variable (`PASSWORD=`, `SECRET=`) sin falsos negativos relevantes.
También se encuentra con una simple revisión manual del árbol del repositorio
y de `git log --all --name-only`.

**Demostración del impacto.** Cualquiera con el enlace al repositorio público
(`github.com/vOnyxxx/s126-g07-mesa-ayuda`) puede ejecutar
`git show v-base:backend/env_del_examen.txt` y obtener ambos valores sin
necesitar ningún acceso adicional.

**Corrección.** Commit `94c441a`. Se elimina el archivo del árbol actual con
`git rm` y se añade su nombre a `.gitignore`.

**Por qué el commit de borrado NO es la corrección completa (y qué falta).**
Borrar un archivo en un commit nuevo no reescribe los commits anteriores: el
archivo sigue siendo recuperable del historial (`git show v-base:...`, o
clonando el repositorio y revisando commits previos), y al tratarse de un
repositorio público, de cualquier fork o caché que GitHub o terceros hayan
podido generar mientras estuvo expuesto. La remediación completa, que queda
como tarea explícita para el equipo (no ejecutada en esta sesión porque
reescribe el historial compartido y requiere un force-push coordinado con
todos los integrantes), es:
1. Purgar el archivo de todo el historial con `git filter-repo` (o BFG
   Repo-Cleaner) y forzar el push de todas las ramas y tags afectados.
2. Rotar en los nodos reales (`sg-db`, `/etc/mesa-ayuda/backend.env` en
   `sg-backend`) cualquier credencial que haya coincidido con los valores
   expuestos, sin importar si eran de prueba: un secreto expuesto se
   considera comprometido independientemente de si alguien lo usó.
3. Verificar que ningún otro archivo de variables de entorno quedó
   commiteado (`git log --all --name-only -- '*.env*'` ya se ejecutó en esta
   sesión sobre el estado actual y no encontró más coincidencias).

**Verificación.** `git ls-tree -r HEAD` sobre la rama corregida ya no incluye
`backend/env_del_examen.txt`; la advertencia de purga de historial y rotación
queda documentada arriba como acción pendiente del equipo.

---

## Resumen de commits

| Commit | Hallazgos que cubre |
|---|---|
| `c168522` | 1 (SQLi login), 2 (SQLi buscar_tickets), 6 (logs con contraseña) |
| `7ee5aa1` | 3 ⭐ (JWT sin verificar firma) + corrección del bug de `iat` |
| `2a57f71` | 4 (MD5 → bcrypt) |
| `365f24b` | 5 ⭐ (IDOR en tickets), 7 (/debug/config), 8 (CORS abierto) |
| `dfc2481` | 9 ⭐ (XSS almacenado), 10 (token en localStorage) |
| `94c441a` | 11 (credenciales commiteadas) |

Todas las correcciones se verificaron contra una instancia local aislada
(MariaDB + backend `v-base`, y para el hallazgo 9 también el frontend
compilado en un navegador real) antes de darlas por cerradas. La aplicación
siguió funcionando de extremo a extremo después de cada corrección: registro,
login, creación y consulta de tickets probados tras cada commit.

## Pendiente para el equipo (fuera del alcance de esta sesión)

- Ejecutar SonarQube, Bearer CLI y OWASP ZAP sobre esta rama corregida y
  comparar contra el análisis de `v-base` ya realizado en la Parte 5
  (informes antes/después en `docs/`, como exige 6.3).
- Purgar el historial de git y rotar credenciales reales, según el hallazgo
  11.
- Aplicar esta rama (`parte6-devsecops`) sobre el repositorio real y
  desplegarla en `sg-backend`/`sg-frontend`, repitiendo las evidencias de
  Partes 3-4 (health check, Swagger, sitio público) para confirmar que el
  sistema sigue funcionando en la infraestructura real del grupo.
- Grabar el video exigido por la consigna, mostrando a cada integrante
  explicando su parte.
