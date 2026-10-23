-- entry_count считается подзапросом при выдаче списка: он нужен, чтобы
-- удаление могло сказать, сколько отметок унесёт, и хранить его отдельной
-- колонкой значило бы поддерживать её в согласии с таблицей отметок.
-- name: ListTrackers :many
SELECT t.id, t.title, t.mode, t.points_rule, t.points_value, t.skill_id,
       t.weekly_target, t.sort_order, t.archived_at,
       (SELECT count(*) FROM entries e WHERE e.tracker_id = t.id)::int AS entry_count
FROM trackers t
WHERE t.user_id = $1
  AND (sqlc.arg(include_archived)::boolean OR t.archived_at IS NULL)
ORDER BY t.sort_order, t.id;

-- name: GetTracker :one
SELECT t.id, t.title, t.mode, t.points_rule, t.points_value, t.skill_id,
       t.weekly_target, t.sort_order, t.archived_at,
       (SELECT count(*) FROM entries e WHERE e.tracker_id = t.id)::int AS entry_count
FROM trackers t
WHERE t.id = $1 AND t.user_id = $2;

-- name: CreateTracker :one
INSERT INTO trackers (user_id, title, mode, points_rule, points_value,
                      skill_id, weekly_target, sort_order)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id, title, mode, points_rule, points_value, skill_id,
          weekly_target, sort_order, archived_at,
          0::int AS entry_count;

-- Метку архивации ставит база: coalesce сохраняет исходный момент при
-- повторном сохранении архивного трекера.
-- name: UpdateTracker :one
UPDATE trackers SET
  title         = $3,
  mode          = $4,
  points_rule   = $5,
  points_value  = $6,
  skill_id      = $7,
  weekly_target = $8,
  sort_order    = $9,
  archived_at   = CASE
                    WHEN sqlc.arg(archived)::boolean THEN coalesce(archived_at, now())
                    ELSE NULL
                  END
WHERE trackers.id = $1 AND trackers.user_id = $2
RETURNING trackers.id, trackers.title, trackers.mode, trackers.points_rule,
          trackers.points_value, trackers.skill_id, trackers.weekly_target,
          trackers.sort_order, trackers.archived_at,
          (SELECT count(*) FROM entries e WHERE e.tracker_id = trackers.id)::int
            AS entry_count;

-- name: DeleteTracker :execrows
DELETE FROM trackers WHERE id = $1 AND user_id = $2;

-- Принадлежность навыка проверяется отдельным запросом, а не внешним
-- ключом: ключ пустил бы ссылку на чужой навык, потому что он не знает
-- про пользователя.
-- name: SkillBelongsToUser :one
SELECT EXISTS (
  SELECT 1 FROM skills WHERE id = $1 AND user_id = $2
) AS belongs;
