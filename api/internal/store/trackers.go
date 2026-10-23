package store

import (
	"context"
	"errors"
	"strings"

	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
	"github.com/Qstimo/hundred-days/api/internal/domain"
	"github.com/jackc/pgx/v5"
)

// ErrWeeklyTargetOutOfRange — недельная цель вне 1…7. Больше семи раз в
// неделю в календаре не бывает, меньше одного — не цель.
var ErrWeeklyTargetOutOfRange = errors.New("недельная цель вне диапазона 1…7")

// ErrPointsValueNegative — отрицательная цена выполнения.
var ErrPointsValueNegative = errors.New("цена выполнения отрицательна")

// ErrUnknownMode — режим не из списка.
var ErrUnknownMode = errors.New("неизвестный режим трекера")

// ErrUnknownRule — правило не из списка.
var ErrUnknownRule = errors.New("неизвестное правило начисления")

// Tracker — трекер в виде, с которым работает приложение.
type Tracker struct {
	ID           int64
	Title        string
	Mode         domain.Mode
	PointsRule   domain.Rule
	PointsValue  float64
	SkillID      *int64
	WeeklyTarget int32
	SortOrder    int32
	Archived     bool
	// EntryCount — сколько отметок накоплено. Нужно, чтобы удаление могло
	// сказать, сколько истории унесёт.
	EntryCount int32
}

// TrackerInput — что приходит на запись.
type TrackerInput struct {
	Title        string
	Mode         domain.Mode
	PointsRule   domain.Rule
	PointsValue  float64
	SkillID      *int64
	WeeklyTarget int32
	SortOrder    int32
	Archived     bool
}

func (in TrackerInput) validate() error {
	if strings.TrimSpace(in.Title) == "" {
		return ErrEmptyTitle
	}
	if in.Mode != domain.ModeCheck && in.Mode != domain.ModeCheckHours {
		return ErrUnknownMode
	}
	if in.PointsRule != domain.RulePerCheck && in.PointsRule != domain.RulePerHour {
		return ErrUnknownRule
	}
	if in.PointsValue < 0 {
		return ErrPointsValueNegative
	}
	if in.WeeklyTarget < 1 || in.WeeklyTarget > 7 {
		return ErrWeeklyTargetOutOfRange
	}
	// Инвариант сочетания режима и правила. Тот же стоит ограничением в
	// базе; проверка здесь нужна, чтобы ответ был понятным 409, а не
	// невнятной ошибкой СУБД.
	return domain.ValidateRule(in.Mode, in.PointsRule)
}

// checkSkill проверяет, что навык принадлежит этому пользователю.
//
// Внешний ключ такой гарантии не даёт: он не знает про пользователя и пустил
// бы ссылку на чужой навык. А ссылка раскрыла бы его существование и увела
// бы поинты в чужую цель.
//
// Отсутствующий и чужой навык дают одну и ту же ошибку: отличать их значило
// бы сообщать о чужом.
func (s *Store) checkSkill(ctx context.Context, userID int64, skillID *int64) error {
	if skillID == nil {
		return nil
	}

	belongs, err := s.q.SkillBelongsToUser(ctx, dbgen.SkillBelongsToUserParams{
		ID: *skillID, UserID: userID,
	})
	if err != nil {
		return err
	}
	if !belongs {
		return pgx.ErrNoRows
	}
	return nil
}

// Trackers возвращает трекеры пользователя.
func (s *Store) Trackers(ctx context.Context, userID int64, includeArchived bool) ([]Tracker, error) {
	rows, err := s.q.ListTrackers(ctx, dbgen.ListTrackersParams{
		UserID: userID, IncludeArchived: includeArchived,
	})
	if err != nil {
		return nil, err
	}

	out := make([]Tracker, 0, len(rows))
	for _, r := range rows {
		out = append(out, Tracker{
			ID:           r.ID,
			Title:        r.Title,
			Mode:         domain.Mode(r.Mode),
			PointsRule:   domain.Rule(r.PointsRule),
			PointsValue:  r.PointsValue,
			SkillID:      r.SkillID,
			WeeklyTarget: r.WeeklyTarget,
			SortOrder:    r.SortOrder,
			Archived:     r.ArchivedAt != nil,
			EntryCount:   r.EntryCount,
		})
	}
	return out, nil
}

// Tracker возвращает один трекер. Чужой или несуществующий — pgx.ErrNoRows.
func (s *Store) Tracker(ctx context.Context, userID, id int64) (Tracker, error) {
	r, err := s.q.GetTracker(ctx, dbgen.GetTrackerParams{ID: id, UserID: userID})
	if err != nil {
		return Tracker{}, err
	}
	return Tracker{
		ID:           r.ID,
		Title:        r.Title,
		Mode:         domain.Mode(r.Mode),
		PointsRule:   domain.Rule(r.PointsRule),
		PointsValue:  r.PointsValue,
		SkillID:      r.SkillID,
		WeeklyTarget: r.WeeklyTarget,
		SortOrder:    r.SortOrder,
		Archived:     r.ArchivedAt != nil,
		EntryCount:   r.EntryCount,
	}, nil
}

// CreateTracker заводит трекер.
func (s *Store) CreateTracker(ctx context.Context, userID int64, in TrackerInput) (Tracker, error) {
	if err := in.validate(); err != nil {
		return Tracker{}, err
	}
	if err := s.checkSkill(ctx, userID, in.SkillID); err != nil {
		return Tracker{}, err
	}

	r, err := s.q.CreateTracker(ctx, dbgen.CreateTrackerParams{
		UserID:       userID,
		Title:        strings.TrimSpace(in.Title),
		Mode:         dbgen.TrackerMode(in.Mode),
		PointsRule:   dbgen.PointsRule(in.PointsRule),
		PointsValue:  domain.Round2(in.PointsValue),
		SkillID:      in.SkillID,
		WeeklyTarget: in.WeeklyTarget,
		SortOrder:    in.SortOrder,
	})
	if err != nil {
		return Tracker{}, err
	}
	return Tracker{
		ID:           r.ID,
		Title:        r.Title,
		Mode:         domain.Mode(r.Mode),
		PointsRule:   domain.Rule(r.PointsRule),
		PointsValue:  r.PointsValue,
		SkillID:      r.SkillID,
		WeeklyTarget: r.WeeklyTarget,
		SortOrder:    r.SortOrder,
		Archived:     r.ArchivedAt != nil,
		EntryCount:   r.EntryCount,
	}, nil
}

// UpdateTracker правит трекер. Проверки те же, что при создании: смена
// режима не должна оставить несовместимое правило.
func (s *Store) UpdateTracker(ctx context.Context, userID, id int64, in TrackerInput) (Tracker, error) {
	if err := in.validate(); err != nil {
		return Tracker{}, err
	}
	if err := s.checkSkill(ctx, userID, in.SkillID); err != nil {
		return Tracker{}, err
	}

	r, err := s.q.UpdateTracker(ctx, dbgen.UpdateTrackerParams{
		ID:           id,
		UserID:       userID,
		Title:        strings.TrimSpace(in.Title),
		Mode:         dbgen.TrackerMode(in.Mode),
		PointsRule:   dbgen.PointsRule(in.PointsRule),
		PointsValue:  domain.Round2(in.PointsValue),
		SkillID:      in.SkillID,
		WeeklyTarget: in.WeeklyTarget,
		SortOrder:    in.SortOrder,
		Archived:     in.Archived,
	})
	if err != nil {
		return Tracker{}, err
	}
	return Tracker{
		ID:           r.ID,
		Title:        r.Title,
		Mode:         domain.Mode(r.Mode),
		PointsRule:   domain.Rule(r.PointsRule),
		PointsValue:  r.PointsValue,
		SkillID:      r.SkillID,
		WeeklyTarget: r.WeeklyTarget,
		SortOrder:    r.SortOrder,
		Archived:     r.ArchivedAt != nil,
		EntryCount:   r.EntryCount,
	}, nil
}

// DeleteTracker удаляет трекер вместе с его отметками: они принадлежат ему и
// без него значения не имеют. Сколько именно унесёт — говорит EntryCount.
func (s *Store) DeleteTracker(ctx context.Context, userID, id int64) error {
	n, err := s.q.DeleteTracker(ctx, dbgen.DeleteTrackerParams{ID: id, UserID: userID})
	if err != nil {
		return err
	}
	if n == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
