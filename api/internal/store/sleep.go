package store

import (
	"context"
	"errors"
	"time"

	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// ErrQualityOutOfRange — самооценка сна вне 1…5.
var ErrQualityOutOfRange = errors.New("оценка сна вне диапазона 1…5")

// Sleep — запись сна. Времена суток — микросекунды от полуночи, как их
// хранит PostgreSQL; длительность здесь не считается, её вычисляет domain.
type Sleep struct {
	Date        time.Time
	WentToBedAt *int64
	WokeUpAt    *int64
	Quality     *int16
}

// SleepInput — что приходит на запись. Присланный nil стирает значение:
// у блока сна нет «не менять», есть только «так теперь».
type SleepInput struct {
	WentToBedAt *int64
	WokeUpAt    *int64
	Quality     *int16
}

// Sleep возвращает запись сна за дату.
func (s *Store) Sleep(ctx context.Context, userID int64, date time.Time) (Sleep, error) {
	r, err := s.q.GetSleep(ctx, dbgen.GetSleepParams{UserID: userID, LogDate: date})
	if err != nil {
		return Sleep{}, err
	}
	return Sleep{
		Date:        r.LogDate,
		WentToBedAt: microsFromTime(r.WentToBedAt),
		WokeUpAt:    microsFromTime(r.WokeUpAt),
		Quality:     r.Quality,
	}, nil
}

// SaveSleep записывает сон за дату, создавая строку при первом сохранении.
func (s *Store) SaveSleep(
	ctx context.Context, userID int64, date time.Time, in SleepInput,
) (Sleep, error) {
	if in.Quality != nil && (*in.Quality < 1 || *in.Quality > 5) {
		return Sleep{}, ErrQualityOutOfRange
	}

	r, err := s.q.UpsertSleep(ctx, dbgen.UpsertSleepParams{
		UserID:      userID,
		LogDate:     date,
		WentToBedAt: timeFromMicros(in.WentToBedAt),
		WokeUpAt:    timeFromMicros(in.WokeUpAt),
		Quality:     in.Quality,
	})
	if err != nil {
		return Sleep{}, err
	}
	return Sleep{
		Date:        r.LogDate,
		WentToBedAt: microsFromTime(r.WentToBedAt),
		WokeUpAt:    microsFromTime(r.WokeUpAt),
		Quality:     r.Quality,
	}, nil
}

// DeleteSleep убирает запись сна. Ноль затронутых строк — 404.
func (s *Store) DeleteSleep(ctx context.Context, userID int64, date time.Time) error {
	n, err := s.q.DeleteSleep(ctx, dbgen.DeleteSleepParams{UserID: userID, LogDate: date})
	if err != nil {
		return err
	}
	if n == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// timeFromMicros заворачивает микросекунды в тип pgx. Отсутствие значения —
// невалидный pgtype.Time, который уедет в базу как NULL.
func timeFromMicros(v *int64) pgtype.Time {
	if v == nil {
		return pgtype.Time{}
	}
	return pgtype.Time{Microseconds: *v, Valid: true}
}

// microsFromTime разворачивает тип pgx обратно.
func microsFromTime(v pgtype.Time) *int64 {
	if !v.Valid {
		return nil
	}
	m := v.Microseconds
	return &m
}
