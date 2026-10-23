package store

import (
	"context"
	"errors"
	"strings"

	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
	"github.com/jackc/pgx/v5"
)

// ErrEmptyTitle — название из одних пробелов. Тот же инвариант стоит
// ограничением в базе; проверка здесь нужна, чтобы ответ был понятным, а не
// невнятной ошибкой СУБД.
var ErrEmptyTitle = errors.New("название пустое")

// ErrTargetNotPositive — цель навыка не больше нуля. Ноль сделал бы
// вычисление прогресса делением на ноль.
var ErrTargetNotPositive = errors.New("цель должна быть больше нуля")

// Skill — навык в виде, с которым работает приложение.
//
// Порождённые sqlc типы строк (CreateSkillRow, GetSkillRow и прочие)
// одинаковы по составу, но различны по типу, и протаскивать их наружу
// значило бы писать пять одинаковых переходов в хендлерах.
type Skill struct {
	ID           int64
	Title        string
	TargetPoints float64
	UnitLabel    string
	SortOrder    int32
	Archived     bool
}

// SkillInput — что приходит на запись.
type SkillInput struct {
	Title        string
	TargetPoints float64
	UnitLabel    string
	SortOrder    int32
	Archived     bool
}

func (in SkillInput) validate() error {
	if strings.TrimSpace(in.Title) == "" {
		return ErrEmptyTitle
	}
	if in.TargetPoints <= 0 {
		return ErrTargetNotPositive
	}
	return nil
}

// Skills возвращает навыки пользователя. Архивные — только по явному
// запросу: иначе список со временем зарастёт тем, что уже не ведётся.
func (s *Store) Skills(ctx context.Context, userID int64, includeArchived bool) ([]Skill, error) {
	rows, err := s.q.ListSkills(ctx, dbgen.ListSkillsParams{
		UserID: userID, IncludeArchived: includeArchived,
	})
	if err != nil {
		return nil, err
	}

	out := make([]Skill, 0, len(rows))
	for _, r := range rows {
		out = append(out, Skill{
			ID:           r.ID,
			Title:        r.Title,
			TargetPoints: r.TargetPoints,
			UnitLabel:    r.UnitLabel,
			SortOrder:    r.SortOrder,
			Archived:     r.ArchivedAt != nil,
		})
	}
	return out, nil
}

// Skill возвращает один навык. Чужой или несуществующий — pgx.ErrNoRows,
// который выше превращается в 404.
func (s *Store) Skill(ctx context.Context, userID, id int64) (Skill, error) {
	r, err := s.q.GetSkill(ctx, dbgen.GetSkillParams{ID: id, UserID: userID})
	if err != nil {
		return Skill{}, err
	}
	return Skill{
		ID:           r.ID,
		Title:        r.Title,
		TargetPoints: r.TargetPoints,
		UnitLabel:    r.UnitLabel,
		SortOrder:    r.SortOrder,
		Archived:     r.ArchivedAt != nil,
	}, nil
}

// CreateSkill заводит навык. Создать его сразу архивным нельзя: это не
// состояние, в котором что-то начинают.
func (s *Store) CreateSkill(ctx context.Context, userID int64, in SkillInput) (Skill, error) {
	if err := in.validate(); err != nil {
		return Skill{}, err
	}

	r, err := s.q.CreateSkill(ctx, dbgen.CreateSkillParams{
		UserID:       userID,
		Title:        strings.TrimSpace(in.Title),
		TargetPoints: in.TargetPoints,
		UnitLabel:    strings.TrimSpace(in.UnitLabel),
		SortOrder:    in.SortOrder,
	})
	if err != nil {
		return Skill{}, err
	}
	return Skill{
		ID:           r.ID,
		Title:        r.Title,
		TargetPoints: r.TargetPoints,
		UnitLabel:    r.UnitLabel,
		SortOrder:    r.SortOrder,
		Archived:     r.ArchivedAt != nil,
	}, nil
}

// UpdateSkill правит навык. Метку архивации ставит база: приложение
// сообщает только желаемое состояние.
func (s *Store) UpdateSkill(ctx context.Context, userID, id int64, in SkillInput) (Skill, error) {
	if err := in.validate(); err != nil {
		return Skill{}, err
	}

	r, err := s.q.UpdateSkill(ctx, dbgen.UpdateSkillParams{
		ID:           id,
		UserID:       userID,
		Title:        strings.TrimSpace(in.Title),
		TargetPoints: in.TargetPoints,
		UnitLabel:    strings.TrimSpace(in.UnitLabel),
		SortOrder:    in.SortOrder,
		Archived:     in.Archived,
	})
	if err != nil {
		return Skill{}, err
	}
	return Skill{
		ID:           r.ID,
		Title:        r.Title,
		TargetPoints: r.TargetPoints,
		UnitLabel:    r.UnitLabel,
		SortOrder:    r.SortOrder,
		Archived:     r.ArchivedAt != nil,
	}, nil
}

// DeleteSkill удаляет навык.
//
// Ноль затронутых строк — не удача, а «нет такого»: иначе удаление чужого
// навыка отвечало бы успехом и тем самым сообщало бы, что его нет. Записи
// при этом не удаляются: трекеры теряют ссылку, а накопленные поинты
// остаются — они зафиксированы в момент выполнения.
func (s *Store) DeleteSkill(ctx context.Context, userID, id int64) error {
	n, err := s.q.DeleteSkill(ctx, dbgen.DeleteSkillParams{ID: id, UserID: userID})
	if err != nil {
		return err
	}
	if n == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
