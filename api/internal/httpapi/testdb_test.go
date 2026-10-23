package httpapi

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

// Интеграционные тесты идут на настоящем PostgreSQL: половина инвариантов
// живёт ограничениями в схеме, и подделка базы их не проверит.
//
// Контейнер поднимается один на пакет, а между тестами таблицы чистятся:
// по контейнеру на тест было бы слишком медленно.
var testPool *pgxpool.Pool

func TestMain(m *testing.M) {
	ctx := context.Background()

	container, err := postgres.Run(ctx, "postgres:17-alpine",
		postgres.WithDatabase("hundred_days"),
		postgres.WithUsername("hd_owner"),
		postgres.WithPassword("secret"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).WithStartupTimeout(90*time.Second)),
	)
	if err != nil {
		panic(err)
	}

	code := run(ctx, container, m)

	_ = testcontainers.TerminateContainer(container)
	os.Exit(code)
}

// run вынесен из TestMain, чтобы defer успевал закрыть пул до завершения
// процесса: os.Exit в TestMain отложенные вызовы не выполняет.
func run(ctx context.Context, container *postgres.PostgresContainer, m *testing.M) int {
	url, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		panic(err)
	}

	if err := runMigrations(url); err != nil {
		panic(err)
	}

	testPool, err = pgxpool.New(ctx, url)
	if err != nil {
		panic(err)
	}
	defer testPool.Close()

	return m.Run()
}

// runMigrations применяет те же файлы goose, что и развёртывание: тесты
// должны идти на схеме, которая поедет на сервер, а не на своей копии.
func runMigrations(url string) error {
	// Тот же скрипт, что у разработчика: инструменты живут в своём модуле,
	// и вызывать их мимо него значит собирать их заново по-своему.
	apiDir, err := filepath.Abs(filepath.Join("..", ".."))
	if err != nil {
		return err
	}

	cmd := exec.Command("./tools.sh", "goose",
		"-dir", "internal/db/migrations", "postgres", url, "up")
	cmd.Dir = apiDir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// truncateAll чистит данные между тестами, оставляя схему. RESTART IDENTITY
// обнуляет счётчики: тесты сравнивают идентификаторы, и продолжающаяся
// нумерация делала бы их зависимыми от порядка запуска.
func truncateAll(t *testing.T) {
	t.Helper()

	_, err := testPool.Exec(context.Background(),
		`TRUNCATE day_plans, sleep_logs, entries, trackers, skills, settings,
		 sessions, users RESTART IDENTITY CASCADE`)
	require.NoError(t, err)
}
