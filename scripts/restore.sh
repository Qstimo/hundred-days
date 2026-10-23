#!/usr/bin/env bash
# Восстановление базы из копии.
#
#   scripts/restore.sh <файл.dump>
#
# Приложения останавливаются на время восстановления: работающий код с
# полупустой базой сделает больше вреда, чем минута недоступности.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

FILE="${1:-}"

main() {
  [ -n "$FILE" ] || fail 'нужен файл копии: scripts/restore.sh <файл.dump>'
  [ -f "$FILE" ] || fail "файла нет: $FILE"

  step 'Восстановление базы'
  warn 'текущие данные будут заменены содержимым копии'

  # Подтверждение словом, а не «y»: восстановление затирает базу, и
  # случайно нажатого «y» для такого мало.
  printf 'Введите «восстановить» для продолжения: '
  local answer
  read -r answer
  [ "$answer" = 'восстановить' ] || fail 'отменено'

  local owner_password
  owner_password="$(env_value HD_POSTGRES_PASSWORD)"
  [ -n "$owner_password" ] || fail 'HD_POSTGRES_PASSWORD пуст'

  step 'Останавливаю приложения'
  compose stop api web

  step 'Заливаю копию'
  # --clean --if-exists: старые объекты сносятся перед заливкой, иначе
  # восстановление упрётся в уже существующие таблицы.
  if ! compose exec -T -e PGPASSWORD="$owner_password" postgres \
      pg_restore -U hd_owner -d hundred_days --clean --if-exists --no-owner < "$FILE"; then
    warn 'pg_restore сообщил об ошибках — проверьте вывод выше'
  fi

  step 'Поднимаю приложения'
  compose up -d api web

  info 'восстановление закончено'
}

main "$@"
