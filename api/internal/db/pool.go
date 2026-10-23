// Package db — подключение к PostgreSQL и порождённые sqlc запросы.
package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Open открывает пул и проверяет, что база отвечает. Пул, созданный без
// проверки, отложил бы ошибку подключения до первого запроса — то есть до
// первого пользователя.
func Open(ctx context.Context, url string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("строка подключения негодна: %w", err)
	}
	// Масштаб приложения — единицы пользователей: больше соединений не
	// нужно, а меньше оставляет запас на миграции и резервную копию.
	cfg.MaxConns = 8
	cfg.MaxConnLifetime = time.Hour

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("база не отвечает: %w", err)
	}

	return pool, nil
}
