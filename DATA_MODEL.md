# YourTime - Modelo de Datos

## Entidades Principales

### Users (Usuarios)
```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    phone           VARCHAR(20) UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(150) NOT NULL,
    avatar_url      VARCHAR(500),
    bio             TEXT,
    location_lat    DECIMAL(10, 8),
    location_lng    DECIMAL(11, 8),
    location_city   VARCHAR(100),
    role            VARCHAR(20) DEFAULT 'user', -- 'user', 'admin', 'moderator'
    status          VARCHAR(20) DEFAULT 'active', -- 'active', 'suspended', 'deleted'
    email_verified  BOOLEAN DEFAULT FALSE,
    phone_verified  BOOLEAN DEFAULT FALSE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_location ON users(location_lat, location_lng);
```

### User Profiles (Perfiles extendidos)
```sql
CREATE TABLE user_profiles (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    -- Como solicitante (client)
    rating_as_client    DECIMAL(3,2) DEFAULT 0.00,
    reviews_as_client   INT DEFAULT 0,
    jobs_posted         INT DEFAULT 0,
    jobs_completed_as_client INT DEFAULT 0,
    -- Como trabajador (worker)
    rating_as_worker    DECIMAL(3,2) DEFAULT 0.00,
    reviews_as_worker   INT DEFAULT 0,
    jobs_completed_as_worker INT DEFAULT 0,
    skills              JSONB DEFAULT '[]', -- ["plomeria", "carpinteria", "electricidad"]
    hourly_rate_tokens  INT, -- Tarifa base en tokens/hora
    availability        JSONB DEFAULT '{}', -- {"monday": {"start": "09:00", "end": "17:00"}}
    verified_skills     JSONB DEFAULT '[]', -- Skills verificados por admin
    portfolio_images    JSONB DEFAULT '[]',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);
```

### Categories & Skills (Categorías y Habilidades)
```sql
CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) UNIQUE NOT NULL,
    slug        VARCHAR(100) UNIQUE NOT NULL,
    icon        VARCHAR(50),
    color       VARCHAR(7), -- Hex color
    parent_id   UUID REFERENCES categories(id),
    sort_order  INT DEFAULT 0,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE skills (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id     UUID NOT NULL REFERENCES categories(id),
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL,
    description     TEXT,
    icon            VARCHAR(50),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(category_id, slug)
);
```

### Tasks (Solicitudes de Trabajo)
```sql
CREATE TABLE tasks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id           UUID NOT NULL REFERENCES users(id),
    category_id         UUID NOT NULL REFERENCES categories(id),
    skill_id            UUID REFERENCES skills(id),
    title               VARCHAR(200) NOT NULL,
    description         TEXT NOT NULL,
    -- Ubicación
    location_lat        DECIMAL(10, 8) NOT NULL,
    location_lng        DECIMAL(11, 8) NOT NULL,
    location_address    TEXT,
    location_city       VARCHAR(100),
    -- Presupuesto en tokens
    budget_min_tokens   INT NOT NULL,
    budget_max_tokens   INT NOT NULL,
    budget_type         VARCHAR(20) DEFAULT 'fixed', -- 'fixed', 'hourly', 'negotiable'
    estimated_hours     DECIMAL(5,2),
    -- Fechas
    preferred_date      DATE,
    preferred_time_start TIME,
    preferred_time_end   TIME,
    urgency             VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    -- Estado
    status              VARCHAR(30) DEFAULT 'open', -- 'open', 'in_progress', 'completed', 'cancelled', 'disputed'
    assigned_worker_id  UUID REFERENCES users(id),
    assigned_at         TIMESTAMPTZ,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    cancel_reason       TEXT,
    -- Metadatos
    views_count         INT DEFAULT 0,
    applications_count  INT DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_tasks_status ON tasks(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_client ON tasks(client_id);
CREATE INDEX idx_tasks_worker ON tasks(assigned_worker_id);
CREATE INDEX idx_tasks_location ON tasks(location_lat, location_lng);
CREATE INDEX idx_tasks_category ON tasks(category_id);
CREATE INDEX idx_tasks_created ON tasks(created_at DESC);
```

> ⚠️ **`idx_tasks_location` no sirve para búsquedas por radio.** Un índice B-tree sobre `(lat, lng)` solo acelera búsquedas por igualdad/rango en cada columna por separado; el filtro típico de la app ("tareas a 10km de mí") requiere calcular distancia geodésica, lo cual sin índice adecuado termina en un *sequential scan* sobre toda la tabla `tasks`. Ver "Búsqueda Geoespacial" más abajo para la solución (PostGIS + `geography` + índice GiST).

### Búsqueda Geoespacial (PostGIS)

Para que `GET /tasks?lat=..&lng=..&radius_km=..` escale, se agrega una columna generada `geography` respaldada por PostGIS y se indexa con GiST:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE tasks ADD COLUMN location geography(Point, 4326)
    GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(location_lng, location_lat), 4326)::geography) STORED;

CREATE INDEX idx_tasks_location_geo ON tasks USING GIST (location);
```

Query de radio (reemplaza el filtro manual de lat/lng en `ListTasks`):

```sql
SELECT *,
       ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_m
FROM tasks
WHERE status = 'open'
  AND deleted_at IS NULL
  AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3 * 1000)
ORDER BY distance_m ASC
LIMIT $4;
```

Mismo patrón aplica a `users.location_lat/location_lng` si se agrega "buscar workers cerca mío". Si PostGIS no está disponible en el proveedor cloud elegido, la alternativa de menor esfuerzo es la extensión `cube` + `earthdistance` (sin soporte de `Point`/SRID, menos precisa pero suficiente para MVP).

### Task Applications (Postulaciones)
```sql
CREATE TABLE task_applications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    worker_id       UUID NOT NULL REFERENCES users(id),
    proposed_tokens INT NOT NULL,
    proposed_hours  DECIMAL(5,2),
    message         TEXT,
    status          VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'withdrawn'
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(task_id, worker_id)
);

CREATE INDEX idx_task_apps_task ON task_applications(task_id);
CREATE INDEX idx_task_apps_worker ON task_applications(worker_id);
CREATE INDEX idx_task_apps_status ON task_applications(status);
```

### Token Economy (Economía de Tokens)

#### Token Balances (Saldos)
```sql
CREATE TABLE token_balances (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    available_tokens    BIGINT DEFAULT 0, -- Disponibles para gastar
    pending_tokens      BIGINT DEFAULT 0, -- En transacciones pendientes
    lifetime_earned     BIGINT DEFAULT 0, -- Total ganado históricamente
    lifetime_spent      BIGINT DEFAULT 0, -- Total gastado históricamente
    lifetime_withdrawn  BIGINT DEFAULT 0, -- Total retirado a dinero real
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);
```

#### Token Transactions (Transacciones de Tokens)
```sql
CREATE TABLE token_transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    type                VARCHAR(30) NOT NULL, -- Ver tipos abajo
    amount              BIGINT NOT NULL, -- Positivo = crédito, Negativo = débito
    balance_after       BIGINT NOT NULL,
    -- Referencias
    related_task_id     UUID REFERENCES tasks(id),
    related_application_id UUID REFERENCES task_applications(id),
    related_withdrawal_id UUID REFERENCES token_withdrawals(id),
    related_purchase_id UUID REFERENCES token_purchases(id),
    -- Metadatos
    description         VARCHAR(500),
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_token_tx_user ON token_transactions(user_id, created_at DESC);
CREATE INDEX idx_token_tx_type ON token_transactions(type);
CREATE INDEX idx_token_tx_task ON token_transactions(related_task_id);
```

**Tipos de Transacciones:**
- `purchase` - Compra de tokens con dinero real
- `task_payment` - Pago por tarea completada (worker recibe)
- `task_charge` - Cargo por contratar tarea (client paga)
- `task_refund` - Reembolso por cancelación
- `withdrawal` - Retiro a dinero real (worker)
- `withdrawal_fee` - Comisión de retiro
- `bonus` - Bonos, referidos, promociones
- `penalty` - Penalizaciones, disputas
- `platform_fee` - Comisión de la plataforma

#### Token Purchases (Compras de Tokens)
```sql
CREATE TABLE token_purchases (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    tokens_amount       BIGINT NOT NULL,
    currency            VARCHAR(3) DEFAULT 'USD', -- ISO 4217
    amount_cents        BIGINT NOT NULL, -- En centavos
    exchange_rate       DECIMAL(10,4) NOT NULL, -- tokens por unidad de moneda
    payment_provider    VARCHAR(30) NOT NULL, -- 'stripe', 'mercadopago', 'paypal'
    payment_intent_id   VARCHAR(255),
    status              VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
    completed_at        TIMESTAMPTZ,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

#### Token Withdrawals (Retiros a Dinero Real)
```sql
CREATE TABLE token_withdrawals (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id               UUID NOT NULL REFERENCES users(id),
    tokens_amount           BIGINT NOT NULL,
    currency                VARCHAR(3) DEFAULT 'USD',
    amount_cents            BIGINT NOT NULL, -- Lo que recibe el worker (neto)
    gross_amount_cents      BIGINT NOT NULL, -- Antes de comisiones
    platform_fee_cents      BIGINT NOT NULL,
    payment_processor_fee_cents BIGINT DEFAULT 0,
    exchange_rate           DECIMAL(10,4) NOT NULL,
    payout_method           VARCHAR(30) NOT NULL, -- 'bank_transfer', 'paypal', 'mercadopago'
    payout_details          JSONB NOT NULL, -- Encrypted bank info, email, etc
    status                  VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
    processed_at            TIMESTAMPTZ,
    failure_reason          TEXT,
    admin_notes             TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_withdrawals_worker ON token_withdrawals(worker_id, created_at DESC);
CREATE INDEX idx_withdrawals_status ON token_withdrawals(status);
```

#### Platform Configuration (Configuración de Economía)
```sql
CREATE TABLE platform_config (
    key                 VARCHAR(100) PRIMARY KEY,
    value               JSONB NOT NULL,
    description         TEXT,
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Valores iniciales:
-- 'token_exchange_rate': {"buy": 100, "sell": 90} -- 100 tokens = $1 compra, 90 tokens = $1 venta
-- 'platform_fee_percent': {"task": 10, "withdrawal": 5} -- % de comisión
-- 'min_withdrawal_tokens': 1000
-- 'max_withdrawal_tokens': 100000
-- 'token_packages': [{"tokens": 500, "price_cents": 500}, {"tokens": 1100, "price_cents": 1000}]
```

### Reviews & Ratings (Reseñas)
```sql
CREATE TABLE reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID NOT NULL REFERENCES tasks(id),
    reviewer_id     UUID NOT NULL REFERENCES users(id), -- Quién escribe
    reviewee_id     UUID NOT NULL REFERENCES users(id), -- Quién recibe
    rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment         TEXT,
    -- Criterios detallados
    quality_rating      SMALLINT CHECK (quality_rating BETWEEN 1 AND 5),
    communication_rating SMALLINT CHECK (communication_rating BETWEEN 1 AND 5),
    punctuality_rating   SMALLINT CHECK (punctuality_rating BETWEEN 1 AND 5),
    is_public       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(task_id, reviewer_id)
);

CREATE INDEX idx_reviews_reviewee ON reviews(reviewee_id, created_at DESC);
```

### Messages (Chat)
```sql
CREATE TABLE conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID REFERENCES tasks(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE conversation_participants (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id           UUID NOT NULL REFERENCES users(id),
    content             TEXT NOT NULL,
    type                VARCHAR(20) DEFAULT 'text', -- 'text', 'image', 'file', 'system', 'offer'
    metadata            JSONB DEFAULT '{}',
    read_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at DESC);
```

### Notifications
```sql
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL, -- 'task_assigned', 'new_application', 'payment_received', etc
    title           VARCHAR(200) NOT NULL,
    body            TEXT,
    data            JSONB DEFAULT '{}',
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read_at, created_at DESC);
```

## Diagramas de Relación (Mermaid)

```mermaid
erDiagram
    USERS ||--|| USER_PROFILES : has
    USERS ||--o{ TASKS : creates (client)
    USERS ||--o{ TASKS : assigned_to (worker)
    USERS ||--o{ TASK_APPLICATIONS : applies
    USERS ||--|| TOKEN_BALANCES : has
    USERS ||--o{ TOKEN_TRANSACTIONS : makes
    USERS ||--o{ TOKEN_PURCHASES : buys
    USERS ||--o{ TOKEN_WITHDRAWALS : requests
    USERS ||--o{ REVIEWS : writes
    USERS ||--o{ REVIEWS : receives
    USERS }|--o{ CONVERSATIONS : participates
    USERS ||--o{ MESSAGES : sends
    USERS ||--o{ NOTIFICATIONS : receives
    
    TASKS ||--o{ TASK_APPLICATIONS : receives
    TASKS ||--|| CONVERSATIONS : has
    TASKS }|--|| CATEGORIES : belongs_to
    TASKS }|--|| SKILLS : requires
    CATEGORIES ||--o{ SKILLS : contains
    CATEGORIES }|--|| CATEGORIES : parent
    
    TOKEN_TRANSACTIONS }|--|| TASKS : related
    TOKEN_TRANSACTIONS }|--|| TASK_APPLICATIONS : related
    TOKEN_TRANSACTIONS }|--|| TOKEN_WITHDRAWALS : related
    TOKEN_TRANSACTIONS }|--|| TOKEN_PURCHASES : related
```

## Migraciones Iniciales (Goose)

```sql
-- 001_initial_schema.up.sql
-- (Todas las tablas de arriba)

-- 002_seed_data.up.sql
INSERT INTO categories (name, slug, icon, color, sort_order) VALUES
('Reparaciones del Hogar', 'reparaciones-hogar', 'home', '#3B82F6', 1),
('Limpieza', 'limpieza', 'sparkles', '#10B981', 2),
('Jardinería', 'jardineria', 'leaf', '#84CC16', 3),
('Mudanzas y Transporte', 'mudanzas', 'truck', '#F59E0B', 4),
('Tecnología', 'tecnologia', 'laptop', '#8B5CF6', 5),
('Clases y Tutorías', 'clases', 'graduation-cap', '#EC4899', 6),
('Eventos y Fotografía', 'eventos', 'camera', '#EF4444', 7),
('Otros Servicios', 'otros', 'tool', '#6B7280', 8);

INSERT INTO platform_config (key, value, description) VALUES
('token_exchange_rate', '{"buy": 100, "sell": 90}', 'Tokens por dólar: compra 100, venta 90'),
('platform_fee_percent', '{"task": 10, "withdrawal": 5}', 'Comisión plataforma: 10% tareas, 5% retiros'),
('min_withdrawal_tokens', '1000', 'Mínimo tokens para retirar'),
('max_withdrawal_tokens', '100000', 'Máximo tokens por retiro'),
('token_packages', '[{"tokens": 500, "price_cents": 500, "bonus": 0}, {"tokens": 1100, "price_cents": 1000, "bonus": 100}, {"tokens": 5500, "price_cents": 5000, "bonus": 500}]', 'Paquetes de tokens con bonus');
```