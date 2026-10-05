# Plan de demostración — Julián Reyes — 11 minutos

| Tiempo | Contenido | Evidencia en pantalla |
|---:|---|---|
| 0:00–1:15 | Arquitectura y función de `sg-reyes-security` | Diagrama, IPs Tailscale y componentes |
| 1:15–2:15 | Aplicación publicada por HTTPS | URL pública, aplicación funcional y `/api` |
| 2:15–3:15 | Wazuh y agentes | Cuatro agentes Linux activos |
| 3:15–4:15 | D1: FIM | Regla 554, ruta, modo realtime y hora |
| 4:15–6:15 | D2: autenticación fallida | Script, cinco 401, regla 100001, nivel 12, T1110 |
| 6:15–8:00 | D3: simulación controlada | Regla 100002 y log de respuesta; declarar la limitación |
| 8:00–9:30 | SonarQube | Backend y frontend, Quality Gate y métricas visibles |
| 9:30–10:15 | Archivos versionados | Decoder, reglas y script dentro de `infra/wazuh/` |
| 10:15–11:00 | Conclusiones y límites | Qué se comprobó y qué quedó sin evidencia completa |

## Frase obligatoria para D3

> La prueba empleó una IP reservada para documentación. Wazuh correlacionó los
> eventos y activó el flujo de respuesta, pero esta evidencia no demuestra el
> bloqueo de un computador real.

## Parte 6

Las comparaciones antes/después de vulnerabilidades solo deben mostrarse si el
equipo dispone de evidencia real de ambas versiones. Este plan no fabrica ni
atribuye resultados de Parte 6.
