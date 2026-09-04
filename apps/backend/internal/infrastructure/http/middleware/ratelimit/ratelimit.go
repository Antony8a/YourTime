package ratelimit

import (
	"net/http"
	"sync"
	"time"

	"github.com/yourtime/backend/internal/config"
	"github.com/yourtime/backend/internal/platform/logger"
)

type clientLimiter struct {
	mu       sync.Mutex
	requests map[string][]time.Time
}

func New(cfg *config.Config) func(http.Handler) http.Handler {
	limiter := &clientLimiter{
		requests: make(map[string][]time.Time),
	}

	// Cleanup old entries every minute
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			limiter.cleanup()
		}
	}()

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !limiter.allow(r.RemoteAddr) {
				logger.Warn().
					Str("ip", r.RemoteAddr).
					Str("path", r.URL.Path).
					Msg("Rate limit exceeded")
				w.Header().Set("X-RateLimit-Limit", "1000")
				w.Header().Set("X-RateLimit-Remaining", "0")
				w.Header().Set("X-RateLimit-Reset", time.Now().Add(time.Hour).Format(time.RFC1123))
				http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func (l *clientLimiter) allow(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	window := now.Add(-time.Hour)

	requests := l.requests[ip]
	valid := make([]time.Time, 0, len(requests))
	for _, t := range requests {
		if t.After(window) {
			valid = append(valid, t)
		}
	}

	if len(valid) >= 1000 { // 1000 requests per hour
		return false
	}

	valid = append(valid, now)
	l.requests[ip] = valid
	return true
}

func (l *clientLimiter) cleanup() {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	window := now.Add(-time.Hour)

	for ip, requests := range l.requests {
		valid := make([]time.Time, 0)
		for _, t := range requests {
			if t.After(window) {
				valid = append(valid, t)
			}
		}
		if len(valid) == 0 {
			delete(l.requests, ip)
		} else {
			l.requests[ip] = valid
		}
	}
}