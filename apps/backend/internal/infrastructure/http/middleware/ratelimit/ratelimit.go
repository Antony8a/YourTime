// Package ratelimit is a small in-memory fixed-window limiter keyed by client
// IP. It protects a single instance; swap it for a shared store (Redis) when
// the API runs on several instances.
package ratelimit

import (
	"context"
	"net"
	"net/http"
	"strconv"
	"sync"
	"time"

	httpx "github.com/yourtime/backend/internal/infrastructure/http"
)

type window struct {
	start time.Time
	count int
}

type limiter struct {
	mu      sync.Mutex
	clients map[string]*window
	max     int
	period  time.Duration
}

// New allows at most max requests per period per client IP. The cleanup
// goroutine stops when ctx is cancelled.
func New(ctx context.Context, max int, period time.Duration) func(http.Handler) http.Handler {
	l := &limiter{clients: make(map[string]*window), max: max, period: period}
	go l.cleanupLoop(ctx)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			allowed, retryAfter := l.allow(clientIP(r), time.Now())
			if !allowed {
				w.Header().Set("Retry-After", strconv.Itoa(int(retryAfter.Seconds())+1))
				httpx.Problem(w, r, http.StatusTooManyRequests, "Too many requests, please slow down")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func (l *limiter) allow(key string, now time.Time) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()

	w, ok := l.clients[key]
	if !ok || now.Sub(w.start) >= l.period {
		l.clients[key] = &window{start: now, count: 1}
		return true, 0
	}
	if w.count >= l.max {
		return false, l.period - now.Sub(w.start)
	}
	w.count++
	return true, 0
}

func (l *limiter) cleanupLoop(ctx context.Context) {
	t := time.NewTicker(l.period)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-t.C:
			l.mu.Lock()
			for k, w := range l.clients {
				if now.Sub(w.start) >= l.period {
					delete(l.clients, k)
				}
			}
			l.mu.Unlock()
		}
	}
}
