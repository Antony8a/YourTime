# Usar la app desde cualquier lugar (con tu PC como servidor)

Con tu PC encendido, la app funciona desde cualquier red (datos móviles, otro WiFi). La API queda
publicada en una dirección **https** fija con **Tailscale Funnel**. No abres puertos en el router ni
contratas un servidor.

```
Celular (APK, en cualquier red) ──https──▶ Tailscale ──▶ Tu PC: API (Docker) ──▶ Postgres (Docker)
```

> **Esto deja tu API abierta a internet.** Cualquiera que conozca la dirección puede intentar usarla.
> Antes de activarlo, haz los pasos 1 y 2: sin ellos, no lo actives.

## 1. Cierra los huecos de una API pública

Ya está hecho en el repositorio, pero comprueba que se aplicó en tu PC:

- **Secreto real y modo producción.** `infra/docker/.env` (no se sube a git) trae `APP_ENV=production`
  y un `JWT_SECRET` aleatorio. Sin esto la API usaría el secreto de desarrollo, que es público en el
  código, y cualquiera podría fabricarse un token. Si el archivo no existe, copia `.env.example`, pon
  `APP_ENV=production` y un secreto de 32+ caracteres (`openssl rand -base64 48`).
- **Postgres solo local.** El puerto 5432 está publicado solo en `127.0.0.1`.
- **Cuentas de demostración con contraseña privada.** `ana@yourtime.dev` y las demás se crean con la
  contraseña `yourtime123`, conocida por cualquiera que lea el repositorio. En una API pública, cárgalas
  con `SEED_PASSWORD` (queda en `infra/docker/.env`) y comparte esa contraseña solo con tus testers:
  `docker compose -f infra/docker/docker-compose.yml run --rm -e SEED_PASSWORD=<la-tuya> --entrypoint seed backend`.
  La pantalla de inicio de sesión no muestra credenciales.

## 2. Una base limpia, con tu cuenta, y el registro cerrado

Esto **borra todos los datos** de la base local (también los de demostración):

```powershell
docker exec yourtime-postgres psql -U yourtime -d yourtime -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
docker restart yourtime-backend      # al arrancar aplica las migraciones
```

Luego **crea tu cuenta** desde la app (con el registro abierto), y después ciérralo para que nadie más
pueda registrarse: en `infra/docker/.env` añade `REGISTRATION_OPEN=false` y reinicia la API
(`docker compose -f infra/docker/docker-compose.yml up -d`). Las cuentas existentes siguen entrando.
Para invitar a alguien: ábrelo, que se registre, y ciérralo de nuevo.

## 3. Instalar Tailscale y publicar la API

1. Instala Tailscale en el PC: <https://tailscale.com/download/windows> (o, en una terminal de
   administrador, `winget install Tailscale.Tailscale`). Inicia sesión con Google, Microsoft o GitHub.
2. En <https://login.tailscale.com/admin/dns> activa **MagicDNS** y **HTTPS Certificates**.
3. En una terminal (PowerShell):

   ```powershell
   tailscale funnel --bg 8080
   ```

   La primera vez imprime un enlace para habilitar Funnel en tu cuenta: ábrelo, acepta y repite el
   comando. Termina mostrando tu dirección, parecida a `https://aochoa.tu-red.ts.net`.

4. Comprueba desde **datos móviles** del celular: abre `https://aochoa.tu-red.ts.net/health`; debe
   decir `{"status":"ok"}`.
5. En la app: pantalla de inicio de sesión → **Servidor · Cambiar** → pega esa dirección. Ya no
   dependes del WiFi de tu casa.

`tailscale funnel status` muestra qué está publicado y `tailscale funnel --bg off` lo retira.

## Mantenerlo funcionando

- **El PC debe estar encendido y despierto.** En _Configuración → Sistema → Inicio/apagado y batería_
  pon que no se suspenda cuando está enchufado.
- Tailscale arranca con Windows. Docker también si activas _Start Docker Desktop when you sign in_, y
  los contenedores se reinician solos. `scripts/iniciar-yourtime.bat` lo enciende todo a mano.
- Si la API va lenta o no responde, mira `docker logs yourtime-backend`.

## Límites y riesgos

- Funnel pasa por los servidores de Tailscale y tiene límites de ancho de banda que no se configuran;
  es suficiente para uso personal, no para muchas personas.
- Con el registro cerrado y tu contraseña fuerte, el riesgo se reduce a quien intente adivinarla: la
  API limita las peticiones de acceso por minuto. Usa una contraseña larga.
- No se probó (a 2026-10-22) qué dirección de cliente ve la API detrás de Funnel; por eso
  `TRUST_PROXY` queda en `false`. Con eso, el límite de peticiones es global y no por persona. Es
  aceptable para uso personal.
- Si prefieres que **nadie** pueda ni ver la API, la alternativa es Tailscale como red privada
  (instalado también en el celular), sin Funnel.
