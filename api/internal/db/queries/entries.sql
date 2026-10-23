-- name: UpsertEntry :one
INSERT INTO entries (user_id, tracker_id, entry_date, hours, points_awarded)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (tracker_id, entry_date) DO UPDATE SET
  hours          = excluded.hours,
  points_awarded = excluded.points_awarded,
  updated_at     = now()
RETURNING entry_date, hours, points_awarded;

-- name: DeleteEntry :execrows
DELETE FROM entries
WHERE user_id = $1 AND tracker_id = $2 AND entry_date = $3;

-- name: ListEntriesForDate :many
SELECT tracker_id, entry_date, hours, points_awarded
FROM entries
WHERE user_id = $1 AND entry_date = $2;
