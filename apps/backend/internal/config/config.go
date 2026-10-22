// Package config loads settings from environment variables.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

const devJWTSecret = "dev-only-secret-do-not-use-in-production-0123456789"

type Config struct {
	Env         string
	Port        string
	DatabaseURL string
	// CORSOrigins are browser origins allowed to call the API. Native mobile
	// apps send no Origin header and are unaffected.
	CORSOrigins []string
	// TrustProxy makes the server believe X-Forwarded-For / X-Real-IP. Enable
	// it only behind a reverse proxy you control, otherwise clients can spoof
	// their IP and dodge rate limiting.
	TrustProxy  bool
	AutoMigrate bool
	// RegistrationOpen lets anyone create an account. Turn it off once the people
	// who should have one do, so a server on the internet is not open to strangers.
	RegistrationOpen bool
	JWT              JWTConfig
}

type JWTConfig struct {
	Secret     string
	AccessTTL  time.Duration
	RefreshTTL time.Duration
}

func (c *Config) IsDevelopment() bool { return c.Env == "development" }

func Load() (*Config, error) {
	cfg := &Config{
		Env:              getenv("APP_ENV", "development"),
		Port:             getenv("PORT", getenv("APP_PORT", "8080")),
		DatabaseURL:      getenv("DATABASE_URL", "postgres://yourtime:yourtime_dev@localhost:5432/yourtime?sslmode=disable"),
		CORSOrigins:      splitList(getenv("CORS_ORIGINS", "http://localhost:8081,http://localhost:19006")),
		TrustProxy:       getbool("TRUST_PROXY", false),
		RegistrationOpen: getbool("REGISTRATION_OPEN", true),
		JWT: JWTConfig{
			Secret: os.Getenv("JWT_SECRET"),
		},
	}
	cfg.AutoMigrate = getbool("DB_AUTO_MIGRATE", cfg.IsDevelopment())

	var err error
	if cfg.JWT.AccessTTL, err = getduration("JWT_ACCESS_TTL", 15*time.Minute); err != nil {
		return nil, err
	}
	if cfg.JWT.RefreshTTL, err = getduration("JWT_REFRESH_TTL", 30*24*time.Hour); err != nil {
		return nil, err
	}

	if cfg.JWT.Secret == "" && cfg.IsDevelopment() {
		cfg.JWT.Secret = devJWTSecret
	}
	if len(cfg.JWT.Secret) < 32 {
		return nil, errors.New("JWT_SECRET must be set and at least 32 characters long")
	}
	if !cfg.IsDevelopment() && cfg.JWT.Secret == devJWTSecret {
		return nil, errors.New("JWT_SECRET must not use the development default outside development")
	}
	return cfg, nil
}

func getenv(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func getbool(key string, fallback bool) bool {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}
	return b
}

func getduration(key string, fallback time.Duration) (time.Duration, error) {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback, nil
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return 0, fmt.Errorf("%s: invalid duration %q (use e.g. 15m, 720h)", key, v)
	}
	return d, nil
}

func splitList(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
