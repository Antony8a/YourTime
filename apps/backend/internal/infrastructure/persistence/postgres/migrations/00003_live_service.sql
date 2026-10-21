-- +goose Up
-- +goose StatementBegin

-- New steps of the live service, and where the worker is while it is active.
ALTER TABLE tasks DROP CONSTRAINT tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('open', 'assigned', 'en_route', 'in_progress', 'completed', 'cancelled'));

ALTER TABLE tasks
    ADD COLUMN en_route_at        TIMESTAMPTZ,
    ADD COLUMN started_at         TIMESTAMPTZ,
    ADD COLUMN worker_lat         DOUBLE PRECISION,
    ADD COLUMN worker_lng         DOUBLE PRECISION,
    ADD COLUMN worker_location_at TIMESTAMPTZ,
    ADD CONSTRAINT tasks_worker_location_pair CHECK ((worker_lat IS NULL) = (worker_lng IS NULL));

-- One service at a time. A person can have one active service as client and one
-- as worker. Unique partial indexes make the database the judge, so two people
-- choosing the same worker at the same moment cannot both succeed. This
-- migration fails if existing data already breaks the rule: fix the data first.
CREATE UNIQUE INDEX tasks_one_active_per_poster ON tasks (poster_id)
    WHERE status IN ('assigned', 'en_route', 'in_progress');
CREATE UNIQUE INDEX tasks_one_active_per_worker ON tasks (assigned_applicant_id)
    WHERE status IN ('assigned', 'en_route', 'in_progress');
-- +goose StatementEnd

-- +goose Down
DROP INDEX IF EXISTS tasks_one_active_per_worker;
DROP INDEX IF EXISTS tasks_one_active_per_poster;
UPDATE tasks SET status = 'assigned' WHERE status IN ('en_route', 'in_progress');
ALTER TABLE tasks
    DROP CONSTRAINT IF EXISTS tasks_worker_location_pair,
    DROP COLUMN IF EXISTS worker_location_at,
    DROP COLUMN IF EXISTS worker_lng,
    DROP COLUMN IF EXISTS worker_lat,
    DROP COLUMN IF EXISTS started_at,
    DROP COLUMN IF EXISTS en_route_at;
ALTER TABLE tasks DROP CONSTRAINT tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('open', 'assigned', 'completed', 'cancelled'));
