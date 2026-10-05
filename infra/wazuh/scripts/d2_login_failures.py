"""Genera cinco intentos inválidos controlados contra el login de Mesa Ayuda."""

from __future__ import annotations

import json
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def main() -> int:
    if len(sys.argv) != 2:
        print("Uso: python d2_login_failures.py URL_COMPLETA_DE_LOGIN")
        return 2

    url = sys.argv[1]
    if not url.lower().startswith("https://"):
        print("Error: la prueba debe ejecutarse contra la URL pública HTTPS.")
        return 2

    payload = json.dumps(
        {"username": "d2test", "password": "D2-only-invalid"}
    ).encode("utf-8")

    for attempt in range(1, 6):
        request = Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=15) as response:
                status = response.status
        except HTTPError as error:
            status = error.code
        except URLError as error:
            print(f"Intento {attempt}: error de red: {error.reason}")
            return 1

        print(f"Intento {attempt}: HTTP {status}")
        time.sleep(2)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
