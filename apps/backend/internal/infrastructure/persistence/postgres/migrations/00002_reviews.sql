-- +goose Up
-- +goose StatementBegin

-- Running totals so a person's rating is a constant-time read. They are kept
-- in step with `reviews` inside the same transaction that inserts a review.
ALTER TABLE users
    ADD COLUMN rating_sum   INT NOT NULL DEFAULT 0,
    ADD COLUMN rating_count INT NOT NULL DEFAULT 0;

CREATE TABLE reviews (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id),
    reviewee_id UUID NOT NULL REFERENCES users(id),
    rating      SMALLINT NOT NULL,
    comment     TEXT NOT NULL DEFAULT '',
    -- The reviewee may answer once.
    reply       TEXT,
    replied_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT reviews_rating_range CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT reviews_not_self CHECK (reviewer_id <> reviewee_id),
    CONSTRAINT reviews_reply_pair CHECK ((reply IS NULL) = (replied_at IS NULL)),
    -- Each person reviews the other once per task.
    CONSTRAINT reviews_one_per_reviewer UNIQUE (task_id, reviewer_id)
);

CREATE INDEX reviews_reviewee_idx ON reviews (reviewee_id, created_at DESC);
-- +goose StatementEnd

-- +goose Down
DROP TABLE IF EXISTS reviews;
ALTER TABLE users DROP COLUMN IF EXISTS rating_sum, DROP COLUMN IF EXISTS rating_count;
