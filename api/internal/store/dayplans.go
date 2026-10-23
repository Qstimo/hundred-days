package store

import (
	"context"
	"strings"
	"time"

	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
	"github.com/jackc/pgx/v5"
)

// DayPlan — пункт плана на день.
type DayPlan struct {
	ID            int64
	Date          time.Time
	Title         string
	DoneAt        *time.Time
	SortOrder     int32
	CarriedFromID *int64
}

// Done отвечает, закрыт ли пункт. Отдельного флага нет: метка времени и есть
// признак закрытия, и два источника одного состояния разошлись бы.
func (p DayPlan) Done() bool { return p.DoneAt != nil }

// DayPlanPatch — правка пункта. Нулевые поля означают «не менять»: у правки
// нет «очистить», в отличие от записи сна.
type DayPlanPatch struct {
	Title     *string
	Done      *bool
	SortOrder *int32
}

func planFrom(r dbgen.CreatePlanRow) DayPlan {
	return DayPlan{
		ID: r.ID, Date: r.PlanDate, Title: r.Title, DoneAt: r.DoneAt,
		SortOrder: r.SortOrder, CarriedFromID: r.CarriedFromID,
	}
}

// Plans возвращает пункты плана за дату.
func (s *Store) Plans(ctx context.Context, userID int64, date time.Time) ([]DayPlan, error) {
	rows, err := s.q.ListPlansForDate(ctx, dbgen.ListPlansForDateParams{
		UserID: userID, PlanDate: date,
	})
	if err != nil {
		return nil, err
	}

	out := make([]DayPlan, 0, len(rows))
	for _, r := range rows {
		out = append(out, DayPlan{
			ID: r.ID, Date: r.PlanDate, Title: r.Title, DoneAt: r.DoneAt,
			SortOrder: r.SortOrder, CarriedFromID: r.CarriedFromID,
		})
	}
	return out, nil
}

// CreatePlan добавляет пункт.
func (s *Store) CreatePlan(
	ctx context.Context, userID int64, date time.Time, title string, sortOrder int32,
) (DayPlan, error) {
	if strings.TrimSpace(title) == "" {
		return DayPlan{}, ErrEmptyTitle
	}

	r, err := s.q.CreatePlan(ctx, dbgen.CreatePlanParams{
		UserID:    userID,
		PlanDate:  date,
		Title:     strings.TrimSpace(title),
		SortOrder: sortOrder,
	})
	if err != nil {
		return DayPlan{}, err
	}
	return planFrom(r), nil
}

// PatchPlan правит пункт. Непереданные поля остаются как были — поэтому
// текущее состояние сначала читается.
func (s *Store) PatchPlan(
	ctx context.Context, userID, id int64, patch DayPlanPatch,
) (DayPlan, error) {
	cur, err := s.q.GetPlan(ctx, dbgen.GetPlanParams{ID: id, UserID: userID})
	if err != nil {
		return DayPlan{}, err
	}

	title := cur.Title
	if patch.Title != nil {
		if strings.TrimSpace(*patch.Title) == "" {
			return DayPlan{}, ErrEmptyTitle
		}
		title = strings.TrimSpace(*patch.Title)
	}

	done := cur.DoneAt != nil
	if patch.Done != nil {
		done = *patch.Done
	}

	sortOrder := cur.SortOrder
	if patch.SortOrder != nil {
		sortOrder = *patch.SortOrder
	}

	r, err := s.q.UpdatePlan(ctx, dbgen.UpdatePlanParams{
		ID: id, UserID: userID, Title: title, SortOrder: sortOrder, Done: done,
	})
	if err != nil {
		return DayPlan{}, err
	}
	return DayPlan{
		ID: r.ID, Date: r.PlanDate, Title: r.Title, DoneAt: r.DoneAt,
		SortOrder: r.SortOrder, CarriedFromID: r.CarriedFromID,
	}, nil
}

// DeletePlan удаляет пункт. Ноль затронутых строк — 404.
func (s *Store) DeletePlan(ctx context.Context, userID, id int64) error {
	n, err := s.q.DeletePlan(ctx, dbgen.DeletePlanParams{ID: id, UserID: userID})
	if err != nil {
		return err
	}
	if n == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// CarryOverPlans копирует незакрытые пункты предыдущего дня в указанный.
//
// Идемпотентно: пункт, у которого в целевом дне уже есть копия, пропускается
// — иначе двойное нажатие удвоило бы список. Всё в одной транзакции:
// половина перенесённого списка хуже, чем ничего.
//
// Исходные пункты остаются на месте. Автоматического переноса нет: он
// размыл бы историю дня, а она здесь и есть содержание.
func (s *Store) CarryOverPlans(
	ctx context.Context, userID int64, to time.Time,
) ([]DayPlan, error) {
	from := to.AddDate(0, 0, -1)

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	q := s.q.WithTx(tx)

	src, err := q.ListPlansToCarryOver(ctx, dbgen.ListPlansToCarryOverParams{
		UserID:     userID,
		PlanDate:   from,
		PlanDate_2: to,
	})
	if err != nil {
		return nil, err
	}

	out := make([]DayPlan, 0, len(src))
	for _, p := range src {
		created, err := q.CreatePlan(ctx, dbgen.CreatePlanParams{
			UserID:        userID,
			PlanDate:      to,
			Title:         p.Title,
			SortOrder:     p.SortOrder,
			CarriedFromID: &p.ID,
		})
		if err != nil {
			return nil, err
		}
		out = append(out, planFrom(created))
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return out, nil
}
