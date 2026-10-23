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
