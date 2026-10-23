#!/usr/bin/env bash
# Проверки перед развёртыванием.
#
# Все проверки идут ДО остановки приложений. Смысл в этом: упасть на
# занятом порту после остановки значит остаться с лежащим приложением и
# непонятной причиной.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

# Требуемый запас на диске: образы веба и API плюс копия базы.
MIN_FREE_MB=2048

preflight_run() {
  step 'Проверки перед развёртыванием'

  command -v docker >/dev/null || fail 'docker не установлен'
  docker compose version >/dev/null 2>&1 || fail 'docker compose недоступен'

  [ -f "$ROOT/.env" ] || fail "нет файла .env — скопируйте .env.example и впишите пароли"

  for key in HD_POSTGRES_PASSWORD HD_APP_PASSWORD; do
    local value
    value="$(env_value "$key" || true)"
    [ -n "$value" ] || fail ".env: $key не заполнен"
  done
  info '.env на месте, пароли заполнены'

  check_port_free "$(env_value HD_HTTP_PORT || echo 8090)"
  check_disk_space
  check_generated_in_sync

  info 'проверки пройдены'
}

# check_port_free — главная проверка на этой машине.
#
# Порты 80 и 443 держит прокси CAIRN, а 8080 оказался занят контейнером
# другого проекта. Занятый порт — единственное, чем этот стек может
# столкнуться с соседями, и столкнуться он должен здесь, а не при запуске.
#
# Свой же контейнер порт занимать может: это обычное повторное
# развёртывание, и compose его перезапустит.
check_port_free() {
  local port="$1"
  [ -n "$port" ] || fail 'HD_HTTP_PORT не задан'

  if ! ss -ltn "sport = :$port" 2>/dev/null | grep -q LISTEN; then
    info "порт $port свободен"
    return
  fi

  local ours
  ours="$(compose ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -c ":$port->" || true)"
  if [ "${ours:-0}" -gt 0 ]; then
    info "порт $port занят своим же контейнером — это повторное развёртывание"
    return
  fi

  local who
  who="$(docker ps --format '{{.Names}}\t{{.Ports}}' 2>/dev/null | grep ":$port->" | cut -f1 | paste -sd' ' || true)"
  if [ -n "$who" ]; then
    fail "порт $port занят посторонним контейнером: $who. Смените HD_HTTP_PORT в .env"
  fi
  fail "порт $port занят посторонним процессом. Смените HD_HTTP_PORT в .env"
}

check_disk_space() {
  local free_mb
  free_mb="$(df -Pm "$ROOT" | awk 'NR==2 {print $4}')"

  if [ "$free_mb" -lt "$MIN_FREE_MB" ]; then
    fail "на диске свободно ${free_mb} МБ, нужно не меньше ${MIN_FREE_MB}: сборка образов и копия базы не поместятся"
  fi
  info "на диске свободно ${free_mb} МБ"
}

# check_generated_in_sync — порождённый код коммитится, и развёртывание
# обязано брать ровно то, что проверял CI. Разошедшийся код означает, что
# кто-то правил спецификацию и не перегенерировал.
check_generated_in_sync() {
  if ! git -C "$ROOT" diff --quiet -- api/internal/db/gen api/internal/httpapi/gen web/src/api-client/schema.d.ts 2>/dev/null; then
    fail 'порождённый код расходится с рабочей копией: перегенерируйте и закоммитьте'
  fi
  info 'порождённый код в согласии с рабочей копией'
}

# Запуск напрямую — выполнить проверки. Через source — только объявить.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  preflight_run
fi
