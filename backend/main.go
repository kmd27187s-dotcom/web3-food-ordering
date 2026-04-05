package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"mealvoting/backend/config"
	appbootstrap "mealvoting/backend/internal/app"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg := config.Load()
	runtime, err := appbootstrap.NewRuntime(cfg)
	if err != nil {
		log.Fatalf("bootstrap backend runtime: %v", err)
	}

	runtime.StartInactiveGroupPruner(ctx, log.Default())
	runtime.SyncChainOnStart(context.Background(), log.Default())

	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())
	router.Any("/*proxyPath", gin.WrapH(runtime.Handler.Routes()))

	log.Printf("mealvoting gin api listening on %s", cfg.HTTPAddress)
	httpServer := &http.Server{
		Addr:    cfg.HTTPAddress,
		Handler: router,
	}

	errCh := make(chan error, 1)
	go func() {
		errCh <- httpServer.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(shutdownCtx); err != nil {
			log.Printf("shutdown: %v", err)
		}
	}
}
