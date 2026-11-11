#!/usr/bin/env bash
# Копия базы.
#
#   scripts/backup.sh [каталог]
#
# Снимается через pg_dump внутри контейнера: так не нужен клиент на машине и
# версия утилиты заведомо совпадает с версией сервера.
#
# Формат custom (-Fc), а не текстовый: восстанавливается параллельно,
# сжимается сам и позволяет достать отдельную таблицу, не читая весь файл.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

BACKUP_DIR="${1:-$ROOT/backups}"
KEEP=10

main() {
  step 'Копия базы'
  mkdir -p "$BACKUP_DIR"

  local owner_password
  owner_password="$(env_value HD_POSTGRES_PASSWORD)" \
    || fail 'не вышло прочитать HD_POSTGRES_PASSWORD из .env'
  [ -n "$owner_password" ] || fail 'HD_POSTGRES_PASSWORD пуст'

  # Контейнера базы нет вовсе — это первое развёртывание, и терять нечего.
  # Отличать этот случай от остановленной базы важно: там копию снять нельзя,
  # а причину знать надо, и молча пройти мимо значило бы начать миграции без
  # возможности откатиться.
  local container
  container="$(compose ps -a postgres --format '{{.Name}}' | head -1)"
  if [ -z "$container" ]; then
    warn 'базы ещё нет — первое развёртывание, копию снимать нечего'
    return 0
  fi

  compose ps postgres --format '{{.Status}}' | grep -q 'Up' \
    || fail 'postgres остановлен: копию снимать нечем. Поднимите базу или запустите развёртывание с --skip-backup'

  local stamp file
  stamp="$(date +%Y%m%d-%H%M%S)"
  file="$BACKUP_DIR/hundred-days-$stamp.dump"

  # Пароль уходит переменной окружения внутрь контейнера, а не аргументом:
  # аргументы видны в списке процессов любому на машине.
  if ! compose exec -T -e PGPASSWORD="$owner_password" postgres \
      pg_dump -U hd_owner -d hundred_days -Fc > "$file"; then
    rm -f "$file"
    fail 'pg_dump не справился — копия удалена, чтобы не осталась обрезанной'
  fi

  # Обрезанная копия хуже отсутствующей: она создаёт ложное чувство
  # сохранности. Пустой или подозрительно малый файл — повод остановиться.
  local size
  size="$(stat -c %s "$file")"
  if [ "$size" -lt 1024 ]; then
    rm -f "$file"
    fail "копия вышла размером $size байт — это не копия"
  fi

  info "снято: $file ($(numfmt --to=iec "$size"))"
  rotate
}

# rotate оставляет последние KEEP копий. Без уборки каталог растёт, пока не
# кончится диск — а кончится он как раз в момент, когда копия нужна.
rotate() {
  local extra
  extra="$(ls -1t "$BACKUP_DIR"/hundred-days-*.dump 2>/dev/null | tail -n "+$((KEEP + 1))")"
  [ -n "$extra" ] || return 0

  echo "$extra" | while read -r old; do
    rm -f "$old"
    info "убрана старая копия: $(basename "$old")"
  done
}

main "$@"
