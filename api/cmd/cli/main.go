// Команды обслуживания: создание аккаунта и смена пароля. Регистрации в
// приложении нет — аккаунт заводится на машине, где стоит стек.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/Qstimo/hundred-days/api/internal/auth"
	"github.com/Qstimo/hundred-days/api/internal/db"
	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
	"github.com/jackc/pgerrcode"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var err error
	switch os.Args[1] {
	case "create-user":
		err = createUser(ctx, os.Args[2:])
	case "set-password":
		err = setPassword(ctx, os.Args[2:])
	default:
		usage()
		os.Exit(2)
	}

	if err != nil {
		fmt.Fprintln(os.Stderr, "ошибка:", err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, `Команды:
  create-user  -login <логин> -name <имя> -password <пароль> [-period-start ГГГГ-ММ-ДД] [-period-days 100]
  set-password -login <логин> -password <пароль>

Строка подключения берётся из HD_DATABASE_URL. Миграции применяет goose, а
не эта команда: схему меняет владелец базы, а приложение ходит отдельной
ролью.`)
}

// open открывает пул по строке из окружения и отдаёт запросы вместе с
// функцией закрытия. Вынесено, чтобы обе команды не повторяли одну проверку.
func open(ctx context.Context) (*dbgen.Queries, func(), error) {
	url := os.Getenv("HD_DATABASE_URL")
	if url == "" {
		return nil, nil, errors.New("HD_DATABASE_URL не задан")
	}

	pool, err := db.Open(ctx, url)
	if err != nil {
		return nil, nil, err
	}
	return dbgen.New(pool), pool.Close, nil
}

func createUser(ctx context.Context, args []string) error {
	fs := flag.NewFlagSet("create-user", flag.ExitOnError)
	login := fs.String("login", "", "логин")
	name := fs.String("name", "", "имя")
	password := fs.String("password", "", "пароль, не короче восьми знаков")
	periodStart := fs.String("period-start", time.Now().Format("2006-01-02"), "дата начала периода")
	periodDays := fs.Int("period-days", 100, "длительность периода в днях")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *login == "" || *password == "" {
		return errors.New("нужны -login и -password")
	}

	start, err := time.Parse("2006-01-02", *periodStart)
	if err != nil {
		return fmt.Errorf("-period-start: %w", err)
	}

	// Пароль проверяется до подключения к базе: негодный пароль не повод
	// открывать соединение.
	hash, err := auth.HashPassword(*password)
	if err != nil {
		return err
	}

	q, closeDB, err := open(ctx)
	if err != nil {
		return err
	}
	defer closeDB()

	user, err := q.CreateUser(ctx, dbgen.CreateUserParams{
		Login:        *login,
		Name:         *name,
		PasswordHash: hash,
	})
	if err != nil {
		// Занятый логин — обычный случай, а не сбой: человек не должен
		// читать текст ошибки СУБД, чтобы это понять.
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgerrcode.UniqueViolation {
			return fmt.Errorf("логин %s уже занят", *login)
		}
		return fmt.Errorf("не вышло создать аккаунт: %w", err)
	}

	// Настройки создаются сразу: без строки настроек не посчитать период, а
	// заставлять человека заполнять их до первого экрана незачем.
	if _, err := q.UpsertSettings(ctx, dbgen.UpsertSettingsParams{
		UserID:       user.ID,
		PeriodTitle:  "100 дней до",
		PeriodStart:  start,
		PeriodDays:   int32(*periodDays),
		SleepEnabled: true,
	}); err != nil {
		return fmt.Errorf("не вышло создать настройки: %w", err)
	}

	fmt.Printf("аккаунт %s создан, идентификатор %d, период с %s на %d дней\n",
		user.Login, user.ID, start.Format("2006-01-02"), *periodDays)
	return nil
}

func setPassword(ctx context.Context, args []string) error {
	fs := flag.NewFlagSet("set-password", flag.ExitOnError)
	login := fs.String("login", "", "логин")
	password := fs.String("password", "", "новый пароль")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *login == "" || *password == "" {
		return errors.New("нужны -login и -password")
	}

	hash, err := auth.HashPassword(*password)
	if err != nil {
		return err
	}

	q, closeDB, err := open(ctx)
	if err != nil {
		return err
	}
	defer closeDB()

	user, err := q.GetUserByLogin(ctx, *login)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("нет аккаунта с логином %s", *login)
		}
		return err
	}

	if err := q.UpdatePasswordHash(ctx, dbgen.UpdatePasswordHashParams{
		ID: user.ID, PasswordHash: hash,
	}); err != nil {
		return err
	}

	// Сессии не трогаем намеренно: смена пароля не повод выкидывать себя же
	// с телефона. Понадобится — добавится отдельный ключ.
	fmt.Println("пароль изменён, сессии оставлены")
	return nil
}
