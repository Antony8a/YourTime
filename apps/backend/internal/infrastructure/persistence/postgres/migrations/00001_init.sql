-- +goose Up
-- +goose StatementBegin
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Users ---------------------------------------------------------------------
CREATE TABLE users (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email            VARCHAR(254) NOT NULL,
    password_hash    VARCHAR(255) NOT NULL,
    full_name        VARCHAR(150) NOT NULL,
    phone            VARCHAR(20),
    avatar_url       VARCHAR(500),
    bio              TEXT,
    -- Account currency (ISO 4217). Default for published tasks and display.
    currency         CHAR(3) NOT NULL DEFAULT 'USD',
    location_lat     DOUBLE PRECISION,
    location_lng     DOUBLE PRECISION,
    location_city    VARCHAR(100),
    -- Preferred browsing radius. NULL = no limit. Never blocks applying.
    search_radius_km INT,
    status           VARCHAR(20) NOT NULL DEFAULT 'active',
    last_login_at    TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_status_check CHECK (status IN ('active', 'suspended')),
    CONSTRAINT users_location_pair CHECK ((location_lat IS NULL) = (location_lng IS NULL)),
    CONSTRAINT users_radius_positive CHECK (search_radius_km IS NULL OR search_radius_km > 0)
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

-- Categories ----------------------------------------------------------------
CREATE TABLE categories (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug       VARCHAR(100) NOT NULL UNIQUE,
    name       VARCHAR(100) NOT NULL,
    icon       VARCHAR(50)  NOT NULL,
    color      VARCHAR(7)   NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO categories (slug, name, icon, color, sort_order) VALUES
    ('hogar',       'Hogar y reparaciones', 'construct-outline',          '#3B82F6', 1),
    ('limpieza',    'Limpieza',             'sparkles-outline',           '#10B981', 2),
    ('mudanzas',    'Mudanzas y transporte','cube-outline',               '#F59E0B', 3),
    ('jardineria',  'Jardinería',           'leaf-outline',               '#22C55E', 4),
    ('tecnologia',  'Tecnología',           'laptop-outline',             '#6366F1', 5),
    ('clases',      'Clases y tutorías',    'school-outline',             '#8B5CF6', 6),
    ('mascotas',    'Mascotas',             'paw-outline',                '#EC4899', 7),
    ('mandados',    'Mandados',             'bag-handle-outline',         '#F97316', 8),
    ('eventos',     'Eventos',              'gift-outline',               '#14B8A6', 9),
    ('otros',       'Otros',                'ellipsis-horizontal-circle-outline', '#64748B', 10);

-- Tasks ---------------------------------------------------------------------
CREATE TABLE tasks (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poster_id               UUID NOT NULL REFERENCES users(id),
    category_id             UUID NOT NULL REFERENCES categories(id),
    title                   VARCHAR(200) NOT NULL,
    description             TEXT NOT NULL,
    -- Budget in minor units of `currency` (the poster's account currency).
    budget_type             VARCHAR(20) NOT NULL DEFAULT 'fixed',
    budget_min_minor        BIGINT,
    budget_max_minor        BIGINT,
    currency                CHAR(3) NOT NULL,
    is_remote               BOOLEAN NOT NULL DEFAULT FALSE,
    location_lat            DOUBLE PRECISION,
    location_lng            DOUBLE PRECISION,
    location_address        TEXT,
    location_city           VARCHAR(100),
    scheduled_at            TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'open',
    assigned_application_id UUID,
    assigned_applicant_id   UUID REFERENCES users(id),
    assigned_at             TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    cancelled_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tasks_status_check CHECK (status IN ('open', 'assigned', 'completed', 'cancelled')),
    CONSTRAINT tasks_budget_type_check CHECK (budget_type IN ('fixed', 'hourly', 'negotiable')),
    CONSTRAINT tasks_budget_pair CHECK ((budget_min_minor IS NULL) = (budget_max_minor IS NULL)),
    CONSTRAINT tasks_budget_required CHECK (budget_type = 'negotiable' OR budget_min_minor IS NOT NULL),
    CONSTRAINT tasks_budget_range CHECK (budget_min_minor IS NULL OR (budget_min_minor > 0 AND budget_max_minor >= budget_min_minor)),
    CONSTRAINT tasks_location_pair CHECK ((location_lat IS NULL) = (location_lng IS NULL)),
    CONSTRAINT tasks_location_required CHECK (is_remote OR location_lat IS NOT NULL)
);

CREATE INDEX tasks_open_feed_idx ON tasks (created_at DESC) WHERE status = 'open';
CREATE INDEX tasks_open_geo_idx ON tasks (location_lat, location_lng) WHERE status = 'open';
CREATE INDEX tasks_poster_idx ON tasks (poster_id, created_at DESC);
CREATE INDEX tasks_category_idx ON tasks (category_id) WHERE status = 'open';
CREATE INDEX tasks_title_trgm_idx ON tasks USING gin (title gin_trgm_ops);

-- Applications --------------------------------------------------------------
CREATE TABLE applications (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id      UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    applicant_id UUID NOT NULL REFERENCES users(id),
    price_minor  BIGINT NOT NULL CHECK (price_minor > 0),
    message      TEXT NOT NULL DEFAULT '',
    status       VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT applications_status_check CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
    CONSTRAINT applications_unique_per_person UNIQUE (task_id, applicant_id)
);
CREATE INDEX applications_applicant_idx ON applications (applicant_id, created_at DESC);
-- A task can have at most one chosen applicant.
CREATE UNIQUE INDEX applications_one_accepted_idx ON applications (task_id) WHERE status = 'accepted';

ALTER TABLE tasks
    ADD CONSTRAINT tasks_assigned_application_fk
    FOREIGN KEY (assigned_application_id) REFERENCES applications(id);
-- +goose StatementEnd

-- +goose Down
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;
