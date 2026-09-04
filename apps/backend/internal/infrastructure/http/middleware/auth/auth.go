package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/yourtime/backend/internal/platform/logger"
)

type contextKey string

const UserIDKey contextKey = "user_id"

func New(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				logger.Warn().Str("path", r.URL.Path).Msg("Missing Authorization header")
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				logger.Warn().Str("path", r.URL.Path).Msg("Invalid Authorization header format")
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			tokenString := parts[1]
			claims := jwt.MapClaims{}

			token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
				return []byte(secret), nil
			})

			if err != nil || !token.Valid {
				logger.Warn().Err(err).Str("path", r.URL.Path).Msg("Invalid token")
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			userID, ok := claims["sub"].(string)
			if !ok || userID == "" {
				logger.Warn().Msg("Token missing user ID")
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), UserIDKey, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetUserID(ctx context.Context) (string, bool) {
	userID, ok := ctx.Value(UserIDKey).(string)
	return userID, ok
}