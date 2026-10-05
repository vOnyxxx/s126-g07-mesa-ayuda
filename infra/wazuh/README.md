# Personalización de Wazuh — S126-G07

Esta carpeta conserva los artefactos solicitados por la Parte 5:

- `local_decoder.xml`: interpreta `AUTH_LOGIN_FAILED user=<usuario> ip=<ip>`.
- `local_rules.xml`: reglas `100000`, `100001` y `100002`.
- `scripts/d2_login_failures.py`: genera cinco solicitudes inválidas controladas.

## Reglas

| ID | Nivel | Descripción |
|---:|---:|---|
| 100000 | 10 | Detecta un fallo de autenticación de la aplicación. |
| 100001 | 12 | Correlaciona cinco fallos de la aplicación desde una IP en 60 segundos. |
| 100002 | 12 | Correlaciona cinco fallos SSH desde una IP en 60 segundos. |

Las reglas de correlación se mapean a MITRE ATT&CK `T1110 — Brute Force`.

## Alcance de D3

La prueba registrada empleó `198.51.100.77`, una IP reservada para
documentación. La evidencia confirma la regla `100002` y la invocación del
flujo de respuesta activa (`check_keys`, `continue`, `Ended`). No muestra una
regla efectiva de firewall, una conexión posterior denegada ni el desbloqueo
después de 180 segundos. Por tanto, no se presenta como bloqueo real.

## Seguridad

Estos archivos no contienen tokens, contraseñas ni claves. Las credenciales y
los tokens de SonarQube deben permanecer fuera de Git.
