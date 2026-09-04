-- 001_initial_schema.up.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Users
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    phone           VARCHAR(20) UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(150) NOT NULL,
    avatar_url      VARCHAR(500),
    bio             TEXT,
    location_lat    DECIMAL(10, 8),
    location_lng    DECIMAL(11, 8),
    location_city   VARCHAR(100),
    role            VARCHAR(20) DEFAULT 'user',
    status          VARCHAR(20) DEFAULT 'active',
    email_verified  BOOLEAN DEFAULT FALSE,
    phone_verified  BOOLEAN DEFAULT FALSE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_location ON users(location_lat, location_lng);

-- User Profiles
CREATE TABLE user_profiles (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    rating_as_client    DECIMAL(3,2) DEFAULT 0.00,
    reviews_as_client   INT DEFAULT 0,
    jobs_posted         INT DEFAULT 0,
    jobs_completed_as_client INT DEFAULT 0,
    rating_as_worker    DECIMAL(3,2) DEFAULT 0.00,
    reviews_as_worker   INT DEFAULT 0,
    jobs_completed_as_worker INT DEFAULT 0,
    skills              JSONB DEFAULT '[]',
    hourly_rate_tokens  INT,
    availability        JSONB DEFAULT '{}',
    verified_skills     JSONB DEFAULT '[]',
    portfolio_images    JSONB DEFAULT '[]',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Categories
CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) UNIQUE NOT NULL,
    slug        VARCHAR(100) UNIQUE NOT NULL,
    icon        VARCHAR(50),
    color       VARCHAR(7),
    parent_id   UUID REFERENCES categories(id),
    sort_order  INT DEFAULT 0,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Skills
CREATE TABLE skills (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id     UUID NOT NULL REFERENCES categories(id),
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL,
    description     TEXT,
    icon            VARCHAR(50),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(category_id, slug)
);

-- Tasks
CREATE TABLE tasks (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id           UUID NOT NULL REFERENCES users(id),
    category_id         UUID NOT NULL REFERENCES categories(id),
    skill_id            UUID REFERENCES skills(id),
    title               VARCHAR(200) NOT NULL,
    description         TEXT NOT NULL,
    location_lat        DECIMAL(10, 8) NOT NULL,
    location_lng        DECIMAL(11, 8) NOT NULL,
    location_address    TEXT,
    location_city       VARCHAR(100),
    budget_min_tokens   INT NOT NULL,
    budget_max_tokens   INT NOT NULL,
    budget_type         VARCHAR(20) DEFAULT 'fixed',
    estimated_hours     DECIMAL(5,2),
    preferred_date      DATE,
    preferred_time_start TIME,
    preferred_time_end   TIME,
    urgency             VARCHAR(20) DEFAULT 'normal',
    status              VARCHAR(30) DEFAULT 'open',
    assigned_worker_id  UUID REFERENCES users(id),
    assigned_at         TIMESTAMPTZ,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    cancel_reason       TEXT,
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

-- Task Applications
CREATE TABLE task_applications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    worker_id       UUID NOT NULL REFERENCES users(id),
    proposed_tokens INT NOT NULL,
    proposed_hours  DECIMAL(5,2),
    message         TEXT,
    status          VARCHAR(20) DEFAULT 'pending',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(task_id, worker_id)
);

CREATE INDEX idx_task_apps_task ON task_applications(task_id);
CREATE INDEX idx_task_apps_worker ON task_applications(worker_id);
CREATE INDEX idx_task_apps_status ON task_applications(status);

-- Token Balances
CREATE TABLE token_balances (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    available_tokens    BIGINT DEFAULT 0,
    pending_tokens      BIGINT DEFAULT 0,
    lifetime_earned     BIGINT DEFAULT 0,
    lifetime_spent      BIGINT DEFAULT 0,
    lifetime_withdrawn  BIGINT DEFAULT 0,
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Token Transactions
CREATE TABLE token_transactions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id),
    type                VARCHAR(30) NOT NULL,
    amount              BIGINT NOT NULL,
    balance_after       BIGINT NOT NULL,
    related_task_id     UUID REFERENCES tasks(id),
    related_application_id UUID REFERENCES task_applications(id),
    related_withdrawal_id UUID REFERENCES token_withdrawals(id),
    related_purchase_id UUID REFERENCES token_purchases(id),
    description         VARCHAR(500),
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_token_tx_user ON token_transactions(user_id, created_at DESC);
CREATE INDEX idx_token_tx_type ON token_transactions(type);
CREATE INDEX idx_token_tx_task ON token_transactions(related_task_id);

-- Token Purchases
CREATE TABLE token_purchases (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id),
    tokens_amount       BIGINT NOT NULL,
    currency            VARCHAR(3) DEFAULT 'USD',
    amount_cents        BIGINT NOT NULL,
    exchange_rate       DECIMAL(10,4) NOT NULL,
    payment_provider    VARCHAR(30) NOT NULL,
    payment_intent_id   VARCHAR(255),
    status              VARCHAR(20) DEFAULT 'pending',
    completed_at        TIMESTAMPTZ,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Token Withdrawals
CREATE TABLE token_withdrawals (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id               UUID NOT NULL REFERENCES users(id),
    tokens_amount           BIGINT NOT NULL,
    currency                VARCHAR(3) DEFAULT 'USD',
    amount_cents            BIGINT NOT NULL,
    gross_amount_cents      BIGINT NOT NULL,
    platform_fee_cents      BIGINT NOT NULL,
    payment_processor_fee_cents BIGINT DEFAULT 0,
    exchange_rate           DECIMAL(10,4) NOT NULL,
    payout_method           VARCHAR(30) NOT NULL,
    payout_details          JSONB NOT NULL,
    status                  VARCHAR(20) DEFAULT 'pending',
    processed_at            TIMESTAMPTZ,
    failure_reason          TEXT,
    admin_notes             TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_withdrawals_worker ON token_withdrawals(worker_id, created_at DESC);
CREATE INDEX idx_withdrawals_status ON token_withdrawals(status);

-- Reviews
CREATE TABLE reviews (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id         UUID NOT NULL REFERENCES tasks(id),
    reviewer_id     UUID NOT NULL REFERENCES users(id),
    reviewee_id     UUID NOT NULL REFERENCES users(id),
    rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment         TEXT,
    quality_rating      SMALLINT CHECK (quality_rating BETWEEN 1 AND 5),
    communication_rating SMALLINT CHECK (communication_rating BETWEEN 1 AND 5),
    punctuality_rating   SMALLINT CHECK (punctuality_rating BETWEEN 1 AND 5),
    is_public       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(task_id, reviewer_id)
);

CREATE INDEX idx_reviews_reviewee ON reviews(reviewee_id, created_at DESC);

-- Conversations
CREATE TABLE conversations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id         UUID REFERENCES tasks(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation Participants
CREATE TABLE conversation_participants (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
);

-- Messages
CREATE TABLE messages (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id           UUID NOT NULL REFERENCES users(id),
    content             TEXT NOT NULL,
    type                VARCHAR(20) DEFAULT 'text',
    metadata            JSONB DEFAULT '{}',
    read_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at DESC);

-- Notifications
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,
    title           VARCHAR(200) NOT NULL,
    body            TEXT,
    data            JSONB DEFAULT '{}',
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read_at, created_at DESC);

-- Platform Config
CREATE TABLE platform_config (
    key                 VARCHAR(100) PRIMARY KEY,
    value               JSONB NOT NULL,
    description         TEXT,
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);