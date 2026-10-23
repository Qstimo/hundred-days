package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/Qstimo/hundred-days/api/internal/auth"
	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
	"github.com/stretchr/testify/require"
)

func TestRegistrationOpenWhenNoAccounts(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))

	rec := do(t, srv, nil, http.MethodGet, "/api/auth/registration", "")

	require.Equal(t, http.StatusOK, rec.Code)

	var out struct {
		IsOpen bool `json:"isOpen"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.True(t, out.IsOpen)
}

// Закрывается сама после первого аккаунта: открытая регистрация на адресе
// без TLS означала бы, что аккаунт создаст любой, кто наткнётся на него.
func TestRegistrationClosesAfterFirstAccount(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")

	rec := do(t, srv, nil, http.MethodGet, "/api/auth/registration", "")

	var out struct {
		IsOpen bool `json:"isOpen"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.False(t, out.IsOpen)
}

func TestRegisterCreatesAccountAndSignsIn(t *testing.T) {
	today := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	srv := newTestServer(t, today)

	rec := do(t, srv, nil, http.MethodPost, "/api/auth/register",
		`{"login":"vadim","name":"Вадим","password":"длинный-пароль"}`)

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	var user map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &user))
	require.Equal(t, "vadim", user["login"])
	require.Equal(t, "Вадим", user["name"])

	// Входит сразу: заставлять вводить ту же пару второй раз незачем.
	cookies := rec.Result().Cookies()
	require.Len(t, cookies, 1)
	require.Equal(t, auth.SessionCookieName, cookies[0].Name)
	require.True(t, cookies[0].HttpOnly)

	meRec := do(t, srv, cookies[0], http.MethodGet, "/api/auth/me", "")
	require.Equal(t, http.StatusOK, meRec.Code)
}

// Без строки настроек не посчитать период, и первый экран был бы пустым.
func TestRegisterCreatesSettingsWithHundredDays(t *testing.T) {
	today := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	srv := newTestServer(t, today)

	rec := do(t, srv, nil, http.MethodPost, "/api/auth/register",
		`{"login":"vadim","password":"длинный-пароль"}`)
	require.Equal(t, http.StatusCreated, rec.Code)

	cookie := rec.Result().Cookies()[0]
	settingsRec := do(t, srv, cookie, http.MethodGet, "/api/settings", "")

	var out struct {
		Settings struct {
			PeriodStart string `json:"periodStart"`
			PeriodDays  int    `json:"periodDays"`
		} `json:"settings"`
		Period struct {
			DayNumber int `json:"dayNumber"`
		} `json:"period"`
	}
	require.NoError(t, json.Unmarshal(settingsRec.Body.Bytes(), &out))

	require.Equal(t, "2026-10-23", out.Settings.PeriodStart, "период начинается сегодня")
	require.Equal(t, 100, out.Settings.PeriodDays)
	require.Equal(t, 1, out.Period.DayNumber, "сегодня — первый день")
}

func TestRegisterRejectsSecondAccount(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")

	rec := do(t, srv, nil, http.MethodPost, "/api/auth/register",
		`{"login":"someone","password":"длинный-пароль"}`)

	require.Equal(t, http.StatusConflict, rec.Code)

	var out map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Equal(t, "registration_closed", out["code"])
}

func TestRegisterRejectsShortPassword(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))

	rec := do(t, srv, nil, http.MethodPost, "/api/auth/register",
		`{"login":"vadim","password":"1234567"}`)

	require.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())

	var out map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Equal(t, "password", out["code"])
}

// Длина считается в знаках: семь русских букв — четырнадцать байт, и
// проверка по байтам пропустила бы такой пароль.
func TestRegisterCountsPasswordInRunes(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))

	rec := do(t, srv, nil, http.MethodPost, "/api/auth/register",
		`{"login":"vadim","password":"паролик"}`)

	require.Equal(t, http.StatusUnprocessableEntity, rec.Code)
}

func TestRegisterRejectsEmptyLogin(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))

	for _, login := range []string{"", "   "} {
		rec := do(t, srv, nil, http.MethodPost, "/api/auth/register",
			`{"login":"`+login+`","password":"длинный-пароль"}`)

		require.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())
	}
}

func TestRegisterTrimsLoginAndName(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))

	rec := do(t, srv, nil, http.MethodPost, "/api/auth/register",
		`{"login":"  vadim  ","name":"  Вадим  ","password":"длинный-пароль"}`)

	require.Equal(t, http.StatusCreated, rec.Code)

	var user map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &user))
	require.Equal(t, "vadim", user["login"])
	require.Equal(t, "Вадим", user["name"])
}

// Главное место, где можно промахнуться: отдельная проверка «аккаунтов нет»
// перед вставкой оставила бы щель, в которую два одновременных запроса
// создали бы два «первых» аккаунта. Проверка живёт внутри вставки.
func TestRegisterIsRaceFree(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))

	const attempts = 8
	codes := make([]int, attempts)

	var wg sync.WaitGroup
	for i := range attempts {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			rec := do(t, srv, nil, http.MethodPost, "/api/auth/register",
				`{"login":"user`+string(rune('a'+i))+`","password":"длинный-пароль"}`)
			codes[i] = rec.Code
		}(i)
	}
	wg.Wait()

	created := 0
	for _, c := range codes {
		if c == http.StatusCreated {
			created++
		}
	}
	require.Equal(t, 1, created, "создаться должен ровно один аккаунт, коды: %v", codes)

	// В базе тоже ровно один.
	var count int
	require.NoError(t, testPool.QueryRow(context.Background(),
		`SELECT count(*) FROM users`).Scan(&count))
	require.Equal(t, 1, count)

	// И у него есть настройки: транзакция либо целиком, либо никак.
	var settings int
	require.NoError(t, testPool.QueryRow(context.Background(),
		`SELECT count(*) FROM settings`).Scan(&settings))
	require.Equal(t, 1, settings)
}

// Пароль хранится хешем, а не как есть.
func TestRegisterStoresPasswordHashed(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))

	do(t, srv, nil, http.MethodPost, "/api/auth/register",
		`{"login":"vadim","password":"длинный-пароль"}`)

	user, err := dbgen.New(testPool).GetUserByLogin(context.Background(), "vadim")
	require.NoError(t, err)
	require.NotContains(t, user.PasswordHash, "длинный-пароль")
	require.Contains(t, user.PasswordHash, "$argon2id$")

	ok, err := auth.VerifyPassword("длинный-пароль", user.PasswordHash)
	require.NoError(t, err)
	require.True(t, ok)
}
