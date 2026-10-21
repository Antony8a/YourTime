-- +goose Up
-- +goose StatementBegin

-- The travel time estimated when the worker set out. Punctuality is judged
-- against it, so a worker is not blamed for a trip that was longer than the
-- time they were given, nor for the traffic along the way.
ALTER TABLE tasks
    ADD COLUMN route_eta_seconds INT,
    ADD CONSTRAINT tasks_route_eta_range CHECK (route_eta_seconds IS NULL OR route_eta_seconds BETWEEN 0 AND 86400);
-- +goose StatementEnd

-- +goose Down
ALTER TABLE tasks
    DROP CONSTRAINT IF EXISTS tasks_route_eta_range,
    DROP COLUMN IF EXISTS route_eta_seconds;
