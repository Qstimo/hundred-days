# «100 дней до» — план реализации

> **Для агентов:** ОБЯЗАТЕЛЬНО выполнять через superpowers:executing-plans.
> Шаги помечены чекбоксами (`- [ ]`) для отслеживания.

**Цель:** личный трекер с ограниченным сроком — ежедневные отметки, часы, сон,
планы на день и прогресс навыков в поинтах.

**Архитектура:** Go-API на chi отдаёт JSON по спецификации OpenAPI, Next 15
отдаёт интерфейс. Спецификация — единственный источник типов: из неё
генерируются и серверные интерфейсы Go, и клиент TypeScript. Хранилище —
PostgreSQL, запросы пишутся на SQL и превращаются в типизированные функции
через sqlc. Вычисляемые величины (серии, поинты, прогноз) живут в чистом
пакете `domain` без базы и тестируются первыми.

**Стек:** Go 1.27 (chi, pgx, sqlc, goose, testcontainers-go), Next 15 (App
Router, TanStack Query v5, shadcn/ui, Recharts), PostgreSQL 17, Docker Compose,
Caddy.

**Источник правды:** `docs/superpowers/specs/2026-10-23-hundred-days-design.md`.
Читай его перед каждым чанком.

---

## Предусловия

Go уже установлен в `~/.local/go`, PATH прописан в `~/.bashrc`. Если `go
version` не отвечает — открой новый терминал или выполни
`export PATH="$HOME/.local/go/bin:$HOME/go/bin:$PATH"`.

Проверка перед началом:

```bash
go version          # go1.27.3 linux/amd64
node -v             # v22.x
pnpm -v             # 10.x
docker compose version
```

---

## Структура файлов

Создаётся целиком этим планом. Каждый файл отвечает за одно.

```
hundred-days/
  docker-compose.yml            стек: postgres, api, web, caddy
  docker-compose.override.yml   локальные порты наружу (не уезжает на сервер)
  .env.example                  все переменные с описаниями
  README.md                     команды разработки и развёртывания
  openapi/
    openapi.yaml                контракт — источник правды для обеих сторон
    oapi-codegen.yaml           настройка генератора Go
  api/
    go.mod  go.sum
    tools.sh                    запуск goose, sqlc, oapi-codegen
    tools/go.mod                модуль инструментов: их зависимости отдельно
    sqlc.yaml                   настройка sqlc
    Dockerfile                  сборка api в статический бинарник
    cmd/
      api/main.go               запуск HTTP-сервера
      cli/main.go               create-user, migrate
    internal/
      config/config.go          чтение переменных окружения
      domain/                   чистые вычисления, без базы и HTTP
        period.go  period_test.go          осталось дней, номер дня
        points.go  points_test.go          поинты одного выполнения
        streak.go  streak_test.go          недельные серии
        sleep.go   sleep_test.go           длительность сна
        forecast.go forecast_test.go       темп и прогноз
        completion.go completion_test.go   процент выполнения
      auth/
        password.go  password_test.go      argon2id
        session.go   session_test.go       выдача и проверка сессий
      db/
        migrations/               goose, по файлу на изменение схемы
        queries/                  sqlc, по файлу на сущность
        gen/                      порождённое sqlc, коммитится
        pool.go                   подключение pgx
        queries_guard_test.go     проверка: каждый запрос фильтрует по user_id
      store/
        store.go                  обёртка: user_id первым аргументом всегда
        trackers.go  skills.go  entries.go  sleep.go  dayplans.go
        settings.go  stats.go
      httpapi/
        gen/                      порождённое oapi-codegen, коммитится
        server.go                 сборка роутера, реализация интерфейса
        middleware.go             сессия → user_id в контексте
        errors.go                 отображение ошибок в коды ответов
        auth.go  day.go  entries.go  sleep.go  dayplans.go
        trackers.go  skills.go  settings.go  stats.go
  web/
    package.json  tsconfig.json  vitest.config.ts
    Dockerfile
    src/
      app/
        layout.tsx  globals.css
        page.tsx                  День — главная
        dashboard/page.tsx
        trackers/page.tsx
        settings/page.tsx
        login/page.tsx
      api-client/
        schema.d.ts               порождённое openapi-typescript
        client.ts                 openapi-fetch с базовым адресом
        index.ts
      components/                 по компоненту в директории
      features/
        day/  dashboard/  trackers/  settings/  auth/
      lib/
        utils.ts                  cn и прочее от shadcn
  docker/
    caddy/Caddyfile
    postgres/init/01-roles.sh     отдельная роль приложения, не владелец
  scripts/
    lib.sh  preflight.sh  deploy.sh  backup.sh  restore.sh
  .github/workflows/ci.yml
```

---

## Соглашения, которые нельзя нарушать

1. **Сначала падающий тест.** Каждая задача начинается с теста, который
   падает по понятной причине, и только потом появляется код.
2. **`user_id` первым аргументом.** Каждая функция в `store/` принимает
   `userID int64` первым параметром, каждый SQL-запрос по данным
   пользователя содержит `user_id = $1` в `WHERE`. Это проверяется тестом
   `queries_guard_test.go`, а не только ревью.
3. **Коммит после каждой задачи.** Сообщения на русском, в повелительном
   наклонении («Добавить», «Считать»), как в CAIRN.
4. **Правила интерфейса** из `~/.claude/CLAUDE.md`: компонент до 100 строк, в
   своей директории, пропсы как `IProps` в `types.ts`, тест
   `ComponentName.test.tsx`, логика в `utils/`, никаких inline-массивов в JSX.
5. **Инструменты — в своём модуле.** `goose`, `sqlc` и `oapi-codegen` живут
   в `api/tools/go.mod` и запускаются через `api/tools.sh`. В модуле
   приложения их зависимости раздували бы `go.sum` с шести строк до трёхсот
   и ехали бы в `go mod download` при каждой сборке образа.
6. **Поинты и часы — `float64`.** В базе `double precision`, а не `numeric`:
   у `numeric` в pgx тип `pgtype.Numeric`, с которым неудобно считать, а
   точности `float64` на числах вида 0.5 и 2 хватает с огромным запасом.
   Округление до двух знаков — на записи, функцией `domain.Round2`.

---

## Chunk 1: Фундамент

Итог чанка: `docker compose up` поднимает PostgreSQL и Go-API, `curl
http://localhost:18081/api/health` отвечает `{"status":"ok"}`, миграции
применяются, CI зелёный.

### Задача 1.1: Go-модуль и проверка живости

**Файлы:**
- Создать: `api/go.mod`
- Создать: `api/internal/httpapi/health.go`
- Тест: `api/internal/httpapi/health_test.go`

- [ ] **Шаг 1: Завести модуль**

```bash
cd ~/"Рабочий стол"/MyMVP/hundred-days/api
go mod init github.com/Qstimo/hundred-days/api
go get github.com/go-chi/chi/v5@latest
go get github.com/stretchr/testify@latest
```

- [ ] **Шаг 2: Написать падающий тест**

`api/internal/httpapi/health_test.go`:

```go
package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

// Ручка живости не обращается ни к базе, ни к сессии: её спрашивает docker
// compose, когда база может быть ещё не готова.
func TestHealth(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()

	Health(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var body map[string]string
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&body))
	require.Equal(t, "ok", body["status"])
}
```

- [ ] **Шаг 3: Убедиться, что тест падает**

Запустить: `go test ./internal/httpapi/ -run TestHealth -v`
Ожидается: ошибка компиляции `undefined: Health`.

- [ ] **Шаг 4: Реализовать**

`api/internal/httpapi/health.go`:

```go
package httpapi

import (
	"encoding/json"
	"net/http"
)

// Health отвечает на проверку живости. Ни база, ни сессия не нужны: ручку
// спрашивает docker compose в момент, когда остальное может быть не поднято.
func Health(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
```

- [ ] **Шаг 5: Убедиться, что тест проходит**

Запустить: `go test ./internal/httpapi/ -v`
Ожидается: PASS.

- [ ] **Шаг 6: Коммит**

```bash
cd ~/"Рабочий стол"/MyMVP/hundred-days
git add api/
git commit -m "Завести модуль api и ручку живости"
```

### Задача 1.2: Чтение настроек окружения

**Файлы:**
- Создать: `api/internal/config/config.go`
- Тест: `api/internal/config/config_test.go`

- [ ] **Шаг 1: Написать падающий тест**

`api/internal/config/config_test.go`:

```go
package config

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestLoadRequiresDatabaseURL(t *testing.T) {
	_, err := Load(func(string) (string, bool) { return "", false })

	require.ErrorContains(t, err, "HD_DATABASE_URL")
}

func TestLoadDefaults(t *testing.T) {
	env := map[string]string{"HD_DATABASE_URL": "postgres://localhost/hd"}

	cfg, err := Load(func(k string) (string, bool) { v, ok := env[k]; return v, ok })

	require.NoError(t, err)
	require.Equal(t, ":3001", cfg.Addr)
	require.Equal(t, "Europe/Moscow", cfg.Location.String())
	require.Equal(t, 30*24*time.Hour, cfg.SessionTTL)
	require.False(t, cfg.SecureCookie)
}

// Зона нужна валидная: по ней определяется «сегодня», и опечатка в имени
// увела бы все даты в UTC молча.
func TestLoadRejectsUnknownTimezone(t *testing.T) {
	env := map[string]string{
		"HD_DATABASE_URL": "postgres://localhost/hd",
		"HD_TIMEZONE":     "Europe/Moskva",
	}

	_, err := Load(func(k string) (string, bool) { v, ok := env[k]; return v, ok })

	require.ErrorContains(t, err, "HD_TIMEZONE")
}
```

- [ ] **Шаг 2: Убедиться, что тест падает**

Запустить: `go test ./internal/config/ -v`
Ожидается: `undefined: Load`.

- [ ] **Шаг 3: Реализовать**

`api/internal/config/config.go`:

```go
// Package config читает настройки из переменных окружения. Отсутствие
// обязательной переменной — ошибка запуска, а не значение по умолчанию:
// приложение, молча поднявшееся не с той базой, хуже не поднявшегося.
package config

import (
	"fmt"
	"time"
)

// Lookup — источник переменных. Вынесен в параметр, чтобы тесты не трогали
// настоящее окружение процесса.
type Lookup func(key string) (string, bool)

// Config — все настройки приложения.
type Config struct {
	DatabaseURL  string
	Addr         string
	Location     *time.Location
	SessionTTL   time.Duration
	SecureCookie bool
}

// Load собирает настройки. Обязательна только строка подключения к базе.
func Load(lookup Lookup) (Config, error) {
	cfg := Config{
		Addr:       ":3001",
		SessionTTL: 30 * 24 * time.Hour,
	}

	url, ok := lookup("HD_DATABASE_URL")
	if !ok || url == "" {
		return Config{}, fmt.Errorf("HD_DATABASE_URL не задан")
	}
	cfg.DatabaseURL = url

	if addr, ok := lookup("HD_ADDR"); ok && addr != "" {
		cfg.Addr = addr
	}

	tz := "Europe/Moscow"
	if v, ok := lookup("HD_TIMEZONE"); ok && v != "" {
		tz = v
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return Config{}, fmt.Errorf("HD_TIMEZONE: неизвестная зона %q: %w", tz, err)
	}
	cfg.Location = loc

	// Флаг Secure у cookie: по HTTP он сделал бы вход невозможным, поэтому
	// включается отдельно, вместе с HTTPS.
	if v, ok := lookup("HD_SECURE_COOKIE"); ok && v == "true" {
		cfg.SecureCookie = true
	}

	return cfg, nil
}
```

- [ ] **Шаг 4: Убедиться, что тесты проходят**

Запустить: `go test ./internal/config/ -v`
Ожидается: три PASS.

- [ ] **Шаг 5: Коммит**

```bash
git add api/internal/config/
git commit -m "Читать настройки из окружения"
```

### Задача 1.3: Схема базы и миграции

**Файлы:**
- Создать: `api/internal/db/migrations/00001_init.sql`
- Создать: `docker/postgres/init/01-roles.sh`

- [ ] **Шаг 1: Поставить goose**

```bash
cd ~/"Рабочий стол"/MyMVP/hundred-days/api
mkdir -p tools && cd tools
# Отдельный модуль для инструментов: goose тянет драйверы всех баз, какие
# умеет, и в модуле приложения они раздули бы go.sum с шести строк до
# трёхсот и ехали бы в `go mod download` при каждой сборке образа.
cat > go.mod <<'EOF'
module github.com/Qstimo/hundred-days/api/tools

go 1.27.3
EOF
go get -tool github.com/pressly/goose/v3/cmd/goose@latest
cd .. && ./tools.sh goose --version
```

Скрипт `api/tools.sh` собирает инструмент в `api/bin` и запускает его из
каталога `api`, поэтому пути в аргументах остаются обычными. Он создаётся
здесь же — его содержимое смотри в репозитории.

- [ ] **Шаг 2: Написать миграцию**

`api/internal/db/migrations/00001_init.sql`:

```sql
-- +goose Up
-- +goose StatementBegin

CREATE TABLE users (
  id            bigserial PRIMARY KEY,
  login         text NOT NULL UNIQUE,
  name          text NOT NULL DEFAULT '',
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id         text PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON sessions (user_id);

-- Одна строка настроек на пользователя. «Осталось N дней» не хранится:
-- хранимое число разошлось бы с календарём на следующий же день.
CREATE TABLE settings (
  user_id       bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  period_title  text NOT NULL DEFAULT '100 дней до',
  period_start  date NOT NULL,
  period_days   integer NOT NULL DEFAULT 100
                CHECK (period_days BETWEEN 1 AND 3650),
  sleep_enabled boolean NOT NULL DEFAULT true
);

CREATE TABLE skills (
  id            bigserial PRIMARY KEY,
  user_id       bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         text NOT NULL CHECK (length(btrim(title)) > 0),
  target_points double precision NOT NULL CHECK (target_points > 0),
  unit_label    text NOT NULL DEFAULT '',
  sort_order    integer NOT NULL DEFAULT 0,
  archived_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX skills_user_id_idx ON skills (user_id);

CREATE TYPE tracker_mode AS ENUM ('check', 'check_hours');
CREATE TYPE points_rule AS ENUM ('per_check', 'per_hour');

CREATE TABLE trackers (
  id            bigserial PRIMARY KEY,
  user_id       bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         text NOT NULL CHECK (length(btrim(title)) > 0),
  mode          tracker_mode NOT NULL,
  points_rule   points_rule NOT NULL,
  points_value  double precision NOT NULL CHECK (points_value >= 0),
  skill_id      bigint REFERENCES skills(id) ON DELETE SET NULL,
  weekly_target integer NOT NULL CHECK (weekly_target BETWEEN 1 AND 7),
  sort_order    integer NOT NULL DEFAULT 0,
  archived_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Правило «за час» считает поинты от часов. У трекера без часов их нет,
  -- и правило давало бы ноль при каждом выполнении.
  CONSTRAINT trackers_per_hour_needs_hours
    CHECK (points_rule <> 'per_hour' OR mode = 'check_hours')
);
CREATE INDEX trackers_user_id_idx ON trackers (user_id);
CREATE INDEX trackers_skill_id_idx ON trackers (skill_id);

-- Существование строки и есть «сделано»: отдельного значения «не сделано»
-- нет, снятие галочки удаляет строку.
-- points_awarded зафиксированы при записи, а не считаются по текущей цене
-- трекера: иначе правка цены переписала бы весь прошлый прогресс навыка.
CREATE TABLE entries (
  id             bigserial PRIMARY KEY,
  user_id        bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tracker_id     bigint NOT NULL REFERENCES trackers(id) ON DELETE CASCADE,
  entry_date     date NOT NULL,
  hours          double precision
                 CHECK (hours IS NULL OR (hours > 0 AND hours <= 24)),
  points_awarded double precision NOT NULL CHECK (points_awarded >= 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tracker_id, entry_date)
);
CREATE INDEX entries_user_date_idx ON entries (user_id, entry_date);

-- Дата привязки — дата подъёма: день, к которому относится сон. Все три
-- значения необязательны, заполнить только подъём — нормально.
CREATE TABLE sleep_logs (
  user_id        bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date       date NOT NULL,
  went_to_bed_at time,
  woke_up_at     time,
  quality        smallint CHECK (quality IS NULL OR quality BETWEEN 1 AND 5),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, log_date)
);

-- carried_from_id — след переноса: в исходном дне видно, что пункт
-- планировался и уехал, а не исчез.
CREATE TABLE day_plans (
  id              bigserial PRIMARY KEY,
  user_id         bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_date       date NOT NULL,
  title           text NOT NULL CHECK (length(btrim(title)) > 0),
  done_at         timestamptz,
  sort_order      integer NOT NULL DEFAULT 0,
  carried_from_id bigint REFERENCES day_plans(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX day_plans_user_date_idx ON day_plans (user_id, plan_date);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE day_plans;
DROP TABLE sleep_logs;
DROP TABLE entries;
DROP TABLE trackers;
DROP TYPE points_rule;
DROP TYPE tracker_mode;
DROP TABLE skills;
DROP TABLE settings;
DROP TABLE sessions;
DROP TABLE users;
-- +goose StatementEnd
```

- [ ] **Шаг 3: Завести роль приложения**

`docker/postgres/init/01-roles.sh` — приложение ходит в базу не владельцем
схемы, как в CAIRN: роль с правами на данные, но без права менять таблицы.

```bash
#!/usr/bin/env bash
# Роль приложения. Миграции применяет владелец, обычная работа идёт отдельной
# ролью без права менять схему: ошибка в коде не уронит таблицу.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE ROLE hd_app LOGIN PASSWORD '${HD_APP_PASSWORD}';
GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO hd_app;
GRANT USAGE ON SCHEMA public TO hd_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ${POSTGRES_USER} IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hd_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ${POSTGRES_USER} IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO hd_app;
SQL
```

```bash
chmod +x docker/postgres/init/01-roles.sh
```

- [ ] **Шаг 4: Коммит**

```bash
git add api/internal/db/migrations/ docker/postgres/
git commit -m "Завести схему базы и роль приложения"
```

### Задача 1.4: Стек Docker Compose

**Файлы:**
- Создать: `docker-compose.yml`
- Создать: `docker-compose.override.yml`
- Создать: `.env.example`
- Создать: `api/Dockerfile`
- Создать: `docker/caddy/Caddyfile`
- Создать: `api/cmd/api/main.go`

- [ ] **Шаг 1: Точка входа API**

`api/cmd/api/main.go`:

```go
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
	"github.com/Qstimo/hundred-days/api/internal/httpapi"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	cfg, err := config.Load(os.LookupEnv)
	if err != nil {
		log.Error("настройки негодны", "ошибка", err)
		os.Exit(1)
	}

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           httpapi.RouterStub(),
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
```

`api/internal/httpapi/router_stub.go` — временный роутер, который задача 3.6
заменит настоящим:

```go
package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// RouterStub — роутер первого чанка: только проверка живости. Заменяется
// настоящим роутером в задаче 3.6.
func RouterStub() http.Handler {
	r := chi.NewRouter()
	r.Get("/api/health", Health)
	return r
}
```

- [ ] **Шаг 2: Dockerfile API**

`api/Dockerfile`:

```dockerfile
# Сборка в статический бинарник: в итоговом образе нет ни компилятора, ни
# оболочки — меньше образ и меньше того, чем можно воспользоваться при взломе.
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY api/go.mod api/go.sum ./
RUN go mod download
COPY api/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/api ./cmd/api
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/cli ./cmd/cli || true

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/api /api
COPY --from=build /out/cli /cli
USER nonroot
EXPOSE 3001
ENTRYPOINT ["/api"]
```

Примечание: `|| true` у сборки `cli` стоит только на время первого чанка,
пока `cmd/cli` ещё нет. Задача 3.5 его убирает — проверь это.

- [ ] **Шаг 3: Compose**

`docker-compose.yml`:

```yaml
name: hundred-days

services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: hundred_days
      POSTGRES_USER: hd_owner
      POSTGRES_PASSWORD: ${HD_POSTGRES_PASSWORD:?HD_POSTGRES_PASSWORD не задан}
      HD_APP_PASSWORD: ${HD_APP_PASSWORD:?HD_APP_PASSWORD не задан}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./docker/postgres/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U hd_owner -d hundred_days']
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  api:
    image: hundred-days-api:latest
    build:
      context: .
      dockerfile: api/Dockerfile
    environment:
      HD_DATABASE_URL: postgres://hd_app:${HD_APP_PASSWORD:?}@postgres:5432/hundred_days
      HD_DATABASE_OWNER_URL: postgres://hd_owner:${HD_POSTGRES_PASSWORD:?}@postgres:5432/hundred_days
      HD_TIMEZONE: ${HD_TIMEZONE:-Europe/Moscow}
      HD_SECURE_COOKIE: ${HD_SECURE_COOKIE:-false}
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ['CMD', '/api', '-healthcheck']
      interval: 10s
      timeout: 5s
      retries: 6
      start_period: 15s
    restart: unless-stopped

  web:
    image: hundred-days-web:latest
    build:
      context: .
      dockerfile: web/Dockerfile
    environment:
      # Внутренний адрес API для серверных компонентов Next.
      HD_API_INTERNAL_URL: http://api:3001
      NODE_ENV: production
    depends_on:
      api:
        condition: service_healthy
    restart: unless-stopped

  proxy:
    image: caddy:2-alpine
    ports:
      - '${HD_HTTP_PORT:-8080}:80'
    environment:
      HD_SITE: ${HD_SITE::80}
    volumes:
      - ./docker/caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
    depends_on:
      - web
      - api
    restart: unless-stopped

volumes:
  postgres-data:
  caddy-data:
```

`docker-compose.override.yml` — порт базы наружу нужен только локально: с
хоста запускаются миграции и интеграционные тесты.

```yaml
services:
  postgres:
    ports:
      - '${HD_POSTGRES_PORT:-5436}:5432'
```

`docker/caddy/Caddyfile`:

```caddyfile
# Сайт задаётся переменной: локально и на старте сервера это «:80» внутри
# контейнера без TLS, на поддомене — имя, и тогда Caddy берёт сертификат сам.
{$HD_SITE::80} {
	handle /api/* {
		reverse_proxy api:3001
	}

	handle {
		reverse_proxy web:3000
	}
}
```

`.env.example`:

```dotenv
# --- База ---
# Пароль владельца схемы: им применяются миграции.
HD_POSTGRES_PASSWORD=
# Пароль роли приложения: ею идёт обычная работа, без права менять схему.
HD_APP_PASSWORD=
# Порт базы наружу. Нужен только локально, для миграций и тестов с хоста.
HD_POSTGRES_PORT=5436

# --- Приложение ---
# Зона, по которой определяется «сегодня». Не браузер: иначе запись в час
# ночи уехала бы на другую дату.
HD_TIMEZONE=Europe/Moscow
# Флаг Secure у cookie сессии. Включать вместе с HTTPS: по HTTP он сделал бы
# вход невозможным.
HD_SECURE_COOKIE=false

# --- Доступ ---
# Порт, на котором стек слушает на машине. 80 и 443 заняты прокси CAIRN.
HD_HTTP_PORT=8080
# Имя сайта для Caddy. Пусто — слушать любой адрес по HTTP на своём порту.
# Для поддомена с HTTPS сюда вписывается имя, но на нашей машине этот путь
# идёт через прокси CAIRN (чанк 12), и значение остаётся пустым.
HD_SITE=
```

- [ ] **Шаг 4: Поднять и проверить**

```bash
cd ~/"Рабочий стол"/MyMVP/hundred-days
cp .env.example .env
# впиши пароли в .env, затем:
docker compose up -d --build postgres api
curl -s http://localhost:3001/api/health   # если порт api опубликован
docker compose logs api --tail 20
```

Ожидается: в журнале `слушаю`, база здорова.
Примечание: порт API наружу не публикуется. Проверять изнутри:
`docker compose exec api /api -healthcheck` — а флаг `-healthcheck` добавляется
следующим шагом.

- [ ] **Шаг 5: Флаг самопроверки у бинарника**

Добавить в начало `main()` в `api/cmd/api/main.go`:

```go
	// Проверка живости из docker compose. В distroless нет ни curl, ни
	// оболочки, поэтому бинарник проверяет себя сам.
	if len(os.Args) > 1 && os.Args[1] == "-healthcheck" {
		resp, err := http.Get("http://127.0.0.1:3001/api/health")
		if err != nil || resp.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		os.Exit(0)
	}
```

- [ ] **Шаг 6: Применить миграции**

```bash
cd api
export HD_DATABASE_OWNER_URL="postgres://hd_owner:ПАРОЛЬ@localhost:5436/hundred_days"
./tools.sh goose -dir internal/db/migrations postgres "$HD_DATABASE_OWNER_URL" up
./tools.sh goose -dir internal/db/migrations postgres "$HD_DATABASE_OWNER_URL" status
# Проверь и обратный путь: секция Down в миграции должна работать, иначе
# откат неудачного развёртывания окажется невозможен ровно тогда, когда нужен.
./tools.sh goose -dir internal/db/migrations postgres "$HD_DATABASE_OWNER_URL" down
./tools.sh goose -dir internal/db/migrations postgres "$HD_DATABASE_OWNER_URL" up
```

Ожидается: миграция `00001_init` применена.

- [ ] **Шаг 7: Коммит**

```bash
git add docker-compose.yml docker-compose.override.yml .env.example \
        api/Dockerfile api/cmd docker/caddy api/internal/httpapi/router_stub.go
git commit -m "Поднять стек в контейнерах"
```

### Задача 1.5: CI

**Файлы:**
- Создать: `.github/workflows/ci.yml`

- [ ] **Шаг 1: Написать рабочий процесс**

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.27'
          cache-dependency-path: api/go.sum
      - name: Тесты
        working-directory: api
        run: go test ./... -race
      - name: Сгенерированное не разошлось с источником
        working-directory: api
        run: |
          ./tools.sh sqlc generate
          ./tools.sh oapi-codegen -config ../openapi/oapi-codegen.yaml ../openapi/openapi.yaml
          git diff --exit-code || {
            echo 'Сгенерированный код разошёлся: перегенерируй и закоммить'
            exit 1
          }

  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
          cache-dependency-path: web/pnpm-lock.yaml
      - working-directory: web
        run: pnpm install --frozen-lockfile
      - working-directory: web
        run: pnpm typecheck
      - working-directory: web
        run: pnpm test run
      - working-directory: web
        run: pnpm build
```

Шаги генерации добавляются по мере появления настроек (задачи 2.0 и 3.1);
пока они падают — закомментируй их и раскомментируй в чанке 3.

- [ ] **Шаг 2: Коммит**

```bash
git add .github/
git commit -m "Прогонять тесты в CI"
```

---

## Chunk 2: Вычисления

Итог чанка: пакет `domain` считает всё, что в дизайне названо вычисляемым.
Ни базы, ни HTTP — только чистые функции и таблицы тестов. Это самая важная
часть: ошибка здесь испортит всю статистику, а поймать её потом трудно.

### Задача 2.1: Период

**Файлы:**
- Создать: `api/internal/domain/period.go`
- Тест: `api/internal/domain/period_test.go`

- [ ] **Шаг 1: Написать падающий тест**

`api/internal/domain/period_test.go`:

```go
package domain

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func day(s string) time.Time {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		panic(err)
	}
	return t
}

func TestDaysLeft(t *testing.T) {
	cases := []struct {
		name  string
		start string
		days  int
		today string
		want  int
	}{
		{"первый день периода", "2026-10-23", 100, "2026-10-23", 100},
		{"середина", "2026-10-23", 100, "2026-11-22", 70},
		{"последний день", "2026-10-23", 100, "2027-01-30", 1},
		{"период кончился", "2026-10-23", 100, "2027-01-31", 0},
		{"кончился давно", "2026-10-23", 100, "2030-01-01", 0},
		{"период ещё не начался", "2026-11-01", 100, "2026-10-23", 100},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			require.Equal(t, c.want, DaysLeft(day(c.start), c.days, day(c.today)))
		})
	}
}

func TestDayNumber(t *testing.T) {
	cases := []struct {
		name  string
		start string
		today string
		want  int
	}{
		{"первый день", "2026-10-23", "2026-10-23", 1},
		{"тридцать первый", "2026-10-23", "2026-11-22", 31},
		{"до начала", "2026-11-01", "2026-10-23", 0},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			require.Equal(t, c.want, DayNumber(day(c.start), day(c.today)))
		})
	}
}
```

- [ ] **Шаг 2: Убедиться, что тест падает**

Запустить: `go test ./internal/domain/ -v`
Ожидается: `undefined: DaysLeft`.

- [ ] **Шаг 3: Реализовать**

`api/internal/domain/period.go`:

```go
// Package domain содержит вычисления, названные в дизайне вычисляемыми: они
// не хранятся в базе и не зависят ни от базы, ни от HTTP. Поэтому тесты
// здесь — обычные табличные, без контейнеров и моков.
package domain

import "time"

// DaysLeft возвращает число дней до конца периода, считая сегодняшний.
// Период кончился — ноль. Не начался — вся длина: впереди ещё всё.
func DaysLeft(start time.Time, days int, today time.Time) int {
	if days <= 0 {
		return 0
	}

	start = truncateDay(start)
	today = truncateDay(today)

	if today.Before(start) {
		return days
	}

	passed := int(today.Sub(start).Hours() / 24)
	left := days - passed
	if left < 0 {
		return 0
	}
	return left
}

// DayNumber — номер сегодняшнего дня в периоде, считая с единицы.
// Ноль означает, что период ещё не начался.
func DayNumber(start time.Time, today time.Time) int {
	start = truncateDay(start)
	today = truncateDay(today)

	if today.Before(start) {
		return 0
	}
	return int(today.Sub(start).Hours()/24) + 1
}

// truncateDay отбрасывает время, оставляя дату. Разность дат, посчитанная по
// меткам со временем, дала бы дробное число дней и ошибку на единицу.
func truncateDay(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}
```

- [ ] **Шаг 4: Убедиться, что тесты проходят**

Запустить: `go test ./internal/domain/ -v`
Ожидается: все подтесты PASS.

- [ ] **Шаг 5: Коммит**

```bash
git add api/internal/domain/
git commit -m "Считать остаток дней периода"
```

### Задача 2.2: Поинты одного выполнения

**Файлы:**
- Создать: `api/internal/domain/points.go`
- Тест: `api/internal/domain/points_test.go`

- [ ] **Шаг 1: Написать падающий тест**

```go
package domain

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPoints(t *testing.T) {
	hours := func(v float64) *float64 { return &v }

	cases := []struct {
		name  string
		rule  Rule
		value float64
		hours *float64
		want  float64
	}{
		{"одно занятие — один поинт", RulePerCheck, 1, nil, 1},
		{"чек даёт свою цену независимо от часов", RulePerCheck, 2, hours(3), 2},
		{"час чтения — один поинт", RulePerHour, 1, hours(1.5), 1.5},
		{"полтора поинта за час", RulePerHour, 1.5, hours(2), 3},
		{"за час без часов — ноль", RulePerHour, 1, nil, 0},
		{"округление до двух знаков", RulePerHour, 0.333, hours(1), 0.33},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			require.Equal(t, c.want, Points(c.rule, c.value, c.hours))
		})
	}
}

// Правило «за час» у трекера без часов — нарушение инварианта, а не повод
// считать ноль молча: оно проверяется до записи.
func TestValidateRule(t *testing.T) {
	require.NoError(t, ValidateRule(ModeCheckHours, RulePerHour))
	require.NoError(t, ValidateRule(ModeCheckHours, RulePerCheck))
	require.NoError(t, ValidateRule(ModeCheck, RulePerCheck))
	require.ErrorIs(t, ValidateRule(ModeCheck, RulePerHour), ErrRuleNeedsHours)
}

func TestRound2(t *testing.T) {
	require.Equal(t, 0.33, Round2(0.333))
	require.Equal(t, 0.34, Round2(0.335))
	require.Equal(t, 2.0, Round2(2))
}
```

- [ ] **Шаг 2: Убедиться, что тест падает**

Запустить: `go test ./internal/domain/ -run 'TestPoints|TestValidateRule|TestRound2' -v`
Ожидается: `undefined: Points`.

- [ ] **Шаг 3: Реализовать**

`api/internal/domain/points.go`:

```go
package domain

import (
	"errors"
	"math"
)

// Mode — режим трекера: только галочка или галочка с часами.
type Mode string

const (
	ModeCheck      Mode = "check"
	ModeCheckHours Mode = "check_hours"
)

// Rule — за что начисляются поинты.
type Rule string

const (
	RulePerCheck Rule = "per_check"
	RulePerHour  Rule = "per_hour"
)

// ErrRuleNeedsHours — правило «за час» у трекера, который часов не
// спрашивает.
var ErrRuleNeedsHours = errors.New("правило «за час» требует режима с часами")

// ValidateRule проверяет инвариант сочетания режима и правила. Тот же
// инвариант стоит ограничением в базе: проверка в одном месте рано или
// поздно обходится.
func ValidateRule(mode Mode, rule Rule) error {
	if rule == RulePerHour && mode != ModeCheckHours {
		return ErrRuleNeedsHours
	}
	return nil
}

// Points считает поинты одного выполнения. Правило «за чек» часы
// игнорирует: трекер с часами может начислять и фиксированную цену.
func Points(rule Rule, value float64, hours *float64) float64 {
	if rule == RulePerHour {
		if hours == nil {
			return 0
		}
		return Round2(value * *hours)
	}
	return Round2(value)
}

// Round2 округляет до двух знаков. Поинты и часы хранятся как числа с
// плавающей точкой, и округление на записи не даёт копиться мусору в
// младших разрядах при суммировании сотен записей.
func Round2(v float64) float64 {
	return math.Round(v*100) / 100
}
```

- [ ] **Шаг 4: Убедиться, что тесты проходят**

Запустить: `go test ./internal/domain/ -v`
Ожидается: PASS.
Примечание: подтест «округление до двух знаков» у `Round2(0.335)` может дать
`0.33` — двоичное представление `0.335` чуть меньше точной середины. Если
падает — исправь ожидание в тесте на `0.33` и припиши в тесте комментарий,
почему: это свойство чисел с плавающей точкой, а не ошибка.

- [ ] **Шаг 5: Коммит**

```bash
git add api/internal/domain/
git commit -m "Считать поинты выполнения"
```

### Задача 2.3: Недельные серии

**Файлы:**
- Создать: `api/internal/domain/streak.go`
- Тест: `api/internal/domain/streak_test.go`

- [ ] **Шаг 1: Написать падающий тест**

```go
package domain

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// Серия считается по неделям, потому что цель недельная. Последний элемент
// среза — текущая, ещё не кончившаяся неделя: она серию не рвёт, пока не
// кончилась, но уже зачтённая — продолжает.
func TestWeeklyStreak(t *testing.T) {
	cases := []struct {
		name            string
		counts          []int
		target          int
		wantCurrent     int
		wantBest        int
		wantWeekDone    int
	}{
		{
			name:         "пусто",
			counts:       nil,
			target:       3,
			wantCurrent:  0,
			wantBest:     0,
			wantWeekDone: 0,
		},
		{
			name:         "только текущая неделя, цель ещё не взята",
			counts:       []int{1},
			target:       3,
			wantCurrent:  0,
			wantBest:     0,
			wantWeekDone: 1,
		},
		{
			name:         "только текущая неделя, цель взята",
			counts:       []int{3},
			target:       3,
			wantCurrent:  1,
			wantBest:     1,
			wantWeekDone: 3,
		},
		{
			name:         "три зачтённые недели, текущая пока пустая — серия жива",
			counts:       []int{3, 4, 3, 0},
			target:       3,
			wantCurrent:  3,
			wantBest:     3,
			wantWeekDone: 0,
		},
		{
			name:         "провал в середине",
			counts:       []int{3, 3, 1, 3, 0},
			target:       3,
			wantCurrent:  1,
			wantBest:     2,
			wantWeekDone: 0,
		},
		{
			name:         "лучшая серия в прошлом",
			counts:       []int{3, 3, 3, 0, 3, 1},
			target:       3,
			wantCurrent:  1,
			wantBest:     3,
			wantWeekDone: 1,
		},
		{
			name:         "текущая зачтена и продолжает серию",
			counts:       []int{3, 3, 4},
			target:       3,
			wantCurrent:  3,
			wantBest:     3,
			wantWeekDone: 4,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := WeeklyStreak(c.counts, c.target)

			require.Equal(t, c.wantCurrent, got.Current, "текущая серия")
			require.Equal(t, c.wantBest, got.Best, "лучшая серия")
			require.Equal(t, c.wantWeekDone, got.CurrentWeekDone, "сделано на этой неделе")
			require.Equal(t, c.target, got.CurrentWeekTarget)
		})
	}
}
```

- [ ] **Шаг 2: Убедиться, что тест падает**

Запустить: `go test ./internal/domain/ -run TestWeeklyStreak -v`
Ожидается: `undefined: WeeklyStreak`.

- [ ] **Шаг 3: Реализовать**

`api/internal/domain/streak.go`:

```go
package domain

// Streak — состояние серии трекера.
type Streak struct {
	// Current — сколько недель подряд цель взята, считая назад от текущей.
	Current int
	// Best — самая длинная серия за весь рассмотренный отрезок.
	Best int
	// CurrentWeekDone — сколько выполнений уже есть на этой неделе.
	CurrentWeekDone int
	// CurrentWeekTarget — недельная цель, для подписи «2 из 3».
	CurrentWeekTarget int
}

// WeeklyStreak считает серию по числу выполнений в неделях. Срез идёт по
// возрастанию недель без пропусков — неделя без выполнений это нуль, а не
// отсутствующий элемент, иначе провал стал бы невидим. Последний элемент —
// текущая неделя.
func WeeklyStreak(counts []int, target int) Streak {
	s := Streak{CurrentWeekTarget: target}
	if len(counts) == 0 {
		return s
	}

	s.CurrentWeekDone = counts[len(counts)-1]

	// Лучшая серия — по всему срезу, включая текущую неделю, если она уже
	// зачтена.
	run := 0
	for _, c := range counts {
		if c >= target {
			run++
			if run > s.Best {
				s.Best = run
			}
			continue
		}
		run = 0
	}

	// Текущая серия отсчитывается с конца. Незачтённая текущая неделя
	// пропускается, а не обрывает счёт: иначе каждый понедельник показывал
	// бы ноль, хотя ничего ещё не потеряно.
	from := len(counts) - 1
	if counts[from] < target {
		from--
	}
	for i := from; i >= 0; i-- {
		if counts[i] < target {
			break
		}
		s.Current++
	}

	return s
}
```

- [ ] **Шаг 4: Убедиться, что тесты проходят**

Запустить: `go test ./internal/domain/ -run TestWeeklyStreak -v`
Ожидается: все семь подтестов PASS.

- [ ] **Шаг 5: Коммит**

```bash
git add api/internal/domain/
git commit -m "Считать недельные серии трекера"
```

### Задача 2.4: Длительность сна

**Файлы:**
- Создать: `api/internal/domain/sleep.go`
- Тест: `api/internal/domain/sleep_test.go`

- [ ] **Шаг 1: Написать падающий тест**

```go
package domain

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func clock(h, m int) *time.Duration {
	d := time.Duration(h)*time.Hour + time.Duration(m)*time.Minute
	return &d
}

func TestSleepDuration(t *testing.T) {
	cases := []struct {
		name string
		bed  *time.Duration
		wake *time.Duration
		want *time.Duration
	}{
		{
			name: "через полночь",
			bed:  clock(23, 40),
			wake: clock(7, 10),
			want: durPtr(7*time.Hour + 30*time.Minute),
		},
		{
			name: "лёг после полуночи",
			bed:  clock(1, 0),
			wake: clock(7, 0),
			want: durPtr(6 * time.Hour),
		},
		{
			name: "дневной сон",
			bed:  clock(14, 0),
			wake: clock(15, 30),
			want: durPtr(90 * time.Minute),
		},
		{"нет времени отхода", nil, clock(7, 0), nil},
		{"нет времени подъёма", clock(23, 0), nil, nil},
		{"нет ни одного", nil, nil, nil},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := SleepDuration(c.bed, c.wake)

			if c.want == nil {
				require.Nil(t, got)
				return
			}
			require.NotNil(t, got)
			require.Equal(t, *c.want, *got)
		})
	}
}

func durPtr(d time.Duration) *time.Duration { return &d }
```

- [ ] **Шаг 2: Убедиться, что тест падает**

Запустить: `go test ./internal/domain/ -run TestSleepDuration -v`
Ожидается: `undefined: SleepDuration`.

- [ ] **Шаг 3: Реализовать**

`api/internal/domain/sleep.go`:

```go
package domain

import "time"

// SleepDuration возвращает длительность сна по двум временам суток,
// отсчитанным от полуночи. Любое незаполненное время даёт nil: блок сна
// необязателен, и половина данных не повод выдумывать вторую.
//
// Переход через полночь: подъём не позже отхода означает, что это следующие
// сутки. Лёг в 23:40, встал в 7:10 — семь с половиной часов, а не минус
// шестнадцать.
func SleepDuration(bed, wake *time.Duration) *time.Duration {
	if bed == nil || wake == nil {
		return nil
	}

	d := *wake - *bed
	if d <= 0 {
		d += 24 * time.Hour
	}
	return &d
}
```

- [ ] **Шаг 4: Убедиться, что тесты проходят**

Запустить: `go test ./internal/domain/ -run TestSleepDuration -v`
Ожидается: шесть PASS.

- [ ] **Шаг 5: Коммит**

```bash
git add api/internal/domain/
git commit -m "Считать длительность сна через полночь"
```

### Задача 2.5: Темп, прогноз и процент выполнения

**Файлы:**
- Создать: `api/internal/domain/forecast.go`
- Создать: `api/internal/domain/completion.go`
- Тест: `api/internal/domain/forecast_test.go`
- Тест: `api/internal/domain/completion_test.go`

- [ ] **Шаг 1: Написать падающие тесты**

`api/internal/domain/forecast_test.go`:

```go
package domain

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPace(t *testing.T) {
	require.Equal(t, 2.0, Pace(28, 14))
	require.Equal(t, 0.0, Pace(0, 14))
	// Окно нулевой длины — не повод делить на ноль.
	require.Equal(t, 0.0, Pace(10, 0))
}

func TestForecast(t *testing.T) {
	// Забрано 100 поинтов, темп два в день, осталось 50 дней.
	require.Equal(t, 200.0, Forecast(100, 2, 50))
	// Период кончился — прогноз равен тому, что уже есть.
	require.Equal(t, 100.0, Forecast(100, 2, 0))
}

func TestWillReach(t *testing.T) {
	require.True(t, WillReach(100, 2, 50, 200))
	require.False(t, WillReach(100, 2, 50, 201))
	// Цель уже взята — прогноз не важен.
	require.True(t, WillReach(300, 0, 0, 200))
}
```

`api/internal/domain/completion_test.go`:

```go
package domain

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestExpectedCount(t *testing.T) {
	// Три раза в неделю за четыре недели — двенадцать.
	require.Equal(t, 12.0, ExpectedCount(28, 3))
	// Неполная неделя считается пропорционально: цель недельная, а период
	// редко кончается ровно в воскресенье.
	require.Equal(t, 1.5, ExpectedCount(7, 3)/2)
	require.Equal(t, 0.0, ExpectedCount(0, 3))
}

func TestCompletionRate(t *testing.T) {
	require.Equal(t, 1.0, CompletionRate(12, 28, 3))
	require.Equal(t, 0.5, CompletionRate(6, 28, 3))
	// Перевыполнение показывается как есть, а не обрезается до сотни:
	// «сделал больше плана» — полезная правда.
	require.Equal(t, 1.5, CompletionRate(18, 28, 3))
	require.Equal(t, 0.0, CompletionRate(5, 0, 3))
}
```

- [ ] **Шаг 2: Убедиться, что тесты падают**

Запустить: `go test ./internal/domain/ -run 'TestPace|TestForecast|TestWillReach|TestExpected|TestCompletion' -v`
Ожидается: `undefined: Pace`.

- [ ] **Шаг 3: Реализовать**

`api/internal/domain/forecast.go`:

```go
package domain

// Pace — темп в поинтах за день: сколько набрано за окно, делённое на его
// длину. Окно нулевой длины даёт ноль, а не деление на ноль.
func Pace(pointsInWindow float64, windowDays int) float64 {
	if windowDays <= 0 {
		return 0
	}
	return Round2(pointsInWindow / float64(windowDays))
}

// Forecast — сколько поинтов будет к концу периода, если темп сохранится.
func Forecast(earned, pacePerDay float64, daysLeft int) float64 {
	if daysLeft <= 0 {
		return Round2(earned)
	}
	return Round2(earned + pacePerDay*float64(daysLeft))
}

// WillReach отвечает, хватит ли темпа на цель к концу периода.
func WillReach(earned, pacePerDay float64, daysLeft int, target float64) bool {
	return Forecast(earned, pacePerDay, daysLeft) >= target
}
```

`api/internal/domain/completion.go`:

```go
package domain

// ExpectedCount — сколько выполнений ожидается за столько-то дней при
// недельной цели. Считается по дням, а не по числу затронутых недель:
// период редко начинается в понедельник и кончается в воскресенье, и счёт
// по неделям завысил бы ожидание на двух краях сразу.
func ExpectedCount(days int, weeklyTarget int) float64 {
	if days <= 0 || weeklyTarget <= 0 {
		return 0
	}
	return Round2(float64(weeklyTarget) * float64(days) / 7)
}

// CompletionRate — доля выполненного от ожидаемого. Единица означает «ровно
// по плану», больше единицы — перевыполнение, и оно не обрезается.
func CompletionRate(done int, days int, weeklyTarget int) float64 {
	expected := ExpectedCount(days, weeklyTarget)
	if expected == 0 {
		return 0
	}
	return Round2(float64(done) / expected)
}
```

- [ ] **Шаг 4: Убедиться, что тесты проходят**

Запустить: `go test ./internal/domain/ -v`
Ожидается: все PASS. Если `ExpectedCount(7,3)/2` даёт не ровно `1.5` —
поправь тест: сравнивай через `require.InDelta` с допуском `1e-9`, потому
что деление на семь в двоичной дроби не точно.

- [ ] **Шаг 5: Коммит**

```bash
git add api/internal/domain/
git commit -m "Считать темп, прогноз и процент выполнения"
```

### Задача 2.6: Проверка покрытия чанка

- [ ] **Шаг 1: Прогнать всё с гонками**

```bash
cd api && go test ./... -race -count=1
```

Ожидается: `ok` по каждому пакету.

- [ ] **Шаг 2: Посмотреть покрытие domain**

```bash
go test ./internal/domain/ -cover
```

Ожидается: не ниже 95%. Если ниже — найди непокрытую ветку и допиши тест,
а не снижай ожидание.

- [ ] **Шаг 3: Коммит**

```bash
git commit --allow-empty -m "Завершить чанк вычислений"
```

---

## Chunk 3: Контракт, хранилище, вход

Итог чанка: `openapi.yaml` описывает вход и настройки, из него порождены обе
стороны, `POST /api/auth/login` выдаёт cookie, `GET /api/auth/me` отвечает
только по ней, аккаунт создаётся командой на сервере. Интеграционные тесты
идут на настоящем PostgreSQL через testcontainers.

### Задача 3.1: Спецификация и генераторы

**Файлы:**
- Создать: `openapi/openapi.yaml`
- Создать: `openapi/oapi-codegen.yaml`
- Создать: `api/sqlc.yaml`

- [ ] **Шаг 1: Поставить генераторы как инструменты модуля**

Инструменты пишутся в `go.mod` через `go get -tool`: версия генератора
фиксируется вместе с кодом, и CI генерирует ровно тем же, чем разработчик.

```bash
cd api/tools
go get -tool github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest
go get -tool github.com/sqlc-dev/sqlc/cmd/sqlc@latest
cd .. && ./tools.sh oapi-codegen --version && ./tools.sh sqlc version
```

- [ ] **Шаг 2: Написать спецификацию входа и настроек**

`openapi/openapi.yaml` — начальный кусок. Он дорастает в каждом чанке; порядок
один и тот же: сначала спецификация, потом генерация, потом хендлер.

```yaml
openapi: 3.0.3
info:
  title: 100 дней до
  version: 1.0.0
servers:
  - url: /api

components:
  securitySchemes:
    sessionCookie:
      type: apiKey
      in: cookie
      name: hd_session

  schemas:
    Error:
      type: object
      required: [message]
      properties:
        message: { type: string }
        # Код нарушенного инварианта, если ответ 409. Интерфейсу нужен не
        # текст, а повод показать своё сообщение у конкретного поля.
        code: { type: string }

    User:
      type: object
      required: [id, login, name]
      properties:
        id: { type: integer, format: int64 }
        login: { type: string }
        name: { type: string }

    LoginRequest:
      type: object
      required: [login, password]
      properties:
        login: { type: string, minLength: 1 }
        password: { type: string, minLength: 1 }

    Settings:
      type: object
      required: [periodTitle, periodStart, periodDays, sleepEnabled]
      properties:
        periodTitle: { type: string, maxLength: 200 }
        periodStart: { type: string, format: date }
        periodDays: { type: integer, minimum: 1, maximum: 3650 }
        sleepEnabled: { type: boolean }

    Period:
      description: Вычисляется на сервере, не хранится.
      type: object
      required: [title, start, days, dayNumber, daysLeft]
      properties:
        title: { type: string }
        start: { type: string, format: date }
        days: { type: integer }
        dayNumber: { type: integer }
        daysLeft: { type: integer }

  responses:
    Unauthorized:
      description: Нет сессии
      content:
        application/json:
          schema: { $ref: '#/components/schemas/Error' }
    NotFound:
      description: Нет такой записи или она чужая
      content:
        application/json:
          schema: { $ref: '#/components/schemas/Error' }
    Conflict:
      description: Нарушен инвариант
      content:
        application/json:
          schema: { $ref: '#/components/schemas/Error' }

security:
  - sessionCookie: []

paths:
  /health:
    get:
      operationId: getHealth
      security: []
      summary: Проверка живости
      responses:
        '200':
          description: Живо
          content:
            application/json:
              schema:
                type: object
                required: [status]
                properties:
                  status: { type: string }

  /auth/login:
    post:
      operationId: login
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/LoginRequest' }
      responses:
        '200':
          description: Вошли, cookie выдана
          content:
            application/json:
              schema: { $ref: '#/components/schemas/User' }
        '401': { $ref: '#/components/responses/Unauthorized' }

  /auth/logout:
    post:
      operationId: logout
      responses:
        '204': { description: Вышли }

  /auth/me:
    get:
      operationId: getMe
      responses:
        '200':
          description: Текущий пользователь
          content:
            application/json:
              schema: { $ref: '#/components/schemas/User' }
        '401': { $ref: '#/components/responses/Unauthorized' }

  /settings:
    get:
      operationId: getSettings
      responses:
        '200':
          description: Настройки и вычисленный период
          content:
            application/json:
              schema:
                type: object
                required: [settings, period]
                properties:
                  settings: { $ref: '#/components/schemas/Settings' }
                  period: { $ref: '#/components/schemas/Period' }
        '401': { $ref: '#/components/responses/Unauthorized' }
    put:
      operationId: putSettings
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/Settings' }
      responses:
        '200':
          description: Сохранено
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Settings' }
        '401': { $ref: '#/components/responses/Unauthorized' }
```

`openapi/oapi-codegen.yaml`:

```yaml
package: gen
output: ../api/internal/httpapi/gen/server.gen.go
generate:
  chi-server: true
  strict-server: true
  models: true
  embedded-spec: true
output-options:
  # Строгий сервер: хендлер принимает разобранный запрос и возвращает
  # типизированный ответ. Забыть поле или вернуть не тот код нельзя —
  # не скомпилируется.
  user-templates: {}
```

`api/sqlc.yaml`:

```yaml
version: '2'
sql:
  - engine: postgresql
    schema: internal/db/migrations
    queries: internal/db/queries
    gen:
      go:
        package: gen
        out: internal/db/gen
        sql_package: pgx/v5
        emit_pointers_for_null_types: true
        emit_json_tags: false
        overrides:
          - db_type: timestamptz
            go_type: time.Time
          - db_type: timestamptz
            nullable: true
            go_type:
              type: 'time.Time'
              pointer: true
```

- [ ] **Шаг 3: Сгенерировать и проверить сборку**

```bash
cd api
mkdir -p internal/httpapi/gen internal/db/queries internal/db/gen
./tools.sh oapi-codegen -config ../openapi/oapi-codegen.yaml ../openapi/openapi.yaml
go build ./...
```

Ожидается: `internal/httpapi/gen/server.gen.go` появился, сборка проходит.

- [ ] **Шаг 4: Коммит**

```bash
git add openapi/ api/sqlc.yaml api/internal/httpapi/gen/ api/go.mod api/go.sum
git commit -m "Описать контракт и завести генераторы"
```

### Задача 3.2: Подключение к базе и запросы пользователей

**Файлы:**
- Создать: `api/internal/db/pool.go`
- Создать: `api/internal/db/queries/users.sql`
- Создать: `api/internal/db/queries/settings.sql`
- Тест: `api/internal/db/queries_guard_test.go`

- [ ] **Шаг 1: Написать тест-страж запросов**

Это не обычный unit-тест, а проверка соглашения: инвариант «проверка прав на
уровне выборки» должен держаться механически, а не вниманием ревьюера.

`api/internal/db/queries_guard_test.go`:

```go
package db

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// Таблицы, строки которых принадлежат пользователю. Запрос к любой из них
// обязан фильтровать по user_id: иначе один человек увидел бы данные
// другого, а проверка в хендлере рано или поздно будет забыта.
var ownedTables = []string{
	"settings", "skills", "trackers", "entries", "sleep_logs", "day_plans",
}

// Запросы, которым фильтр по пользователю не нужен и почему.
var exempt = map[string]string{
	"GetUserByLogin":    "вход: пользователя ещё нет в контексте",
	"CreateUser":        "создание аккаунта командой на сервере",
	"CreateSession":     "сессия создаётся в момент входа",
	"GetSessionByID":    "сессия и есть то, из чего берётся user_id",
	"DeleteSession":     "выход: удаление по идентификатору сессии",
	"DeleteSessionsOfUser": "удаление по user_id и так",
	"ExtendSession":     "продление по идентификатору сессии",
}

var nameRe = regexp.MustCompile(`--\s*name:\s*(\w+)`)

func TestEveryOwnedQueryFiltersByUser(t *testing.T) {
	dir := filepath.Join("queries")
	files, err := os.ReadDir(dir)
	require.NoError(t, err)
	require.NotEmpty(t, files, "каталог запросов пуст — проверка бессмысленна")

	for _, f := range files {
		if !strings.HasSuffix(f.Name(), ".sql") {
			continue
		}

		raw, err := os.ReadFile(filepath.Join(dir, f.Name()))
		require.NoError(t, err)

		for _, block := range splitQueries(string(raw)) {
			m := nameRe.FindStringSubmatch(block)
			if m == nil {
				continue
			}
			name := m[1]
			if _, ok := exempt[name]; ok {
				continue
			}

			lower := strings.ToLower(block)
			if !touchesOwnedTable(lower) {
				continue
			}

			require.Contains(t, lower, "user_id",
				"запрос %s в %s трогает данные пользователя, но не фильтрует по user_id",
				name, f.Name())
		}
	}
}

func touchesOwnedTable(lowerSQL string) bool {
	for _, tbl := range ownedTables {
		if strings.Contains(lowerSQL, tbl) {
			return true
		}
	}
	return false
}

// splitQueries режет файл на блоки по строкам «-- name:».
func splitQueries(s string) []string {
	parts := strings.Split(s, "-- name:")
	out := make([]string, 0, len(parts))
	for i, p := range parts {
		if i == 0 && !strings.Contains(p, "name:") {
			continue
		}
		out = append(out, "-- name:"+p)
	}
	return out
}
```

- [ ] **Шаг 2: Убедиться, что тест падает**

Запустить: `cd api && go test ./internal/db/ -v`
Ожидается: FAIL — «каталог запросов пуст».

- [ ] **Шаг 3: Написать запросы**

`api/internal/db/queries/users.sql`:

```sql
-- name: GetUserByLogin :one
SELECT id, login, name, password_hash
FROM users
WHERE login = $1;

-- name: GetUserByID :one
SELECT id, login, name
FROM users
WHERE id = $1;

-- name: CreateUser :one
INSERT INTO users (login, name, password_hash)
VALUES ($1, $2, $3)
RETURNING id, login, name;

-- name: UpdatePasswordHash :exec
UPDATE users SET password_hash = $2 WHERE id = $1;

-- name: CreateSession :exec
INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3);

-- name: GetSessionByID :one
SELECT id, user_id, expires_at FROM sessions WHERE id = $1;

-- name: ExtendSession :exec
UPDATE sessions SET expires_at = $2 WHERE id = $1;

-- name: DeleteSession :exec
DELETE FROM sessions WHERE id = $1;

-- name: DeleteExpiredSessions :exec
DELETE FROM sessions WHERE expires_at < now();
```

`api/internal/db/queries/settings.sql`:

```sql
-- name: GetSettings :one
SELECT user_id, period_title, period_start, period_days, sleep_enabled
FROM settings
WHERE user_id = $1;

-- name: UpsertSettings :one
INSERT INTO settings (user_id, period_title, period_start, period_days, sleep_enabled)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (user_id) DO UPDATE SET
  period_title  = excluded.period_title,
  period_start  = excluded.period_start,
  period_days   = excluded.period_days,
  sleep_enabled = excluded.sleep_enabled
RETURNING user_id, period_title, period_start, period_days, sleep_enabled;
```

- [ ] **Шаг 4: Сгенерировать и прогнать страж**

```bash
cd api
./tools.sh sqlc generate
go test ./internal/db/ -v
```
Ожидается: PASS.

Проверь страж нарочно: добавь в `settings.sql` запрос
`-- name: BadSettings :many` без `WHERE user_id`, прогони тест — должен упасть
с понятным сообщением. Затем удали его.

- [ ] **Шаг 5: Подключение pgx**

`api/internal/db/pool.go`:

```go
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
```

- [ ] **Шаг 6: Коммит**

```bash
git add api/internal/db/
git commit -m "Завести запросы пользователей и страж фильтра по user_id"
```

### Задача 3.3: Хеширование пароля

**Файлы:**
- Создать: `api/internal/auth/password.go`
- Тест: `api/internal/auth/password_test.go`

- [ ] **Шаг 1: Написать падающий тест**

```go
package auth

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestHashAndVerify(t *testing.T) {
	hash, err := HashPassword("правильный-пароль")
	require.NoError(t, err)
	require.True(t, strings.HasPrefix(hash, "$argon2id$"))

	ok, err := VerifyPassword("правильный-пароль", hash)
	require.NoError(t, err)
	require.True(t, ok)

	ok, err = VerifyPassword("другой-пароль", hash)
	require.NoError(t, err)
	require.False(t, ok)
}

// Соль случайна: два хеша одного пароля не совпадают, иначе по базе было бы
// видно, у кого пароли одинаковые.
func TestHashIsSalted(t *testing.T) {
	a, err := HashPassword("пароль")
	require.NoError(t, err)
	b, err := HashPassword("пароль")
	require.NoError(t, err)

	require.NotEqual(t, a, b)
}

func TestVerifyRejectsGarbageHash(t *testing.T) {
	_, err := VerifyPassword("пароль", "не хеш вовсе")
	require.Error(t, err)
}

func TestHashRejectsShortPassword(t *testing.T) {
	_, err := HashPassword("1234567")
	require.ErrorIs(t, err, ErrPasswordTooShort)
}
```

- [ ] **Шаг 2: Убедиться, что тест падает**

Запустить: `cd api && go test ./internal/auth/ -v`
Ожидается: `undefined: HashPassword`.

- [ ] **Шаг 3: Реализовать**

```bash
cd api && go get golang.org/x/crypto@latest
```

`api/internal/auth/password.go`:

```go
// Package auth — пароли и сессии.
package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

// ErrPasswordTooShort — пароль короче восьми знаков. Приложение смотрит в
// интернет на своём порту, и восемь знаков здесь нижняя граница, а не
// пожелание.
var ErrPasswordTooShort = errors.New("пароль короче восьми знаков")

// Параметры argon2id. Взяты из рекомендаций OWASP: 19 МиБ памяти и два
// прохода. Приложение на единицы пользователей, вход редкий — экономить на
// стойкости незачем.
const (
	argonTime    = 2
	argonMemory  = 19 * 1024
	argonThreads = 1
	argonKeyLen  = 32
	saltLen      = 16
)

// HashPassword возвращает хеш в собственном разборчивом формате:
// $argon2id$v=19$m=...,t=...,p=...$соль$хеш.
func HashPassword(password string) (string, error) {
	if len(password) < 8 {
		return "", ErrPasswordTooShort
	}

	salt := make([]byte, saltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("не вышло получить соль: %w", err)
	}

	key := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)

	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, argonMemory, argonTime, argonThreads,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(key),
	), nil
}

// VerifyPassword сравнивает пароль с хешем. Сравнение постоянного времени:
// обычное сравнение байт выдало бы длину совпавшего префикса по времени
// ответа.
func VerifyPassword(password, encoded string) (bool, error) {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false, errors.New("хеш не в формате argon2id")
	}

	var memory uint32
	var time uint32
	var threads uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &time, &threads); err != nil {
		return false, fmt.Errorf("параметры хеша не разобраны: %w", err)
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false, fmt.Errorf("соль не разобрана: %w", err)
	}
	want, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return false, fmt.Errorf("хеш не разобран: %w", err)
	}

	got := argon2.IDKey([]byte(password), salt, time, memory, threads, uint32(len(want)))

	return subtle.ConstantTimeCompare(got, want) == 1, nil
}
```

- [ ] **Шаг 4: Убедиться, что тесты проходят**

Запустить: `go test ./internal/auth/ -v`
Ожидается: четыре PASS.

- [ ] **Шаг 5: Коммит**

```bash
git add api/internal/auth/ api/go.mod api/go.sum
git commit -m "Хешировать пароли argon2id"
```

### Задача 3.4: Сессии

**Файлы:**
- Создать: `api/internal/auth/session.go`
- Тест: `api/internal/auth/session_test.go`

- [ ] **Шаг 1: Написать падающий тест**

```go
package auth

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestNewSessionIDIsLongAndUnique(t *testing.T) {
	a, err := NewSessionID()
	require.NoError(t, err)
	b, err := NewSessionID()
	require.NoError(t, err)

	require.NotEqual(t, a, b)
	// 32 случайных байта в base64url — 43 знака. Короче брать нельзя:
	// идентификатор сессии и есть ключ ко всем данным.
	require.Len(t, a, 43)
}

// Продление скользящее: сессия обновляется, только когда прошла половина
// срока. Иначе запись в базу шла бы на каждом запросе.
func TestNeedsExtension(t *testing.T) {
	now := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	ttl := 30 * 24 * time.Hour

	require.False(t, NeedsExtension(now.Add(20*24*time.Hour), now, ttl))
	require.True(t, NeedsExtension(now.Add(10*24*time.Hour), now, ttl))
	// Истёкшая сессия не продлевается: её надо отвергнуть, а не оживить.
	require.False(t, NeedsExtension(now.Add(-time.Hour), now, ttl))
}

func TestIsExpired(t *testing.T) {
	now := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)

	require.False(t, IsExpired(now.Add(time.Minute), now))
	require.True(t, IsExpired(now.Add(-time.Minute), now))
	require.True(t, IsExpired(now, now))
}
```

- [ ] **Шаг 2: Убедиться, что тест падает**

Запустить: `go test ./internal/auth/ -run 'Session|Extension|Expired' -v`
Ожидается: `undefined: NewSessionID`.

- [ ] **Шаг 3: Реализовать**

`api/internal/auth/session.go`:

```go
package auth

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"time"
)

// SessionCookieName — имя cookie сессии.
const SessionCookieName = "hd_session"

// NewSessionID выдаёт идентификатор сессии: 32 случайных байта в base64url.
// Это ключ ко всем данным пользователя, поэтому берётся из системного
// источника случайности, а не из счётчика или времени.
func NewSessionID() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("не вышло получить случайные байты: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// IsExpired отвечает, истёк ли срок. Ровно наступивший срок считается
// истёкшим: граница должна быть на одной стороне.
func IsExpired(expiresAt, now time.Time) bool {
	return !expiresAt.After(now)
}

// NeedsExtension отвечает, пора ли продлить сессию. Продление скользящее и
// редкое: запись в базу на каждом запросе ради продления на минуту — пустая
// работа. Истёкшая сессия не продлевается.
func NeedsExtension(expiresAt, now time.Time, ttl time.Duration) bool {
	if IsExpired(expiresAt, now) {
		return false
	}
	return expiresAt.Sub(now) < ttl/2
}
```

- [ ] **Шаг 4: Убедиться, что тесты проходят**

Запустить: `go test ./internal/auth/ -v`
Ожидается: PASS.

- [ ] **Шаг 5: Коммит**

```bash
git add api/internal/auth/
git commit -m "Выдавать и продлять сессии"
```

### Задача 3.5: Команда создания аккаунта

**Файлы:**
- Создать: `api/cmd/cli/main.go`
- Изменить: `api/Dockerfile` (убрать `|| true` у сборки cli)

- [ ] **Шаг 1: Написать команду**

`api/cmd/cli/main.go`:

```go
// Команды обслуживания: создание аккаунта и смена пароля. Регистрации в
// приложении нет — аккаунт заводится на машине, где стоит стек.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/Qstimo/hundred-days/api/internal/auth"
	"github.com/Qstimo/hundred-days/api/internal/db"
	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
	"github.com/jackc/pgx/v5"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var err error
	switch os.Args[1] {
	case "create-user":
		err = createUser(ctx, os.Args[2:])
	case "set-password":
		err = setPassword(ctx, os.Args[2:])
	default:
		usage()
		os.Exit(2)
	}

	if err != nil {
		fmt.Fprintln(os.Stderr, "ошибка:", err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, `Команды:
  create-user  -login <логин> -name <имя> -password <пароль> [-period-start YYYY-MM-DD] [-period-days 100]
  set-password -login <логин> -password <пароль>

Строка подключения берётся из HD_DATABASE_URL.`)
}

func createUser(ctx context.Context, args []string) error {
	fs := flag.NewFlagSet("create-user", flag.ExitOnError)
	login := fs.String("login", "", "логин")
	name := fs.String("name", "", "имя")
	password := fs.String("password", "", "пароль, не короче восьми знаков")
	periodStart := fs.String("period-start", time.Now().Format("2006-01-02"), "дата начала периода")
	periodDays := fs.Int("period-days", 100, "длительность периода в днях")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *login == "" || *password == "" {
		return errors.New("нужны -login и -password")
	}

	start, err := time.Parse("2006-01-02", *periodStart)
	if err != nil {
		return fmt.Errorf("-period-start: %w", err)
	}

	hash, err := auth.HashPassword(*password)
	if err != nil {
		return err
	}

	pool, err := db.Open(ctx, os.Getenv("HD_DATABASE_URL"))
	if err != nil {
		return err
	}
	defer pool.Close()

	q := dbgen.New(pool)

	user, err := q.CreateUser(ctx, dbgen.CreateUserParams{
		Login:        *login,
		Name:         *name,
		PasswordHash: hash,
	})
	if err != nil {
		return fmt.Errorf("не вышло создать аккаунт: %w", err)
	}

	// Настройки создаются сразу: без строки настроек не посчитать период, а
	// заставлять человека заполнять их до первого экрана незачем.
	if _, err := q.UpsertSettings(ctx, dbgen.UpsertSettingsParams{
		UserID:       user.ID,
		PeriodTitle:  "100 дней до",
		PeriodStart:  start,
		PeriodDays:   int32(*periodDays),
		SleepEnabled: true,
	}); err != nil {
		return fmt.Errorf("не вышло создать настройки: %w", err)
	}

	fmt.Printf("аккаунт %s создан, идентификатор %d\n", user.Login, user.ID)
	return nil
}

func setPassword(ctx context.Context, args []string) error {
	fs := flag.NewFlagSet("set-password", flag.ExitOnError)
	login := fs.String("login", "", "логин")
	password := fs.String("password", "", "новый пароль")
	if err := fs.Parse(args); err != nil {
		return err
	}

	hash, err := auth.HashPassword(*password)
	if err != nil {
		return err
	}

	pool, err := db.Open(ctx, os.Getenv("HD_DATABASE_URL"))
	if err != nil {
		return err
	}
	defer pool.Close()

	q := dbgen.New(pool)
	user, err := q.GetUserByLogin(ctx, *login)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("нет аккаунта с логином %s", *login)
		}
		return err
	}

	if err := q.UpdatePasswordHash(ctx, dbgen.UpdatePasswordHashParams{
		ID: user.ID, PasswordHash: hash,
	}); err != nil {
		return err
	}

	// Сессии не трогаем намеренно: смена пароля не повод выкидывать себя же
	// с телефона. Если понадобится — добавится отдельный ключ.
	fmt.Println("пароль изменён")
	return nil
}
```

- [ ] **Шаг 2: Убрать костыль из Dockerfile**

В `api/Dockerfile` заменить строку сборки cli, убрав `|| true`:

```dockerfile
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/cli ./cmd/cli
```

- [ ] **Шаг 3: Проверить вживую**

```bash
cd api
export HD_DATABASE_URL="postgres://hd_owner:ПАРОЛЬ@localhost:5436/hundred_days"
go run ./cmd/cli create-user -login vadim -name Вадим -password "длинный-пароль"
```

Ожидается: «аккаунт vadim создан, идентификатор 1».
Повторный запуск должен дать ошибку о занятом логине — это проверка
ограничения `UNIQUE`.

- [ ] **Шаг 4: Коммит**

```bash
git add api/cmd/cli api/Dockerfile
git commit -m "Создавать аккаунт командой на сервере"
```

### Задача 3.6: Хранилище, посредник сессии и ручки входа

**Файлы:**
- Создать: `api/internal/store/store.go`
- Создать: `api/internal/store/settings.go`
- Создать: `api/internal/httpapi/middleware.go`
- Создать: `api/internal/httpapi/errors.go`
- Создать: `api/internal/httpapi/server.go`
- Создать: `api/internal/httpapi/auth.go`
- Создать: `api/internal/httpapi/settings.go`
- Удалить: `api/internal/httpapi/router_stub.go`
- Тест: `api/internal/httpapi/integration_test.go`
- Тест: `api/internal/httpapi/testdb_test.go`

- [ ] **Шаг 1: Поднять базу для тестов через testcontainers**

`api/internal/httpapi/testdb_test.go`:

```go
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
// Контейнер поднимается один на пакет, а между тестами таблицы чистятся —
// поднимать по контейнеру на тест слишком медленно.
var testPool *pgxpool.Pool

func TestMain(m *testing.M) {
	ctx := context.Background()

	container, err := postgres.Run(ctx, "postgres:17-alpine",
		postgres.WithDatabase("hundred_days"),
		postgres.WithUsername("hd_owner"),
		postgres.WithPassword("secret"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).WithStartupTimeout(60*time.Second)),
	)
	if err != nil {
		panic(err)
	}

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

	code := m.Run()

	testPool.Close()
	_ = testcontainers.TerminateContainer(container)
	os.Exit(code)
}

// runMigrations применяет те же файлы goose, что и развёртывание: тесты
// должны идти на схеме, которая поедет на сервер, а не на своей копии.
func runMigrations(url string) error {
	dir, err := filepath.Abs(filepath.Join("..", "db", "migrations"))
	if err != nil {
		return err
	}
	// Тот же скрипт, что у разработчика: инструменты живут в своём модуле,
	// и вызывать их мимо него значит собирать их заново по-своему.
	cmd := exec.Command("./tools.sh", "goose", "-dir", dir, "postgres", url, "up")
	cmd.Dir = filepath.Join("..", "..")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// truncateAll чистит данные между тестами, оставляя схему.
func truncateAll(t *testing.T) {
	t.Helper()
	_, err := testPool.Exec(context.Background(),
		`TRUNCATE day_plans, sleep_logs, entries, trackers, skills, settings,
		 sessions, users RESTART IDENTITY CASCADE`)
	require.NoError(t, err)
}
```

```bash
cd api
go get github.com/testcontainers/testcontainers-go@latest
go get github.com/testcontainers/testcontainers-go/modules/postgres@latest
```

- [ ] **Шаг 2: Написать падающий интеграционный тест входа**

`api/internal/httpapi/integration_test.go`:

```go
package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Qstimo/hundred-days/api/internal/auth"
	"github.com/Qstimo/hundred-days/api/internal/config"
	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
	"github.com/stretchr/testify/require"
)

// newTestServer собирает приложение на тестовой базе с застывшим «сегодня»:
// иначе тест на остаток дней периода менял бы ответ каждые сутки.
func newTestServer(t *testing.T, today time.Time) http.Handler {
	t.Helper()
	truncateAll(t)

	loc, err := time.LoadLocation("Europe/Moscow")
	require.NoError(t, err)

	cfg := config.Config{
		Location:   loc,
		SessionTTL: 30 * 24 * time.Hour,
	}

	return NewRouter(testPool, cfg, func() time.Time { return today })
}

func seedUser(t *testing.T, login, password string) int64 {
	t.Helper()
	hash, err := auth.HashPassword(password)
	require.NoError(t, err)

	q := dbgen.New(testPool)
	u, err := q.CreateUser(context.Background(), dbgen.CreateUserParams{
		Login: login, Name: "Тест", PasswordHash: hash,
	})
	require.NoError(t, err)

	_, err = q.UpsertSettings(context.Background(), dbgen.UpsertSettingsParams{
		UserID:       u.ID,
		PeriodTitle:  "100 дней до",
		PeriodStart:  time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC),
		PeriodDays:   100,
		SleepEnabled: true,
	})
	require.NoError(t, err)

	return u.ID
}

func TestLoginSetsCookieAndMeWorks(t *testing.T) {
	today := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	srv := newTestServer(t, today)
	seedUser(t, "vadim", "длинный-пароль")

	body, _ := json.Marshal(map[string]string{
		"login": "vadim", "password": "длинный-пароль",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	srv.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	cookies := rec.Result().Cookies()
	require.Len(t, cookies, 1)
	cookie := cookies[0]
	require.Equal(t, auth.SessionCookieName, cookie.Name)
	require.True(t, cookie.HttpOnly, "cookie сессии должна быть недоступна скриптам")
	require.Equal(t, http.SameSiteLaxMode, cookie.SameSite)

	// С cookie «я» отвечает.
	meReq := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	meReq.AddCookie(cookie)
	meRec := httptest.NewRecorder()
	srv.ServeHTTP(meRec, meReq)

	require.Equal(t, http.StatusOK, meRec.Code)
	var me map[string]any
	require.NoError(t, json.Unmarshal(meRec.Body.Bytes(), &me))
	require.Equal(t, "vadim", me["login"])
}

func TestLoginRejectsWrongPassword(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")

	body, _ := json.Marshal(map[string]string{
		"login": "vadim", "password": "не тот пароль",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	srv.ServeHTTP(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
	require.Empty(t, rec.Result().Cookies())
}

// Неизвестный логин и неверный пароль отвечают одинаково: разный ответ
// сказал бы, какие логины существуют.
func TestLoginHidesWhetherLoginExists(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")

	for _, login := range []string{"vadim", "никого-такого-нет"} {
		body, _ := json.Marshal(map[string]string{"login": login, "password": "мимо"})
		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		srv.ServeHTTP(rec, req)

		require.Equal(t, http.StatusUnauthorized, rec.Code, "логин %s", login)
	}
}

func TestMeWithoutCookieIs401(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	rec := httptest.NewRecorder()

	srv.ServeHTTP(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

// Период вычисляется, а не хранится: начало 1 октября, сто дней, сегодня
// 23 октября — двадцать третий день, осталось 78.
func TestSettingsReturnsComputedPeriod(t *testing.T) {
	today := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	srv := newTestServer(t, today)
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	req := httptest.NewRequest(http.MethodGet, "/api/settings", nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()

	srv.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var out struct {
		Period struct {
			DayNumber int `json:"dayNumber"`
			DaysLeft  int `json:"daysLeft"`
		} `json:"period"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Equal(t, 23, out.Period.DayNumber)
	require.Equal(t, 78, out.Period.DaysLeft)
}

// login — помощник: входит и возвращает cookie.
func login(t *testing.T, srv http.Handler, l, p string) *http.Cookie {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"login": l, "password": p})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	cookies := rec.Result().Cookies()
	require.Len(t, cookies, 1)
	return cookies[0]
}
```

- [ ] **Шаг 3: Убедиться, что тест падает**

Запустить: `cd api && go test ./internal/httpapi/ -run TestLogin -v`
Ожидается: `undefined: NewRouter`.

- [ ] **Шаг 4: Реализовать хранилище**

`api/internal/store/store.go`:

```go
// Package store — доступ к данным. Каждая функция принимает userID первым
// аргументом: так проверку принадлежности нельзя забыть, она в сигнатуре.
// Инвариант дизайна — проверка прав на уровне выборки, а не в хендлере.
package store

import (
	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store — хранилище поверх пула и порождённых sqlc запросов.
type Store struct {
	pool *pgxpool.Pool
	q    *dbgen.Queries
}

// New собирает хранилище.
func New(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool, q: dbgen.New(pool)}
}

// Queries открывает доступ к порождённым запросам там, где обёртка не
// добавляет ничего. Пользоваться прямо в хендлерах нельзя: userID обязан
// проходить через функции этого пакета.
func (s *Store) Queries() *dbgen.Queries { return s.q }
```

`api/internal/store/settings.go`:

```go
package store

import (
	"context"

	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
)

// Settings возвращает настройки пользователя.
func (s *Store) Settings(ctx context.Context, userID int64) (dbgen.Setting, error) {
	return s.q.GetSettings(ctx, userID)
}

// SaveSettings записывает настройки, создавая строку при первом сохранении.
func (s *Store) SaveSettings(ctx context.Context, userID int64, in dbgen.UpsertSettingsParams) (dbgen.Setting, error) {
	in.UserID = userID
	return s.q.UpsertSettings(ctx, in)
}
```

- [ ] **Шаг 5: Реализовать посредник сессии**

`api/internal/httpapi/middleware.go`:

```go
package httpapi

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/Qstimo/hundred-days/api/internal/auth"
	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
	"github.com/jackc/pgx/v5"
)

type ctxKey string

const userIDKey ctxKey = "userID"

// UserID достаёт пользователя из контекста. Отсутствие — ошибка сборки
// роутера, а не запроса: до хендлера под охраной без него не доходят.
func UserID(ctx context.Context) int64 {
	id, ok := ctx.Value(userIDKey).(int64)
	if !ok {
		panic("хендлер под охраной сессии вызван без userID в контексте")
	}
	return id
}

// requireSession пропускает дальше только с живой сессией. Истёкшую удаляет
// и гасит cookie: иначе браузер носил бы мёртвый ключ месяцами.
func (s *Server) requireSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(auth.SessionCookieName)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "нужен вход", "")
			return
		}

		sess, err := s.store.Queries().GetSessionByID(r.Context(), cookie.Value)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				s.clearSessionCookie(w)
				writeError(w, http.StatusUnauthorized, "нужен вход", "")
				return
			}
			writeError(w, http.StatusInternalServerError, "не вышло проверить сессию", "")
			return
		}

		now := s.now()
		if auth.IsExpired(sess.ExpiresAt, now) {
			_ = s.store.Queries().DeleteSession(r.Context(), sess.ID)
			s.clearSessionCookie(w)
			writeError(w, http.StatusUnauthorized, "сессия истекла", "")
			return
		}

		if auth.NeedsExtension(sess.ExpiresAt, now, s.cfg.SessionTTL) {
			expires := now.Add(s.cfg.SessionTTL)
			if err := s.store.Queries().ExtendSession(r.Context(), dbgen.ExtendSessionParams{
				ID: sess.ID, ExpiresAt: expires,
			}); err == nil {
				s.setSessionCookie(w, sess.ID, expires)
			}
		}

		ctx := context.WithValue(r.Context(), userIDKey, sess.UserID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (s *Server) setSessionCookie(w http.ResponseWriter, id string, expires time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     auth.SessionCookieName,
		Value:    id,
		Path:     "/",
		Expires:  expires,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.cfg.SecureCookie,
	})
}

func (s *Server) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     auth.SessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.cfg.SecureCookie,
	})
}
```

`api/internal/httpapi/errors.go`:

```go
package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/Qstimo/hundred-days/api/internal/domain"
	"github.com/jackc/pgx/v5"
)

// writeError отдаёт ошибку одним форматом. code — машинный повод, нужный
// интерфейсу, чтобы показать своё сообщение у конкретного поля.
func writeError(w http.ResponseWriter, status int, message, code string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	payload := map[string]string{"message": message}
	if code != "" {
		payload["code"] = code
	}
	_ = json.NewEncoder(w).Encode(payload)
}

// writeStoreError переводит ошибку хранилища в код ответа.
//
// Отсутствие записи — всегда 404, даже если причина в чужом владельце:
// ответ 403 сообщил бы, что запись существует. Это инвариант дизайна.
func writeStoreError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		writeError(w, http.StatusNotFound, "нет такой записи", "")
	case errors.Is(err, domain.ErrRuleNeedsHours):
		writeError(w, http.StatusConflict,
			"правило «за час» требует режима с часами", "rule_needs_hours")
	default:
		writeError(w, http.StatusInternalServerError, "внутренняя ошибка", "")
	}
}

// writeJSON отдаёт удачный ответ.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
```

- [ ] **Шаг 6: Реализовать роутер и ручки входа**

`api/internal/httpapi/server.go`:

```go
package httpapi

import (
	"net/http"
	"time"

	"github.com/Qstimo/hundred-days/api/internal/config"
	"github.com/Qstimo/hundred-days/api/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Clock отдаёт текущий момент. Вынесен в зависимость, чтобы тесты на
// остаток дней периода не меняли ответ каждые сутки.
type Clock func() time.Time

// Server — приложение: хранилище, настройки, часы.
type Server struct {
	store *store.Store
	cfg   config.Config
	now   Clock
}

// NewRouter собирает маршруты. Открытыми остаются только живость и вход;
// всё остальное — под посредником сессии.
func NewRouter(pool *pgxpool.Pool, cfg config.Config, now Clock) http.Handler {
	s := &Server{store: store.New(pool), cfg: cfg, now: now}

	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.Recoverer)

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", Health)
		r.Post("/auth/login", s.Login)
		r.Post("/auth/logout", s.Logout)

		r.Group(func(r chi.Router) {
			r.Use(s.requireSession)

			r.Get("/auth/me", s.Me)
			r.Get("/settings", s.GetSettings)
			r.Put("/settings", s.PutSettings)
			// Остальные маршруты добавляются в чанках 4–6.
		})
	})

	return r
}

// Today возвращает сегодняшнюю дату в зоне приложения. Зона своя, а не
// браузерная: иначе запись в час ночи уехала бы на другую дату, а
// статистика разошлась бы между устройствами.
func (s *Server) Today() time.Time {
	t := s.now().In(s.cfg.Location)
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}
```

`api/internal/httpapi/auth.go`:

```go
package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/Qstimo/hundred-days/api/internal/auth"
	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
	"github.com/jackc/pgx/v5"
)

// Login проверяет пароль и выдаёт cookie сессии.
//
// Неизвестный логин и неверный пароль отвечают одинаково: разный ответ
// сказал бы, какие логины в системе есть.
func (s *Server) Login(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Login    string `json:"login"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "тело запроса не разобрано", "")
		return
	}

	user, err := s.store.Queries().GetUserByLogin(r.Context(), in.Login)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusUnauthorized, "логин или пароль не подходят", "")
			return
		}
		writeError(w, http.StatusInternalServerError, "внутренняя ошибка", "")
		return
	}

	ok, err := auth.VerifyPassword(in.Password, user.PasswordHash)
	if err != nil || !ok {
		writeError(w, http.StatusUnauthorized, "логин или пароль не подходят", "")
		return
	}

	id, err := auth.NewSessionID()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "не вышло создать сессию", "")
		return
	}

	expires := s.now().Add(s.cfg.SessionTTL)
	if err := s.store.Queries().CreateSession(r.Context(), dbgen.CreateSessionParams{
		ID: id, UserID: user.ID, ExpiresAt: expires,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "не вышло создать сессию", "")
		return
	}

	s.setSessionCookie(w, id, expires)
	writeJSON(w, http.StatusOK, map[string]any{
		"id": user.ID, "login": user.Login, "name": user.Name,
	})
}

// Logout удаляет сессию и гасит cookie. Отсутствие cookie — тоже успех:
// выход должен быть идемпотентным.
func (s *Server) Logout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(auth.SessionCookieName); err == nil {
		_ = s.store.Queries().DeleteSession(r.Context(), cookie.Value)
	}
	s.clearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

// Me отдаёт текущего пользователя.
func (s *Server) Me(w http.ResponseWriter, r *http.Request) {
	user, err := s.store.Queries().GetUserByID(r.Context(), UserID(r.Context()))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id": user.ID, "login": user.Login, "name": user.Name,
	})
}
```

`api/internal/httpapi/settings.go`:

```go
package httpapi

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/Qstimo/hundred-days/api/internal/domain"
	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
)

// settingsPayload — настройки в виде, в котором их знает интерфейс.
type settingsPayload struct {
	PeriodTitle  string `json:"periodTitle"`
	PeriodStart  string `json:"periodStart"`
	PeriodDays   int    `json:"periodDays"`
	SleepEnabled bool   `json:"sleepEnabled"`
}

// periodPayload — вычисленный период. Не хранится: день и остаток меняются
// сами собой каждые сутки.
type periodPayload struct {
	Title     string `json:"title"`
	Start     string `json:"start"`
	Days      int    `json:"days"`
	DayNumber int    `json:"dayNumber"`
	DaysLeft  int    `json:"daysLeft"`
}

func (s *Server) buildPeriod(st dbgen.Setting) periodPayload {
	today := s.Today()
	return periodPayload{
		Title:     st.PeriodTitle,
		Start:     st.PeriodStart.Format("2006-01-02"),
		Days:      int(st.PeriodDays),
		DayNumber: domain.DayNumber(st.PeriodStart, today),
		DaysLeft:  domain.DaysLeft(st.PeriodStart, int(st.PeriodDays), today),
	}
}

// GetSettings отдаёт настройки вместе с вычисленным периодом: интерфейсу
// нужны оба, и второй запрос ради шапки был бы лишним.
func (s *Server) GetSettings(w http.ResponseWriter, r *http.Request) {
	st, err := s.store.Settings(r.Context(), UserID(r.Context()))
	if err != nil {
		writeStoreError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"settings": settingsPayload{
			PeriodTitle:  st.PeriodTitle,
			PeriodStart:  st.PeriodStart.Format("2006-01-02"),
			PeriodDays:   int(st.PeriodDays),
			SleepEnabled: st.SleepEnabled,
		},
		"period": s.buildPeriod(st),
	})
}

// PutSettings сохраняет настройки.
func (s *Server) PutSettings(w http.ResponseWriter, r *http.Request) {
	var in settingsPayload
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "тело запроса не разобрано", "")
		return
	}

	start, err := time.Parse("2006-01-02", in.PeriodStart)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "дата начала не разобрана", "period_start")
		return
	}
	if in.PeriodDays < 1 || in.PeriodDays > 3650 {
		writeError(w, http.StatusUnprocessableEntity, "длительность вне допустимого", "period_days")
		return
	}

	st, err := s.store.SaveSettings(r.Context(), UserID(r.Context()), dbgen.UpsertSettingsParams{
		PeriodTitle:  in.PeriodTitle,
		PeriodStart:  start,
		PeriodDays:   int32(in.PeriodDays),
		SleepEnabled: in.SleepEnabled,
	})
	if err != nil {
		writeStoreError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, settingsPayload{
		PeriodTitle:  st.PeriodTitle,
		PeriodStart:  st.PeriodStart.Format("2006-01-02"),
		PeriodDays:   int(st.PeriodDays),
		SleepEnabled: st.SleepEnabled,
	})
}
```

- [ ] **Шаг 7: Заменить заглушку роутера в main**

В `api/cmd/api/main.go`: открыть пул, передать его в `NewRouter`, убрать
`RouterStub`. Удалить файл `api/internal/httpapi/router_stub.go`.

```go
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
```

- [ ] **Шаг 8: Убедиться, что тесты проходят**

Запустить: `cd api && go test ./internal/httpapi/ -v`
Ожидается: пять PASS. Первый прогон качает образ PostgreSQL — это минута.

- [ ] **Шаг 9: Коммит**

```bash
git add api/
git rm api/internal/httpapi/router_stub.go
git commit -m "Пускать по сессии и отдавать настройки с периодом"
```

### Задача 3.7: Завершение чанка

- [ ] **Шаг 1: Прогнать всё**

```bash
cd api && go test ./... -race -count=1
```

- [ ] **Шаг 2: Проверить вживую**

```bash
cd ~/"Рабочий стол"/MyMVP/hundred-days
docker compose up -d --build postgres api
docker compose exec -e HD_DATABASE_URL=... api /cli create-user \
  -login vadim -name Вадим -password "длинный-пароль"
```

Примечание: в distroless нет оболочки, поэтому переменные передаются ключом
`-e`, а команда вызывается по полному пути `/cli`.

- [ ] **Шаг 3: Включить шаги генерации в CI**

Раскомментируй в `.github/workflows/ci.yml` шаг «Сгенерированное не
разошлось с источником» и убедись, что он проходит локально:

```bash
cd api && ./tools.sh sqlc generate && \
  ./tools.sh oapi-codegen -config ../openapi/oapi-codegen.yaml ../openapi/openapi.yaml && \
  git diff --exit-code
```

- [ ] **Шаг 4: Коммит**

```bash
git add -A && git commit -m "Завершить чанк входа"
```

---

## Chunk 4: Навыки и трекеры

Итог чанка: реестры навыков и трекеров работают, инвариант сочетания режима и
правила отвергается кодом `409` с машинным поводом `rule_needs_hours`, чужая
запись отвечает `404`.

Приём тот же, что в чанке 3, и повторяется в каждой задаче:
спецификация → `./tools.sh oapi-codegen` → запрос в `queries/` →
`./tools.sh sqlc generate` → функция в `store/` с `userID` первым аргументом →
хендлер → маршрут в `NewRouter` → интеграционный тест.

### Задача 4.1: Навыки

**Файлы:**
- Изменить: `openapi/openapi.yaml` (пути `/skills`, `/skills/{id}`)
- Создать: `api/internal/db/queries/skills.sql`
- Создать: `api/internal/store/skills.go`
- Создать: `api/internal/httpapi/skills.go`
- Тест: `api/internal/httpapi/skills_test.go`

- [ ] **Шаг 1: Описать в спецификации**

Схема `Skill`: `id`, `title`, `targetPoints` (number, minimum 0.01),
`unitLabel`, `sortOrder`, `archived` (boolean). Схема `SkillInput` — без `id`
и `archived`.

Пути: `GET /skills` (список, параметр `includeArchived`), `POST /skills`,
`PUT /skills/{id}`, `DELETE /skills/{id}`.

Удаление навыка **не удаляет записи**: трекеры теряют ссылку
(`ON DELETE SET NULL`), накопленные поинты остаются в `entries`. Опиши это в
`description` операции удаления — иначе следующий читатель решит, что это
недосмотр.

- [ ] **Шаг 2: Написать падающий тест**

`api/internal/httpapi/skills_test.go`. Обязательные случаи:

```go
// Чужой навык отвечает 404, а не 403: ответ 403 сообщил бы, что он есть.
func TestSkillOfAnotherUserIs404(t *testing.T)
// Список отдаёт только свои навыки.
func TestSkillsListIsScopedToUser(t *testing.T)
// Цель должна быть положительной: ноль сделал бы прогресс делением на ноль.
func TestSkillRejectsNonPositiveTarget(t *testing.T)
// Архивный навык не попадает в список без явного запроса.
func TestArchivedSkillHiddenByDefault(t *testing.T)
```

Тест принадлежности пишется так: заводятся два пользователя через
`seedUser`, вход под первым, запрос к навыку второго.

```go
func TestSkillOfAnotherUserIs404(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	otherID := seedUser(t, "someone", "длинный-пароль")
	alienSkill := seedSkill(t, otherID, "Чужой навык", 100)

	cookie := login(t, srv, "vadim", "длинный-пароль")

	req := httptest.NewRequest(http.MethodPut,
		fmt.Sprintf("/api/skills/%d", alienSkill), strings.NewReader(`{"title":"Моё","targetPoints":10}`))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()

	srv.ServeHTTP(rec, req)

	require.Equal(t, http.StatusNotFound, rec.Code)
}
```

- [ ] **Шаг 3: Убедиться, что тесты падают**

Запустить: `go test ./internal/httpapi/ -run TestSkill -v`

- [ ] **Шаг 4: Написать запросы**

`api/internal/db/queries/skills.sql`:

```sql
-- name: ListSkills :many
SELECT id, title, target_points, unit_label, sort_order, archived_at
FROM skills
WHERE user_id = $1
  AND (sqlc.arg(include_archived)::boolean OR archived_at IS NULL)
ORDER BY sort_order, id;

-- name: GetSkill :one
SELECT id, title, target_points, unit_label, sort_order, archived_at
FROM skills
WHERE id = $1 AND user_id = $2;

-- name: CreateSkill :one
INSERT INTO skills (user_id, title, target_points, unit_label, sort_order)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, title, target_points, unit_label, sort_order, archived_at;

-- name: UpdateSkill :one
UPDATE skills SET
  title = $3, target_points = $4, unit_label = $5,
  sort_order = $6, archived_at = $7
WHERE id = $1 AND user_id = $2
RETURNING id, title, target_points, unit_label, sort_order, archived_at;

-- name: DeleteSkill :execrows
DELETE FROM skills WHERE id = $1 AND user_id = $2;
```

Важно: `user_id` стоит в `WHERE` у каждого запроса, включая правку и
удаление. Запрос `UPDATE ... WHERE id = $1` без пользователя позволил бы
править чужое — и страж из задачи 3.2 такой запрос не пропустит.

`:execrows` у удаления нужен, чтобы отличить «удалил» от «нечего удалять»:
ноль строк превращается в `404`.

- [ ] **Шаг 5: Сгенерировать, написать store и хендлеры**

`api/internal/store/skills.go` — функции `Skills`, `Skill`, `CreateSkill`,
`UpdateSkill`, `DeleteSkill`, все с `userID int64` первым аргументом. Удаление
возвращает `pgx.ErrNoRows`, если затронуто ноль строк:

```go
// DeleteSkill удаляет навык. Ноль затронутых строк — не удача, а «нет
// такого»: иначе удаление чужого навыка отвечало бы успехом.
func (s *Store) DeleteSkill(ctx context.Context, userID, id int64) error {
	n, err := s.q.DeleteSkill(ctx, dbgen.DeleteSkillParams{ID: id, UserID: userID})
	if err != nil {
		return err
	}
	if n == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
```

`api/internal/httpapi/skills.go` — пять хендлеров по образцу `settings.go`.
Проверка `targetPoints > 0` до обращения к базе, ответ `422` с кодом
`target_points`.

- [ ] **Шаг 6: Добавить маршруты и убедиться, что тесты проходят**

В `NewRouter`, внутри группы под `requireSession`:

```go
			r.Get("/skills", s.ListSkills)
			r.Post("/skills", s.CreateSkill)
			r.Put("/skills/{id}", s.UpdateSkill)
			r.Delete("/skills/{id}", s.DeleteSkill)
```

Запустить: `go test ./internal/httpapi/ -v`

- [ ] **Шаг 7: Коммит**

```bash
git add -A && git commit -m "Вести реестр навыков"
```

### Задача 4.2: Трекеры и инвариант правила

**Файлы:**
- Изменить: `openapi/openapi.yaml`
- Создать: `api/internal/db/queries/trackers.sql`
- Создать: `api/internal/store/trackers.go`
- Создать: `api/internal/httpapi/trackers.go`
- Тест: `api/internal/httpapi/trackers_test.go`

- [ ] **Шаг 1: Описать в спецификации**

Схема `Tracker`: `id`, `title`, `mode` (enum `check`, `check_hours`),
`pointsRule` (enum `per_check`, `per_hour`), `pointsValue` (number, minimum 0),
`skillId` (integer, nullable), `weeklyTarget` (integer 1…7), `sortOrder`,
`archived`.

В `description` поля `pointsRule` напиши инвариант словами: правило
`per_hour` допустимо только при `mode: check_hours`, иначе `409` с кодом
`rule_needs_hours`.

- [ ] **Шаг 2: Написать падающий тест**

```go
// Инвариант проверяется кодом, а не только ограничением базы: ответ должен
// быть понятным 409 с машинным поводом, а не 500 от нарушения CHECK.
func TestTrackerRejectsPerHourWithoutHours(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	body := `{"title":"Чтение","mode":"check","pointsRule":"per_hour",
	          "pointsValue":1,"weeklyTarget":3}`
	req := httptest.NewRequest(http.MethodPost, "/api/trackers", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()

	srv.ServeHTTP(rec, req)

	require.Equal(t, http.StatusConflict, rec.Code)

	var out map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Equal(t, "rule_needs_hours", out["code"])
}

// Чужой навык нельзя привязать к своему трекеру: ссылка на него раскрыла бы
// его существование и утащила бы поинты в чужую цель.
func TestTrackerRejectsAlienSkill(t *testing.T)

// Правка трекера проверяет инвариант так же, как создание: сменить режим на
// «без часов», оставив правило «за час», нельзя.
func TestTrackerUpdateKeepsInvariant(t *testing.T)

func TestTrackerRejectsWeeklyTargetOutOfRange(t *testing.T)
func TestTrackerOfAnotherUserIs404(t *testing.T)
```

- [ ] **Шаг 3: Убедиться, что тесты падают**

- [ ] **Шаг 4: Написать запросы**

`api/internal/db/queries/trackers.sql` — `ListTrackers`, `GetTracker`,
`CreateTracker`, `UpdateTracker`, `DeleteTracker` (`:execrows`), все с
`user_id` в `WHERE`. Плюс запрос проверки принадлежности навыка:

```sql
-- name: SkillBelongsToUser :one
SELECT EXISTS (
  SELECT 1 FROM skills WHERE id = $1 AND user_id = $2
) AS belongs;
```

- [ ] **Шаг 5: Реализовать store**

`api/internal/store/trackers.go`. Проверка инварианта делается здесь, а не в
хендлере: хранилище — последняя точка перед базой, и обойти её нельзя.

```go
// CreateTracker заводит трекер. Инвариант сочетания режима и правила
// проверяется до записи: ограничение в базе дало бы ту же защиту, но ответом
// была бы невнятная ошибка СУБД вместо понятного 409.
func (s *Store) CreateTracker(ctx context.Context, userID int64, in TrackerInput) (dbgen.Tracker, error) {
	if err := domain.ValidateRule(domain.Mode(in.Mode), domain.Rule(in.PointsRule)); err != nil {
		return dbgen.Tracker{}, err
	}

	// Чужой навык привязать нельзя: ссылка раскрыла бы его существование и
	// увела бы поинты в чужую цель.
	if in.SkillID != nil {
		belongs, err := s.q.SkillBelongsToUser(ctx, dbgen.SkillBelongsToUserParams{
			ID: *in.SkillID, UserID: userID,
		})
		if err != nil {
			return dbgen.Tracker{}, err
		}
		if !belongs {
			return dbgen.Tracker{}, pgx.ErrNoRows
		}
	}

	return s.q.CreateTracker(ctx, /* ... */)
}
```

`UpdateTracker` делает ровно те же две проверки — вынеси их в приватную
функцию `validateTrackerInput`, чтобы не дублировать.

- [ ] **Шаг 6: Реализовать хендлеры, добавить маршруты, прогнать тесты**

Запустить: `go test ./internal/httpapi/ -v`
Ожидается: все PASS, включая пять новых.

- [ ] **Шаг 7: Коммит**

```bash
git add -A && git commit -m "Вести реестр трекеров с проверкой правила поинтов"
```

---

## Chunk 5: Страница дня

Итог чанка: `GET /api/day?date=` отдаёт всё для главного экрана одним ответом,
отметки трекеров ставятся и снимаются, сон и планы пишутся, незакрытые планы
переносятся кнопкой.

### Задача 5.1: Отметки выполнения

**Файлы:**
- Изменить: `openapi/openapi.yaml`
- Создать: `api/internal/db/queries/entries.sql`
- Создать: `api/internal/store/entries.go`
- Создать: `api/internal/httpapi/entries.go`
- Тест: `api/internal/httpapi/entries_test.go`

- [ ] **Шаг 1: Описать в спецификации**

`PUT /trackers/{id}/entries/{date}` — тело `{ "hours": number | null }`,
ответ `200` со схемой `Entry` (`date`, `hours`, `pointsAwarded`).
`DELETE /trackers/{id}/entries/{date}` — ответ `204`.

В описании `PUT` напиши: повторный вызов перезаписывает часы и пересчитывает
поинты по текущей цене трекера — это правка сегодняшней записи, а не новая.

- [ ] **Шаг 2: Написать падающий тест**

```go
// Поинты фиксируются в записи. Правка цены трекера не переписывает прошлое:
// иначе «забрано 240 из 300» менялось бы от настройки, а не от работы.
func TestEntryKeepsPointsAfterTrackerPriceChange(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Английский", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})

	// Отметили при цене 1.
	putEntry(t, srv, cookie, trackerID, "2026-10-20", nil)

	// Подняли цену до 5.
	putTrackerPrice(t, srv, cookie, trackerID, 5)

	// У старой записи поинты прежние.
	entries := getDay(t, srv, cookie, "2026-10-20")
	require.Equal(t, 1.0, entries.Trackers[0].Entry.PointsAwarded)

	// А у новой — новые.
	putEntry(t, srv, cookie, trackerID, "2026-10-21", nil)
	next := getDay(t, srv, cookie, "2026-10-21")
	require.Equal(t, 5.0, next.Trackers[0].Entry.PointsAwarded)
}

// Правило «за час» без часов — 422: отметить выполнение, не сказав сколько,
// значит начислить ноль, и это почти наверняка ошибка пользователя.
func TestEntryPerHourRequiresHours(t *testing.T)

// Повторная отметка перезаписывает, а не плодит дубли.
func TestEntryIsIdempotentPerDay(t *testing.T)

// Снятие отметки удаляет строку: отдельного значения «не сделано» нет.
func TestDeleteEntryRemovesRow(t *testing.T)

// Любой день открыт для правки, в том числе давний.
func TestEntryCanBeWrittenForPastDate(t *testing.T)

// Будущая дата отвергается: отметить то, чего ещё не было, нельзя.
func TestEntryRejectsFutureDate(t *testing.T)

func TestEntryOnAlienTrackerIs404(t *testing.T)
```

- [ ] **Шаг 3: Убедиться, что тесты падают**

- [ ] **Шаг 4: Написать запросы**

```sql
-- name: UpsertEntry :one
INSERT INTO entries (user_id, tracker_id, entry_date, hours, points_awarded)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (tracker_id, entry_date) DO UPDATE SET
  hours          = excluded.hours,
  points_awarded = excluded.points_awarded,
  updated_at     = now()
RETURNING id, entry_date, hours, points_awarded;

-- name: DeleteEntry :execrows
DELETE FROM entries
WHERE user_id = $1 AND tracker_id = $2 AND entry_date = $3;

-- name: ListEntriesForDate :many
SELECT tracker_id, entry_date, hours, points_awarded
FROM entries
WHERE user_id = $1 AND entry_date = $2;
```

- [ ] **Шаг 5: Реализовать store**

`api/internal/store/entries.go`:

```go
// SaveEntry ставит или перезаписывает отметку выполнения.
//
// Поинты считаются здесь и ложатся в строку: читать их потом по текущей
// цене трекера нельзя — правка цены переписала бы весь прошлый прогресс.
func (s *Store) SaveEntry(ctx context.Context, userID, trackerID int64, date time.Time, hours *float64) (dbgen.UpsertEntryRow, error) {
	tr, err := s.q.GetTracker(ctx, dbgen.GetTrackerParams{ID: trackerID, UserID: userID})
	if err != nil {
		return dbgen.UpsertEntryRow{}, err // pgx.ErrNoRows → 404, в том числе для чужого
	}

	if dbgen.PointsRule(tr.PointsRule) == dbgen.PointsRulePerHour && hours == nil {
		return dbgen.UpsertEntryRow{}, ErrHoursRequired
	}
	if tr.Mode == dbgen.TrackerModeCheck {
		// Трекер без часов часы игнорирует, а не отвергает: лишнее поле в
		// теле запроса не повод ломать отметку.
		hours = nil
	}

	points := domain.Points(domain.Rule(tr.PointsRule), tr.PointsValue, hours)

	return s.q.UpsertEntry(ctx, dbgen.UpsertEntryParams{
		UserID: userID, TrackerID: trackerID, EntryDate: date,
		Hours: hours, PointsAwarded: points,
	})
}
```

Добавь в `store` ошибку `ErrHoursRequired` и переведи её в `422` в
`writeStoreError` с кодом `hours_required`.

- [ ] **Шаг 6: Реализовать хендлеры**

Отдельно — проверка будущей даты. Она делается в хендлере, потому что требует
знания «сегодня», а это свойство сервера, не хранилища:

```go
// Дата в будущем отвергается: отметить то, чего ещё не было, нельзя.
// «Сегодня» берётся из зоны приложения, а не из браузера.
if date.After(s.Today()) {
	writeError(w, http.StatusUnprocessableEntity, "дата в будущем", "future_date")
	return
}
```

- [ ] **Шаг 7: Прогнать тесты и закоммитить**

```bash
go test ./internal/httpapi/ -v
git add -A && git commit -m "Ставить и снимать отметки выполнения"
```

### Задача 5.2: Сон

**Файлы:**
- Изменить: `openapi/openapi.yaml`
- Создать: `api/internal/db/queries/sleep.sql`
- Создать: `api/internal/store/sleep.go`
- Создать: `api/internal/httpapi/sleep.go`
- Тест: `api/internal/httpapi/sleep_test.go`

- [ ] **Шаг 1: Описать в спецификации**

Схема `Sleep`: `date`, `wentToBedAt` (string `HH:MM`, nullable),
`wokeUpAt` (nullable), `quality` (integer 1…5, nullable),
`durationMinutes` (integer, nullable, **только на чтение** — вычисляется).

`PUT /sleep/{date}`, `DELETE /sleep/{date}`.

- [ ] **Шаг 2: Написать падающий тест**

```go
// Главный случай: сон через полночь. Лёг в 23:40, встал в 7:10 — семь с
// половиной часов, а не минус шестнадцать.
func TestSleepDurationAcrossMidnight(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	body := `{"wentToBedAt":"23:40","wokeUpAt":"07:10","quality":4}`
	req := httptest.NewRequest(http.MethodPut, "/api/sleep/2026-10-23", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()

	srv.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var out struct{ DurationMinutes *int `json:"durationMinutes"` }
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.NotNil(t, out.DurationMinutes)
	require.Equal(t, 450, *out.DurationMinutes)
}

// Половина данных — не повод выдумывать вторую: длительности нет.
func TestSleepWithOnlyWakeTimeHasNoDuration(t *testing.T)
func TestSleepRejectsQualityOutOfRange(t *testing.T)
func TestSleepRejectsMalformedTime(t *testing.T)
func TestDeleteSleepRemovesRow(t *testing.T)
```

- [ ] **Шаг 3: Запросы**

```sql
-- name: UpsertSleep :one
INSERT INTO sleep_logs (user_id, log_date, went_to_bed_at, woke_up_at, quality)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (user_id, log_date) DO UPDATE SET
  went_to_bed_at = excluded.went_to_bed_at,
  woke_up_at     = excluded.woke_up_at,
  quality        = excluded.quality,
  updated_at     = now()
RETURNING log_date, went_to_bed_at, woke_up_at, quality;

-- name: GetSleep :one
SELECT log_date, went_to_bed_at, woke_up_at, quality
FROM sleep_logs
WHERE user_id = $1 AND log_date = $2;

-- name: DeleteSleep :execrows
DELETE FROM sleep_logs WHERE user_id = $1 AND log_date = $2;
```

- [ ] **Шаг 4: Реализовать**

Тип `time` в pgx приходит как `pgtype.Time` с микросекундами от полуночи.
Напиши две функции перевода в `api/internal/httpapi/sleep.go` и покрой их
unit-тестом — это самое вероятное место ошибки на единицу:

```go
// parseClock переводит «ЧЧ:ММ» в микросекунды от полуночи — вид, в котором
// PostgreSQL хранит time.
func parseClock(s string) (int64, error)

// formatClock переводит обратно, в «ЧЧ:ММ».
func formatClock(micros int64) string
```

Тест `api/internal/httpapi/sleep_clock_test.go`:

```go
func TestClockRoundTrip(t *testing.T) {
	for _, s := range []string{"00:00", "07:10", "23:40", "12:34"} {
		micros, err := parseClock(s)
		require.NoError(t, err)
		require.Equal(t, s, formatClock(micros))
	}
}

func TestParseClockRejectsGarbage(t *testing.T) {
	for _, s := range []string{"24:00", "7:10", "12:60", "полдень", ""} {
		_, err := parseClock(s)
		require.Error(t, err, "должно отвергаться: %q", s)
	}
}
```

Длительность считается функцией `domain.SleepDuration` — не пиши её второй
раз в хендлере.

- [ ] **Шаг 5: Прогнать тесты и закоммитить**

```bash
go test ./internal/httpapi/ -v
git add -A && git commit -m "Записывать сон и считать длительность"
```

### Задача 5.3: Планы на день и перенос

**Файлы:**
- Изменить: `openapi/openapi.yaml`
- Создать: `api/internal/db/queries/dayplans.sql`
- Создать: `api/internal/store/dayplans.go`
- Создать: `api/internal/httpapi/dayplans.go`
- Тест: `api/internal/httpapi/dayplans_test.go`

- [ ] **Шаг 1: Описать в спецификации**

Схема `DayPlan`: `id`, `date`, `title`, `done` (boolean), `doneAt` (nullable),
`sortOrder`, `carriedFromId` (nullable).

`POST /day-plans` (тело: `date`, `title`), `PATCH /day-plans/{id}` (тело:
необязательные `title`, `done`, `sortOrder`), `DELETE /day-plans/{id}`,
`POST /day-plans/carry-over` (тело: `{ "date": "YYYY-MM-DD" }`, ответ — список
созданных пунктов).

- [ ] **Шаг 2: Написать падающий тест**

```go
// Перенос копирует незакрытые пункты предыдущего дня в указанный, оставляя
// в исходном дне след: видно, что планировалось и уехало, а не исчезло.
func TestCarryOverCopiesUnfinishedFromPreviousDay(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	done := createPlan(t, srv, cookie, "2026-10-22", "Сделанное")
	undone := createPlan(t, srv, cookie, "2026-10-22", "Несделанное")
	markDone(t, srv, cookie, done)

	created := carryOver(t, srv, cookie, "2026-10-23")

	require.Len(t, created, 1)
	require.Equal(t, "Несделанное", created[0].Title)
	require.Equal(t, undone, *created[0].CarriedFromID)

	// Исходный день не изменился: пункт остался там незакрытым.
	yesterday := getDay(t, srv, cookie, "2026-10-22")
	require.Len(t, yesterday.Plans, 2)
}

// Повторный перенос не плодит копии: иначе двойное нажатие удвоило бы
// список.
func TestCarryOverIsIdempotent(t *testing.T) {
	// ...
	first := carryOver(t, srv, cookie, "2026-10-23")
	second := carryOver(t, srv, cookie, "2026-10-23")

	require.Len(t, first, 1)
	require.Empty(t, second, "пункт уже перенесён — копировать нечего")
}

// Закрытие ставит метку времени, открытие — снимает.
func TestPlanDoneTogglesTimestamp(t *testing.T)
func TestPlanOfAnotherUserIs404(t *testing.T)
func TestPlanRejectsEmptyTitle(t *testing.T)
```

- [ ] **Шаг 3: Запросы**

```sql
-- name: ListPlansForDate :many
SELECT id, plan_date, title, done_at, sort_order, carried_from_id
FROM day_plans
WHERE user_id = $1 AND plan_date = $2
ORDER BY sort_order, id;

-- name: CreatePlan :one
INSERT INTO day_plans (user_id, plan_date, title, sort_order, carried_from_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, plan_date, title, done_at, sort_order, carried_from_id;

-- name: UpdatePlan :one
UPDATE day_plans SET title = $3, done_at = $4, sort_order = $5
WHERE id = $1 AND user_id = $2
RETURNING id, plan_date, title, done_at, sort_order, carried_from_id;

-- name: DeletePlan :execrows
DELETE FROM day_plans WHERE id = $1 AND user_id = $2;

-- Незакрытые пункты дня, которые ещё не переносили в целевой день.
-- Проверка по carried_from_id делает перенос идемпотентным: повторное
-- нажатие не создаёт копий.
-- name: ListPlansToCarryOver :many
SELECT p.id, p.title, p.sort_order
FROM day_plans p
WHERE p.user_id = $1
  AND p.plan_date = $2
  AND p.done_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM day_plans c
    WHERE c.user_id = $1
      AND c.plan_date = $3
      AND c.carried_from_id = p.id
  )
ORDER BY p.sort_order, p.id;
```

- [ ] **Шаг 4: Реализовать store**

Перенос делается одной транзакцией: половина скопированных пунктов хуже, чем
ни одного.

```go
// CarryOverPlans копирует незакрытые пункты предыдущего дня в указанный.
//
// Идемпотентно: пункт, у которого в целевом дне уже есть копия, пропускается.
// Всё в одной транзакции — половина перенесённого списка хуже, чем ничего.
func (s *Store) CarryOverPlans(ctx context.Context, userID int64, to time.Time) ([]dbgen.CreatePlanRow, error) {
	from := to.AddDate(0, 0, -1)

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	q := s.q.WithTx(tx)

	src, err := q.ListPlansToCarryOver(ctx, dbgen.ListPlansToCarryOverParams{
		UserID: userID, PlanDate: from, PlanDate_2: to,
	})
	if err != nil {
		return nil, err
	}

	out := make([]dbgen.CreatePlanRow, 0, len(src))
	for _, p := range src {
		created, err := q.CreatePlan(ctx, dbgen.CreatePlanParams{
			UserID: userID, PlanDate: to, Title: p.Title,
			SortOrder: p.SortOrder, CarriedFromID: &p.ID,
		})
		if err != nil {
			return nil, err
		}
		out = append(out, created)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return out, nil
}
```

- [ ] **Шаг 5: Прогнать тесты и закоммитить**

```bash
go test ./internal/httpapi/ -v
git add -A && git commit -m "Вести планы на день и переносить незакрытые"
```

### Задача 5.4: Ответ страницы дня

**Файлы:**
- Изменить: `openapi/openapi.yaml`
- Создать: `api/internal/db/queries/day.sql`
- Создать: `api/internal/store/day.go`
- Создать: `api/internal/httpapi/day.go`
- Тест: `api/internal/httpapi/day_test.go`

- [ ] **Шаг 1: Описать в спецификации**

`GET /day?date=YYYY-MM-DD` (без параметра — сегодня в зоне сервера).

Схема `DayResponse`:

```yaml
    DayResponse:
      type: object
      required: [date, period, trackers, plans, skills, sleepEnabled]
      properties:
        date: { type: string, format: date }
        period: { $ref: '#/components/schemas/Period' }
        sleepEnabled: { type: boolean }
        sleep: { $ref: '#/components/schemas/Sleep', nullable: true }
        trackers:
          type: array
          items:
            type: object
            required: [tracker, weekDone, weekTarget]
            properties:
              tracker: { $ref: '#/components/schemas/Tracker' }
              entry: { $ref: '#/components/schemas/Entry', nullable: true }
              # Сделано на неделе, в которую попадает запрошенная дата.
              weekDone: { type: integer }
              weekTarget: { type: integer }
        plans:
          type: array
          items: { $ref: '#/components/schemas/DayPlan' }
        # Есть ли что переносить со вчера: кнопка показывается только тогда.
        carryOverAvailable: { type: boolean }
        skills:
          type: array
          items:
            type: object
            required: [skill, earnedPoints]
            properties:
              skill: { $ref: '#/components/schemas/Skill' }
              earnedPoints: { type: number }
```

- [ ] **Шаг 2: Написать падающий тест**

```go
// Один запрос отдаёт всё для главного экрана: период, трекеры с отметкой,
// недельный счёт, сон, планы и прогресс навыков. Шесть запросов дали бы
// шесть индикаторов загрузки на экране, который открывается каждый день.
func TestDayReturnsEverythingAtOnce(t *testing.T) {
	today := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC) // пятница
	srv := newTestServer(t, today)
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	skillID := seedSkill(t, userID, "Английский уровня B", 300)
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check", Value: 1,
		WeeklyTarget: 3, SkillID: &skillID,
	})

	// Понедельник и среда той же недели.
	putEntry(t, srv, cookie, trackerID, "2026-10-19", nil)
	putEntry(t, srv, cookie, trackerID, "2026-10-21", nil)
	createPlan(t, srv, cookie, "2026-10-23", "Написать план")

	day := getDay(t, srv, cookie, "2026-10-23")

	require.Equal(t, "2026-10-23", day.Date)
	require.Equal(t, 23, day.Period.DayNumber)
	require.Len(t, day.Trackers, 1)
	// Отметки за сегодня нет: сегодня ещё не делали.
	require.Nil(t, day.Trackers[0].Entry)
	// А на этой неделе уже два раза из трёх.
	require.Equal(t, 2, day.Trackers[0].WeekDone)
	require.Equal(t, 3, day.Trackers[0].WeekTarget)
	require.Len(t, day.Plans, 1)
	require.Len(t, day.Skills, 1)
	require.Equal(t, 2.0, day.Skills[0].EarnedPoints)
}

// Неделя считается с понедельника: воскресенье относится к той же неделе,
// что предшествующий понедельник, а не к следующей.
func TestDayWeekStartsOnMonday(t *testing.T) {
	// Отметка в понедельник 19 октября, запрос за воскресенье 25-е:
	// weekDone должен быть 1, а не 0.
}

// Без параметра date отдаётся сегодня в зоне сервера.
func TestDayWithoutDateIsToday(t *testing.T)

// Архивный трекер на странице дня не показывается.
func TestDayHidesArchivedTrackers(t *testing.T)

// Кнопка переноса появляется только если со вчера есть что переносить.
func TestDayCarryOverAvailableFlag(t *testing.T)
```

- [ ] **Шаг 3: Запросы**

Неделя в PostgreSQL берётся `date_trunc('week', ...)` — она начинается с
понедельника, как нужно.

```sql
-- Сколько раз каждый трекер выполнен на неделе, в которую попадает дата.
-- date_trunc('week') в PostgreSQL начинает неделю с понедельника.
-- name: CountEntriesInWeek :many
SELECT tracker_id, count(*)::int AS done
FROM entries
WHERE user_id = $1
  AND entry_date >= date_trunc('week', $2::date)
  AND entry_date <  date_trunc('week', $2::date) + interval '7 days'
GROUP BY tracker_id;

-- Накопленные поинты по навыкам. Считается суммой зафиксированных в записях
-- поинтов, а не по текущей цене трекеров.
-- name: SumPointsBySkill :many
SELECT t.skill_id, coalesce(sum(e.points_awarded), 0)::double precision AS earned
FROM entries e
JOIN trackers t ON t.id = e.tracker_id
WHERE e.user_id = $1 AND t.skill_id IS NOT NULL
GROUP BY t.skill_id;

-- Есть ли незакрытые пункты за предыдущий день, ещё не перенесённые.
-- name: HasPlansToCarryOver :one
SELECT EXISTS (
  SELECT 1 FROM day_plans p
  WHERE p.user_id = $1 AND p.plan_date = $2 AND p.done_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM day_plans c
      WHERE c.user_id = $1 AND c.plan_date = $3 AND c.carried_from_id = p.id
    )
) AS available;
```

- [ ] **Шаг 4: Реализовать**

`api/internal/store/day.go` — одна функция `Day(ctx, userID, date)`,
собирающая всё. Запросы идут последовательно: их шесть, база локальная, и
параллелить ради единиц миллисекунд незачем.

`api/internal/httpapi/day.go` — разбор параметра `date`, подстановка
`s.Today()` при его отсутствии, сборка ответа.

- [ ] **Шаг 5: Прогнать тесты и закоммитить**

```bash
go test ./internal/httpapi/ -race -count=1
git add -A && git commit -m "Отдавать страницу дня одним ответом"
```

---

## Chunk 6: Статистика

Итог чанка: `GET /api/stats?from=&to=` отдаёт всё для дашборда — теплокарту,
часы, серии, прогресс навыков с прогнозом, сон и долю закрытых планов.

### Задача 6.1: Агрегаты

**Файлы:**
- Изменить: `openapi/openapi.yaml`
- Создать: `api/internal/db/queries/stats.sql`
- Создать: `api/internal/store/stats.go`
- Создать: `api/internal/httpapi/stats.go`
- Тест: `api/internal/httpapi/stats_test.go`

- [ ] **Шаг 1: Описать в спецификации**

`GET /stats?from=YYYY-MM-DD&to=YYYY-MM-DD`. Схема `StatsResponse`:

```yaml
    StatsResponse:
      type: object
      required: [from, to, trackers, skills, plans]
      properties:
        from: { type: string, format: date }
        to: { type: string, format: date }
        trackers:
          type: array
          items:
            type: object
            required: [trackerId, title, mode, days, totalDone, totalHours,
                       completionRate, currentStreak, bestStreak,
                       currentWeekDone, weeklyTarget]
            properties:
              trackerId: { type: integer, format: int64 }
              title: { type: string }
              mode: { type: string }
              # По дню на каждый день отрезка, включая пустые: теплокарте
              # нужны и провалы, а пропуск дня сдвинул бы сетку.
              days:
                type: array
                items:
                  type: object
                  required: [date, done]
                  properties:
                    date: { type: string, format: date }
                    done: { type: boolean }
                    hours: { type: number, nullable: true }
                    points: { type: number }
              totalDone: { type: integer }
              totalHours: { type: number }
              completionRate: { type: number }
              currentStreak: { type: integer }
              bestStreak: { type: integer }
              currentWeekDone: { type: integer }
              weeklyTarget: { type: integer }
        skills:
          type: array
          items:
            type: object
            required: [skillId, title, targetPoints, earnedPoints, forecast, willReach]
            properties:
              skillId: { type: integer, format: int64 }
              title: { type: string }
              unitLabel: { type: string }
              targetPoints: { type: number }
              earnedPoints: { type: number }
              # Прогноз по темпу последних 14 дней до конца периода.
              forecast: { type: number }
              willReach: { type: boolean }
        sleep:
          type: array
          items:
            type: object
            required: [date]
            properties:
              date: { type: string, format: date }
              wentToBedAt: { type: string, nullable: true }
              wokeUpAt: { type: string, nullable: true }
              durationMinutes: { type: integer, nullable: true }
              quality: { type: integer, nullable: true }
        plans:
          type: object
          required: [total, done, rate]
          properties:
            total: { type: integer }
            done: { type: integer }
            rate: { type: number }
```

- [ ] **Шаг 2: Написать падающий тест**

```go
// Отрезок отдаётся целиком, день за днём: теплокарте нужны и пустые дни.
func TestStatsFillsEveryDayOfRange(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})
	putEntry(t, srv, cookie, trackerID, "2026-10-20", nil)

	stats := getStats(t, srv, cookie, "2026-10-19", "2026-10-25")

	require.Len(t, stats.Trackers, 1)
	require.Len(t, stats.Trackers[0].Days, 7, "семь дней отрезка")
	require.False(t, stats.Trackers[0].Days[0].Done, "19-е пустое")
	require.True(t, stats.Trackers[0].Days[1].Done, "20-е закрыто")
	require.Equal(t, 1, stats.Trackers[0].TotalDone)
}

// Серия считается по неделям и не рвётся незакончившейся неделей.
func TestStatsStreakIgnoresUnfinishedCurrentWeek(t *testing.T) {
	// Две полные недели по цели, текущая пока пустая: currentStreak == 2.
}

// Часы суммируются только у трекеров с часами.
func TestStatsSumsHours(t *testing.T)

// Прогноз навыка считается по темпу, а не по среднему за всё время.
func TestStatsSkillForecast(t *testing.T)

// Доля закрытых планов — отдельная метрика, на поинты не влияет.
func TestStatsPlansRate(t *testing.T)

// Отрезок задом наперёд отвергается.
func TestStatsRejectsInvertedRange(t *testing.T)

// Слишком длинный отрезок отвергается: пять лет по дню на трекер — ответ в
// мегабайты, и его никто не прочтёт.
func TestStatsRejectsHugeRange(t *testing.T)
```

- [ ] **Шаг 3: Запросы**

```sql
-- Записи отрезка по дням. Заполнение пустых дней делается в Go: генерировать
-- календарь в SQL дороже и труднее читать.
-- name: ListEntriesInRange :many
SELECT tracker_id, entry_date, hours, points_awarded
FROM entries
WHERE user_id = $1 AND entry_date BETWEEN $2 AND $3
ORDER BY entry_date;

-- Выполнения по неделям для серий. Берётся вся история, а не отрезок:
-- серия, начавшаяся до его начала, иначе выглядела бы короче.
-- name: CountEntriesByWeek :many
SELECT tracker_id,
       date_trunc('week', entry_date)::date AS week_start,
       count(*)::int AS done
FROM entries
WHERE user_id = $1
GROUP BY tracker_id, week_start
ORDER BY tracker_id, week_start;

-- Поинты за последние N дней — для темпа.
-- name: SumRecentPointsBySkill :many
SELECT t.skill_id, coalesce(sum(e.points_awarded), 0)::double precision AS earned
FROM entries e
JOIN trackers t ON t.id = e.tracker_id
WHERE e.user_id = $1 AND t.skill_id IS NOT NULL AND e.entry_date > $2
GROUP BY t.skill_id;

-- name: ListSleepInRange :many
SELECT log_date, went_to_bed_at, woke_up_at, quality
FROM sleep_logs
WHERE user_id = $1 AND log_date BETWEEN $2 AND $3
ORDER BY log_date;

-- name: CountPlansInRange :one
SELECT count(*)::int AS total,
       count(done_at)::int AS done
FROM day_plans
WHERE user_id = $1 AND plan_date BETWEEN $2 AND $3;
```

- [ ] **Шаг 4: Реализовать сборку в store**

Ключевой момент — превращение недельных сумм в срез без пропусков для
`domain.WeeklyStreak`. Неделя без записей в базе отсутствует, а функции нужен
нуль на её месте: пропущенная неделя сделала бы провал невидимым.

```go
// weekCounts разворачивает суммы по неделям в срез без пропусков, от первой
// недели с записями до текущей включительно.
//
// Неделя без записей в базе отсутствует, но в срезе обязана быть нулём:
// иначе провал стал бы невидим и серия склеилась бы через него.
func weekCounts(rows []weekRow, currentWeekStart time.Time) []int {
	if len(rows) == 0 {
		return []int{0}
	}

	byWeek := make(map[time.Time]int, len(rows))
	for _, r := range rows {
		byWeek[r.WeekStart] = r.Done
	}

	out := []int{}
	for w := rows[0].WeekStart; !w.After(currentWeekStart); w = w.AddDate(0, 0, 7) {
		out = append(out, byWeek[w])
	}
	return out
}
```

Напиши на `weekCounts` отдельный unit-тест в `api/internal/store/stats_test.go`
— он чистый и базы не требует:

```go
func TestWeekCountsFillsGapsWithZero(t *testing.T) {
	w := func(s string) time.Time { t, _ := time.Parse("2006-01-02", s); return t }

	rows := []weekRow{
		{WeekStart: w("2026-09-28"), Done: 3},
		// Неделя 5 октября пропущена — в ней не было ни одной записи.
		{WeekStart: w("2026-10-12"), Done: 2},
	}

	got := weekCounts(rows, w("2026-10-19"))

	require.Equal(t, []int{3, 0, 2, 0}, got)
}
```

- [ ] **Шаг 5: Ограничить длину отрезка**

```go
// Длина отрезка ограничена: ответ отдаёт по дню на каждый трекер, и пять
// лет превратились бы в мегабайты, которые всё равно не прочесть.
const maxStatsRangeDays = 400

if to.Sub(from).Hours()/24 > maxStatsRangeDays {
	writeError(w, http.StatusUnprocessableEntity,
		"отрезок длиннее 400 дней", "range_too_long")
	return
}
```

- [ ] **Шаг 6: Прогнать тесты и закоммитить**

```bash
cd api && go test ./... -race -count=1
git add -A && git commit -m "Считать статистику за отрезок"
```

### Задача 6.2: Завершение серверной части

- [ ] **Шаг 1: Проверить, что спецификация и код не разошлись**

```bash
cd api
./tools.sh sqlc generate
./tools.sh oapi-codegen -config ../openapi/oapi-codegen.yaml ../openapi/openapi.yaml
git diff --exit-code
```

Ожидается: различий нет.

- [ ] **Шаг 2: Пройти по спецификации глазами**

Открой `openapi/openapi.yaml` и сверь с таблицей ручек в разделе 6 дизайна.
Каждая ручка должна быть описана, у каждой — коды `401` и `404`, где они
возможны.

- [ ] **Шаг 3: Проверить вживую**

```bash
cd ~/"Рабочий стол"/MyMVP/hundred-days
docker compose up -d --build
# вход
curl -s -c /tmp/hd.jar -X POST localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"login":"vadim","password":"длинный-пароль"}'
# страница дня
curl -s -b /tmp/hd.jar localhost:8080/api/day | head -40
```

- [ ] **Шаг 4: Коммит**

```bash
git add -A && git commit -m "Завершить серверную часть"
```

---

## Chunk 7: Веб-каркас, клиент и вход

Итог чанка: Next поднимается, типы и клиент порождены из той же
спецификации, `/login` входит и ведёт на главную, без сессии любой экран
отправляет на вход, выезжающая панель с черновиком готова к использованию.

### Задача 7.1: Каркас Next

**Файлы:**
- Создать: `web/package.json`, `web/tsconfig.json`, `web/next.config.ts`
- Создать: `web/vitest.config.ts`, `web/vitest.setup.ts`
- Создать: `web/src/app/layout.tsx`, `web/src/app/globals.css`
- Создать: `web/tailwind.config.ts`, `web/components.json`

- [ ] **Шаг 1: Поднять проект**

```bash
cd ~/"Рабочий стол"/MyMVP/hundred-days
pnpm create next-app@latest web --typescript --tailwind --app \
  --src-dir --import-alias '@/*' --no-eslint --use-pnpm
cd web
pnpm add @tanstack/react-query openapi-fetch
pnpm add -D openapi-typescript vitest @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input label checkbox select sheet \
  card progress calendar popover chart sonner
```

Примечание: линтера в проекте нет — так же, как в CAIRN. Качество держат
типы и тесты.

- [ ] **Шаг 2: Настроить Vitest**

`web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

`web/vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Скрипты в `web/package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest",
    "typecheck": "tsc --noEmit",
    "api:types": "openapi-typescript ../openapi/openapi.yaml -o src/api-client/schema.d.ts"
  }
}
```

- [ ] **Шаг 3: Проксировать API в разработке**

`web/next.config.ts`:

```ts
import type { NextConfig } from 'next';

/**
 * В бою адрес API совпадает с адресом приложения: `/api/*` раздаёт Caddy.
 * В разработке Next слушает 3000, а Go — 3001, поэтому запросы по `/api`
 * переписываются. Без этого cookie сессии не доехала бы: на другом порту
 * это другой источник.
 */
const nextConfig: NextConfig = {
  async rewrites() {
    if (process.env.NODE_ENV === 'production') return [];
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:3001/api/:path*',
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Шаг 4: Проверить и закоммитить**

```bash
cd web && pnpm typecheck && pnpm build
git add -A && git commit -m "Поднять каркас веб-приложения"
```

### Задача 7.2: Клиент из спецификации

**Файлы:**
- Создать: `web/src/api-client/schema.d.ts` (порождается)
- Создать: `web/src/api-client/client.ts`
- Создать: `web/src/api-client/serverClient.ts`
- Создать: `web/src/api-client/index.ts`
- Тест: `web/src/api-client/client.test.ts`

- [ ] **Шаг 1: Сгенерировать типы**

```bash
cd web && pnpm api:types
```

Ожидается: `src/api-client/schema.d.ts` появился и содержит `DayResponse`.
Этот файл коммитится: CI проверяет, что он не разошёлся со спецификацией.

- [ ] **Шаг 2: Написать падающий тест**

`web/src/api-client/client.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { apiClient, isUnauthorized } from './client';

describe('apiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('ходит по относительному адресу: cookie сессии ходит только в свой источник', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.GET('/health');

    const url = fetchMock.mock.calls[0][0] as Request | string;
    const href = typeof url === 'string' ? url : url.url;
    expect(href).toContain('/api/health');
  });

  it('узнаёт ответ без сессии по коду 401', () => {
    expect(isUnauthorized({ response: { status: 401 } })).toBe(true);
    expect(isUnauthorized({ response: { status: 404 } })).toBe(false);
    expect(isUnauthorized(new Error('сеть отвалилась'))).toBe(false);
  });
});
```

- [ ] **Шаг 3: Реализовать**

`web/src/api-client/client.ts`:

```ts
import createClient from 'openapi-fetch';
import type { paths } from './schema';

/**
 * Клиент API для браузера. Адрес относительный: cookie сессии помечена
 * `SameSite=Lax` и уходит только в свой источник, а абсолютный адрес сделал
 * бы запрос межсайтовым.
 */
export const apiClient = createClient<paths>({ baseUrl: '/api' });

/** Ответ «нужен вход»: повод отправить на `/login`, а не показать ошибку. */
export function isUnauthorized(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const response = (error as { response?: { status?: number } }).response;
  return response?.status === 401;
}
```

`web/src/api-client/serverClient.ts`:

```ts
import createClient from 'openapi-fetch';
import { cookies } from 'next/headers';
import type { paths } from './schema';

/**
 * Клиент для серверных компонентов. Ходит во внутренний адрес API напрямую,
 * минуя прокси, и вручную пересылает cookie сессии: серверный запрос
 * исходит не от браузера, и сам он её не приложит.
 */
export async function createServerClient() {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  return createClient<paths>({
    baseUrl: `${process.env.HD_API_INTERNAL_URL ?? 'http://127.0.0.1:3001'}/api`,
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    // Данные дня меняются от каждой галочки: кэш ответов здесь только мешает.
    cache: 'no-store',
  });
}
```

- [ ] **Шаг 4: Прогнать тесты и закоммитить**

```bash
cd web && pnpm test run src/api-client
git add -A && git commit -m "Породить клиент API из спецификации"
```

### Задача 7.3: Вход и охрана маршрутов

**Файлы:**
- Создать: `web/src/features/auth/LoginForm/` (`index.ts`, `LoginForm.tsx`, `LoginForm.test.tsx`, `types.ts`)
- Создать: `web/src/app/login/page.tsx`
- Создать: `web/src/features/auth/utils/requireUser.ts`, `index.ts`
- Создать: `web/src/app/providers.tsx`

- [ ] **Шаг 1: Написать падающий тест формы входа**

`web/src/features/auth/LoginForm/LoginForm.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('отправляет логин и пароль', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Логин'), 'vadim');
    await userEvent.type(screen.getByLabelText('Пароль'), 'длинный-пароль');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(onSubmit).toHaveBeenCalledWith({
      login: 'vadim',
      password: 'длинный-пароль',
    });
  });

  it('не отправляет пустую форму', async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('показывает ошибку, не раскрывая, что именно не подошло', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('401'));
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Логин'), 'vadim');
    await userEvent.type(screen.getByLabelText('Пароль'), 'мимо');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Логин или пароль не подходят',
    );
  });

  it('блокирует кнопку на время отправки', async () => {
    let resolve: () => void = () => {};
    const onSubmit = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Логин'), 'vadim');
    await userEvent.type(screen.getByLabelText('Пароль'), 'длинный-пароль');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(screen.getByRole('button', { name: /Вхожу/ })).toBeDisabled();
    resolve();
  });
});
```

- [ ] **Шаг 2: Убедиться, что тесты падают**

```bash
cd web && pnpm test run src/features/auth
```

- [ ] **Шаг 3: Реализовать**

`web/src/features/auth/LoginForm/types.ts`:

```ts
/** Данные формы входа. */
export interface ILoginValues {
  login: string;
  password: string;
}

export interface IProps {
  /** Отправка формы. Отказ означает, что пара не подошла. */
  onSubmit: (values: ILoginValues) => Promise<void>;
}
```

`LoginForm.tsx` — клиентский компонент до 100 строк: два поля, кнопка,
состояния `isSubmitting` и `hasError`. Сообщение об ошибке одно на оба
случая: «Логин или пароль не подходят» — то же решение, что на сервере.

`web/src/features/auth/utils/requireUser.ts`:

```ts
import { redirect } from 'next/navigation';
import { createServerClient } from '@/api-client/serverClient';

/**
 * Проверяет сессию в серверном компоненте и отдаёт пользователя.
 * Без сессии уводит на вход — на сервере, до отрисовки: иначе защищённый
 * экран успел бы мигнуть.
 */
export async function requireUser() {
  const client = await createServerClient();
  const { data, error } = await client.GET('/auth/me');

  if (error || !data) redirect('/login');
  return data;
}
```

`web/src/app/providers.tsx` — провайдер TanStack Query:

```tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Данные дня меняются только от собственных действий: лишние
            // перезапросы при возврате в окно ни к чему.
            refetchOnWindowFocus: false,
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

- [ ] **Шаг 4: Прогнать тесты и закоммитить**

```bash
cd web && pnpm test run && pnpm typecheck
git add -A && git commit -m "Входить по логину и паролю"
```

### Задача 7.4: Выезжающая панель с черновиком

Это узел, от которого зависят все формы. В CAIRN панель версии собирает поля
в черновик и отправляет одной кнопкой — здесь то же, но как общий механизм с
первого дня, а не выведенный потом из трёх копий.

**Файлы:**
- Создать: `web/src/components/DraftDrawer/` (`index.ts`, `DraftDrawer.tsx`, `DraftDrawer.test.tsx`, `types.ts`)
- Создать: `web/src/components/DraftDrawer/utils/useDraft.ts`, `utils/index.ts`
- Тест: `web/src/components/DraftDrawer/utils/useDraft.test.ts`

- [ ] **Шаг 1: Написать падающий тест хука черновика**

`web/src/components/DraftDrawer/utils/useDraft.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDraft } from './useDraft';

interface IForm {
  title: string;
  weeklyTarget: number;
}

const initial: IForm = { title: 'Занятие', weeklyTarget: 3 };

describe('useDraft', () => {
  it('начинается без изменений', () => {
    const { result } = renderHook(() => useDraft(initial));

    expect(result.current.draft).toEqual(initial);
    expect(result.current.isDirty).toBe(false);
  });

  it('помечает черновик изменённым', () => {
    const { result } = renderHook(() => useDraft(initial));

    act(() => result.current.setField('title', 'Чтение'));

    expect(result.current.draft.title).toBe('Чтение');
    expect(result.current.isDirty).toBe(true);
  });

  it('возврат к исходному значению снимает отметку изменения', () => {
    const { result } = renderHook(() => useDraft(initial));

    act(() => result.current.setField('title', 'Чтение'));
    act(() => result.current.setField('title', 'Занятие'));

    expect(result.current.isDirty).toBe(false);
  });

  it('сброс возвращает исходное', () => {
    const { result } = renderHook(() => useDraft(initial));

    act(() => result.current.setField('weeklyTarget', 7));
    act(() => result.current.reset());

    expect(result.current.draft).toEqual(initial);
    expect(result.current.isDirty).toBe(false);
  });

  it('смена исходных данных подхватывается, пока черновик чист', () => {
    const { result, rerender } = renderHook(({ v }) => useDraft(v), {
      initialProps: { v: initial },
    });

    rerender({ v: { title: 'Другое', weeklyTarget: 5 } });

    expect(result.current.draft.title).toBe('Другое');
  });

  it('смена исходных данных не затирает начатую правку', () => {
    const { result, rerender } = renderHook(({ v }) => useDraft(v), {
      initialProps: { v: initial },
    });

    act(() => result.current.setField('title', 'Моя правка'));
    rerender({ v: { title: 'Пришло с сервера', weeklyTarget: 5 } });

    expect(result.current.draft.title).toBe('Моя правка');
  });
});
```

Последний случай — главный. Ответ сервера, пришедший во время набора текста,
не должен стирать набранное: это ровно то, за что ругают формы, живущие
прямо на данных запроса.

- [ ] **Шаг 2: Убедиться, что тесты падают**

- [ ] **Шаг 3: Реализовать хук**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

/** Состояние черновика формы. */
export interface IDraftState<T> {
  draft: T;
  isDirty: boolean;
  setField: <K extends keyof T>(key: K, value: T[K]) => void;
  setDraft: (value: T) => void;
  reset: () => void;
}

/**
 * Собирает поля формы в черновик, который уходит одной кнопкой «Сохранить».
 *
 * Пришедшие с сервера данные подхватываются только в чистый черновик:
 * начатую правку обновление затирать не должно, иначе набранный текст
 * исчезал бы от чужого перезапроса.
 */
export function useDraft<T extends object>(initial: T): IDraftState<T> {
  const [draft, setDraftState] = useState<T>(initial);
  const [isDirty, setIsDirty] = useState(false);
  const baseline = useRef(initial);

  useEffect(() => {
    if (isDirty) return;
    baseline.current = initial;
    setDraftState(initial);
  }, [initial, isDirty]);

  const recompute = useCallback((next: T) => {
    setDraftState(next);
    setIsDirty(!shallowEqual(next, baseline.current));
  }, []);

  const setField = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      recompute({ ...draft, [key]: value });
    },
    [draft, recompute],
  );

  const reset = useCallback(() => {
    setDraftState(baseline.current);
    setIsDirty(false);
  }, []);

  return { draft, isDirty, setField, setDraft: recompute, reset };
}

function shallowEqual<T extends object>(a: T, b: T): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key as keyof T] !== b[key as keyof T]) return false;
  }
  return true;
}
```

- [ ] **Шаг 4: Написать тест и реализацию панели**

`DraftDrawer.test.tsx` — обязательные случаи:

```tsx
it('показывает кнопку «Сохранить» в прилипшей шапке')
it('блокирует «Сохранить», пока нет изменений')
it('спрашивает подтверждение при закрытии с несохранёнными изменениями')
it('закрывается без вопросов, когда изменений нет')
it('закрывается после удачного сохранения')
it('оставляет панель открытой, если сохранение не удалось')
```

`types.ts`:

```ts
import type { ReactNode } from 'react';

export interface IProps {
  /** Открыта ли панель. */
  isOpen: boolean;
  /** Заголовок панели. */
  title: string;
  /** Есть ли несохранённые изменения: от этого зависят кнопка и вопрос при закрытии. */
  isDirty: boolean;
  /** Сохранение. Отказ оставляет панель открытой. */
  onSave: () => Promise<void>;
  /** Закрытие панели. */
  onClose: () => void;
  children: ReactNode;
}
```

`DraftDrawer.tsx` — обёртка над `Sheet` из shadcn: прилипшая шапка с
заголовком и кнопкой, тело с полями, подтверждение закрытия при `isDirty`.
Держись в пределах 100 строк; подтверждение вынеси в отдельный компонент
`ConfirmClose`.

- [ ] **Шаг 5: Прогнать тесты и закоммитить**

```bash
cd web && pnpm test run && pnpm typecheck
git add -A && git commit -m "Завести выезжающую панель с черновиком"
```

---

## Chunk 8: Экран дня

Итог чанка: главная открывается на сегодня, трекеры отмечаются, сон и планы
пишутся, прогресс навыков виден, по датам можно ходить.

### Задача 8.1: Серверная загрузка и гидратация

**Файлы:**
- Создать: `web/src/app/page.tsx`
- Создать: `web/src/features/day/DayScreen/` (`index.ts`, `DayScreen.tsx`, `DayScreen.test.tsx`, `types.ts`)
- Создать: `web/src/features/day/hooks/useQueryDay.ts`, `hooks/index.ts`

- [ ] **Шаг 1: Реализовать серверную страницу**

`web/src/app/page.tsx`:

```tsx
import { requireUser } from '@/features/auth/utils';
import { createServerClient } from '@/api-client/serverClient';
import { DayScreen } from '@/features/day/DayScreen';

/**
 * Главная — страница сегодняшнего дня.
 *
 * Данные берутся на сервере и передаются экрану начальными: первая отрисовка
 * приходит заполненной, без индикатора загрузки. Дальше экран живёт на
 * TanStack Query — он единственный источник правды, и в состояние компонента
 * эти данные не копируются.
 *
 * Дата по умолчанию не считается здесь: «сегодня» определяет сервер API по
 * своей зоне, и второе место, где это решается, разошлось бы с первым.
 */
export default async function DayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireUser();

  const { date } = await searchParams;
  const client = await createServerClient();
  const { data } = await client.GET('/day', {
    params: { query: date ? { date } : {} },
  });

  return <DayScreen initialDay={data} date={date} />;
}
```

- [ ] **Шаг 2: Написать хук запроса**

```ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api-client';
import type { components } from '@/api-client/schema';

type DayResponse = components['schemas']['DayResponse'];

/** Ключ запроса дня. Дата входит в ключ: дни кэшируются поотдельности. */
export function dayQueryKey(date?: string) {
  return ['day', date ?? 'today'] as const;
}

/** Данные страницы дня одним запросом. */
export function useQueryDay(date?: string, initialData?: DayResponse) {
  return useQuery({
    queryKey: dayQueryKey(date),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/day', {
        params: { query: date ? { date } : {} },
      });
      if (error) throw error;
      return data;
    },
    initialData,
  });
}
```

- [ ] **Шаг 3: Написать тест экрана и реализовать**

`DayScreen.test.tsx` — собирает экран с готовыми данными и проверяет, что
видны все блоки. Экран — композиция, своей логики у него нет, поэтому тест
короткий:

```tsx
it('показывает шапку периода, трекеры, планы, сон и навыки')
it('не показывает блок сна, когда он выключен в настройках')
```

`DayScreen.tsx` — строго композиция: `PeriodHeader`, `TrackerList`,
`DayPlanList`, `SleepBlock`, `SkillProgressList`, `DateNavigator`. Не более
100 строк, никакой логики — она в дочерних компонентах и хуках.

- [ ] **Шаг 4: Коммит**

```bash
cd web && pnpm test run && pnpm typecheck
git add -A && git commit -m "Открывать страницу дня с серверными данными"
```

### Задача 8.2: Шапка периода и навигация по датам

**Файлы:**
- Создать: `web/src/features/day/PeriodHeader/` (четыре файла)
- Создать: `web/src/features/day/DateNavigator/` (четыре файла)
- Создать: `web/src/features/day/utils/formatRussianDate.ts`, `utils/index.ts`
- Тест: `web/src/features/day/utils/formatRussianDate.test.ts`

- [ ] **Шаг 1: Написать падающий тест форматирования**

```ts
import { describe, expect, it } from 'vitest';
import { formatRussianDate, formatDaysLeft } from './formatRussianDate';

describe('formatRussianDate', () => {
  it('пишет дату по-русски', () => {
    expect(formatRussianDate('2026-10-23')).toBe('23 октября, пятница');
  });

  it('называет сегодня сегодняшним днём', () => {
    expect(formatRussianDate('2026-10-23', '2026-10-23')).toBe('Сегодня, 23 октября');
  });

  it('называет вчера вчерашним', () => {
    expect(formatRussianDate('2026-10-22', '2026-10-23')).toBe('Вчера, 22 октября');
  });
});

describe('formatDaysLeft', () => {
  it('согласует слово «день» с числом', () => {
    expect(formatDaysLeft(1)).toBe('остался 1 день');
    expect(formatDaysLeft(2)).toBe('осталось 2 дня');
    expect(formatDaysLeft(5)).toBe('осталось 5 дней');
    expect(formatDaysLeft(11)).toBe('осталось 11 дней');
    expect(formatDaysLeft(21)).toBe('остался 21 день');
    expect(formatDaysLeft(0)).toBe('период завершён');
  });
});
```

Склонение числительных — ровно то место, где форматирование чисел «по
локали» не спасает, а неверная форма бросается в глаза каждый день.

- [ ] **Шаг 2: Реализовать**

```ts
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда',
  'четверг', 'пятница', 'суббота'] as const;

const MONTHS_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая',
  'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'] as const;

/**
 * Склоняет слово «день» по числу. Правило русского языка: 1, 21, 31 — «день»;
 * 2–4, 22–24 — «дня»; остальное, включая 11–14, — «дней».
 */
export function formatDaysLeft(days: number): string {
  if (days <= 0) return 'период завершён';

  const lastTwo = days % 100;
  const last = days % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return `осталось ${days} дней`;
  if (last === 1) return `остался ${days} день`;
  if (last >= 2 && last <= 4) return `осталось ${days} дня`;
  return `осталось ${days} дней`;
}
```

`formatRussianDate` — разбор `YYYY-MM-DD` вручную, без `new Date(string)`:
разбор строки конструктором даёт полночь UTC и в зоне `+03` съезжает на день
назад. Это классическая ошибка, и тест на «сегодня» её поймает.

```ts
/** Разбирает `YYYY-MM-DD` в числа без часового пояса. */
function parseISODate(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
}
```

- [ ] **Шаг 3: Реализовать компоненты**

`PeriodHeader` — заголовок периода, «День 23 из 100», `formatDaysLeft`, полоса
`Progress`. Пропсы: `period` из ответа дня.

`DateNavigator` — стрелки и `Calendar` в `Popover`. Переход меняет параметр
`date` в адресе через `useRouter`, а не состояние: адрес дня должен
открываться ссылкой и переживать перезагрузку.

Кнопка «вперёд» выключена на сегодняшнем дне: будущую дату сервер отвергает,
и давать по ней ходить незачем.

- [ ] **Шаг 4: Прогнать тесты и закоммитить**

```bash
cd web && pnpm test run && pnpm typecheck
git add -A && git commit -m "Показывать период и ходить по датам"
```

### Задача 8.3: Трекеры на странице дня

**Файлы:**
- Создать: `web/src/features/day/TrackerList/` (четыре файла)
- Создать: `web/src/features/day/TrackerRow/` (четыре файла)
- Создать: `web/src/features/day/hooks/useMutationEntry.ts`

- [ ] **Шаг 1: Написать падающий тест строки трекера**

```tsx
it('показывает галочку без поля часов у трекера без часов')
it('показывает поле часов у трекера с часами')
it('отмечает выполнение по нажатию на галочку')
it('снимает отметку повторным нажатием')
it('не отправляет отметку «за час» без введённых часов')
it('показывает недельный счёт «2 из 3»')
it('у выполненного трекера показывает начисленные поинты')
it('возвращает галочку в исходное состояние, если запрос не удался')
```

Последний случай важен: отметка ставится оптимистично, и откат должен быть
проверен, иначе при обрыве сети экран покажет сделанным то, чего нет.

- [ ] **Шаг 2: Реализовать мутацию с оптимистичным обновлением**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api-client';
import { dayQueryKey } from './useQueryDay';

/**
 * Ставит или снимает отметку выполнения.
 *
 * Обновление оптимистичное: галочка — одно нажатие, и ждать ответа сервера,
 * чтобы она закрасилась, значит сделать экран вязким. При отказе кэш
 * возвращается к снимку, снятому до запроса.
 */
export function useMutationEntry(date: string | undefined) {
  const queryClient = useQueryClient();
  const key = dayQueryKey(date);

  return useMutation({
    mutationFn: async (input: { trackerId: number; hours: number | null; done: boolean }) => {
      const path = `/trackers/{id}/entries/{date}` as const;
      const params = { path: { id: input.trackerId, date: date ?? today() } };

      const { error } = input.done
        ? await apiClient.PUT(path, { params, body: { hours: input.hours } })
        : await apiClient.DELETE(path, { params });

      if (error) throw error;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const snapshot = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (prev) => applyEntryLocally(prev, input));
      return { snapshot };
    },
    onError: (_error, _input, context) => {
      // Возврат к снимку: иначе экран остался бы показывать сделанным то,
      // чего на сервере нет.
      if (context?.snapshot) queryClient.setQueryData(key, context.snapshot);
    },
    onSettled: () => {
      // Поинты и недельный счёт считает сервер — после записи данные
      // перечитываются, а не досчитываются на месте.
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
```

`applyEntryLocally` вынеси в `utils/` и покрой unit-тестом: это чистая
функция над ответом дня.

- [ ] **Шаг 3: Реализовать компоненты**

`TrackerRow` — галочка, название, поле часов (у `check_hours`), подпись «2 из
3 на этой неделе», поинты у выполненного. Поле часов с debounce 300 мс, чтобы
набор «1.5» не отправлял три запроса.

`TrackerList` — список, пустое состояние со ссылкой на `/trackers`.

- [ ] **Шаг 4: Прогнать тесты и закоммитить**

```bash
cd web && pnpm test run && pnpm typecheck
git add -A && git commit -m "Отмечать выполнение трекеров на странице дня"
```

### Задача 8.4: Планы на день

**Файлы:**
- Создать: `web/src/features/day/DayPlanList/` (четыре файла)
- Создать: `web/src/features/day/DayPlanItem/` (четыре файла)
- Создать: `web/src/features/day/hooks/useMutationDayPlan.ts`

- [ ] **Шаг 1: Написать падающий тест**

```tsx
it('добавляет пункт по нажатию Enter в поле ввода')
it('не добавляет пустой пункт')
it('закрывает пункт галочкой')
it('открывает закрытый пункт повторным нажатием')
it('показывает кнопку переноса, когда со вчера есть незакрытые')
it('скрывает кнопку переноса, когда переносить нечего')
it('правка текста идёт в выезжающей панели, а не прямо в списке')
it('показывает, что пункт перенесён со вчера')
```

- [ ] **Шаг 2: Реализовать**

Добавление и закрытие — прямо в списке, одним нажатием. Правка текста и
удаление — в `DraftDrawer`: это уже не одно нажатие, и правило дизайна здесь
применяется.

Перенесённый пункт помечается подписью «со вчера» — поле `carriedFromId`
именно для этого и есть.

- [ ] **Шаг 3: Прогнать тесты и закоммитить**

```bash
cd web && pnpm test run && pnpm typecheck
git add -A && git commit -m "Вести планы на день и переносить со вчера"
```

### Задача 8.5: Сон и прогресс навыков

**Файлы:**
- Создать: `web/src/features/day/SleepBlock/` (четыре файла)
- Создать: `web/src/features/day/SkillProgressList/` (четыре файла)
- Создать: `web/src/features/day/hooks/useMutationSleep.ts`

- [ ] **Шаг 1: Написать падающий тест блока сна**

```tsx
it('показывает поля «лёг», «встал» и оценку качества')
it('показывает длительность, посчитанную сервером')
it('не показывает длительность, когда заполнено только одно время')
it('сохраняет по уходу фокуса, а не по каждой набранной цифре')
it('не отображается, когда сон выключен в настройках')
```

Поля времени — `<input type="time">`: собственный ввод времени пришлось бы
проверять и объяснять, а браузерный уже умеет и то и другое, включая
клавиатуру и мобильную раскладку.

- [ ] **Шаг 2: Реализовать**

`SleepBlock` — три поля и подпись длительности. Длительность берётся из
ответа сервера (`durationMinutes`), а не считается на клиенте: правило
перехода через полночь должно жить в одном месте.

`SkillProgressList` — полосы «забрано N из M» по данным `skills` ответа дня.
Ссылка на `/dashboard` за подробностями.

- [ ] **Шаг 3: Прогнать тесты, проверить вживую, закоммитить**

```bash
cd web && pnpm test run && pnpm typecheck
# в одном терминале API, в другом веб:
cd ../api && go run ./cmd/api
cd ../web && pnpm dev
# открыть http://localhost:3000, войти, заполнить день
git add -A && git commit -m "Записывать сон и показывать прогресс навыков"
```

---

## Chunk 9: Реестры трекеров, навыков и настроек

Итог чанка: `/trackers` ведёт трекеры и навыки, `/settings` правит период и
тумблер сна. Все формы — в `DraftDrawer`.

### Задача 9.1: Экран трекеров

**Файлы:**
- Создать: `web/src/app/trackers/page.tsx`
- Создать: `web/src/features/trackers/TrackerTable/` (четыре файла)
- Создать: `web/src/features/trackers/TrackerDrawer/` (четыре файла)
- Создать: `web/src/features/trackers/hooks/` (`useQueryTrackers.ts`, `useMutationTracker.ts`, `index.ts`)

- [ ] **Шаг 1: Написать падающий тест панели трекера**

```tsx
it('собирает поля в черновик и отправляет одной кнопкой')
it('блокирует «Сохранить», пока ничего не изменено')
it('скрывает выбор правила «за час» у режима без часов')
it('сбрасывает правило на «за чек» при смене режима на «без часов»')
it('показывает понятное сообщение при ответе 409 rule_needs_hours')
it('спрашивает подтверждение при закрытии с несохранёнными изменениями')
it('позволяет не привязывать навык')
it('предлагает только свои навыки')
```

Случай со сбросом правила — тот самый инвариант, увиденный со стороны
интерфейса: форма не должна давать собрать заведомо отвергаемое сочетание.
Но проверку на сервере это не отменяет — она последняя линия.

- [ ] **Шаг 2: Реализовать**

`TrackerDrawer` на `DraftDrawer` и `useDraft`. Поля: название, режим
(переключатель), правило, цена, навык (общий `Select`), недельная цель.

Удаление трекера спрашивает подтверждение и говорит, сколько отметок
унесёт — число приходит с сервера. Это решение из CAIRN: удаление, молча
уносящее историю, однажды окажется неприятной неожиданностью.

Для этого добавь в спецификацию `GET /trackers/{id}/entry-count` или отдай
число в `Tracker` полем `entryCount` — второе проще и не плодит ручку.
Дополни задачу 4.2: поле считается запросом `count(*)` при выдаче списка.

- [ ] **Шаг 3: Прогнать тесты и закоммитить**

```bash
cd web && pnpm test run && pnpm typecheck
git add -A && git commit -m "Вести трекеры в выезжающей панели"
```

### Задача 9.2: Навыки и настройки

**Файлы:**
- Создать: `web/src/features/trackers/SkillDrawer/` (четыре файла)
- Создать: `web/src/features/trackers/SkillList/` (четыре файла)
- Создать: `web/src/app/settings/page.tsx`
- Создать: `web/src/features/settings/SettingsDrawer/` (четыре файла)

- [ ] **Шаг 1: Написать падающие тесты**

```tsx
// SkillDrawer
it('требует положительную цель в поинтах')
it('показывает, какие трекеры питают навык')
it('предупреждает при удалении, что трекеры потеряют навык, а поинты останутся')

// SettingsDrawer
it('правит заголовок, дату начала и длительность периода')
it('показывает, какой датой кончится период при выбранной длительности')
it('переключает тумблер сна')
it('предупреждает, что смена даты начала сдвинет номер дня')
```

Подсказка о дате окончания нужна потому, что «100 дней от 23 октября» —
не та информация, которую человек держит в голове.

- [ ] **Шаг 2: Реализовать**

Экран настроек — паспорт периода и тумблер сна, правка в панели. Смена пароля
в этом чанке не делается: её нет в спецификации API. Если нужна — добавь
ручку `PUT /auth/password` отдельной задачей, с проверкой текущего пароля.

- [ ] **Шаг 3: Прогнать тесты и закоммитить**

```bash
cd web && pnpm test run && pnpm typecheck
git add -A && git commit -m "Вести навыки и настройки периода"
```

---

## Chunk 10: Дашборд

Итог чанка: `/dashboard` показывает все шесть видов графиков за выбранный
отрезок.

**Перед началом чанка обязательно вызови skill `dataviz`** — он задаёт
палитру, правила осей, подписей и поведения в тёмной теме. Без него графики
получатся шестью разными стилями в одном экране.

### Задача 10.1: Отрезок и каркас дашборда

**Файлы:**
- Создать: `web/src/app/dashboard/page.tsx`
- Создать: `web/src/features/dashboard/RangePicker/` (четыре файла)
- Создать: `web/src/features/dashboard/hooks/useQueryStats.ts`, `hooks/index.ts`
- Создать: `web/src/features/dashboard/constants.ts`
- Тест: `web/src/features/dashboard/utils/resolveRange.test.ts`

- [ ] **Шаг 1: Написать падающий тест разрешения отрезка**

```ts
import { describe, expect, it } from 'vitest';
import { resolveRange } from './resolveRange';
import { RangePreset } from '../constants';

describe('resolveRange', () => {
  const today = '2026-10-23';
  const period = { start: '2026-10-01', days: 100 };

  it('тридцать дней считает назад от сегодня включительно', () => {
    expect(resolveRange(RangePreset.Days30, today, period)).toEqual({
      from: '2026-09-24',
      to: '2026-10-23',
    });
  });

  it('весь период берёт от его начала до сегодня', () => {
    expect(resolveRange(RangePreset.Period, today, period)).toEqual({
      from: '2026-10-01',
      to: '2026-10-23',
    });
  });

  it('не уводит конец отрезка в будущее', () => {
    // Период кончается 8 января 2027-го, но данных за будущее нет.
    const range = resolveRange(RangePreset.Period, today, period);
    expect(range.to).toBe(today);
  });

  it('всё время начинает с начала периода, если данных раньше нет', () => {
    expect(resolveRange(RangePreset.All, today, period).from).toBe('2026-10-01');
  });
});
```

- [ ] **Шаг 2: Реализовать**

`constants.ts` — набор пресетов перечислением, а не союзом строк: значение
используется в разметке, в адресе и в тесте.

```ts
/** Пресеты отрезка для дашборда. */
export enum RangePreset {
  Days30 = '30d',
  Days90 = '90d',
  Period = 'period',
  All = 'all',
}

/** Подписи кнопок переключателя отрезка. */
export const RANGE_LABELS: Record<RangePreset, string> = {
  [RangePreset.Days30]: '30 дней',
  [RangePreset.Days90]: '90 дней',
  [RangePreset.Period]: 'Весь период',
  [RangePreset.All]: 'Всё время',
};
```

Выбранный отрезок живёт в адресе (`?range=90d`), а не в состоянии: ссылкой на
дашборд за три месяца должно быть можно поделиться и вернуться к нему.

- [ ] **Шаг 3: Прогнать тесты и закоммитить**

```bash
cd web && pnpm test run src/features/dashboard && pnpm typecheck
git add -A && git commit -m "Выбирать отрезок на дашборде"
```

### Задача 10.2: Теплокарта-календарь

**Файлы:**
- Создать: `web/src/features/dashboard/TrackerHeatmap/` (четыре файла)
- Создать: `web/src/features/dashboard/TrackerHeatmap/utils/buildWeeks.ts`, `utils/index.ts`
- Тест: `web/src/features/dashboard/TrackerHeatmap/utils/buildWeeks.test.ts`

Recharts теплокарты не даёт — сетка рисуется своим SVG. Это и к лучшему:
календарная сетка — не график, а раскладка.

- [ ] **Шаг 1: Написать падающий тест раскладки**

```ts
import { describe, expect, it } from 'vitest';
import { buildWeeks } from './buildWeeks';

describe('buildWeeks', () => {
  it('раскладывает дни по столбцам-неделям, начиная с понедельника', () => {
    // 19 октября 2026 — понедельник, 25-е — воскресенье.
    const days = [
      { date: '2026-10-19', done: true, points: 1, hours: null },
      { date: '2026-10-20', done: false, points: 0, hours: null },
      { date: '2026-10-25', done: true, points: 1, hours: null },
    ];

    const weeks = buildWeeks(days);

    expect(weeks).toHaveLength(1);
    expect(weeks[0][0]?.date).toBe('2026-10-19');
    expect(weeks[0][6]?.date).toBe('2026-10-25');
  });

  it('добивает первую неделю пустыми клетками, если отрезок начался в середине', () => {
    // 21 октября — среда: две клетки до неё должны быть пустыми, иначе
    // сетка съедет и дни встанут под чужими днями недели.
    const days = [{ date: '2026-10-21', done: true, points: 1, hours: null }];

    const weeks = buildWeeks(days);

    expect(weeks[0][0]).toBeNull();
    expect(weeks[0][1]).toBeNull();
    expect(weeks[0][2]?.date).toBe('2026-10-21');
  });

  it('разбивает длинный отрезок на несколько недель', () => {
    const days = Array.from({ length: 21 }, (_, i) => ({
      date: `2026-10-${String(5 + i).padStart(2, '0')}`,
      done: i % 2 === 0,
      points: 0,
      hours: null,
    }));

    expect(buildWeeks(days)).toHaveLength(3);
  });
});
```

Случай со сдвигом первой недели — главный: без пустых клеток в начале вся
сетка встаёт под чужими днями недели, и теплокарта начинает врать молча.

- [ ] **Шаг 2: Реализовать раскладку и компонент**

`buildWeeks` возвращает `(IDayCell | null)[][]` — столбцы по неделям, строки
по дням недели от понедельника.

`TrackerHeatmap.tsx` — SVG-сетка: клетка 12×12 с зазором 3, цвет по
насыщенности из палитры `dataviz`, подпись месяцев сверху, дни недели слева.
У каждой клетки `<title>` с датой и результатом: подсказка без своего
обработчика и доступная с клавиатуры.

Дни, которые по недельной цели и не предполагались, не красятся провалом —
цель недельная, и ровный серый квадрат в субботу не ошибка.

- [ ] **Шаг 3: Написать тест компонента**

```tsx
it('рисует клетку на каждый день отрезка')
it('подписывает клетку датой и результатом')
it('закрашивает выполненные дни насыщеннее пустых')
it('переносит сетку в горизонтальную прокрутку на узком экране')
```

- [ ] **Шаг 4: Прогнать тесты и закоммитить**

```bash
cd web && pnpm test run && pnpm typecheck
git add -A && git commit -m "Рисовать теплокарту дней трекера"
```

### Задача 10.3: Остальные графики

**Файлы:**
- Создать: `web/src/features/dashboard/SkillProgressChart/` (четыре файла)
- Создать: `web/src/features/dashboard/HoursChart/` (четыре файла)
- Создать: `web/src/features/dashboard/StreakTiles/` (четыре файла)
- Создать: `web/src/features/dashboard/SleepChart/` (четыре файла)
- Создать: `web/src/features/dashboard/PlansTile/` (четыре файла)

Каждый — отдельная задача с тестом и коммитом. Порядок свободный.

- [ ] **Шаг 1: Прогресс навыков**

Горизонтальные полосы к цели плюс метка прогноза. Тесты:

```tsx
it('показывает забранные поинты и цель')
it('подписывает прогноз: «при текущем темпе — 240 из 300»')
it('помечает навык, который по прогнозу не успевает')
it('не делит на ноль у навыка с нулевым прогрессом')
```

- [ ] **Шаг 2: Часы по дням и неделям**

Накопительные столбики Recharts с разбивкой по трекерам, переключатель
гранулярности. Тесты:

```tsx
it('суммирует часы по дням')
it('переключается на недели')
it('показывает только трекеры с часами')
it('показывает пустое состояние, когда часов ни у кого нет')
```

Группировка по неделям — чистая функция в `utils/`, со своим тестом.

- [ ] **Шаг 3: Плитки серий**

Текущая и лучшая серия, процент выполнения, спарклайн. Тесты:

```tsx
it('показывает текущую и лучшую серию')
it('показывает процент выполнения')
it('не называет перевыполнение провалом: больше ста процентов — это норма')
it('согласует слово «неделя» с числом')
```

Склонение «недели» — то же правило, что у «дня»: переиспользуй хелпер из
`features/day/utils`, а не пиши второй. Если он там слишком локальный —
перенеси в `src/lib/plural.ts` вместе с его тестами.

- [ ] **Шаг 4: График сна**

Две линии (лёг и встал) по общей оси времени, полоса длительности, качество
точками. Тесты:

```tsx
it('рисует линии отхода и подъёма')
it('не рвёт линию на днях без данных, а размыкает её')
it('показывает длительность сна отдельным рядом')
it('скрывается, когда сон выключен')
it('кладёт ночное время на осмысленную ось: 23:40 выше 01:00, а не ниже')
```

Последний случай — суть графика. Ось времени суток для отхода ко сну надо
сдвинуть: на обычной оси 23:40 и 00:10 оказываются на противоположных концах,
хотя это полчаса разницы. Решение — считать ось от полудня: часы после
полудня остаются как есть, часы до полудня получают плюс 24. Вынеси это в
функцию `toSleepAxis` с отдельным тестом.

- [ ] **Шаг 5: Плитка планов**

Доля закрытых планов за отрезок. Тесты:

```tsx
it('показывает закрытые и всего')
it('показывает долю в процентах')
it('показывает пустое состояние, когда планов за отрезок не было')
```

- [ ] **Шаг 6: Собрать дашборд, прогнать всё, закоммитить**

```bash
cd web && pnpm test run && pnpm typecheck && pnpm build
git add -A && git commit -m "Показывать статистику графиками"
```

---

## Chunk 11: Развёртывание

Итог чанка: стек собирается и поднимается на сервере одной командой, база
копируется до миграций, есть откат, README описывает всё это.

### Задача 11.1: Образ веб-приложения

**Файлы:**
- Создать: `web/Dockerfile`
- Изменить: `web/next.config.ts` (вывод `standalone`)

- [ ] **Шаг 1: Включить отдельный вывод**

В `next.config.ts` добавить `output: 'standalone'` — иначе в образ придётся
кладти весь `node_modules`.

- [ ] **Шаг 2: Написать Dockerfile**

```dockerfile
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY web/ ./
# Спецификация нужна сборке: из неё порождены типы клиента.
COPY openapi/ ../openapi/
RUN pnpm build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
# Отдельный вывод Next: только нужные файлы, без всего node_modules.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```

Добавь в `docker-compose.yml` проверку живости веба:

```yaml
    healthcheck:
      test: ['CMD', 'node', '-e', "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 5s
      retries: 6
      start_period: 20s
```

Адрес проверки — `/login`, а не `/`: главная уводит на вход редиректом, и
проверка по ней зависела бы от того, как `fetch` обходится с перенаправлением.

- [ ] **Шаг 3: Собрать и проверить**

```bash
cd ~/"Рабочий стол"/MyMVP/hundred-days
docker compose build web
docker compose up -d
curl -s -o /dev/null -w '%{http_code}\n' localhost:8080/login   # 200
```

- [ ] **Шаг 4: Коммит**

```bash
git add -A && git commit -m "Собрать образ веб-приложения"
```

### Задача 11.2: Скрипты развёртывания

**Файлы:**
- Создать: `scripts/lib.sh`, `scripts/preflight.sh`, `scripts/deploy.sh`
- Создать: `scripts/backup.sh`, `scripts/restore.sh`, `scripts/rollback.sh`

Скрипты повторяют логику CAIRN, но короче: там же стоит образец, и
подсматривать в него правильно — `~/Рабочий стол/MyMVP/CAIRNProject/scripts/`.

- [ ] **Шаг 1: Написать проверки перед развёртыванием**

`scripts/preflight.sh` проверяет: `.env` существует, в нём заданы
`HD_POSTGRES_PASSWORD` и `HD_APP_PASSWORD`, порт `HD_HTTP_PORT` не занят
другим процессом, на диске есть место под копию базы.

Порт — главная проверка: он единственное, чем новый стек может столкнуться с
CAIRN, и столкнуться должен на проверке, а не на запуске.

```bash
# Порт занят кем-то посторонним? Прокси CAIRN держит 80 и 443, и наш порт
# должен быть свободен — иначе запуск упадёт уже после остановки приложений.
check_port_free() {
  local port="$1"
  if ss -ltn "sport = :$port" | grep -q LISTEN; then
    # Свой же контейнер занимать порт может: это обычное повторное
    # развёртывание.
    if ! docker compose ps --format json 2>/dev/null | grep -q '"Publishers"'; then
      fail "порт $port занят посторонним процессом"
    fi
  fi
}
```

- [ ] **Шаг 2: Написать развёртывание**

`scripts/deploy.sh`, порядок шагов как в CAIRN и он не случаен:

1. `preflight_run` — проверки;
2. `backup.sh` — копия базы (пропускается ключом `--skip-backup`);
3. сборка образов, пометка предыдущих как `:previous` для отката;
4. остановка `api` и `web`;
5. миграции `goose up` владельцем схемы;
6. запуск.

Миграции идут при остановленных приложениях: иначе старый код какое-то время
работает с новой схемой. Несколько секунд недоступности дешевле запросов,
падающих на изменившихся таблицах.

- [ ] **Шаг 3: Проверить на локальной машине**

```bash
cd ~/"Рабочий стол"/MyMVP/hundred-days
bash scripts/preflight.sh
bash scripts/backup.sh
bash scripts/deploy.sh
```

Затем нарочно сломай: впиши в `.env` занятый порт и убедись, что
`preflight.sh` останавливает развёртывание до остановки приложений.

- [ ] **Шаг 4: Коммит**

```bash
git add scripts/ && git commit -m "Развёртывать и откатывать скриптами"
```

### Задача 11.3: README

**Файлы:**
- Создать: `README.md`

- [ ] **Шаг 1: Написать**

Разделы: что это, требования, первый запуск локально (включая `create-user`),
команды проверок (`go test ./...`, `pnpm test`, `pnpm typecheck`,
`pnpm build`), перегенерация контракта, развёртывание на сервере, копия и
восстановление базы, переменные окружения таблицей, устройство портов и чем
он не пересекается с CAIRN.

Отдельным абзацем — **как добраться**: на старте `http://IP:8080` без TLS, и
пароль идёт открытым текстом. Это должно быть написано там, где читают, а не
только в спецификации.

- [ ] **Шаг 2: Коммит**

```bash
git add README.md && git commit -m "Описать разработку и развёртывание"
```

### Задача 11.4: Запуск на сервере

- [ ] **Шаг 1: Создать репозиторий на GitHub**

На этой машине **нет ни `gh`, ни сохранённого доступа на запись в GitHub**
(ни `~/.git-credentials`, ни `~/.config/gh`, ни переменных окружения), а
`sudo` просит пароль. Поэтому шаг выполняет человек:

```bash
sudo apt install gh
gh auth login
```

После этого:

```bash
cd ~/"Рабочий стол"/MyMVP/hundred-days
gh repo create Qstimo/hundred-days --private --source=. --remote=origin
git push -u origin main
```

- [ ] **Шаг 2: Развернуть**

На сервере: клонировать репозиторий в отдельный каталог (не рядом с CAIRN в
одной папке — отдельный каталог верхнего уровня), создать `.env`, выполнить
`scripts/deploy.sh`, создать аккаунт командой `/cli create-user`.

- [ ] **Шаг 3: Проверить**

Открыть `http://IP:8080`, войти, заполнить сегодняшний день, посмотреть
дашборд. Перезапустить стек и убедиться, что данные на месте.

- [ ] **Шаг 4: Проверить, что CAIRN не задет**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://ДОМЕН_CAIRN/
docker compose -p cairn ps      # в каталоге CAIRN
```

Ожидается: CAIRN работает как раньше. Это обязательный шаг: два стека на одной
машине — ровно то место, где «ничего не трогали» проверяется, а не
предполагается.

---

## Chunk 12: Поддомен и HTTPS

Итог чанка: приложение открывается по поддомену с сертификатом, порт 8080
больше не нужен снаружи.

Это **последняя** задача и единственная, которая правит файлы CAIRN. До неё
пароль идёт по открытому каналу — не затягивай.

### Задача 12.1: Блок поддомена в прокси CAIRN

**Файлы:**
- Изменить: `~/Рабочий стол/MyMVP/CAIRNProject/docker/caddy/Caddyfile`
- Изменить: `docker-compose.yml` этого проекта (слушать только localhost)

- [ ] **Шаг 1: Завести DNS-запись**

Запись `A` для поддомена на IP сервера, у того же провайдера, где домен
CAIRN. Дождаться распространения: `dig +short ПОДДОМЕН`.

- [ ] **Шаг 2: Закрыть порт от интернета**

В `docker-compose.yml` этого проекта привязать публикацию к localhost:

```yaml
    ports:
      # Только на петлю: снаружи приложение доступно через прокси CAIRN,
      # и открытый порт был бы вторым входом в обход TLS.
      - '127.0.0.1:${HD_HTTP_PORT:-8080}:80'
```

- [ ] **Шаг 3: Добавить блок в Caddyfile CAIRN**

```caddyfile
# «100 дней до» — отдельное приложение на своём стеке. Здесь только
# маршрутизация: прокси CAIRN держит 80 и 443, и получить сертификат на
# поддомен может лишь он.
ПОДДОМЕН {
	reverse_proxy host.docker.internal:8080
}
```

Проверь, разрешает ли `host.docker.internal` на этой машине: на Linux он
требует `extra_hosts: ['host.docker.internal:host-gateway']` у службы `proxy`
в compose CAIRN. Если нет — используй адрес шлюза docker-сети или подключи
контейнер `proxy` CAIRN к сети этого проекта через `external` network. Выбери
первое: одна строка в compose понятнее общей сети между проектами.

- [ ] **Шаг 4: Включить Secure у cookie**

В `.env` этого проекта: `HD_SECURE_COOKIE=true`. Без этого cookie сессии
ходила бы и по HTTP — а теперь в этом нет нужды.

- [ ] **Шаг 5: Применить и проверить**

```bash
# в каталоге CAIRN
docker compose up -d proxy
# в каталоге hundred-days
docker compose up -d
curl -s -o /dev/null -w '%{http_code}\n' https://ПОДДОМЕН/login   # 200
curl -s -o /dev/null -w '%{http_code}\n' https://ДОМЕН_CAIRN/      # не сломался
```

Проверь, что порт 8080 снаружи больше не отвечает:
`curl --max-time 5 http://IP:8080/` с другой машины — должно не соединиться.

- [ ] **Шаг 6: Коммит в двух репозиториях**

```bash
cd ~/"Рабочий стол"/MyMVP/hundred-days
git add -A && git commit -m "Открывать приложение по поддомену с HTTPS"

cd ~/"Рабочий стол"/MyMVP/CAIRNProject
git add docker/caddy/Caddyfile docker-compose.yml
git commit -m "Проксировать поддомен приложения «100 дней до»"
```

---

## Проверка перед завершением

- [ ] `cd api && go test ./... -race -count=1` — зелено
- [ ] `cd web && pnpm test run && pnpm typecheck && pnpm build` — зелено
- [ ] `./tools.sh sqlc generate && ./tools.sh oapi-codegen ... && git diff --exit-code` — различий нет
- [ ] CI на GitHub зелёный
- [ ] Покрытие `internal/domain` не ниже 95%
- [ ] Страж `queries_guard_test.go` проходит и ловит нарочно сломанный запрос
- [ ] Приложение открывается по поддомену с сертификатом
- [ ] CAIRN работает как до всего этого
- [ ] Копия базы снимается и восстанавливается
- [ ] Каждое утро экран дня открывается на сегодня сам, без выбора даты

## Что в план не вошло и почему

- **Смена пароля в интерфейсе.** В спецификации API её нет; пока пароль
  меняется командой `set-password` на сервере. Нужна — отдельная задача с
  проверкой текущего пароля.
- **Напоминания.** Приложение не пишет первым — решение дизайна.
- **Второй пользователь.** Схема к нему готова (`user_id` везде), экраны —
  нет. Это осознанный долг, а не недосмотр.
- **Перенос планов автоматически.** Отвергнуто: размывает историю дня.
