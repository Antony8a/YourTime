# API

REST sobre JSON. Prefijo `/api/v1`. Las reglas de negocio están en [`PRODUCT.md`](PRODUCT.md); los
tipos TypeScript equivalentes, en `packages/shared-types/src/index.ts`.

## Convenciones

- **Autenticación:** `Authorization: Bearer <access_token>` en todo salvo `/health`, `/categories`
  y `/auth/*`. El token de acceso dura 15 minutos; el de renovación, 30 días.
- **Éxito:** `{ "data": ..., "meta": ... }`. Las listas paginadas incluyen
  `meta: { has_more, limit, offset }`. Paginación por `limit` (1 a 50, por defecto 20) y `offset`.
- **Dinero:** enteros en unidades menores de una moneda ISO 4217 explícita (`*_minor` + `currency`).
- **Error:** formato RFC 7807 (con `Content-Type: application/json`) más un campo `code` estable
  que los clientes traducen:

```json
{
  "type": "https://yourtime.app/errors/conflict",
  "code": "already_applied",
  "title": "Conflict",
  "status": 409,
  "detail": "you already applied to this task",
  "instance": "/api/v1/tasks/…/applications"
}
```

`detail` está en inglés y es para desarrolladores. La app muestra su propio texto según `code` (ver
`apps/mobile/src/lib/errors.ts`). Los errores de validación de campos traen además
`errors: [{ field, code, message }]`, con `code` igual a la regla que falló (`required`, `min`…).

| Estado | Cuándo                                                                    |
| ------ | ------------------------------------------------------------------------- |
| 400    | Entrada inválida (JSON, parámetros, reglas de validación o de negocio)    |
| 401    | Falta el token, es inválido o expiró; credenciales incorrectas            |
| 403    | La persona no puede hacer esto (no es quien publicó, es su propia tarea…) |
| 404    | El recurso no existe                                                      |
| 409    | Conflicto de estado (tarea no abierta, ya postulada, ya resuelta)         |
| 413    | Cuerpo mayor a 1 MB                                                       |
| 429    | Límite de peticiones por IP (cabecera `Retry-After`)                      |

## Autenticación

| Método y ruta         | Cuerpo                                        | Respuesta    |
| --------------------- | --------------------------------------------- | ------------ |
| `POST /auth/register` | `email`, `password`, `full_name`, `currency?` | `201` sesión |
| `POST /auth/login`    | `email`, `password`                           | sesión       |
| `POST /auth/refresh`  | `refresh_token`                               | sesión nueva |

Sesión: `{ user, access_token, refresh_token, expires_in }`. Las rutas `/auth/*` tienen un límite
más estricto (20 por minuto por IP). El token de renovación **no** sirve como token de acceso y
viceversa.

## Perfil

| Método y ruta | Descripción                 |
| ------------- | --------------------------- |
| `GET /me`     | La cuenta de quien consulta |
| `PATCH /me`   | Actualización parcial       |

Campos de `PATCH /me` (todos opcionales): `full_name`, `bio`, `avatar_url`, `phone` (E.164),
`currency`, `location: { latitude, longitude, city? }` y `search_radius_km`. Para
`search_radius_km`, un número lo fija, `null` lo quita (sin límite) y omitirlo lo deja igual. Una
actualización inválida no cambia nada.

## Categorías

`GET /categories` (público) devuelve `[{ id, slug, name, icon, color }]`. `icon` es un nombre de
Ionicons.

## Tareas

| Método y ruta                    | Descripción                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| `GET /tasks`                     | Feed de tareas abiertas, sin las propias                                                      |
| `POST /tasks`                    | Publicar. `201` con la tarea                                                                  |
| `GET /tasks/{id}`                | Detalle visto por quien consulta                                                              |
| `PUT /tasks/{id}`                | Editar (solo quien publicó, solo `open`)                                                      |
| `POST /tasks/{id}/cancel`        | Cancelar (quien publicó; hasta `en_route`, no una vez `in_progress`)                          |
| `POST /tasks/{id}/start-route`   | Iniciar ruta (la persona elegida; presencial; cuerpo `latitude`, `longitude`, `eta_seconds?`) |
| `POST /tasks/{id}/start-service` | Iniciar servicio (la persona elegida; tras la ruta, o directo si es remota)                   |
| `POST /tasks/{id}/complete`      | Finalizar (la persona elegida o quien publicó; solo `in_progress`)                            |
| `POST /tasks/{id}/release`       | Renunciar (la persona elegida; `assigned` o `en_route`); la tarea vuelve a `open`             |
| `POST /tasks/{id}/location`      | Enviar la posición actual (la persona elegida; `en_route` o `in_progress`); `204`             |
| `GET /me/active`                 | El servicio activo de quien consulta: `{ as_client, as_worker }`, cada uno una tarea o `null` |
| `GET /me/tasks`                  | Mis tareas. Filtro `status=open,assigned`                                                     |

**`GET /tasks`** parámetros: `q` (busca en título y descripción), `category_id`, `lat`, `lng`,
`max_distance_km`, `preferred_radius=true`, `sort=recent|distance`, `limit`, `offset`.
`max_distance_km` y el radio se ignoran si no hay ubicación de origen. `sort=distance` sin origen
cae a `recent`.

**Cuerpo de `POST` y `PUT /tasks`:**

```json
{
  "category_id": "uuid",
  "title": "Arreglar gotera",
  "description": "…",
  "budget": { "type": "fixed", "min_minor": 8000000, "max_minor": 15000000, "currency": "COP" },
  "is_remote": false,
  "location": { "latitude": 6.2442, "longitude": -75.5812, "city": "Medellín", "address": "…" },
  "scheduled_at": "2026-03-01T14:00:00Z"
}
```

- `budget.currency` es opcional: por defecto la moneda de la cuenta al crear, y la actual de la
  tarea al editar. `min_minor`/`max_minor` son obligatorios salvo en `negotiable`.
- Si no es remota y no se envía `location`, se usa la ubicación guardada de la cuenta.

**El servicio en vivo.** Los pasos son `assigned → en_route → in_progress → completed`; ninguno se
puede saltar (`route_not_started`) y solo los conduce la persona elegida (`not_assigned_worker`). Las
tareas remotas no tienen ruta: `start-route` responde `409` y `start-service` funciona desde `assigned`.

**Un servicio a la vez.** `POST /applications/{id}/accept` responde `409 client_busy` si quien publica
ya tiene un servicio activo como cliente, y `409 worker_busy` si el postulante ya está haciendo otro.
Cada tarea de postulante trae `applicant_busy` para saberlo antes. Lo garantizan índices únicos en la
base de datos.

**Acciones disponibles.** Cada tarea incluye `actions`: lo que quien consulta puede hacer ahora
(`edit`, `cancel`, `start_route`, `start_service`, `complete`, `release`). Los clientes se dibujan
desde esa lista en lugar de repetir las reglas.

**Tiempo de ruta.** Al iniciar la ruta, la app puede enviar `eta_seconds`: lo que tardará el trayecto
según la ruta que calculó. El servidor lo guarda (`route_eta_seconds`) pero lo acota por la distancia
en línea recta (entre 90 km/h y 12 km/h, más 5 min de margen) para que nadie pueda inflarlo y excusar
una llegada tarde, ni encogerlo para parecer puntual. Sin `eta_seconds` se estima con 20 km/h. Se
usa para juzgar la puntualidad (ver [`PRODUCT.md`](PRODUCT.md#confiabilidad-de-quien-trabaja)).

**Ubicación en vivo.** `worker_location: { latitude, longitude, updated_at }` solo lo reciben quien
publicó y la persona elegida, y solo mientras el servicio está activo. Se borra al finalizar,
cancelar o renunciar. Para cualquier otra persona es `null`.

**Respuesta de tarea** (campos principales): `id`, `title`, `description`, `category`, `budget`,
`is_remote`, `location` (aproximada para terceros, ver `PRODUCT.md`), `scheduled_at`, `status`,
`poster`, `assigned_applicant` (solo quien publicó), `applications_count`, `distance_km`,
`within_preferred_radius`, `is_owner`, `is_worker`, `actions`, `en_route_at`, `started_at`,
`completed_at`, `agreed_price_minor`, `worker_location`, `can_apply`, `my_application`, `created_at`,
`updated_at`.
`poster.email`/`poster.phone` aparecen solo para la persona elegida.

## Reseñas y perfiles

| Método y ruta              | Quién                                            | Descripción                                                             |
| -------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| `POST /tasks/{id}/reviews` | Quien publicó o la persona elegida, al finalizar | Calificar a la otra persona: `rating`, `comment?`                       |
| `POST /reviews/{id}/reply` | La persona calificada, una sola vez              | Responder: `text`                                                       |
| `GET /users/{id}`          | Cualquier sesión                                 | Perfil público y calificación                                           |
| `GET /users/{id}/reviews`  | Cualquier sesión                                 | Reseñas recibidas, de la más nueva a la más antigua (`limit`, `offset`) |

- `rating` es un entero de 1 a 5. `comment` y `text` admiten hasta 1000 caracteres.
- **La calificación viaja con cada persona:** todo objeto de persona (`poster`, `applicant`,
  `assigned_applicant`, `reviewer`) y `GET /me` incluyen `rating: { average, count }`. `average` va
  redondeado a un decimal y es `0` cuando `count` es `0`.
- **Confiabilidad.** El perfil público (`GET /users/{id}`) incluye `reliability`, y cada `applicant`
  de `GET /tasks/{id}/applications` y `GET /me/applications` también (solo en postulantes):
  ```json
  {
    "completed_services": 3,
    "response_seconds": 720,
    "on_time_count": 2,
    "on_time_total": 2,
    "on_time_percent": 100
  }
  ```
  `response_seconds` es la **mediana** de lo que tardó en salir (o en empezar, si es remota) tras ser
  elegida, y es `null` sin servicios. `on_time_percent` es `null` si ningún servicio pudo juzgarse.
  Se calcula al consultar, no se guarda.
- **Idioma.** `GET /me` incluye `language` (`es`, `en`, `pt`, `fr` o `null` si la cuenta sigue al
  dispositivo). Se elige al registrarse (`language`, acepta también un código regional como `pt-BR`)
  o con `PATCH /me` (`language`; `""` vuelve a seguir al dispositivo). Un idioma no admitido responde
  `400 invalid_language`. La API no traduce nada: los textos los pone cada app según el `code` del error.
- **Estado de reseña en la tarea.** `GET /tasks/{id}` de una tarea finalizada incluye, solo para
  sus dos participantes, `can_review` (aún no calificó), `my_review` (la que escribió) y
  `review_for_me` (la que recibió). Para el resto son `false` y `null`.
- Una reseña tiene `id`, `task_id`, `reviewer_id`, `reviewee_id`, `rating`, `comment`, `reply`,
  `replied_at` y `created_at`. En `GET /users/{id}/reviews` añade `reviewer` (nombre, foto y
  calificación) y `task_title`. El perfil público (`GET /users/{id}`) trae `id`, `full_name`,
  `avatar_url`, `bio`, `rating`, `reliability` y `member_since`; nunca correo ni teléfono.

## Balance

| Método y ruta               | Quién          | Descripción                                                       |
| --------------------------- | -------------- | ----------------------------------------------------------------- |
| `GET /me/balance?from=&to=` | Quien consulta | Lo ganado como trabajador y lo gastado como cliente en un periodo |

- `from` (inclusive) y `to` (exclusivo) son instantes RFC 3339, ambos opcionales: sin `from` es
  «desde siempre» y sin `to`, «hasta ahora». La app manda el inicio del primer día y el inicio del
  día siguiente al último, en la zona horaria del dispositivo. `from` debe ser anterior a `to`
  (`invalid_range`).
- Responde `{ from, to, earned, spent }`. Cada lado trae `totals` (`{ currency, total_minor, count }`,
  **uno por moneda**: nunca se convierte ni se mezcla), `entries` y `has_more`.
- `entries` lista los servicios finalizados, del más reciente al más antiguo, hasta 200 por lado
  (`has_more` avisa si hay más; los totales siempre cubren todo el periodo). Cada uno trae
  `task_id`, `title`, `category`, `counterpart` (la otra persona: nombre y foto, nunca contacto),
  `currency`, `amount_minor` y `completed_at`.
- **Conversión a la moneda de la cuenta.** La respuesta trae `currency` (la moneda de la cuenta).
  Cada lado trae además `converted`: `{ currency, total_minor, approximate, partial }`, todo sumado
  en esa moneda, o `null` si hay dinero en otra moneda que no pudo convertirse. Cada servicio de
  `entries` trae `converted_minor` (`null` si ya está en esa moneda o no hay tipo de cambio).
  Cada servicio se convierte con el cambio **del día en que se finalizó**. `approximate` es `true` si
  para algún día no había registro y se usó el más cercano; `partial` si algún monto quedó fuera
  por falta de tipo de cambio. Los totales y montos originales (`totals`, `amount_minor`) no cambian.
- **Qué cuenta:** solo tareas `completed` cuyo `completed_at` cae en el periodo, al precio de la
  postulación elegida y en la moneda de la tarea. Lo cancelado o aún en curso no suma.

## Tipos de cambio

| Método y ruta | Quién            | Descripción                                          |
| ------------- | ---------------- | ---------------------------------------------------- |
| `GET /rates`  | Cualquier sesión | Los tipos de cambio de hoy, para las referencias «≈» |

- Responde `{ date, base, rates, fetched_at, stale }`: cuántas unidades de cada moneda equivalen a
  1 `base` (siempre `USD`). `date` es el día (UTC) de los tipos. Si hoy no se pudieron obtener y se
  sirven los más recientes, `stale` es `true`. Si nunca hubo ninguno: `503` con código
  `rates_unavailable`. Cambian una vez al día; la respuesta admite caché de una hora.
- Convertir un monto: `monto / rates[origen] * rates[destino]`, respetando los decimales de cada
  moneda (`JPY`, `CLP`, etc. no tienen). La app y el servidor usan la misma cuenta
  (`packages/shared-utils/src/convert.ts` y `rates.Snapshot.Convert`).

## Postulaciones

| Método y ruta                      | Quién                          | Descripción                           |
| ---------------------------------- | ------------------------------ | ------------------------------------- |
| `POST /tasks/{id}/applications`    | Cualquiera menos quien publicó | Postularse: `price_minor`, `message?` |
| `GET /tasks/{id}/applications`     | Quien publicó                  | Ver postulaciones (sin retiradas)     |
| `GET /me/applications`             | Quien se postuló               | Mis postulaciones                     |
| `POST /applications/{id}/accept`   | Quien publicó                  | Elegir; rechaza las demás pendientes  |
| `POST /applications/{id}/reject`   | Quien publicó                  | Descartar una pendiente               |
| `POST /applications/{id}/withdraw` | Quien se postuló               | Retirar una pendiente                 |

`accept` es atómico y seguro ante concurrencia: si dos peticiones compiten por la misma tarea,
exactamente una tiene éxito y la otra recibe `409`.

## Códigos de error

| Código                                                                                                                                                                                                          | Estado |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `invalid_credentials`                                                                                                                                                                                           | 401    |
| `account_inactive`, `not_owner`, `not_applicant`, `own_task`, `not_task_participant`, `not_reviewee`, `not_assigned_worker`                                                                                     | 403    |
| `user_not_found`, `task_not_found`, `application_not_found`, `review_not_found`                                                                                                                                 | 404    |
| `email_taken`, `task_not_open`, `invalid_transition`, `already_applied`, `application_not_open`, `task_not_completed`, `already_reviewed`, `already_replied`, `client_busy`, `worker_busy`, `route_not_started` | 409    |
| `invalid_email`, `invalid_password`, `invalid_phone`, `invalid_currency`, `invalid_coordinates`, `invalid_radius`, `invalid_name`, `invalid_city`                                                               | 400    |
| `invalid_title`, `invalid_description`, `invalid_budget`, `invalid_location`, `invalid_price`, `invalid_message`, `past_schedule`, `category_not_found`, `invalid_rating`, `invalid_comment`, `invalid_reply`   | 400    |
| `invalid_range`                                                                                                                                                                                                 | 400    |
| `rates_unavailable`                                                                                                                                                                                             | 503    |

Un error sin `code` es genérico (por ejemplo JSON mal formado o un parámetro inválido).
