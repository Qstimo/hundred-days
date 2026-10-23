-- Записи отрезка по дням. Заполнение пустых дней делается в Go: генерировать
-- календарь в SQL дороже и труднее читать.
-- name: ListEntriesInRange :many
SELECT tracker_id, entry_date, hours, points_awarded
FROM entries
WHERE user_id = $1 AND entry_date BETWEEN $2 AND $3
ORDER BY entry_date;

-- Выполнения по неделям для серий. Берётся вся история, а не отрезок:
-- серия, начавшаяся до его начала, иначе выглядела бы короче.
-- name: CountEntriesByWeek :many
SELECT tracker_id,
       date_trunc('week', entry_date)::date AS week_start,
       count(*)::int AS done
FROM entries
WHERE user_id = $1
GROUP BY tracker_id, week_start
ORDER BY tracker_id, week_start;

-- Поинты по навыкам за всё время.
-- name: SumPointsBySkillAll :many
SELECT t.skill_id, coalesce(sum(e.points_awarded), 0)::double precision AS earned
FROM entries e
JOIN trackers t ON t.id = e.tracker_id
WHERE e.user_id = $1 AND t.skill_id IS NOT NULL
GROUP BY t.skill_id;

-- Поинты за последние N дней — для темпа.
-- name: SumRecentPointsBySkill :many
SELECT t.skill_id, coalesce(sum(e.points_awarded), 0)::double precision AS earned
FROM entries e
JOIN trackers t ON t.id = e.tracker_id
WHERE e.user_id = $1 AND t.skill_id IS NOT NULL AND e.entry_date > $2
GROUP BY t.skill_id;

-- name: ListSleepInRange :many
SELECT log_date, went_to_bed_at, woke_up_at, quality
FROM sleep_logs
WHERE user_id = $1 AND log_date BETWEEN $2 AND $3
ORDER BY log_date;

-- name: CountPlansInRange :one
SELECT count(*)::int AS total,
       count(done_at)::int AS done
FROM day_plans
WHERE user_id = $1 AND plan_date BETWEEN $2 AND $3;
