# Matriz de evidencias — Parte 5

Las imágenes fueron revisadas para evitar tokens, JWT, contraseñas y claves.

| ID | Evidencia | Archivo | Alcance probado |
|---|---|---|---|
| E-01 | Agentes Linux activos | [wazuh-agentes-activos.jpeg](evidencias/parte-5/wazuh-agentes-activos.jpeg) | Cuatro agentes Linux, no los PC Windows |
| E-02a | FIM: evento | [d1-fim-evento.jpeg](evidencias/parte-5/d1-fim-evento.jpeg) | Creación de `/opt/examen/group.txt`, regla 554 |
| E-02b | FIM: detalles | [d1-fim-detalles.jpeg](evidencias/parte-5/d1-fim-detalles.jpeg) | Nivel, hora, modo, ruta y hashes |
| E-03a | Validación de reglas D2 | [d2-wazuh-logtest.jpeg](evidencias/parte-5/d2-wazuh-logtest.jpeg) | Decoder y reglas 100000/100001 |
| E-03b | Solicitudes controladas | [d2-cinco-http-401.jpeg](evidencias/parte-5/d2-cinco-http-401.jpeg) | Cinco respuestas HTTP 401 |
| E-03c | Alerta D2, evento | [d2-alerta-evento.jpeg](evidencias/parte-5/d2-alerta-evento.jpeg) | Agente, decoder, log y eventos previos |
| E-03d | Alerta D2, regla | [d2-alerta-regla.jpeg](evidencias/parte-5/d2-alerta-regla.jpeg) | Regla 100001, nivel 12 y T1110 |
| E-04a | Flujo de respuesta D3 | [d3-respuesta-activa-simulada.jpeg](evidencias/parte-5/d3-respuesta-activa-simulada.jpeg) | `check_keys`, `continue`, `Ended`; no bloqueo real |
| E-04b | Evento SSH simulado | [d3-evento-ssh-simulado.jpeg](evidencias/parte-5/d3-evento-ssh-simulado.jpeg) | IP reservada, usuario, puerto y decoder SSH |
| E-04c | Alerta D3 | [d3-alerta-regla.jpeg](evidencias/parte-5/d3-alerta-regla.jpeg) | Regla 100002, frecuencia 5, nivel 12 y T1110 |
| E-05 | Proyectos SonarQube | [sonarqube-proyectos.jpeg](evidencias/parte-5/sonarqube-proyectos.jpeg) | Dos proyectos y Quality Gate; un solo estado |

## Limitaciones que deben conservarse en el informe

- D1 muestra creación de `group.txt`, no modificación de `grupo.txt`.
- D3 usa `198.51.100.77` y no acredita el bloqueo de un computador real.
- No hay evidencia aquí de agentes Windows de PC1, PC2 y PC3.
- La captura SonarQube no acredita análisis separados antes/después.
