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
