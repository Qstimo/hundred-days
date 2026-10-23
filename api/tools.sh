#!/usr/bin/env bash
# Запуск инструментов разработки: goose, sqlc, oapi-codegen.
#
# Инструменты живут в отдельном модуле api/tools, а не в модуле приложения.
# Причина: goose тянет драйверы всех баз, какие умеет, — ClickHouse, MySQL,
# Azure, — и в модуле приложения они раздували бы go.sum с шести строк до
# трёхсот и ехали бы в `go mod download` при каждой сборке образа. Версии
# при этом по-прежнему зафиксированы в коде, просто в своём файле.
#
# Скрипт собирает нужный инструмент в api/bin (каталог вне присмотра git) и
# запускает его из каталога api. Поэтому пути в аргументах обычные,
# относительные, и команды выглядят так же, как у инструмента в своём модуле:
#
#   ./tools.sh goose -dir internal/db/migrations postgres "$URL" up
#   ./tools.sh sqlc generate
#   ./tools.sh oapi-codegen -config ../openapi/oapi-codegen.yaml ../openapi/openapi.yaml
#
# Пересобрать инструмент после смены версии: rm -rf bin && ./tools.sh <имя>.
set -euo pipefail

API="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$API"

declare -A PKG=(
	[goose]=github.com/pressly/goose/v3/cmd/goose
	[sqlc]=github.com/sqlc-dev/sqlc/cmd/sqlc
	[oapi-codegen]=github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen
)

name="${1:-}"
if [ -z "$name" ]; then
	echo "нужно имя инструмента: ${!PKG[*]}" >&2
	exit 2
fi
shift

if [ -z "${PKG[$name]:-}" ]; then
	echo "неизвестный инструмент: $name (есть: ${!PKG[*]})" >&2
	exit 2
fi

# Сборка один раз: дальше бинарник берётся готовым из api/bin.
if [ ! -x "bin/$name" ]; then
	echo "собираю $name..." >&2
	go -C tools build -o "$API/bin/$name" "${PKG[$name]}"
fi

exec "bin/$name" "$@"
