package store

import (
	"context"
	"errors"
	"time"

	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
	"github.com/jackc/pgx/v5"
)

// DayTracker — трекер на странице дня: он сам, отметка за этот день и
// недельный счёт.
type DayTracker struct {
	Tracker    Tracker
	Entry      *Entry
	WeekDone   int32
	WeekTarget int32
}

// DaySkill — навык с накопленными поинтами.
type DaySkill struct {
	Skill        Skill
	EarnedPoints float64
}

// Day — всё для страницы дня.
type Day struct {
	Date               time.Time
	Settings           dbgen.Setting
	Sleep              *Sleep
	Trackers           []DayTracker
	Plans              []DayPlan
	CarryOverAvailable bool
	Skills             []DaySkill
}

// DayData собирает страницу дня одним вызовом.
//
// Запросов шесть, и они идут один за другим: база локальная, счёт идёт на
// единицы миллисекунд, и распараллеливание добавило бы шесть соединений ради
// ничего. Главное здесь — что наружу уходит один ответ, а не шесть.
func (s *Store) DayData(ctx context.Context, userID int64, date time.Time) (Day, error) {
	settings, err := s.q.GetSettings(ctx, userID)
	if err != nil {
		return Day{}, err
	}

	trackers, err := s.Trackers(ctx, userID, false)
	if err != nil {
		return Day{}, err
	}

	entries, err := s.q.ListEntriesForDate(ctx, dbgen.ListEntriesForDateParams{
		UserID: userID, EntryDate: date,
	})
	if err != nil {
		return Day{}, err
	}
	entryByTracker := make(map[int64]Entry, len(entries))
	for _, e := range entries {
		entryByTracker[e.TrackerID] = Entry{
			Date: e.EntryDate, Hours: e.Hours, PointsAwarded: e.PointsAwarded,
		}
	}

	weekRows, err := s.q.CountEntriesInWeek(ctx, dbgen.CountEntriesInWeekParams{
		UserID: userID, OnDate: date,
	})
	if err != nil {
		return Day{}, err
	}
	doneByTracker := make(map[int64]int32, len(weekRows))
	for _, w := range weekRows {
		doneByTracker[w.TrackerID] = w.Done
	}

	dayTrackers := make([]DayTracker, 0, len(trackers))
	for _, t := range trackers {
		dt := DayTracker{
			Tracker:    t,
			WeekDone:   doneByTracker[t.ID],
			WeekTarget: t.WeeklyTarget,
		}
		if e, ok := entryByTracker[t.ID]; ok {
			entry := e
			dt.Entry = &entry
		}
		dayTrackers = append(dayTrackers, dt)
	}

	plans, err := s.Plans(ctx, userID, date)
	if err != nil {
		return Day{}, err
	}

	available, err := s.q.HasPlansToCarryOver(ctx, dbgen.HasPlansToCarryOverParams{
		UserID:     userID,
		PlanDate:   date.AddDate(0, 0, -1),
		PlanDate_2: date,
	})
	if err != nil {
		return Day{}, err
	}

	skills, err := s.Skills(ctx, userID, false)
	if err != nil {
		return Day{}, err
	}

	pointRows, err := s.q.SumPointsBySkill(ctx, userID)
	if err != nil {
		return Day{}, err
	}
	earnedBySkill := make(map[int64]float64, len(pointRows))
	for _, p := range pointRows {
		if p.SkillID != nil {
			earnedBySkill[*p.SkillID] = p.Earned
		}
	}

	daySkills := make([]DaySkill, 0, len(skills))
	for _, sk := range skills {
		daySkills = append(daySkills, DaySkill{
			Skill: sk, EarnedPoints: earnedBySkill[sk.ID],
		})
	}

	day := Day{
		Date:               date,
		Settings:           settings,
		Trackers:           dayTrackers,
		Plans:              plans,
		CarryOverAvailable: available,
		Skills:             daySkills,
	}

	// Запись сна необязательна: её отсутствие — обычное дело, а не ошибка.
	sleep, err := s.Sleep(ctx, userID, date)
	switch {
	case err == nil:
		day.Sleep = &sleep
	case errors.Is(err, pgx.ErrNoRows):
	default:
		return Day{}, err
	}

	return day, nil
}
