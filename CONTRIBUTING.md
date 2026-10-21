# Contribuir

## Antes de enviar cambios

```bash
make ci          # typecheck + todas las pruebas
```

Con una base de datos desechable para las pruebas de extremo a extremo (se **borra**):

```bash
export TEST_DATABASE_URL="postgres://yourtime:yourtime_dev@localhost:5432/yourtime_test?sslmode=disable"
make test-backend
```

## Commits

[Conventional Commits](https://www.conventionalcommits.org/): `tipo(ámbito): asunto`, en tiempo
imperativo, hasta 72 caracteres.

- **Tipos:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`, `revert`.
- **Ámbitos:** `auth`, `task`, `application`, `user`, `api`, `mobile`, `infra`, `docs`.

Ejemplo: `feat(task): filter the feed by distance`.

Husky ejecuta Prettier y `gofmt` sobre lo preparado y valida el mensaje con commitlint.

## Criterios de código

- **Las reglas de negocio viven en el dominio**, no en handlers ni en pantallas, y se prueban sin
  base de datos. Si cambias una regla, actualiza [`docs/PRODUCT.md`](docs/PRODUCT.md).
- **Un solo lugar por dato.** Tipos de la API en `packages/shared-types`; formato de dinero,
  distancia y fechas en `packages/shared-utils`; textos de error en `apps/mobile/src/lib/errors.ts`;
  colores y medidas en `apps/mobile/src/theme`. No los dupliques.
- **Dinero siempre en unidades menores enteras** con su moneda explícita.
- **Errores de dominio con código estable** (`derr.New(kind, "codigo", "mensaje")`); si añades uno,
  añade su traducción en la app y su fila en [`docs/API.md`](docs/API.md).
- **Nunca expongas contacto ni ubicación exacta** fuera de quien publica y la persona elegida.
- **Cambios de base de datos** con una migración nueva; no edites una ya aplicada.
- **Una operación que cambia estado** debe ser transaccional y probarse bajo concurrencia si dos
  personas pueden competir por ella.
- **Interfaz:** usa los componentes de `src/components/ui`, objetivos táctiles de al menos 44 pt,
  etiquetas de accesibilidad y estados de carga, vacío y error en toda lista.
- **Movimiento:** usa las constantes de `src/lib/motion.ts` y `PressableScale`. Nunca `ease-in`,
  nada de más de 300 ms, solo `transform` y `opacity`, y no animes lo que se repite muchas veces
  al día. Respeta "reducir movimiento".
- Comentarios para explicar **por qué**, no qué.

## Ramas

`master` siempre en verde. Trabaja en ramas `feature/…` o `fix/…` y abre un PR; la CI debe pasar.
