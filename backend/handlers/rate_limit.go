package handlers

import (
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

type rateLimiter struct {
	mu      sync.Mutex
	entries map[string]rateLimitEntry
	now     func() time.Time
}

type rateLimitEntry struct {
	count     int
	windowEnd time.Time
}

func newRateLimiter() *rateLimiter {
	return &rateLimiter{
		entries: make(map[string]rateLimitEntry),
		now:     time.Now,
	}
}

func (r *rateLimiter) allow(key string, limit int, window time.Duration) (bool, time.Duration) {
	now := r.now()

	r.mu.Lock()
	defer r.mu.Unlock()

	for existingKey, entry := range r.entries {
		if !entry.windowEnd.After(now) {
			delete(r.entries, existingKey)
		}
	}

	entry, ok := r.entries[key]
	if !ok || !entry.windowEnd.After(now) {
		r.entries[key] = rateLimitEntry{
			count:     1,
			windowEnd: now.Add(window),
		}
		return true, 0
	}

	if entry.count >= limit {
		return false, entry.windowEnd.Sub(now)
	}

	entry.count++
	r.entries[key] = entry
	return true, 0
}

func clientIdentifier(r *http.Request) string {
	forwardedFor := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-For"), ",")[0])
	if forwardedFor != "" {
		return forwardedFor
	}
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return host
	}
	if strings.TrimSpace(r.RemoteAddr) != "" {
		return strings.TrimSpace(r.RemoteAddr)
	}
	return "unknown"
}

func retryAfterSeconds(delay time.Duration) string {
	seconds := int((delay + time.Second - 1) / time.Second)
	if seconds < 1 {
		seconds = 1
	}
	return strconv.Itoa(seconds)
}
