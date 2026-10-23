-- name: ListSkills :many
SELECT id, title, target_points, unit_label, sort_order, archived_at
FROM skills
WHERE user_id = $1
  AND (sqlc.arg(include_archived)::boolean OR archived_at IS NULL)
ORDER BY sort_order, id;

-- name: GetSkill :one
SELECT id, title, target_points, unit_label, sort_order, archived_at
FROM skills
WHERE id = $1 AND user_id = $2;

-- name: CreateSkill :one
INSERT INTO skills (user_id, title, target_points, unit_label, sort_order)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, title, target_points, unit_label, sort_order, archived_at;

-- Метку архивации ставит база, а не приложение: coalesce сохраняет
-- исходный момент архивации при повторном сохранении, иначе каждая правка
-- архивного навыка переписывала бы дату и «архивировано в марте» превращалось
-- бы в «архивировано сейчас».
-- name: UpdateSkill :one
UPDATE skills SET
  title         = $3,
  target_points = $4,
  unit_label    = $5,
  sort_order    = $6,
  archived_at   = CASE
                    WHEN sqlc.arg(archived)::boolean THEN coalesce(archived_at, now())
                    ELSE NULL
                  END
WHERE id = $1 AND user_id = $2
RETURNING id, title, target_points, unit_label, sort_order, archived_at;

-- name: DeleteSkill :execrows
DELETE FROM skills WHERE id = $1 AND user_id = $2;
