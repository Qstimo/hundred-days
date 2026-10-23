#!/usr/bin/env bash
# Развёртывание. Запускается на самой машине, в каталоге системы.
#
#   scripts/deploy.sh [--skip-backup] [--no-cache]
#
# Порядок шагов важен и не случаен:
#   проверки → копия базы → сборка → остановка приложений → миграции → запуск.
#
# Миграции применяются при остановленных приложениях. Иначе старый код какое-то
# время работает с новой схемой: несколько секунд недоступности дешевле, чем
# запросы, падающие на изменившихся таблицах.
#
# Сборка идёт ДО остановки: если образ не собрался, приложение продолжает
# работать на прежнем, и падение сборки не превращается в простой.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
source "$ROOT/scripts/preflight.sh"

skip_backup=''
build_args=()

while [ $# -gt 0 ]; do
  case "$1" in
    --skip-backup) skip_backup=1 ;;
    --no-cache) build_args+=(--no-cache) ;;
    -h|--help) sed -n '2,18p' "$0"; exit 0 ;;
    *) fail "неизвестный ключ: $1" ;;
  esac
  shift
done

started_at="$(date +%s)"

main() {
  preflight_run

  if [ -n "$skip_backup" ]; then
    warn 'копия базы пропущена по ключу --skip-backup: откатить неудачную миграцию будет нечем'
  else
    bash "$ROOT/scripts/backup.sh"
  fi

  mark_previous_images
  build_images
  stop_apps
  migrate
  start_all
  wait_healthy
  report
}

# mark_previous_images помечает текущие образы как previous — на них
# возвращает scripts/rollback.sh. Пометка ставится ДО сборки: после неё
# «предыдущим» оказался бы только что собранный.
mark_previous_images() {
  step 'Помечаю текущие образы'
  for name in hundred-days-api hundred-days-web; do
    if docker image inspect "$name:latest" >/dev/null 2>&1; then
      docker tag "$name:latest" "$name:previous"
      info "$name:latest → $name:previous"
    else
      info "$name:latest ещё нет — помечать нечего"
    fi
  done
}

build_images() {
  step 'Собираю образы'
  # BuildKit обязателен: классический сборщик на этой машине не разрешает
  # DNS внутри сборочного контейнера, и установка зависимостей падает.
  DOCKER_BUILDKIT=1 compose build "${build_args[@]}" api web
}

stop_apps() {
  step 'Останавливаю приложения'
  # База остаётся поднятой: миграции идут в неё.
  compose stop api web
}

migrate() {
  step 'Применяю миграции'

  local owner_password port url
  owner_password="$(env_value HD_POSTGRES_PASSWORD)"
  port="$(env_value HD_POSTGRES_PORT || echo 5436)"
  url="postgres://hd_owner:${owner_password}@localhost:${port}/hundred_days?sslmode=disable"

  # Миграции применяет владелец схемы, а не роль приложения: та права
  # менять таблицы не имеет, и это намеренно.
  (cd "$ROOT/api" && ./tools.sh goose -dir internal/db/migrations postgres "$url" up) \
    || fail 'миграции не применились — приложения оставлены остановленными, база цела из копии'

  (cd "$ROOT/api" && ./tools.sh goose -dir internal/db/migrations postgres "$url" status) | tail -3
}

start_all() {
  step 'Поднимаю стек'
  compose up -d
}

# wait_healthy ждёт, пока службы сообщат о здоровье. Без ожидания скрипт
# заканчивается раньше, чем приложение начинает отвечать, и «развёрнуто»
# означает лишь «контейнеры созданы».
wait_healthy() {
  step 'Жду здоровья служб'

  local waited=0
  while [ "$waited" -lt 120 ]; do
    local unhealthy
    unhealthy="$(compose ps --format '{{.Name}} {{.Health}}' \
      | awk '$2 != "healthy" && $2 != "" {print $1}' | paste -sd' ')"

    if [ -z "$unhealthy" ]; then
      info 'все службы здоровы'
      return
    fi

    sleep 3
    waited=$((waited + 3))
  done

  compose ps
  fail 'службы не сообщили о здоровье за 120 с — смотрите «docker compose logs»'
}

report() {
  local port elapsed
  port="$(env_value HD_HTTP_PORT || echo 8090)"
  elapsed=$(( $(date +%s) - started_at ))

  step "Развёрнуто за ${elapsed} с"
  info "приложение: http://$(hostname -I | awk '{print $1}'):${port}/"
  warn 'пока HTTPS не включён, пароль идёт по открытому каналу'
}

main "$@"
