# Contexto del proyecto

Para quien retoma YourTime (una persona o un chat nuevo): qué se construyó, cómo se usa, cómo
correrlo y probarlo, qué decisiones importan y qué falta. El detalle de cada tema vive en su
documento (ver [Dónde seguir](#dónde-seguir)); aquí está el mapa y lo que no se deduce leyendo el código.

> **Estado del repositorio:** todo lo descrito está en el árbol de trabajo, **sin confirmar**
> (`git status` muestra ~190 cambios). El último commit es de cuando el proyecto era solo
> planificación (con un enfoque de moneda-token y un cliente Angular que se descartaron). Antes de
> seguir, conviene revisar y confirmar por partes.

## Qué es

Una app móvil donde alguien **publica una tarea**, otras personas **se postulan con su precio** y quien
publicó **elige a una**. Se descartó la economía de tokens: la **moneda es una preferencia de la
cuenta**, y la **distancia solo informa** (filtra y ordena, nunca impide postularse).

Se construyó, en este orden: el producto base (cuentas, tareas, postulaciones, ubicación) → reseñas de
1 a 5 estrellas → la regla de un servicio a la vez con **pantalla de servicio en vivo** → rediseño y
auditoría de accesibilidad → **balance con rango de fechas** → **conversión de monedas** → pruebas en
un Android real.

## Cómo se usa

1. **Registro** con correo, contraseña, nombre y moneda. Perfil: teléfono, presentación, ubicación y
   radio preferido.
2. **Explorar:** lista de tareas con distancia, filtros (categoría, radio, texto) y orden por cercanía.
   Si la tarea está en otra moneda, debajo del precio sale su equivalente pequeño: `≈ 63.075 COP`.
3. **Postularse** con un precio propio y un mensaje (el equivalente se actualiza mientras se escribe).
   Quien publica ve cada oferta con la calificación del postulante (`★ 4,5 (2)`) y **cómo trabaja**:
   si es puntual, cuánto tarda en salir tras ser elegido y cuántos servicios lleva (ver `PRODUCT.md`).
4. **Elegir** a una persona. Las demás se descartan. Quien fue elegida puede estar ocupada en otro
   servicio y entonces no se la puede elegir todavía.
5. **Servicio en vivo**, estilo transporte. Quien hace el trabajo debe pulsar **iniciar ruta** (se ve su
   recorrido en el mapa para quien publicó), luego **iniciar servicio** y al final **finalizar**. Quien
   hace el trabajo puede **renunciar** antes de iniciar el servicio (la tarea se reabre) y quien
   publicó puede **cancelar** hasta que sale de ruta. Las tareas remotas se saltan la ruta.
6. **Reseñas:** al finalizar, la app abre sola la calificación para cada parte. Se puede dejar
   comentario, y la persona calificada puede **responder una vez**.
7. **Mi balance** (Perfil → Mi balance): lo **ganado** haciendo servicios y lo **gastado** en los que se
   pidieron, en un periodo que se elige con atajos (7 días, 30 días, este mes, mes pasado, este año,
   todo), flechas ‹ › o un calendario de rango. Muestra totales por moneda, un total convertido a la
   moneda de la cuenta y la lista de servicios.

**Cuentas de demostración** (contraseña `yourtime123`, o la de `SEED_PASSWORD` si la definiste al cargar los datos; con la API pública usa una privada): `ana@yourtime.dev` (COP, Medellín),
`luis@yourtime.dev` (USD), `marta@yourtime.dev` (EUR), `carlos@yourtime.dev` (COP). La semilla trae 5
tareas abiertas y 6 servicios ya finalizados, con reseñas, precios y fechas entre hace 4 y 71 días;
Ana tiene 3 servicios hechos (en USD, EUR y COP) y 3 pedidos, para probar el balance.

## Reglas que no son obvias

Las reglas completas están en [`PRODUCT.md`](PRODUCT.md). Estas son las que más sorprenden:

- **Un servicio contratado y uno realizado a la vez por persona**, garantizado por la base de datos con
  índices únicos parciales (`tasks_one_active_per_poster` / `_per_worker`), no solo por código.
- **Dinero = enteros en unidad menor + moneda ISO.** Cuántos decimales tiene cada moneda (JPY, KRW,
  VND, CLP, PYG e IDR: ninguno) está duplicado en `packages/shared-utils/src/currency.ts` y en
  `valueobjects.Currency.Decimals()`; hay que mantenerlos iguales.
- **El precio acordado nunca se convierte.** La conversión es solo referencia. El servidor guarda los
  tipos de cambio **por día** (`exchange_rates`) y convierte cada servicio con el cambio **del día en
  que se finalizó**; si falta ese día usa el más cercano y lo marca `approximate`. Las aproximaciones
  grandes se redondean a unidades enteras al mostrarlas (`roundForDisplay`).
- **Privacidad:** a terceros se les muestra una ubicación redondeada y la distancia se calcula desde
  ese punto; la exacta y el contacto solo los ven quien publicó y la persona elegida.
- **Errores con código estable.** La API responde RFC 7807 con un `code`; la app lo traduce en
  `apps/mobile/src/lib/errors.ts`.
- **La API dice qué puede hacer cada persona** (`actions` en la tarea), así la app no duplica la
  máquina de estados: `open → assigned → en_route → in_progress → completed` (o `cancelled`).
- **Reseñas:** la calificación media se guarda como suma y cantidad, actualizadas en la misma
  transacción que la reseña; así `★ 4,8 (12)` es una lectura barata y siempre exacta.

## Mapa del código

| Dónde                                   | Qué hay                                                                                                              |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `apps/backend/internal/domain/`         | Reglas puras: `user`, `task`, `review`, `balance`, `rates`, `valueobjects`, errores con código                       |
| `apps/backend/internal/application/`    | Casos de uso: `auth`, `tasks`, `reviews`, `balance`, `rates`                                                         |
| `apps/backend/internal/infrastructure/` | `http` (handlers, router), `persistence/postgres` (SQL a mano + migraciones), `security`, `rates`                    |
| `apps/backend/internal/app/app.go`      | Raíz de composición; la usan el servidor y las pruebas de extremo a extremo                                          |
| `apps/backend/.../migrations/`          | `00001` esquema · `00002` reseñas · `00003` servicio en vivo · `00004` índices del balance · `00005` tipos de cambio |
| `apps/backend/scripts/{migrate,seed}`   | Migrar y cargar datos de demostración                                                                                |
| `apps/mobile/app/`                      | Rutas (Expo Router): `(auth)`, `(tabs)`, `task/[id]`, `service/[id]`, `user/[id]`, `balance`                         |
| `apps/mobile/src/components/`           | `ui` (sistema de diseño, `Sheet`, `Portal`), `balance`, `task`, `reviews`, `service`, `money`                        |
| `apps/mobile/src/{api,lib,store,theme}` | Cliente y hooks, utilidades (movimiento, rutas, ubicación), sesión, tokens                                           |
| `packages/shared-types`                 | Contrato de la API                                                                                                   |
| `packages/shared-utils`                 | Dinero, distancia, tiempo, `period.ts` (rangos de fechas), `convert.ts` (espejo del servidor)                        |

Los paquetes compartidos son código fuente TypeScript sin compilar; Metro y Vitest los leen directo.

## Cómo correrlo (Windows, sin Go, `make` ni `pnpm` instalados)

```bash
# 1. API y base de datos (migra al arrancar) + datos de demostración
docker compose -f infra/docker/docker-compose.yml up -d --build
docker compose -f infra/docker/docker-compose.yml run --rm --entrypoint seed backend

# 2. App (la primera vez: npx pnpm@9.15.4 install)
cd apps/mobile && npx expo start --web
```

Si Docker Desktop está apagado, los contenedores `yourtime-backend` y `yourtime-postgres` no responden:
arranca Docker Desktop y `docker start` ambos. Para empezar de cero:

```bash
docker exec yourtime-postgres psql -U yourtime -d yourtime -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
docker compose -f infra/docker/docker-compose.yml run --rm --entrypoint migrate backend
docker compose -f infra/docker/docker-compose.yml run --rm --entrypoint seed backend
```

**En un Android físico** (lo que se probó, con un Motorola Edge 50 Pro, Android 16):

1. Instalar **Expo Go para SDK 52** a mano: <https://expo.dev/go?sdkVersion=52&platform=android&device=true>.
   La de Play Store es de SDK 57 y rechaza el proyecto ("Project is incompatible"); desactivar la
   actualización automática de Expo Go.
2. Activar Depuración USB y conectar el cable. `adb` está en
   `%LOCALAPPDATA%\Android\Sdk\platform-tools` (solo platform-tools; no hay SDK completo ni emulador).
3. Redirigir los puertos por USB (evita depender de la WiFi y del firewall) y arrancar Metro:

```bash
adb reverse tcp:8081 tcp:8081 && adb reverse tcp:8080 tcp:8080
EXPO_PUBLIC_API_URL=http://localhost:8080 npx expo start --localhost --port 8081
adb shell am start -a android.intent.action.VIEW -d "exp://localhost:8081" host.exp.exponent
```

Por WiFi en cambio: misma red, puertos 8080 y 8081 abiertos en el firewall (perfil de red privado) y
`EXPO_PUBLIC_API_URL=http://<ip-del-pc>:8080`. En un emulador la app usa sola `10.0.2.2:8080`.

Mapas y rutas usan servidores públicos de prueba (OpenStreetMap y OSRM); se cambian con
`EXPO_PUBLIC_TILE_URL`, `EXPO_PUBLIC_ROUTING_URL` y `EXPO_PUBLIC_TILE_ATTRIBUTION`.

**Go no está instalado:** el backend se compila y prueba dentro de `golang:1.23` (ver abajo).

## Cómo se verificó

Resultados al cierre de la sesión (todo en verde):

- **Backend:** `go vet` y `go test -race -tags integration ./...` (incluye pruebas de extremo a extremo
  de flujo completo, servicio en vivo, reseñas, balance y tipos de cambio; usan una base desechable y
  un proveedor de cambio falso, sin red). Comando usado:

  ```bash
  docker exec yourtime-postgres psql -U yourtime -d postgres -c "CREATE DATABASE yourtime_test"
  docker run --rm --network docker_default -v yt-gomod:/go/pkg/mod -v yt-gobuild:/root/.cache/go-build \
    -v "$PWD/apps/backend:/src" -w /src \
    -e TEST_DATABASE_URL="postgres://yourtime:yourtime_dev@postgres:5432/yourtime_test?sslmode=disable" \
    golang:1.23 sh -c "gofmt -l . ; go vet -tags integration ./... && go test -race -tags integration -count=1 ./..."
  ```

  La base de `TEST_DATABASE_URL` **se borra** en cada prueba. Los volúmenes `yt-gomod`/`yt-gobuild`
  guardan la caché de Go: sin ellos la primera corrida descarga todo y es lenta.

- **TypeScript:** `npx pnpm@9.15.4 typecheck` y `npx pnpm@9.15.4 test` (Vitest: 59 pruebas, incluidos
  rangos de fechas y conversión espejo del backend).
- **Interfaz:** se recorrió la app real con Playwright (navegador Edge) contra la API real: servicio en
  vivo con dos personas, reseñas, balance y calendario (50 comprobaciones), conversión (32), cierre de
  sesión repetido, y auditoría de accesibilidad con axe (0 violaciones, objetivos táctiles ≥ 44 pt,
  claro y oscuro, teléfono y escritorio).
- **Android real, por USB:** inicio de sesión, cerrar sesión 3 veces seguidas, lista con conversión,
  balance, calendario con rango, botón Atrás y hoja de postulación con el teclado real.

> Los scripts de Playwright y de control por `adb` están en la carpeta temporal de la sesión, **fuera del
> repositorio**, y pueden perderse. Llevarlos al repo (p. ej. `apps/mobile/e2e/`) y a CI es la deuda de
> pruebas más útil.

## Lecciones de Android real

Lo que el navegador no mostró y el celular sí:

- **Hermes no trae `Intl.RelativeTimeFormat`.** "hace 5 minutos" rompía las tarjetas
  ("Cannot read property 'prototype' of undefined"). `packages/shared-utils/src/time.ts` tiene ahora una
  versión manual en español. Evitar otras APIs de `Intl` poco comunes.
- **El `Modal` nativo nacía como un cuadradito arriba a la izquierda** (la segunda vez que se abría,
  con la arquitectura nueva). Las hojas ya no lo usan: `Portal.tsx` publica el contenido en una capa
  propia montada una vez en `app/_layout.tsx`, y `Sheet.tsx` maneja el botón Atrás de Android.
- **Reanimated dentro de un `Modal` no siempre aplica el estilo** en la primera apertura. `Sheet` anima
  con `Animated` de React Native.
- **Las bandas del calendario dejaban líneas entre días** en pantallas de alta densidad; se solapan 1 px.
- **`Image` de React Native en Android descarta los encabezados personalizados** y manda un
  `okhttp/x.y` genérico: OpenStreetMap lo bloquea y devuelve teselas "Access blocked". `RouteMap`
  descarga cada tesela con `fetch` (que sí respeta el `User-Agent`) y la muestra como data URI. La
  atribución quedaba tapada por la hoja del servicio y se subió sobre ella.
- **Las pantallas de una tarea abierta no se actualizaban solas**: quien publicó no veía las
  postulaciones nuevas y quien se postuló no sabía que lo habían elegido. Ahora la tarea se sondea
  cada 10 s mientras alguien la espera (sin push, es la forma de enterarse).
- **Android ofrece autocompletar contraseñas** al tocar el campo de correo; al probar por `adb` hay que
  elegir esa cuenta o usar "No, gracias".

## Diseño y accesibilidad

El sistema de diseño es propio (`src/theme`, `src/components/ui`), con modo claro y oscuro. Las reglas de
movimiento están en `apps/mobile/src/lib/motion.ts`: curva de salida fuerte, menos de 300 ms, solo
`transform` y `opacity`, escala 0,97 al presionar, respeto de "reducir movimiento", y vibración siempre
acompañada de un cambio visual. Accesibilidad: niveles de encabezado (`Text` con `level`), regiones
`main`/`nav`, objetivos de 44 pt, contraste con tokens verificados, y en web las capas ocultas se marcan
`inert` (`src/lib/webA11y.ts`).

## Pendiente y riesgos

- **Confirmar los cambios** (ver el aviso del principio).
- **Ubicación en vivo solo con la app abierta.** Probado en un Android real (2026-10-21): GPS, mapa y
  ruta, iniciar ruta/servicio/finalizar como trabajador y como cliente, reseñas desde los dos lados y
  publicar una tarea. Falta el seguimiento en segundo plano (ver `ROADMAP.md`).
- **Tipos de cambio** de fuentes públicas gratuitas (`open.er-api.com`, con respaldo en un espejo
  comunitario): sin garantía de servicio y con atribución obligatoria (ya aparece en el balance). En
  producción, contratar un proveedor con SLA. Son valores de referencia, no de transacción.
- **Mapas y rutas** con servidores públicos de prueba, no aptos para producción.
- **Sin pruebas de interfaz en el repo**, sin verificación de correo ni recuperación de contraseña, con
  paginación por `offset` y sin notificaciones push. La lista priorizada está en
  [`ROADMAP.md`](ROADMAP.md).
- El servidor, al arrancar antes de migrar, avisa "No exchange rates yet": se recupera solo en la primera
  petición de tipos de cambio. No es un error.

## Dónde seguir

| Documento                                  | Contenido                                          |
| ------------------------------------------ | -------------------------------------------------- |
| [`PRODUCT.md`](PRODUCT.md)                 | Todas las reglas de negocio                        |
| [`API.md`](API.md)                         | Endpoints, errores y códigos                       |
| [`DATA_MODEL.md`](DATA_MODEL.md)           | Decisiones del modelo de datos y concurrencia      |
| [`ACCESO_REMOTO.md`](ACCESO_REMOTO.md)     | Usar la app desde cualquier red con tu PC          |
| [`APK.md`](APK.md)                         | APK local y cómo encender todo en este PC          |
| [`DESPLIEGUE.md`](DESPLIEGUE.md)           | API gratis en Render + Neon y el APK con EAS       |
| [`ARCHITECTURE.md`](ARCHITECTURE.md)       | Stack, estructura, seguridad, calidad y producción |
| [`ROADMAP.md`](ROADMAP.md)                 | Qué está hecho y qué sigue, en orden de prioridad  |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | Flujo de trabajo, commits y criterios de código    |
