from app.database import get_connection

with get_connection() as conexion:
    with conexion.cursor() as cursor:
        cursor.execute("SELECT CURRENT_USER() AS cuenta, DATABASE() AS base")
        identidad = cursor.fetchone()
        print("cuenta:", identidad["cuenta"])
        print("base:", identidad["base"])

        cursor.execute("SHOW STATUS LIKE 'Ssl_cipher'")
        print("cifrado:", cursor.fetchone()["Value"])

        cursor.execute("SHOW STATUS LIKE 'Ssl_version'")
        print("tls:", cursor.fetchone()["Value"])

        cursor.execute("SELECT COUNT(*) AS total FROM usuarios")
        print("usuarios:", cursor.fetchone()["total"])
