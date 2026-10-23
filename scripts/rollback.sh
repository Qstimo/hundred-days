#!/usr/bin/env bash
# Откат на предыдущие образы.
#
#   scripts/rollback.sh
#
# Откатывает только код. База не откатывается: для неё есть
# scripts/restore.sh и копия, снятая развёртыванием. Разделено нарочно —
# откат кода нужен часто и безопасен, откат базы редок и опасен.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

main() {
  step 'Откат на предыдущие образы'

  for name in hundred-days-api hundred-days-web; do
    docker image inspect "$name:previous" >/dev/null 2>&1 \
      || fail "нет образа $name:previous — откатывать не на что"
  done

  warn 'миграции не откатываются: если схема изменилась, прежний код может с ней не работать'
  printf 'Введите «откатить» для продолжения: '
  local answer
  read -r answer
  [ "$answer" = 'откатить' ] || fail 'отменено'

  for name in hundred-days-api hundred-days-web; do
    docker tag "$name:previous" "$name:latest"
    info "$name:previous → $name:latest"
  done

  step 'Поднимаю стек на прежних образах'
  compose up -d --force-recreate api web

  info 'откат закончен'
}

main "$@"
