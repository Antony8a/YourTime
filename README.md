# YourTime

App móvil para **publicar tareas, recibir postulaciones y elegir quién las hace**.

Alguien publica lo que necesita; otras personas se postulan con su precio; quien publicó elige a una
y ambas se siguen en una pantalla de servicio en vivo, estilo transporte, con mapa, ruta, tiempo
estimado y los pasos "iniciar ruta", "iniciar servicio" y "finalizar". Cada persona puede tener a la
vez un servicio contratado y uno en realización. Al finalizar, cada parte califica a la otra de 1 a 5
estrellas (con comentario y una respuesta), y esa calificación se ve junto a cada postulante. La
moneda es una preferencia de cada cuenta, y la distancia a cada tarea informa la decisión pero
nunca impide postularse.

## Empezar

Requisitos: **Node 20+** y **Docker**. No necesitas Go, `make` ni `pnpm` instalados.

**1. Backend y base de datos** (Docker; migra solo al arrancar):

```bash
docker compose -f infra/docker/docker-compose.yml up -d --build
docker compose -f infra/docker/docker-compose.yml run --rm --entrypoint seed backend   # datos demo
```

La API queda en <http://localhost:8080> (`/health` para comprobarla).

**2. App móvil** (la primera vez, instala dependencias):

```bash
npx pnpm@9.15.4 install
cd apps/mobile
npx expo start --web        # en el navegador; quita --web para el código QR de Expo Go
```

Cuentas de demostración: `ana@yourtime.dev`, `luis@yourtime.dev` y `marta@yourtime.dev`, contraseña
`yourtime123`.

**En un teléfono físico:** el teléfono y tu computador deben estar en la misma red y el firewall debe
permitir el puerto 8080. La app detecta la IP de la máquina de desarrollo; si no, define
`EXPO_PUBLIC_API_URL=http://<tu-ip>:8080`.

**Detener todo:** `docker compose -f infra/docker/docker-compose.yml down` (añade `-v` para borrar los datos).

Si tienes Go, `make` y pnpm, `make help` lista atajos equivalentes.

## Documentación

| Documento                                      | Contenido                                          |
| ---------------------------------------------- | -------------------------------------------------- |
| [`docs/CONTEXTO.md`](docs/CONTEXTO.md)         | Visión de conjunto para retomar el proyecto        |
| [`docs/PRODUCT.md`](docs/PRODUCT.md)           | Qué hace el producto y todas las reglas de negocio |
| [`docs/API.md`](docs/API.md)                   | Endpoints, errores y códigos                       |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md)     | Decisiones del modelo de datos y concurrencia      |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Stack, estructura, seguridad, calidad y producción |
| [`docs/ROADMAP.md`](docs/ROADMAP.md)           | Qué está hecho y qué sigue                         |
| [`CONTRIBUTING.md`](CONTRIBUTING.md)           | Flujo de trabajo y criterios de código             |

## Licencia

MIT
