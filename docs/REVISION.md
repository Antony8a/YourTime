# Revisión previa a los commits

Revisión del árbol de trabajo antes de confirmarlo (2026-10-21). Es una foto de ese momento: describe
qué cambió, cómo se verificó y qué observaciones quedaron. El estado general del proyecto está en
[`CONTEXTO.md`](CONTEXTO.md).

## Qué cambió

193 rutas respecto del último commit (`79a1018`, cuando el proyecto era solo planificación):

| Grupo                | Cambio                                                                                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eliminado (121)      | Cliente Angular (`apps/web`), economía de tokens (`TOKEN_ECONOMY.md`, dominio `token`), documentos de planificación de la raíz, Turbo, sqlc, nginx/caddy, ESLint/Tailwind del móvil y el código viejo   |
| Backend (nuevo)      | Dominios `task`, `review`, `balance`, `rates`; casos de uso `auth`, `tasks`, `reviews`, `balance`, `rates`; repositorios PostgreSQL con SQL a mano; 5 migraciones; manejadores HTTP; JWT; raíz `app`  |
| Backend (modificado) | Configuración, usuario, errores con código, middleware, enrutador, `migrate` y `seed`                                                                                                                |
| Paquetes compartidos | `shared-types` (contrato de la API) y `shared-utils` (dinero, distancia, tiempo, periodos, conversión)                                                                                               |
| App móvil            | Rutas de Expo Router, sistema de diseño, componentes de tarea, reseñas, servicio en vivo, balance y dinero; cliente de la API, sesión y tema                                                         |
| Infra y herramientas | `docker-compose`, `Dockerfile.backend`, CI, Husky, Prettier, `Makefile`, `package.json` y `pnpm-lock.yaml`                                                                                           |
| Documentación        | `docs/` (contexto, producto, API, modelo de datos, arquitectura, hoja de ruta), `README.md` y `CONTRIBUTING.md` reescritos                                                                           |

## Verificación

Corrida el mismo día, sobre el árbol sin confirmar:

- **Backend:** `gofmt -l` sin salida, `go vet -tags integration ./...` limpio y
  `go test -race -tags integration -count=1 ./...` en verde: `app` (extremo a extremo), `balance`,
  `rates`, `review`, `task`, `user`, `infrastructure/rates` e `infrastructure/security`. Dentro de
  `golang:1.23`, con una base desechable `yourtime_test`.
- **TypeScript:** `typecheck` limpio en los tres paquetes; Vitest, 55 pruebas en verde.
- **Secretos:** sin credenciales reales. Solo hay valores de desarrollo y de prueba: la contraseña de
  las cuentas demo, el secreto JWT de desarrollo y los de las pruebas. `config.Load` rechaza el
  secreto de desarrollo fuera de `APP_ENV=development`, y `.env` está en `.gitignore`.
- **Archivos:** nada que no deba subirse. Lo mayor es `pnpm-lock.yaml` (354 KB); `node_modules/` y
  `.expo/` están ignorados.

## No verificado

- **Android real:** servicio en vivo con GPS y mapa, reseñas y publicar una tarea (ver `CONTEXTO.md`).
- **CI en GitHub:** el flujo nunca se ejecutó con este árbol. Sus pasos replican los comandos de arriba
  más `pnpm --filter @yourtime/mobile build` (exportación web de Expo), que no se corrió aquí.
- **Lint:** no hay ESLint configurado; solo `gofmt` y Prettier.

## Observaciones

1. **Los commits intermedios no compilan.** El borrado del código viejo y el código nuevo son una
   reescritura, y partirla en commits deja tramos del historial que no construyen (por ejemplo, el
   commit de borrado deja sin contenido a los paquetes compartidos). Solo el último commit es un estado
   verificado.
2. **Fines de línea.** Git avisa de que reemplazará LF por CRLF (`core.autocrlf=true`) y no hay
   `.gitattributes`. Es inofensivo, pero un `.gitattributes` con `* text=auto eol=lf` evitaría
   diferencias espurias entre Windows y el CI de Linux.
3. **Prettier al commitear.** El hook de pre-commit corre `lint-staged` y puede reformatear archivos
   preparados; el commit incluye ese resultado.
