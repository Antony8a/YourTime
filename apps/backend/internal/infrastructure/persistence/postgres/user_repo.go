package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
	"github.com/yourtime/backend/internal/domain/user"
)

type UserRepo struct {
	pool *pgxpool.Pool
}

func NewUserRepo(pool *pgxpool.Pool) *UserRepo { return &UserRepo{pool: pool} }

var _ user.Repository = (*UserRepo)(nil)

const userColumns = `id, email, password_hash, full_name, phone, avatar_url, bio, currency,
	location_lat, location_lng, location_city, search_radius_km, status, last_login_at, created_at, updated_at,
	rating_sum, rating_count, language`

func scanUser(row pgx.Row) (*user.User, error) {
	var (
		u        user.User
		email    string
		phone    *string
		currency string
		lat, lng *float64
		city     *string
		status   string
		language *string
	)
	err := row.Scan(&u.ID, &email, &u.PasswordHash, &u.FullName, &phone, &u.AvatarURL, &u.Bio, &currency,
		&lat, &lng, &city, &u.SearchRadiusKm, &status, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt,
		&u.Rating.Sum, &u.Rating.Count, &language)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, user.ErrNotFound
		}
		return nil, err
	}
	u.Email = valueobjects.Email(email)
	if language != nil {
		l := valueobjects.Language(*language)
		u.Language = &l
	}
	u.Currency = valueobjects.Currency(currency)
	u.Status = user.Status(status)
	if phone != nil {
		p := valueobjects.Phone(*phone)
		u.Phone = &p
	}
	if lat != nil && lng != nil {
		loc := &user.Location{Coordinates: valueobjects.Coordinates{Lat: *lat, Lng: *lng}}
		if city != nil {
			loc.City = *city
		}
		u.Location = loc
	}
	return &u, nil
}

// languageArg is the nullable SQL value of a person's chosen language.
func languageArg(l *valueobjects.Language) *string {
	if l == nil {
		return nil
	}
	s := l.String()
	return &s
}

// locationArgs flattens an optional location into nullable SQL arguments.
func locationArgs(loc *user.Location) (lat, lng *float64, city *string) {
	if loc == nil {
		return nil, nil, nil
	}
	return &loc.Coordinates.Lat, &loc.Coordinates.Lng, &loc.City
}

func (r *UserRepo) Create(ctx context.Context, u *user.User) error {
	lat, lng, city := locationArgs(u.Location)
	var phone *string
	if u.Phone != nil {
		p := u.Phone.String()
		phone = &p
	}
	_, err := r.pool.Exec(ctx, `
		INSERT INTO users (id, email, password_hash, full_name, phone, avatar_url, bio, currency,
			location_lat, location_lng, location_city, search_radius_km, status, created_at, updated_at, language)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
		u.ID, u.Email.String(), u.PasswordHash, u.FullName, phone, u.AvatarURL, u.Bio, u.Currency.String(),
		lat, lng, city, u.SearchRadiusKm, string(u.Status), u.CreatedAt, u.UpdatedAt, languageArg(u.Language))
	if isUniqueViolation(err, "users_email_key") {
		return user.ErrEmailTaken
	}
	return err
}

func (r *UserRepo) GetByID(ctx context.Context, id uuid.UUID) (*user.User, error) {
	return scanUser(r.pool.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE id = $1`, id))
}

func (r *UserRepo) GetByEmail(ctx context.Context, email valueobjects.Email) (*user.User, error) {
	return scanUser(r.pool.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE lower(email) = $1`, email.String()))
}

func (r *UserRepo) Update(ctx context.Context, u *user.User) error {
	lat, lng, city := locationArgs(u.Location)
	var phone *string
	if u.Phone != nil {
		p := u.Phone.String()
		phone = &p
	}
	tag, err := r.pool.Exec(ctx, `
		UPDATE users SET full_name=$2, phone=$3, avatar_url=$4, bio=$5, currency=$6,
			location_lat=$7, location_lng=$8, location_city=$9, search_radius_km=$10,
			status=$11, last_login_at=$12, password_hash=$13, updated_at=$14, language=$15
		WHERE id=$1`,
		u.ID, u.FullName, phone, u.AvatarURL, u.Bio, u.Currency.String(),
		lat, lng, city, u.SearchRadiusKm, string(u.Status), u.LastLoginAt, u.PasswordHash, u.UpdatedAt, languageArg(u.Language))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return user.ErrNotFound
	}
	return nil
}
