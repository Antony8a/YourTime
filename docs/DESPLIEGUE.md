# Despliegue gratuito y APK

Cómo publicar la API gratis y generar un APK que funcione sin tu computador ni Metro. Todo es gratis,
pero con límites que conviene conocer (ver [Límites](#límites)).

```
Celular (APK)  ──https──▶  Render (API en Docker)  ──▶  Neon (Postgres)
                              ▲
                  se reconstruye solo con cada push a master
```

## 1. Base de datos en Neon

1. Crea una cuenta en <https://neon.com> (no pide tarjeta) y un proyecto. Elige la región
   **AWS us-east-2 (Ohio)**, la misma que Render en `render.yaml`.
2. En _Connect_, copia la cadena **Direct connection** (sin `-pooler` en el nombre del host). El
   _pooler_ no sirve para las migraciones.
3. Debe verse así: `postgresql://usuario:clave@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require`

## 2. API en Render

1. Crea una cuenta en <https://render.com> e inicia sesión con GitHub.
2. _New → Blueprint_, elige el repositorio `Antony8a/YourTime` y la rama `master`. Render lee
   [`render.yaml`](../render.yaml) y crea el servicio **yourtime-api**.
3. Cuando pida `DATABASE_URL`, pega la cadena de Neon. `JWT_SECRET` se genera solo.
4. Espera el primer despliegue (5-10 min). Al arrancar aplica las migraciones sola.
5. Comprueba que responda: abre `https://yourtime-api.onrender.com/health`. Si Render le puso otro
   nombre (por estar tomado), usa esa URL en el paso 4.

**Desde ahora, desplegar un cambio es hacer `git push origin master`:** Render reconstruye y reemplaza
la API solo.

### Datos de demostración (opcional)

Los datos de demostración usan por defecto una contraseña conocida (`yourtime123`; define
`SEED_PASSWORD` para cambiarla), así que **cualquiera que tenga la URL podría entrar como Ana**. Si el APK es solo para ti, mejor no los cargues y regístrate con tu
propia cuenta en la app. Si los quieres, desde tu PC (con Docker encendido):

```bash
docker compose -f infra/docker/docker-compose.yml run --rm \
  -e DATABASE_URL="<la cadena de Neon>" --entrypoint seed backend
```

## 3. El APK con EAS

Una sola vez, en tu terminal (EAS pide tu usuario y clave de Expo, por eso lo haces tú):

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli init            # crea el proyecto en tu cuenta de Expo y lo enlaza
```

Si la URL de la API del paso 2 no es `https://yourtime-api.onrender.com`, cámbiala en
`apps/mobile/eas.json` (perfil `standalone`, `EXPO_PUBLIC_API_URL`). Después:

```bash
npx eas-cli build -p android --profile standalone
```

- La primera vez pregunta si genera la clave de firma (_keystore_): responde que sí. EAS la guarda
  por ti; **sin ella no podrías actualizar el APK sobre uno ya instalado**.
- Tarda 15-30 min en la cola gratuita. Al terminar da un enlace y un código QR: abre el enlace en el
  celular, descarga el `.apk` y permite _Instalar apps desconocidas_ cuando Android lo pida.

Para publicar una versión nueva de la app: `git push` (si cambió la API) y volver a correr el
`build`. Si solo cambió el código de la app, el `build` basta.

## Límites

- **Render duerme la API tras 15 minutos sin uso** y tarda cerca de **1 minuto** en despertar: la
  primera acción después de un rato puede tardar. La app espera hasta 75 s y avisa si no responde.
  Para quitarlo hay que pasar el servicio a un plan de pago.
- **Render gratis: 750 horas al mes** (una API siempre despierta serían 720) y ancho de banda
  limitado. No es para producción.
- **Neon gratis: 0,5 GB y 100 horas de cómputo al mes**; el cómputo se apaga a los 5 minutos y la
  primera consulta tarda unos segundos en despertar.
- Las ubicaciones en vivo y el mapa usan servidores públicos de prueba (ver `CONTEXTO.md`).
- Los límites de peticiones están en memoria de una sola instancia, lo cual es correcto con un solo
  servicio.
