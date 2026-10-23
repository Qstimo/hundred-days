// Запуск HTTP-сервера. Всё, что сложнее сборки зависимостей, живёт в
// internal: main должен читаться целиком за раз.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Qstimo/hundred-days/api/internal/config"
	"github.com/Qstimo/hundred-days/api/internal/db"
	"github.com/Qstimo/hundred-days/api/internal/httpapi"
)

func main() {
	// Проверка живости из docker compose. В distroless нет ни curl, ни
	// оболочки, поэтому бинарник проверяет себя сам.
	if len(os.Args) > 1 && os.Args[1] == "-healthcheck" {
		selfCheck()
	}

	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	cfg, err := config.Load(os.LookupEnv)
	if err != nil {
		log.Error("настройки негодны", "ошибка", err)
		os.Exit(1)
	}

	pool, err := db.Open(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Error("база недоступна", "ошибка", err)
		os.Exit(1)
	}
	defer pool.Close()

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           httpapi.NewRouter(pool, cfg, time.Now),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Info("слушаю", "адрес", cfg.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("сервер упал", "ошибка", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Error("не удалось остановиться мягко", "ошибка", err)
	}
}

// selfCheck спрашивает собственную ручку живости и выходит с кодом ответа.
func selfCheck() {
	client := &http.Client{Timeout: 5 * time.Second}

	resp, err := client.Get("http://127.0.0.1:3001/api/health")
	if err != nil {
		os.Exit(1)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		os.Exit(1)
	}
	os.Exit(0)
}
