package store

import (
	"context"
	"errors"
	"time"

	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
	"github.com/Qstimo/hundred-days/api/internal/domain"
)

// paceWindowDays — окно, по которому считается темп. Две недели: меньше
// шумит на одном удачном дне, больше — не замечает, что человек остановился.
const paceWindowDays = 14

// ErrRangeInverted — конец отрезка раньше начала.
var ErrRangeInverted = errors.New("конец отрезка раньше начала")

// ErrRangeTooLong — отрезок длиннее допустимого.
var ErrRangeTooLong = errors.New("отрезок слишком длинный")

// MaxStatsRangeDays — предел длины отрезка. Ответ отдаёт по дню на каждый
// трекер, и пять лет превратились бы в мегабайты, которые всё равно не
// прочесть.
const MaxStatsRangeDays = 400

// weekRow — число выполнений за неделю, как его отдаёт база.
type weekRow struct {
	WeekStart time.Time
	Done      int
}

// StatsDay — один день отрезка у трекера.
type StatsDay struct {
	Date   time.Time
	Done   bool
	Hours  *float64
	Points float64
}

// StatsTracker — трекер со статистикой за отрезок.
type StatsTracker struct {
	Tracker        Tracker
	Days           []StatsDay
	TotalDone      int
	TotalHours     float64
	TotalPoints    float64
	CompletionRate float64
	Streak         domain.Streak
}

// StatsSkill — навык с прогнозом.
type StatsSkill struct {
	Skill        Skill
	EarnedPoints float64
	PacePerDay   float64
	Forecast     float64
	WillReach    bool
}

// StatsSleep — запись сна за день отрезка.
type StatsSleep struct {
	Date        time.Time
	WentToBedAt *int64
	WokeUpAt    *int64
	Quality     *int16
}

// StatsPlans — сводка по планам за отрезок.
type StatsPlans struct {
	Total int
	Done  int
	Rate  float64
}

// Stats — всё для дашборда.
type Stats struct {
	From     time.Time
	To       time.Time
	Trackers []StatsTracker
	Skills   []StatsSkill
	Sleep    []StatsSleep
	Plans    StatsPlans
}

// StatsData собирает статистику за отрезок, включая оба края.
func (s *Store) StatsData(
	ctx context.Context, userID int64, from, to, today time.Time,
) (Stats, error) {
	if to.Before(from) {
		return Stats{}, ErrRangeInverted
	}
	days := int(to.Sub(from).Hours()/24) + 1
	if days > MaxStatsRangeDays {
		return Stats{}, ErrRangeTooLong
	}

	settings, err := s.q.GetSettings(ctx, userID)
	if err != nil {
		return Stats{}, err
	}

	trackers, err := s.Trackers(ctx, userID, false)
	if err != nil {
		return Stats{}, err
	}

	statsTrackers, err := s.trackerStats(ctx, userID, trackers, from, to, days, today)
	if err != nil {
		return Stats{}, err
	}

	statsSkills, err := s.skillStats(ctx, userID, settings, today)
	if err != nil {
		return Stats{}, err
	}

	sleep, err := s.sleepStats(ctx, userID, from, to)
	if err != nil {
		return Stats{}, err
	}

	plansRow, err := s.q.CountPlansInRange(ctx, dbgen.CountPlansInRangeParams{
		UserID: userID, PlanDate: from, PlanDate_2: to,
	})
	if err != nil {
		return Stats{}, err
	}

	plans := StatsPlans{Total: int(plansRow.Total), Done: int(plansRow.Done)}
	if plans.Total > 0 {
		plans.Rate = domain.Round2(float64(plans.Done) / float64(plans.Total))
	}

	return Stats{
		From:     from,
		To:       to,
		Trackers: statsTrackers,
		Skills:   statsSkills,
		Sleep:    sleep,
		Plans:    plans,
	}, nil
}

// trackerStats раскладывает записи отрезка по дням и считает серии.
func (s *Store) trackerStats(
	ctx context.Context, userID int64, trackers []Tracker,
	from, to time.Time, days int, today time.Time,
) ([]StatsTracker, error) {
	entries, err := s.q.ListEntriesInRange(ctx, dbgen.ListEntriesInRangeParams{
		UserID: userID, EntryDate: from, EntryDate_2: to,
	})
	if err != nil {
		return nil, err
	}

	// Записи по трекеру и дате: дальше по этой карте заполняется календарь.
	type key struct {
		tracker int64
		date    string
	}
	byDay := make(map[key]dbgen.ListEntriesInRangeRow, len(entries))
	for _, e := range entries {
		byDay[key{e.TrackerID, e.EntryDate.Format("2006-01-02")}] = e
	}

	weekRows, err := s.q.CountEntriesByWeek(ctx, userID)
	if err != nil {
		return nil, err
	}
	weeksByTracker := make(map[int64][]weekRow)
	for _, w := range weekRows {
		weeksByTracker[w.TrackerID] = append(weeksByTracker[w.TrackerID],
			weekRow{WeekStart: w.WeekStart, Done: int(w.Done)})
	}

	currentWeek := startOfWeek(today)

	out := make([]StatsTracker, 0, len(trackers))
	for _, t := range trackers {
		st := StatsTracker{
			Tracker: t,
			Days:    make([]StatsDay, 0, days),
		}

		// Календарь заполняется днями подряд, включая пустые: теплокарте
		// нужны и провалы, а пропуск дня сдвинул бы сетку.
		for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
			day := StatsDay{Date: d}
			if e, ok := byDay[key{t.ID, d.Format("2006-01-02")}]; ok {
				day.Done = true
				day.Hours = e.Hours
				day.Points = e.PointsAwarded

				st.TotalDone++
				st.TotalPoints += e.PointsAwarded
				if e.Hours != nil {
					st.TotalHours += *e.Hours
				}
			}
			st.Days = append(st.Days, day)
		}

		st.TotalPoints = domain.Round2(st.TotalPoints)
		st.TotalHours = domain.Round2(st.TotalHours)
		st.CompletionRate = domain.CompletionRate(st.TotalDone, days, int(t.WeeklyTarget))
		st.Streak = domain.WeeklyStreak(
			weekCounts(weeksByTracker[t.ID], currentWeek), int(t.WeeklyTarget))

		out = append(out, st)
	}
	return out, nil
}

// skillStats считает прогресс, темп и прогноз по навыкам.
func (s *Store) skillStats(
	ctx context.Context, userID int64, settings dbgen.Setting, today time.Time,
) ([]StatsSkill, error) {
	skills, err := s.Skills(ctx, userID, false)
	if err != nil {
		return nil, err
	}

	allRows, err := s.q.SumPointsBySkillAll(ctx, userID)
	if err != nil {
		return nil, err
	}
	earned := make(map[int64]float64, len(allRows))
	for _, r := range allRows {
		if r.SkillID != nil {
			earned[*r.SkillID] = r.Earned
		}
	}

	since := today.AddDate(0, 0, -paceWindowDays)
	recentRows, err := s.q.SumRecentPointsBySkill(ctx, dbgen.SumRecentPointsBySkillParams{
		UserID: userID, EntryDate: since,
	})
	if err != nil {
		return nil, err
	}
	recent := make(map[int64]float64, len(recentRows))
	for _, r := range recentRows {
		if r.SkillID != nil {
			recent[*r.SkillID] = r.Earned
		}
	}

	daysLeft := domain.DaysLeft(settings.PeriodStart, int(settings.PeriodDays), today)

	out := make([]StatsSkill, 0, len(skills))
	for _, sk := range skills {
		pace := domain.Pace(recent[sk.ID], paceWindowDays)
		got := earned[sk.ID]

		out = append(out, StatsSkill{
			Skill:        sk,
			EarnedPoints: domain.Round2(got),
			PacePerDay:   pace,
			Forecast:     domain.Forecast(got, pace, daysLeft),
			WillReach:    domain.WillReach(got, pace, daysLeft, sk.TargetPoints),
		})
	}
	return out, nil
}

// sleepStats отдаёт записи сна отрезка.
func (s *Store) sleepStats(
	ctx context.Context, userID int64, from, to time.Time,
) ([]StatsSleep, error) {
	rows, err := s.q.ListSleepInRange(ctx, dbgen.ListSleepInRangeParams{
		UserID: userID, LogDate: from, LogDate_2: to,
	})
	if err != nil {
		return nil, err
	}

	out := make([]StatsSleep, 0, len(rows))
	for _, r := range rows {
		out = append(out, StatsSleep{
			Date:        r.LogDate,
			WentToBedAt: microsFromTime(r.WentToBedAt),
			WokeUpAt:    microsFromTime(r.WokeUpAt),
			Quality:     r.Quality,
		})
	}
	return out, nil
}

// weekCounts разворачивает суммы по неделям в срез без пропусков, от первой
// недели с записями до текущей включительно.
//
// Неделя без записей в базе отсутствует, но в срезе обязана быть нулём:
// иначе провал стал бы невидим и серия склеилась бы через него. Хвост до
// текущей недели добивается нулями по той же причине — иначе серия
// выглядела бы живой, хотя давно оборвалась.
func weekCounts(rows []weekRow, currentWeekStart time.Time) []int {
	if len(rows) == 0 {
		return []int{0}
	}

	byWeek := make(map[time.Time]int, len(rows))
	for _, r := range rows {
		byWeek[r.WeekStart] = r.Done
	}

	out := []int{}
	for w := rows[0].WeekStart; !w.After(currentWeekStart); w = w.AddDate(0, 0, 7) {
		out = append(out, byWeek[w])
	}
	if len(out) == 0 {
		return []int{0}
	}
	return out
}

// startOfWeek возвращает понедельник недели, в которую попадает дата. Тот же
// день недели, с которого начинает date_trunc('week') в PostgreSQL.
func startOfWeek(t time.Time) time.Time {
	day := truncateDay(t)
	// В Go воскресенье — ноль, поэтому его надо увести на шесть дней назад,
	// а не на минус один.
	offset := (int(day.Weekday()) + 6) % 7
	return day.AddDate(0, 0, -offset)
}

// truncateDay отбрасывает время, оставляя дату в UTC.
func truncateDay(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}
