-- name: ListPlansForDate :many
SELECT id, plan_date, title, done_at, sort_order, carried_from_id
FROM day_plans
WHERE user_id = $1 AND plan_date = $2
ORDER BY sort_order, id;

-- name: GetPlan :one
SELECT id, plan_date, title, done_at, sort_order, carried_from_id
FROM day_plans
WHERE id = $1 AND user_id = $2;

-- name: CreatePlan :one
INSERT INTO day_plans (user_id, plan_date, title, sort_order, carried_from_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, plan_date, title, done_at, sort_order, carried_from_id;

-- Метку закрытия ставит база: coalesce сохраняет исходный момент, когда
-- правится только текст уже закрытого пункта.
-- name: UpdatePlan :one
UPDATE day_plans SET
  title      = $3,
  sort_order = $4,
  done_at    = CASE
                 WHEN sqlc.arg(done)::boolean THEN coalesce(done_at, now())
                 ELSE NULL
               END
WHERE id = $1 AND user_id = $2
RETURNING id, plan_date, title, done_at, sort_order, carried_from_id;

-- name: DeletePlan :execrows
DELETE FROM day_plans WHERE id = $1 AND user_id = $2;

-- Незакрытые пункты дня, которые ещё не переносили в целевой день.
-- Проверка по carried_from_id делает перенос идемпотентным: повторное
-- нажатие не создаёт копий. Копия считается существующей независимо от
-- того, закрыта она или нет.
-- name: ListPlansToCarryOver :many
SELECT p.id, p.title, p.sort_order
FROM day_plans p
WHERE p.user_id = $1
  AND p.plan_date = $2
  AND p.done_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM day_plans c
    WHERE c.user_id = $1
      AND c.plan_date = $3
      AND c.carried_from_id = p.id
  )
ORDER BY p.sort_order, p.id;
