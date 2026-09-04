# YourTime - API Contracts (REST)

## Convenciones Generales

| Aspecto | Estándar |
|---------|----------|
| Base URL | `/api/v1` |
| Formato | JSON (`application/json`) |
| Auth | Bearer Token (JWT) en header `Authorization` |
| Paginación | Cursor-based: `?cursor=<id>&limit=20` |
| Fechas | ISO 8601 UTC (`2024-01-15T10:30:00Z`) |
| IDs | UUID v4 |
| Monedas | Enteros en unidad mínima (centavos, tokens) |
| Errors | RFC 7807 Problem Details |
| Versioning | URL path (`/v1/`, `/v2/`) |

## Códigos de Estado HTTP

| Código | Uso |
|--------|-----|
| 200 | OK (GET, PUT, PATCH) |
| 201 | Created (POST) |
| 204 | No Content (DELETE) |
| 400 | Bad Request (validación) |
| 401 | Unauthorized (token inválido/expirado) |
| 403 | Forbidden (sin permisos) |
| 404 | Not Found |
| 409 | Conflict (duplicados, estado inválido) |
| 422 | Unprocessable Entity (reglas de negocio) |
| 429 | Too Many Requests (rate limit) |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

## Formato de Respuesta

### Éxito
```json
{
  "data": { ... },
  "meta": { "cursor": "uuid", "has_more": true }
}
```

### Error (RFC 7807)
```json
{
  "type": "https://yourtime.com/errors/validation-failed",
  "title": "Validation Failed",
  "status": 400,
  "detail": "One or more fields failed validation",
  "instance": "/api/v1/tasks",
  "errors": [
    { "field": "title", "code": "required", "message": "Title is required" },
    { "field": "budget_min_tokens", "code": "min", "message": "Must be at least 100", "value": 50 }
  ]
}
```

---

## Módulo: Auth

### POST `/auth/register`
```json
// Request
{
  "email": "user@example.com",
  "password": "securePass123",
  "full_name": "Juan Pérez",
  "phone": "+5491123456789"
}

// Response 201
{
  "data": {
    "user": { "id": "uuid", "email": "...", "full_name": "...", "role": "user", "status": "active", "email_verified": false, "created_at": "..." },
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "expires_in": 3600
  }
}
```

### POST `/auth/login`
```json
// Request
{
  "email": "user@example.com",
  "password": "securePass123",
  "remember_me": true
}

// Response 200 (igual que register)
```

### POST `/auth/refresh`
```json
// Request
{
  "refresh_token": "eyJ..."
}

// Response 200
{
  "data": { "access_token": "eyJ...", "expires_in": 3600 }
}
```

### POST `/auth/logout`
```json
// Request (opcional - para revocar refresh token)
{
  "refresh_token": "eyJ..."
}
// Response 204
```

### POST `/auth/forgot-password`
```json
// Request
{ "email": "user@example.com" }
// Response 204 (siempre 204 por seguridad)
```

### POST `/auth/reset-password`
```json
// Request
{ "token": "reset_token_from_email", "password": "newPass123" }
// Response 204
```

### GET `/auth/me`
```json
// Response 200
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "Juan Pérez",
    "avatar_url": "https://...",
    "role": "user",
    "status": "active",
    "email_verified": true,
    "phone_verified": false,
    "location_city": "Buenos Aires",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

### PATCH `/auth/me`
```json
// Request (todos opcionales)
{
  "full_name": "Juan Carlos Pérez",
  "avatar_url": "https://...",
  "bio": "Experto en plomería",
  "location_city": "Córdoba",
  "location_lat": -31.4201,
  "location_lng": -64.1888
}
// Response 200 (updated user)
```

---

## Módulo: Users / Profiles

### GET `/users/:id`
```json
// Response 200
{
  "data": {
    "id": "uuid",
    "full_name": "Juan Pérez",
    "avatar_url": "https://...",
    "bio": "Experto en plomería",
    "location_city": "Buenos Aires",
    "rating_as_client": 4.8,
    "reviews_as_client": 12,
    "jobs_posted": 15,
    "jobs_completed_as_client": 13,
    "rating_as_worker": 4.9,
    "reviews_as_worker": 45,
    "jobs_completed_as_worker": 42,
    "skills": ["plomería", "electricidad", "carpintería"],
    "verified_skills": ["plomería"],
    "hourly_rate_tokens": 5000,
    "portfolio_images": ["https://...", "https://..."],
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

### GET `/users/:id/reviews`
```json
// Query: ?type=as_worker&limit=10&cursor=uuid
// Response 200
{
  "data": [
    {
      "id": "uuid",
      "task_id": "uuid",
      "task_title": "Reparar grifo",
      "reviewer": { "id": "uuid", "full_name": "María", "avatar_url": "..." },
      "rating": 5,
      "comment": "Excelente trabajo",
      "quality_rating": 5,
      "communication_rating": 5,
      "punctuality_rating": 4,
      "created_at": "2024-01-20T15:00:00Z"
    }
  ],
  "meta": { "cursor": "uuid", "has_more": true }
}
```

---

## Módulo: Categories & Skills

### GET `/categories`
```json
// Response 200
{
  "data": [
    { "id": "uuid", "name": "Reparaciones del Hogar", "slug": "reparaciones-hogar", "icon": "home", "color": "#3B82F6", "skills_count": 12 },
    { "id": "uuid", "name": "Limpieza", "slug": "limpieza", "icon": "sparkles", "color": "#10B981", "skills_count": 8 }
  ]
}
```

### GET `/categories/:id/skills`
```json
// Response 200
{
  "data": [
    { "id": "uuid", "name": "Plomería", "slug": "plomeria", "description": "Reparación de cañerías, grifos...", "icon": "wrench" },
    { "id": "uuid", "name": "Electricidad", "slug": "electricidad", "description": "Instalaciones eléctricas...", "icon": "zap" }
  ]
}
```

---

## Módulo: Tasks (Core)

### POST `/tasks`
```json
// Request
{
  "category_id": "uuid",
  "skill_id": "uuid",
  "title": "Necesito hacer huecos en pared para repisas",
  "description": "Tengo 3 repisas para colgar, necesito hacer 6 huecos en pared de ladrillo...",
  "location_lat": -34.6037,
  "location_lng": -58.3816,
  "location_address": "Av. Corrientes 1234, CABA",
  "location_city": "Buenos Aires",
  "budget_min_tokens": 15000,
  "budget_max_tokens": 25000,
  "budget_type": "fixed",
  "estimated_hours": 3,
  "preferred_date": "2024-01-20",
  "preferred_time_start": "09:00",
  "preferred_time_end": "13:00",
  "urgency": "normal"
}

// Response 201
{
  "data": {
    "id": "uuid",
    "client_id": "uuid",
    "status": "open",
    "views_count": 0,
    "applications_count": 0,
    "created_at": "2024-01-15T10:30:00Z",
    // ... todos los campos
  }
}
```

### GET `/tasks` (Listar/Buscar)
```json
// Query params:
// ?status=open&category_id=uuid&skill_id=uuid&city=Buenos Aires
// &lat=-34.6037&lng=-58.3816&radius_km=10
// &budget_min=10000&budget_max=50000
// &date_from=2024-01-20&date_to=2024-01-25
// &urgency=high&sort=created_desc|budget_asc|distance
// &limit=20&cursor=uuid

// Response 200
{
  "data": [
    {
      "id": "uuid",
      "title": "Necesito hacer huecos en pared...",
      "category": { "id": "uuid", "name": "Reparaciones", "icon": "home", "color": "#3B82F6" },
      "skill": { "id": "uuid", "name": "Carpintería" },
      "budget_min_tokens": 15000,
      "budget_max_tokens": 25000,
      "budget_type": "fixed",
      "location_city": "Buenos Aires",
      "distance_km": 2.5,
      "urgency": "normal",
      "status": "open",
      "client": { "id": "uuid", "full_name": "Juan", "avatar_url": "...", "rating_as_client": 4.5 },
      "applications_count": 3,
      "preferred_date": "2024-01-20",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": { "cursor": "uuid", "has_more": true }
}
```

### GET `/tasks/:id`
```json
// Response 200
{
  "data": {
    "id": "uuid",
    "title": "...",
    "description": "...",
    "category": { ... },
    "skill": { ... },
    "budget_min_tokens": 15000,
    "budget_max_tokens": 25000,
    "budget_type": "fixed",
    "estimated_hours": 3,
    "location": { "lat": -34.6037, "lng": -58.3816, "address": "...", "city": "Buenos Aires" },
    "preferred_date": "2024-01-20",
    "preferred_time_start": "09:00",
    "preferred_time_end": "13:00",
    "urgency": "normal",
    "status": "open",
    "client": { "id": "uuid", "full_name": "Juan", "avatar_url": "...", "rating_as_client": 4.5, "reviews_as_client": 12 },
    "assigned_worker": null,
    "applications_count": 3,
    "views_count": 15,
    "can_apply": true,
    "user_application": null, // o { id, status, proposed_tokens, ... } si ya aplicó
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

### PATCH `/tasks/:id` (Solo client dueño, solo si status=open)
```json
// Request (campos permitidos)
{
  "title": "Nuevo título",
  "description": "Nueva descripción",
  "budget_min_tokens": 20000,
  "budget_max_tokens": 30000,
  "preferred_date": "2024-01-22"
}
// Response 200 (updated task)
```

### POST `/tasks/:id/cancel` (Client o Admin)
```json
// Request
{ "reason": "Ya no necesito el servicio" }
// Response 200
{
  "data": { "id": "uuid", "status": "cancelled", "cancelled_at": "...", "cancel_reason": "..." }
}
```

---

## Módulo: Applications (Postulaciones)

### POST `/tasks/:id/applications`
```json
// Request
{
  "proposed_tokens": 20000,
  "proposed_hours": 3,
  "message": "Hola, tengo experiencia en esto. Puedo hacerlo el sábado por la mañana."
}
// Response 201
{
  "data": {
    "id": "uuid",
    "task_id": "uuid",
    "worker_id": "uuid",
    "proposed_tokens": 20000,
    "proposed_hours": 3,
    "message": "...",
    "status": "pending",
    "created_at": "2024-01-15T11:00:00Z"
  }
}
```

### GET `/tasks/:id/applications` (Solo client dueño)
```json
// Response 200
{
  "data": [
    {
      "id": "uuid",
      "worker": { "id": "uuid", "full_name": "Pedro", "avatar_url": "...", "rating_as_worker": 4.8, "reviews_as_worker": 30, "skills": ["carpintería"] },
      "proposed_tokens": 20000,
      "proposed_hours": 3,
      "message": "...",
      "status": "pending",
      "created_at": "2024-01-15T11:00:00Z"
    }
  ]
}
```

### PATCH `/applications/:id` (Worker dueño - withdraw)
```json
// Request
{ "status": "withdrawn" }
// Response 200
```

### POST `/applications/:id/accept` (Client dueño de la task)
```json
// Response 200
{
  "data": {
    "task": { "id": "uuid", "status": "in_progress", "assigned_worker_id": "uuid", "assigned_at": "..." },
    "application": { "id": "uuid", "status": "accepted" }
  }
}
```

### POST `/applications/:id/reject` (Client dueño)
```json
// Response 200 (application status: rejected)
```

---

## Módulo: Task Execution

### POST `/tasks/:id/start` (Worker asignado)
```json
// Response 200
{ "data": { "id": "uuid", "status": "in_progress", "started_at": "..." } }
```

### POST `/tasks/:id/complete` (Worker asignado)
```json
// Request
{ "completion_notes": "Trabajo completado, 6 huecos hechos y repisas colocadas" }
// Response 200
{
  "data": {
    "task": { "id": "uuid", "status": "completed", "completed_at": "..." },
    "payment": { "tokens_charged": 20000, "tokens_paid_to_worker": 18000, "platform_fee": 2000 }
  }
}
```

### POST `/tasks/:id/dispute` (Client o Worker)
```json
// Request
{ "reason": "El trabajo no se hizo como se acordó", "evidence_images": ["url1", "url2"] }
// Response 200
{ "data": { "id": "uuid", "status": "disputed", "dispute_created_at": "..." } }
```

---

## Módulo: Tokens / Economía

### GET `/tokens/balance`
```json
// Response 200
{
  "data": {
    "available_tokens": 15000,
    "pending_tokens": 5000,
    "lifetime_earned": 50000,
    "lifetime_spent": 20000,
    "lifetime_withdrawn": 30000
  }
}
```

### GET `/tokens/transactions`
```json
// Query: ?type=task_payment&limit=20&cursor=uuid
// Response 200
{
  "data": [
    {
      "id": "uuid",
      "type": "task_payment",
      "amount": 18000,
      "balance_after": 15000,
      "description": "Pago por tarea 'Huecos en pared'",
      "related_task": { "id": "uuid", "title": "Huecos en pared" },
      "created_at": "2024-01-20T14:00:00Z"
    }
  ],
  "meta": { "cursor": "uuid", "has_more": true }
}
```

### GET `/tokens/packages`
```json
// Response 200
{
  "data": [
    { "tokens": 500, "price_cents": 500, "bonus_tokens": 0, "price_usd": 5.00, "tokens_per_usd": 100 },
    { "tokens": 1100, "price_cents": 1000, "bonus_tokens": 100, "price_usd": 10.00, "tokens_per_usd": 110 },
    { "tokens": 5500, "price_cents": 5000, "bonus_tokens": 500, "price_usd": 50.00, "tokens_per_usd": 110 }
  ]
}
```

### POST `/tokens/purchase` (Crear intent de pago)
```json
// Request
{ "package_tokens": 1100, "payment_provider": "stripe" }
// Response 201
{
  "data": {
    "purchase_id": "uuid",
    "client_token": "pi_...", // Stripe PaymentIntent client_secret
    "provider": "stripe",
    "amount_cents": 1000,
    "tokens": 1100
  }
}
```

### POST `/tokens/purchase/webhook` (Stripe/MercadoPago webhook - no auth)
```json
// Handler interno, valida firma del provider
```

### POST `/tokens/withdraw` (Worker)
```json
// Request
{
  "tokens_amount": 10000,
  "payout_method": "bank_transfer",
  "payout_details": {
    "bank_name": "Banco Galicia",
    "account_type": "caja_ahorro",
    "cbu": "0070098123456789012345",
    "cuit": "20-12345678-9",
    "account_holder": "Pedro González"
  }
}
// Response 201
{
  "data": {
    "id": "uuid",
    "tokens_amount": 10000,
    "estimated_amount_cents": 9500, // Neto después de fees
    "status": "pending",
    "created_at": "2024-01-20T15:00:00Z"
  }
}
```

### GET `/tokens/withdrawals`
```json
// Response 200
{
  "data": [
    { "id": "uuid", "tokens_amount": 10000, "amount_cents": 9500, "status": "completed", "processed_at": "...", "payout_method": "bank_transfer" }
  ]
}
```

### GET `/tokens/exchange-rate`
```json
// Response 200
{
  "data": {
    "buy_rate": 100,    // 100 tokens = $1 al comprar
    "sell_rate": 90,    // 90 tokens = $1 al vender
    "platform_fee_task_percent": 10,
    "platform_fee_withdrawal_percent": 5,
    "min_withdrawal_tokens": 1000
  }
}
```

---

## Módulo: Messages (Chat)

### GET `/conversations`
```json
// Response 200
{
  "data": [
    {
      "id": "uuid",
      "task": { "id": "uuid", "title": "Huecos en pared" },
      "other_participant": { "id": "uuid", "full_name": "Pedro", "avatar_url": "..." },
      "last_message": { "content": "Nos vemos el sábado", "sender_id": "uuid", "created_at": "..." },
      "unread_count": 2,
      "updated_at": "2024-01-15T12:00:00Z"
    }
  ]
}
```

### GET `/conversations/:id/messages`
```json
// Query: ?limit=50&before=message_id
// Response 200
{
  "data": [
    { "id": "uuid", "sender_id": "uuid", "content": "Hola", "type": "text", "read_at": "...", "created_at": "..." }
  ],
  "meta": { "cursor": "uuid", "has_more": true }
}
```

### POST `/conversations/:id/messages`
```json
// Request
{ "content": "Nos vemos a las 9", "type": "text" }
// Response 201
{ "data": { "id": "uuid", "sender_id": "uuid", "content": "...", "type": "text", "created_at": "..." } }
```

### PATCH `/conversations/:id/read`
```json
// Request
{ "last_read_message_id": "uuid" }
// Response 204
```

---

## Módulo: Notifications

### GET `/notifications`
```json
// Query: ?unread_only=true&limit=20
// Response 200
{
  "data": [
    { "id": "uuid", "type": "new_application", "title": "Nueva postulación", "body": "Pedro se postuló a tu tarea", "data": { "task_id": "uuid", "application_id": "uuid" }, "read_at": null, "created_at": "..." }
  ]
}
```

### PATCH `/notifications/:id/read`
```json
// Response 204
```

### POST `/notifications/read-all`
```json
// Response 204
```

---

## Webhooks (Para pagos)

### POST `/webhooks/stripe`
```json
// Stripe event payload, validado con signature
// Maneja: payment_intent.succeeded, payment_intent.payment_failed
```

### POST `/webhooks/mercadopago`
```json
// MercadoPago notification, validado con signature
// Maneja: payment.approved, payment.rejected
```

---

## Rate Limiting

| Endpoint | Límite |
|----------|--------|
| Auth (login/register) | 10/min per IP |
| Token purchase | 5/min per user |
| Task create | 20/hour per user |
| Task apply | 30/hour per user |
| Messages | 60/min per user |
| General API | 1000/hour per user |

Headers de respuesta:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

---

## WebSocket Events (Real-time)

### Conexión
```
WS /ws?token=<jwt>
```

### Eventos Cliente -> Servidor
```json
{ "event": "join_conversation", "data": { "conversation_id": "uuid" } }
{ "event": "leave_conversation", "data": { "conversation_id": "uuid" } }
{ "event": "typing_start", "data": { "conversation_id": "uuid" } }
{ "event": "typing_stop", "data": { "conversation_id": "uuid" } }
```

### Eventos Servidor -> Cliente
```json
{ "event": "new_message", "data": { "message": { ... } } }
{ "event": "message_read", "data": { "conversation_id": "uuid", "user_id": "uuid", "message_id": "uuid" } }
{ "event": "user_typing", "data": { "conversation_id": "uuid", "user_id": "uuid" } }
{ "event": "task_updated", "data": { "task_id": "uuid", "status": "in_progress" } }
{ "event": "new_application", "data": { "application": { ... } } }
{ "event": "token_balance_changed", "data": { "available": 15000, "pending": 5000 } }
{ "event": "notification", "data": { "notification": { ... } } }
```