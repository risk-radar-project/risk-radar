package ratelimit

import (
	"sync"
	"time"

	"api-gateway/internal/config"
)

type Limiter struct {
	window  time.Duration
	mu      sync.Mutex
	buckets map[string]*windowCounter
}

type windowCounter struct {
	start  time.Time
	counts map[string]int
}

func New(window time.Duration) *Limiter {
	return &Limiter{
		window:  window,
		buckets: make(map[string]*windowCounter),
	}
}

func (l *Limiter) Allow(route config.RuntimeRoute, key string, authenticated bool) bool {
	if route.RateLimit == nil {
		return true
	}
	if key == "" {
		return true
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	bucket := l.bucket(route.Prefix)
	bucket.resetIfNeeded(time.Now(), l.window)
	limit := route.RateLimit.Anonymous
	if authenticated {
		limit = route.RateLimit.Authenticated
	}
	bucket.counts[key]++
	return bucket.counts[key] <= limit
}

func (l *Limiter) bucket(prefix string) *windowCounter {
	b, ok := l.buckets[prefix]
	if !ok {
		b = &windowCounter{start: time.Now(), counts: make(map[string]int)}
		l.buckets[prefix] = b
	}
	return b
}

func (w *windowCounter) resetIfNeeded(now time.Time, window time.Duration) {
	if now.Sub(w.start) >= window {
		w.start = now
		w.counts = make(map[string]int)
	}
}
