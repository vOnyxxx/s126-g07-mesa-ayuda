SELECT user, host, plugin, ssl_type
FROM mysql.user
WHERE user IN ('root', 'app_mesa', '')
ORDER BY user, host;

SHOW GRANTS FOR 'app_mesa'@'100.70.226.73';

SELECT Host, Db, User
FROM mysql.db
WHERE Db LIKE 'test%';

SELECT @@GLOBAL.generated_random_password_length AS longitud_aleatoria,
       @@require_secure_transport AS tls_obligatorio,
       @@general_log AS registro_general,
       @@log_error AS ruta_errores;
