# Parte 5 — Centro de monitoreo: Wazuh, SonarQube y detección

## Arquitectura registrada

| Componente | Host | IP Tailscale | Evidencia disponible |
|---|---|---:|---|
| Wazuh 4.14.8 y SonarQube | `sg-reyes-security` | `100.121.21.113` | Dashboard y proyectos SonarQube |
| MySQL | `sg-reyes-db` | `100.68.48.48` | Agente Wazuh activo |
| API | `sg-reyes-backend` | `100.70.226.73` | Agente Wazuh y D2 |
| Frontend | `sg-reyes-frontend` | `100.74.98.91` | Agente Wazuh y D3 controlada |

El dashboard registra cuatro agentes Linux activos: seguridad, base de datos,
backend y frontend. Las evidencias disponibles no muestran agentes instalados
en los tres computadores Windows, por lo que no se afirma ese requisito.

## D1 — File Integrity Monitoring

Wazuh detectó la creación de `/opt/examen/group.txt` en
`sg-reyes-security`. La alerta corresponde a la regla `554`, nivel `5`, modo
`realtime`, e incluye ruta, hora y hashes. La consigna pedía modificar
`grupo.txt`; la evidencia conservada corresponde a la creación de
`group.txt`, diferencia que se mantiene explícita.

## D2 — Fuerza bruta del login

El backend emitió eventos sanitizados con el formato:

```text
AUTH_LOGIN_FAILED user=<usuario> ip=<ip>
```

El agente de backend recolectó `/var/log/mesa_ayuda/app.log`. El decodificador
`mesa_ayuda_auth_failed` extrajo `dstuser` y `srcip`. La regla `100000` detectó
un evento individual y la `100001` correlacionó cinco fallos desde la misma IP
en 60 segundos, nivel `12`, MITRE ATT&CK `T1110`.

La prueba controlada ejecutó cinco solicitudes contra la URL pública y obtuvo
HTTP `401`. Los eventos visibles contienen usuario e IP, pero no contraseñas.
Los encabezados de IP reenviada solo deben aceptarse desde proxies de confianza;
un `X-Forwarded-For` recibido directamente del cliente es falsificable.

## D3 — SSH y respuesta activa

La regla `100002`, nivel `12`, correlacionó cinco fallos SSH desde la IP
`198.51.100.77` en 60 segundos y los mapeó a `T1110`. Esa dirección pertenece
al bloque reservado para documentación y los eventos fueron simulados.

El log de `sg-reyes-frontend` muestra la ejecución de
`active-response/bin/firewall-drop` con `check_keys`, `continue` y `Ended`.
No muestra `command:add`, una regla de `iptables`/`nftables`/UFW, una conexión
posterior rechazada ni la restauración del acceso. La evidencia demuestra
detección, correlación y activación del flujo, **no el bloqueo de un PC real**.

## SonarQube

SonarQube Community Build se registró en `100.121.21.113:9000`, accesible por
la tailnet. La captura disponible muestra los proyectos `Mesa Ayuda Backend` y
`Mesa Ayuda Frontend` con Quality Gate `Passed`. También muestra 0 % de
cobertura y hotspots sin revisar; un Quality Gate aprobado no demuestra la
ausencia de vulnerabilidades.

Solo se conserva evidencia de un estado de análisis por proyecto. No se afirma
una comparación completa entre `v-base` y una versión corregida mientras no
existan ambos informes, requisito relacionado con la Parte 6.

## Archivos versionados

- `infra/wazuh/local_decoder.xml`
- `infra/wazuh/local_rules.xml`
- `infra/wazuh/scripts/d2_login_failures.py`
- `docs/evidencias-parte-5.md`

## Autoría

La implementación y documentación de este bloque fue realizada desde PC2 por
Julián Reyes. La participación final debe coincidir con el autor de los commits
y con la explicación individual en el video.
