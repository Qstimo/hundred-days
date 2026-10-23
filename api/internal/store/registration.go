package store

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/Qstimo/hundred-days/api/internal/auth"
	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
	"github.com/jackc/pgerrcode"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// ErrRegistrationClosed — аккаунт уже есть, и регистрация закрыта.
var ErrRegistrationClosed = errors.New("регистрация закрыта")

// ErrLoginTaken — логин занят. Возможен только в состязании двух запросов:
// при закрытой регистрации до вставки дело не доходит.
var ErrLoginTaken = errors.New("логин занят")

// ErrEmptyLogin — логин из одних пробелов.
var ErrEmptyLogin = errors.New("логин пустой")

// RegistrationOpen отвечает, можно ли завести аккаунт.
//
// Ответ годится только для подсказки в интерфейсе: к моменту самой
// регистрации он может устареть. Решает та же проверка внутри вставки.
func (s *Store) RegistrationOpen(ctx context.Context) (bool, error) {
	exists, err := s.q.AnyUserExists(ctx)
	if err != nil {
		return false, err
	}
	return !exists, nil
}

// Register заводит первый аккаунт вместе со строкой настроек.
//
// Проверка «аккаунтов ещё нет» живёт внутри вставки, а не перед ней: иначе
// два одновременных запроса прошли бы проверку оба и создали два «первых»
// аккаунта. Ноль вставленных строк и есть «закрыто».
//
// Настройки создаются сразу: без них не посчитать период, а заставлять
// человека заполнять их до первого экрана незачем.
func (s *Store) Register(
	ctx context.Context, login, name, password string, today time.Time, periodDays int32,
) (dbgen.RegisterFirstUserRow, error) {
	login = strings.TrimSpace(login)
	if login == "" {
		return dbgen.RegisterFirstUserRow{}, ErrEmptyLogin
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		return dbgen.RegisterFirstUserRow{}, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return dbgen.RegisterFirstUserRow{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	q := s.q.WithTx(tx)

	user, err := q.RegisterFirstUser(ctx, dbgen.RegisterFirstUserParams{
		Login:        login,
		Name:         strings.TrimSpace(name),
		PasswordHash: hash,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return dbgen.RegisterFirstUserRow{}, ErrRegistrationClosed
		}

		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgerrcode.UniqueViolation {
			return dbgen.RegisterFirstUserRow{}, ErrLoginTaken
		}
		return dbgen.RegisterFirstUserRow{}, err
	}

	if _, err := q.UpsertSettings(ctx, dbgen.UpsertSettingsParams{
		UserID:       user.ID,
		PeriodTitle:  "100 дней до",
		PeriodStart:  today,
		PeriodDays:   periodDays,
		SleepEnabled: true,
	}); err != nil {
		return dbgen.RegisterFirstUserRow{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return dbgen.RegisterFirstUserRow{}, err
	}
	return user, nil
}
