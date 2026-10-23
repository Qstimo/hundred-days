package store

import (
	"context"
	"errors"
	"time"

	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
	"github.com/Qstimo/hundred-days/api/internal/domain"
	"github.com/jackc/pgx/v5"
)

// ErrHoursRequired — у трекера с правилом «за час» не указаны часы.
// Отметить выполнение, не сказав сколько, значит начислить ноль, и это почти
// наверняка ошибка пользователя, а не намерение.
var ErrHoursRequired = errors.New("нужны часы")

// ErrHoursOutOfRange — часы вне разумного: больше суток или не больше нуля.
var ErrHoursOutOfRange = errors.New("часы вне допустимого")

// Entry — отметка выполнения.
type Entry struct {
	Date          time.Time
	Hours         *float64
	PointsAwarded float64
}

// SaveEntry ставит или перезаписывает отметку выполнения.
//
// Поинты считаются здесь и ложатся в строку: читать их потом по текущей цене
// трекера нельзя — правка цены переписала бы весь прошлый прогресс навыка.
//
// Трекер читается тем же запросом, что проверяет принадлежность: чужой или
// несуществующий даёт pgx.ErrNoRows, который выше превращается в 404.
func (s *Store) SaveEntry(
	ctx context.Context, userID, trackerID int64, date time.Time, hours *float64,
) (Entry, error) {
	tr, err := s.q.GetTracker(ctx, dbgen.GetTrackerParams{ID: trackerID, UserID: userID})
	if err != nil {
		return Entry{}, err
	}

	if hours != nil && (*hours <= 0 || *hours > 24) {
		return Entry{}, ErrHoursOutOfRange
	}

	// Трекер без часов часы игнорирует, а не отвергает: лишнее поле в теле
	// запроса не повод ломать отметку.
	if dbgen.TrackerMode(tr.Mode) == dbgen.TrackerModeCheck {
		hours = nil
	}

	if dbgen.PointsRule(tr.PointsRule) == dbgen.PointsRulePerHour && hours == nil {
		return Entry{}, ErrHoursRequired
	}

	row, err := s.q.UpsertEntry(ctx, dbgen.UpsertEntryParams{
		UserID:        userID,
		TrackerID:     trackerID,
		EntryDate:     date,
		Hours:         hours,
		PointsAwarded: domain.Points(domain.Rule(tr.PointsRule), tr.PointsValue, hours),
	})
	if err != nil {
		return Entry{}, err
	}

	return Entry{
		Date:          row.EntryDate,
		Hours:         row.Hours,
		PointsAwarded: row.PointsAwarded,
	}, nil
}

// DeleteEntry снимает отметку.
//
// Трекер проверяется до удаления: без этого снятие отметки у чужого трекера
// отвечало бы 404 по другой причине — нечего удалять, — и это совпадение, а
// не проверка. Ноль затронутых строк тоже даёт 404: нечего снимать.
func (s *Store) DeleteEntry(
	ctx context.Context, userID, trackerID int64, date time.Time,
) error {
	if _, err := s.q.GetTracker(ctx, dbgen.GetTrackerParams{
		ID: trackerID, UserID: userID,
	}); err != nil {
		return err
	}

	n, err := s.q.DeleteEntry(ctx, dbgen.DeleteEntryParams{
		UserID: userID, TrackerID: trackerID, EntryDate: date,
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
