-- +goose Up
-- +goose StatementBegin

-- The language the person chose for the app. NULL means "follow the device".
-- Keep the list in sync with valueobjects.NewLanguage and the apps.
ALTER TABLE users
    ADD COLUMN language VARCHAR(5),
    ADD CONSTRAINT users_language_check CHECK (language IS NULL OR language IN ('es', 'en', 'pt', 'fr'));
-- +goose StatementEnd

-- +goose Down
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_language_check,
    DROP COLUMN IF EXISTS language;
