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
