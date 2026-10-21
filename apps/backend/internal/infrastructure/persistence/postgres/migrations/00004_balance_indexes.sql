-- +goose Up
-- +goose StatementBegin
-- The balance sums finished services per person over a period, as worker or as client.
CREATE INDEX tasks_worker_completed_idx ON tasks (assigned_applicant_id, completed_at DESC)
    WHERE status = 'completed';
CREATE INDEX tasks_poster_completed_idx ON tasks (poster_id, completed_at DESC)
    WHERE status = 'completed';
-- +goose StatementEnd

-- +goose Down
DROP INDEX IF EXISTS tasks_poster_completed_idx;
DROP INDEX IF EXISTS tasks_worker_completed_idx;
