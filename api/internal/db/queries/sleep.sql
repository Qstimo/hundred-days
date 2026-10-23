-- name: GetSleep :one
SELECT log_date, went_to_bed_at, woke_up_at, quality
FROM sleep_logs
WHERE user_id = $1 AND log_date = $2;

-- name: UpsertSleep :one
INSERT INTO sleep_logs (user_id, log_date, went_to_bed_at, woke_up_at, quality)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (user_id, log_date) DO UPDATE SET
  went_to_bed_at = excluded.went_to_bed_at,
  woke_up_at     = excluded.woke_up_at,
  quality        = excluded.quality,
  updated_at     = now()
RETURNING log_date, went_to_bed_at, woke_up_at, quality;

-- name: DeleteSleep :execrows
DELETE FROM sleep_logs WHERE user_id = $1 AND log_date = $2;
