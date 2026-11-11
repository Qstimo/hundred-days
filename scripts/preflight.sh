#!/usr/bin/env bash
# Проверки перед развёртыванием.
#
# Все проверки идут ДО остановки приложений. Смысл в этом: упасть на
# занятом порту или на отсутствующей сети после остановки значит остаться с
# лежащим приложением и непонятной причиной.
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

  check_access_pair
  check_entrance
  check_disk_space
  check_generated_in_sync

  info 'проверки пройдены'
}

# check_access_pair — HD_PUBLIC_URL и HD_SECURE_COOKIE образуют пару.
#
# Проверка здесь, а не в приложении: рассогласование ломает ровно вход, то
# есть обнаружилось бы после развёртывания и на живых людях. По HTTP cookie с
# флагом Secure браузер не сохранит, а по HTTPS без этого флага cookie сессии
# ходила бы и по открытому каналу.
check_access_pair() {
  local url secure
  url="$(env_value HD_PUBLIC_URL || true)"
  secure="$(env_value HD_SECURE_COOKIE || true)"

  [ -n "$url" ] || fail '.env: HD_PUBLIC_URL не задан — развёртыванию нечего проверять и нечего печатать'

  case "$url" in
    https://*)
      [ "$secure" = 'true' ] \
        || fail ".env: HD_PUBLIC_URL=$url по HTTPS, а HD_SECURE_COOKIE не true — cookie сессии пойдёт и по открытому каналу"
      info "адрес $url, cookie сессии с флагом Secure"
      ;;
    http://*)
      [ "$secure" != 'true' ] \
        || fail ".env: HD_PUBLIC_URL=$url по HTTP, а HD_SECURE_COOKIE=true — браузер не сохранит cookie сессии, и вход молча не пройдёт"
      info "адрес $url, HTTPS выключен"
      ;;
    *)
      fail ".env: HD_PUBLIC_URL=$url — нужен полный адрес со схемой, http:// или https://"
      ;;
  esac
}

# check_entrance — проверка того единственного, чем стек держится за внешний
# мир. Способов два, и у каждого своя беда.
#
# На сервере вход один: прокси CAIRN приходит по общей сети, и портов стек не
# публикует вовсе. Нет сети — трафику некуда приходить, и узнать об этом надо
# до остановки приложений.
#
# На машине разработки прокси CAIRN нет, вход идёт портом, и порт должен быть
# свободен.
check_entrance() {
  local net
  net="$(env_value HD_EDGE_NETWORK || true)"

  if [ -z "$net" ]; then
    check_port_free HD_HTTP_PORT 8090
    return
  fi

  docker network inspect "$net" >/dev/null 2>&1 \
    || fail "нет docker-сети $net: её создаёт стек CAIRN (служба proxy). Поднимите CAIRN — иначе приложению некуда принимать трафик"
  info "сеть $net на месте — прокси CAIRN до стека дотянется"
}

# check_port_free — проверка для машины разработки, где вход идёт портом.
#
# Порт 8080 на ней занят контейнером другого проекта. Занятый порт — то
# немногое, чем этот стек может столкнуться с соседями, и столкнуться он
# должен здесь, а не при запуске.
#
# Свой же контейнер порт занимать может: это обычное повторное
# развёртывание, и compose его перезапустит.
check_port_free() {
  local key="$1" port
  port="$(env_value "$key")"
  port="${port:-$2}"
  [ -n "$port" ] || fail "$key не задан"

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
    fail "порт $port занят посторонним контейнером: $who. Смените $key в .env"
  fi
  fail "порт $port занят посторонним процессом. Смените $key в .env"
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
