package main

import (
	"context"
	"io"
	"log"
	"sync"
	"testing"
	"time"

	appbootstrap "mealvoting/backend/internal/app"
)

type stubInactiveGroupPruner struct {
	mu    sync.Mutex
	count int
	ch    chan int
}

func (s *stubInactiveGroupPruner) PruneInactiveGroups(ctx context.Context) error {
	s.mu.Lock()
	s.count++
	count := s.count
	s.mu.Unlock()

	select {
	case s.ch <- count:
	default:
	}
	return nil
}

func TestStartInactiveGroupPrunerRunsImmediatelyAndOnTicker(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	store := &stubInactiveGroupPruner{ch: make(chan int, 4)}
	done := make(chan struct{})
	go func() {
		defer close(done)
		appbootstrap.RunInactiveGroupPruner(ctx, log.New(io.Discard, "", 0), store, 10*time.Millisecond)
	}()

	select {
	case count := <-store.ch:
		if count != 1 {
			t.Fatalf("expected immediate prune count 1, got %d", count)
		}
	case <-time.After(100 * time.Millisecond):
		t.Fatal("timed out waiting for immediate prune")
	}

	select {
	case count := <-store.ch:
		if count < 2 {
			t.Fatalf("expected scheduled prune count >= 2, got %d", count)
		}
	case <-time.After(150 * time.Millisecond):
		t.Fatal("timed out waiting for scheduled prune")
	}

	cancel()

	select {
	case <-done:
	case <-time.After(100 * time.Millisecond):
		t.Fatal("pruner did not stop after context cancellation")
	}
}
