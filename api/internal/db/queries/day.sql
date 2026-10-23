-- Сколько раз каждый трекер выполнен на неделе, в которую попадает дата.
-- date_trunc('week') в PostgreSQL начинает неделю с понедельника — это то,
-- что нужно: воскресенье относится к той же неделе, что предшествующий
-- понедельник.
-- name: CountEntriesInWeek :many
SELECT tracker_id, count(*)::int AS done
FROM entries
WHERE user_id = $1
  AND entry_date >= date_trunc('week', sqlc.arg(on_date)::date)
  AND entry_date <  date_trunc('week', sqlc.arg(on_date)::date) + interval '7 days'
GROUP BY tracker_id;

-- Накопленные поинты по навыкам. Сумма зафиксированных в отметках значений,
-- а не пересчёт по текущей цене трекеров: иначе правка цены переписала бы
-- весь прошлый прогресс.
-- name: SumPointsBySkill :many
SELECT t.skill_id, coalesce(sum(e.points_awarded), 0)::double precision AS earned
FROM entries e
JOIN trackers t ON t.id = e.tracker_id
WHERE e.user_id = $1 AND t.skill_id IS NOT NULL
GROUP BY t.skill_id;

-- Есть ли незакрытые пункты за предыдущий день, ещё не перенесённые.
-- name: HasPlansToCarryOver :one
SELECT EXISTS (
  SELECT 1 FROM day_plans p
  WHERE p.user_id = $1
    AND p.plan_date = $2
    AND p.done_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM day_plans c
      WHERE c.user_id = $1
        AND c.plan_date = $3
        AND c.carried_from_id = p.id
    )
) AS available;
