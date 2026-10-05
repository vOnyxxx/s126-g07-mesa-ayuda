# Entrega de Julián Reyes al equipo — Parte 5

## Archivos del repositorio

- `infra/wazuh/local_decoder.xml`
- `infra/wazuh/local_rules.xml`
- `infra/wazuh/scripts/d2_login_failures.py`
- `docs/parte-5-centro-monitoreo.md`
- `docs/evidencias-parte-5.md`
- `docs/evidencias/parte-5/`
- `docs/plan-demostracion-parte-5.md`

## Material para insertar en el informe IEEE

1. Diagrama con `sg-reyes-security` como manager central y los cuatro nodos.
2. Captura de los cuatro agentes Linux activos.
3. Capturas D1 con la diferencia `group.txt`/`grupo.txt` explicada.
4. D2: `wazuh-logtest`, cinco HTTP 401 y alerta `100001`.
5. D3: tres capturas, rotuladas como simulación controlada.
6. SonarQube: dos proyectos y limitación de un único estado observado.
7. Referencia a las reglas y al script versionados en `infra/wazuh/`.

## Material que no debe compartirse

- Tokens `sqp_` de SonarQube.
- Contraseñas, JWT o archivos `.env`.
- Llaves SSH/WireGuard privadas.
- Capturas donde aparezcan secretos.
- Una afirmación de bloqueo real para D3.
