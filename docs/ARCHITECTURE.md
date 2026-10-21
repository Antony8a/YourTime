# Arquitectura

## Stack

| Capa     | Tecnología                                                                       |
| -------- | -------------------------------------------------------------------------------- |
| Backend  | Go 1.23, chi, pgx, goose, zerolog, golang-jwt, validator                         |
| Datos    | PostgreSQL 16                                                                    |
| Mobile   | Expo SDK 52, React Native 0.76, Expo Router 4, React Query, Zustand              |
| Paquetes | `shared-types` (contrato de la API) y `shared-utils` (dinero, distancia, tiempo) |
| Monorepo | pnpm workspaces                                                                  |
| Infra    | Docker Compose en local; cualquier plataforma de contenedores en producción      |

Decisiones deliberadas:

- **Sin ORM ni generador de SQL.** Las consultas son SQL escrito a mano con pgx; son pocas y
  algunas (distancia, bloqueos) se leen mejor así.
- **Sin NativeWind ni librería de UI.** El diseño sale de un sistema propio de tokens y componentes
  (`apps/mobile/src/theme`, `apps/mobile/src/components/ui`) con modo claro y oscuro.
- **Paquetes compartidos como código fuente TypeScript**, sin paso de compilación: Metro y Vitest
  los leen directamente.
- **Sin Redis, MinIO ni servidor de correo** hasta que una funcionalidad los necesite.

## Estructura del repositorio

```
apps/
  backend/                 API en Go
    cmd/server/            Punto de entrada
    internal/
      domain/              Reglas de negocio puras (user, task, review, valueobjects)
      application/         Casos de uso (auth, tasks, reviews)
      infrastructure/      http (handlers, router, middleware), persistence/postgres, security (JWT)
      app/                 Raíz de composición: construye todo, también usado por las pruebas
      config/ platform/    Configuración por entorno y logger
    scripts/               migrate y seed
  mobile/                  App Expo
    app/                   Rutas (Expo Router): (auth), (tabs), task/[id]
    src/{api,components,lib,store,theme}
packages/
  shared-types/            Tipos del contrato de la API
  shared-utils/            Helpers puros con pruebas
infra/docker/              Compose y Dockerfile del backend
docs/                      Esta documentación
```

## Backend

Arquitectura en capas con dependencias hacia adentro:

```
http handlers ─▶ application (casos de uso) ─▶ domain (entidades, reglas, interfaces de repositorio)
                                                   ▲
                       persistence/postgres ───────┘  implementa las interfaces
```

- **`domain`** no importa nada de infraestructura. Las reglas viven en las entidades (`Task.Assign`,
  `Task.Complete`, `NewApplication`…) y se prueban sin base de datos.
- **`application`** orquesta: carga datos, llama al dominio, decide qué ve cada persona (privacidad
  de contacto y ubicación).
- **`infrastructure`** traduce HTTP y SQL. Los errores de dominio llevan un `Code` estable y una
  categoría (`NotFound`, `Conflict`…) que `HandleError` convierte en el estado HTTP correcto.
- **`app.NewRouter`** es la única raíz de composición; el servidor y las pruebas de extremo a
  extremo la comparten, así que lo que se prueba es lo que se despliega.

### Seguridad

- Contraseñas con bcrypt; el login tarda lo mismo con correos conocidos y desconocidos.
- JWT HS256 con claim de tipo: el token de renovación nunca autentica peticiones, ni al revés. Se
  rechaza el algoritmo `none`. `JWT_SECRET` es obligatorio (mínimo 32 caracteres) fuera de
  desarrollo.
- Límite de peticiones por IP en memoria (general y más estricto en `/auth/*`). Solo respeta
  `X-Forwarded-For` si `TRUST_PROXY=true`.
- Cuerpos limitados a 1 MB, JSON estricto (campos desconocidos rechazados), `LIKE` escapado.
- Contacto y ubicación exacta se revelan únicamente entre quien publica y la persona elegida.

### Configuración (variables de entorno)

| Variable          | Por defecto                      | Notas                                         |
| ----------------- | -------------------------------- | --------------------------------------------- |
| `APP_ENV`         | `development`                    |                                               |
| `PORT`            | `8080`                           |                                               |
| `DATABASE_URL`    | Postgres local de Docker Compose |                                               |
| `JWT_SECRET`      | (generado solo en desarrollo)    | Obligatorio y de 32+ caracteres en producción |
| `JWT_ACCESS_TTL`  | `15m`                            |                                               |
| `JWT_REFRESH_TTL` | `720h`                           |                                               |
| `CORS_ORIGINS`    | `http://localhost:8081,…:19006`  | Solo afecta a navegadores                     |
| `TRUST_PROXY`     | `false`                          | Actívalo solo detrás de un proxy propio       |
| `DB_AUTO_MIGRATE` | `true` en desarrollo             | Migrar al arrancar                            |

## Mobile

- **Rutas** (`app/`): `(auth)/login|register`, `(tabs)/index|publish|activity|profile`,
  `task/[id]`, `task/[id]/edit`, `user/[id]` (perfil público y reseñas) y `service/[id]` (el servicio
  en vivo). Un guardián en `_layout.tsx` redirige según la sesión.
- **Datos del servidor** con React Query: las listas usan consultas infinitas, las acciones
  invalidan lo que cambia. Solo hay estado global propio para la sesión (`store/auth.ts`).
- **Sesión:** tokens en el llavero del sistema (`expo-secure-store`; `localStorage` en web). El
  cliente (`api/client.ts`) renueva el token ante un 401 una sola vez y de forma compartida entre
  peticiones concurrentes. Un fallo de red nunca cierra la sesión.
- **Textos:** la app está en español y es dueña de sus mensajes. Los errores de la API se traducen
  por `code` (`lib/errors.ts`).
- **Accesibilidad:** objetivos táctiles de al menos 44 pt, roles y estados en los controles,
  contraste AA en ambos temas, regiones en vivo para errores, un esquema de títulos (h1 > h2 > h3)
  y una región principal en cada pantalla. Se audita con axe-core (ver Calidad).

### Movimiento y detalle visual

Las reglas salen de la guía de diseño de Emil Kowalski (`emilkowalski/skills`) y están codificadas
en `src/lib/motion.ts` para no depender de la memoria de quien programe.

- Solo se anima `transform` y `opacity`, en el hilo de la interfaz (Reanimated).
- Curva `ease-out` fuerte, nunca `ease-in`. Entradas por debajo de 300 ms (hoja 240 ms, salida
  160 ms) y retroalimentación al presionar de 100 a 160 ms.
- Presionar encoge el elemento un 3 % (`PressableScale`); las superficies grandes, menos.
- Las entradas parten de un pequeño desplazamiento más opacidad, nunca de escala 0.
- Lo que se hace cientos de veces al día no se anima: cambiar de pestaña, refrescar una lista.
- Con "reducir movimiento" se omiten escala y desplazamiento y se conservan los cambios de opacidad
  y de color.
- La háptica acompaña siempre a un cambio visual y se dispara una vez por acción (elegir una
  estrella, aviso de éxito o de error).
- Cifras con `tabular-nums` (precios, calificaciones) para que no bailen al cambiar.
- En pantallas anchas (navegador, tableta) la app es una columna de teléfono centrada
  (`AppFrame`).

### Mapa, rutas y seguimiento en vivo

La pantalla `service/[id]` se dibuja sin SDK de mapas ni claves, igual en iOS, Android y web:

- **Mosaicos como imágenes.** `RouteMap` calcula qué mosaicos Web Mercator cubren el trayecto
  (`packages/shared-utils/src/geo.ts`, con pruebas) y los dibuja con `<Image>`. La ruta se dibuja
  encima con `react-native-svg`, y los marcadores son vistas. El encuadre se calcula una vez por
  ruta para que el mapa no salte con cada actualización.
- **Rutas por calles** con un servidor compatible con OSRM (`lib/routing.ts`). Si falla o no responde,
  se dibuja una línea recta punteada y el tiempo se estima a 25 km/h: la pantalla nunca queda
  bloqueada.
- **Seguimiento:** el teléfono de quien hace el servicio envía su posición cada 4 s como mínimo y
  solo mientras la pantalla está abierta (`lib/useShareLocation.ts`). Quien publicó refresca la
  tarea cada 5 s (sondeo). En web se usa directamente la API del navegador porque la suscripción de
  `expo-location` falla al cancelarse.

**Servicios externos y qué envían.** Por defecto la app usa dos servidores públicos de prueba:

| Variable                       | Por defecto                              | Recibe                                       |
| ------------------------------ | ---------------------------------------- | -------------------------------------------- |
| `EXPO_PUBLIC_TILE_URL`         | `tile.openstreetmap.org/{z}/{x}/{y}.png` | Qué zona del mapa se está viendo             |
| `EXPO_PUBLIC_ROUTING_URL`      | `router.project-osrm.org`                | Las coordenadas de quien viaja y del destino |
| `EXPO_PUBLIC_TILE_ATTRIBUTION` | `© OpenStreetMap`                        | (texto que se muestra sobre el mapa)         |

Ambos son **solo para desarrollo**: sus políticas de uso no permiten tráfico de producción y el
segundo recibe ubicaciones reales de personas. Antes de lanzar, apunta las variables a un servidor
propio o a un proveedor con contrato (mosaicos y rutas) y revisa la política de privacidad.

### URL de la API

Se resuelve en `api/client.ts`: `EXPO_PUBLIC_API_URL` si existe; en un dispositivo físico, la IP de
la máquina de desarrollo; en el emulador de Android, `10.0.2.2`.

## Calidad

- **Backend:** `go vet`, pruebas unitarias de dominio y JWT, y una prueba de extremo a extremo
  contra Postgres real (`-tags integration`) que recorre el producto completo, incluida una carrera
  de aceptaciones concurrentes. Se ejecuta con detector de carreras.
- **TypeScript:** `tsc --noEmit` en modo estricto y pruebas de `shared-utils` con Vitest.
- **Interfaz:** se recorre la app real contra la API real con Playwright y axe-core en cuatro
  anchos (360, 390, 768 y 1280 px), claro y oscuro, midiendo accesibilidad, contraste, objetivos
  táctiles, desbordes y errores de consola. No hay pruebas de interfaz en la CI todavía.
- **CI** (`.github/workflows/ci.yml`): las tres comprobaciones anteriores, el empaquetado de la app
  con Metro y la construcción de la imagen del backend.

## Producción: lista de comprobación

- [ ] `JWT_SECRET` aleatorio de 32+ caracteres, guardado en un gestor de secretos.
- [ ] `APP_ENV=production`; migraciones ejecutadas por un paso de despliegue, no al arrancar.
- [ ] HTTPS delante de la API y `TRUST_PROXY=true` solo si ese proxy es propio.
- [ ] Postgres gestionado con copias de seguridad y restauración probada.
- [ ] Proveedor propio o con contrato para mosaicos de mapa y rutas (ver arriba).
- [ ] Límite de peticiones compartido (Redis) si la API corre en varias instancias.
- [ ] Revocación de tokens de renovación y recuperación de contraseña (ver `ROADMAP.md`).
- [ ] Política de privacidad y términos: la app maneja ubicación y datos de contacto.
- [ ] Métricas, logs centralizados y alertas sobre errores 5xx.

Opciones sencillas para desplegar el contenedor: Cloud Run, Fly.io, Railway o Render, con Postgres
gestionado del mismo proveedor.
