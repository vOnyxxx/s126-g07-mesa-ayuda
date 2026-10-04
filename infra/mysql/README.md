# Parte 2 — MySQL nativo y bastionado (S126-G07)

## Arquitectura

MySQL 8.0.46 se instaló desde los repositorios de Ubuntu 24.04 directamente en
`sg-reyes-db`, sin Docker. El servicio `mysql` está habilitado en systemd.
Escucha solo en `100.68.48.48:33067`, la IP Tailscale y el puerto asignado.

La configuración específica está en `99-s126-g07.cnf`. También se ajustó
`bind-address` en `/etc/mysql/mysql.conf.d/mysqld.cnf` a `100.68.48.48`;
dejar allí el valor anterior `127.0.0.1` impedía aplicar correctamente el
cambio. `mysqlx` está deshabilitado.

## Bastionado y acceso

Se verificó el equivalente de `mysql_secure_installation`: no existen cuentas
anónimas, `root` solo existe como `root@localhost` con `auth_socket`, y no
existen la base `test` ni sus permisos. Se activó `validate_password` con
política MEDIUM y longitud mínima de 16 caracteres.

La aplicación utiliza `app_mesa@100.70.226.73` con
`caching_sha2_password` y `REQUIRE SSL`. Solo tiene SELECT, INSERT, UPDATE
y DELETE sobre `mesa_ayuda.*`; no tiene permisos administrativos ni DDL.
La contraseña se conserva fuera del repositorio. El esquema de la aplicación
debe crearse por separado antes de iniciar el backend con esta cuenta.

`require_secure_transport=ON` obliga TLS. La conexión probada desde backend
negoció TLSv1.3 con `TLS_AES_256_GCM_SHA384`. Desde frontend, el puerto
33067 no es alcanzable según la ACL de Tailscale.

## Arranque, registros y respaldo

El drop-in `10-tailscale.conf` ordena el inicio de MySQL después de
`tailscale-online.target` y comprueba que Tailscale haya asignado
`100.68.48.48`. Tras reiniciar la VM, Tailscale, MySQL y el temporizador
estaban activos y MySQL escuchaba en esa IP y puerto.

`general_log` está desactivado. Los errores e intentos fallidos se escriben
en `/var/log/mysql/error.log`, legible por el agente Wazuh con privilegios
adecuados.

`sg-mesa-backup.timer` ejecuta diariamente, a las 08:00 UTC (03:00 en
Colombia), `sg-mesa-backup.sh`. Usa `mysqldump` y cifra la salida con `age`
antes de conservarla en `/var/backups/mesa_ayuda/`. `Persistent=true`
recupera una ejecución perdida si la VM estaba apagada. El repositorio solo
contiene el destinatario público de `age`; la identidad privada permanece
fuera de Git. Se descifró un respaldo y se restauró en una base temporal,
donde se recuperó el registro de prueba `S126-G07`. La base y la tabla de
prueba se eliminaron después.

## Riesgo de usar root en el .env original

Si una inyección SQL en la aplicación llega a una conexión de MySQL con
`root`, el atacante podría leer o modificar otras bases, administrar usuarios
y destruir datos con los privilegios del servidor. `app_mesa` limita el daño
a las operaciones y la base autorizadas, pero no corrige la inyección:
la falla de la Parte 6 debe solucionarse con consultas parametrizadas y
validación apropiada de entradas.
