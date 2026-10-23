package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Qstimo/hundred-days/api/internal/auth"
	"github.com/Qstimo/hundred-days/api/internal/config"
	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
	"github.com/stretchr/testify/require"
)

// newTestServer собирает приложение на тестовой базе с застывшим «сегодня»:
// иначе тест на остаток дней периода менял бы ответ каждые сутки.
func newTestServer(t *testing.T, today time.Time) http.Handler {
	t.Helper()
	truncateAll(t)

	loc, err := time.LoadLocation("Europe/Moscow")
	require.NoError(t, err)

	cfg := config.Config{
		Location:   loc,
		SessionTTL: 30 * 24 * time.Hour,
	}

	return NewRouter(testPool, cfg, func() time.Time { return today })
}

// seedUser заводит пользователя с настройками прямо в базе, минуя API:
// заводить его через ручки было бы проверкой не того, что проверяется.
func seedUser(t *testing.T, login, password string) int64 {
	t.Helper()

	hash, err := auth.HashPassword(password)
	require.NoError(t, err)

	q := dbgen.New(testPool)
	u, err := q.CreateUser(context.Background(), dbgen.CreateUserParams{
		Login: login, Name: "Тест", PasswordHash: hash,
	})
	require.NoError(t, err)

	_, err = q.UpsertSettings(context.Background(), dbgen.UpsertSettingsParams{
		UserID:       u.ID,
		PeriodTitle:  "100 дней до",
		PeriodStart:  time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC),
		PeriodDays:   100,
		SleepEnabled: true,
	})
	require.NoError(t, err)

	return u.ID
}

// login входит и возвращает cookie сессии.
func login(t *testing.T, srv http.Handler, l, p string) *http.Cookie {
	t.Helper()

	body, err := json.Marshal(map[string]string{"login": l, "password": p})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	cookies := rec.Result().Cookies()
	require.Len(t, cookies, 1)
	return cookies[0]
}

func TestLoginSetsCookieAndMeWorks(t *testing.T) {
	today := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	srv := newTestServer(t, today)
	seedUser(t, "vadim", "длинный-пароль")

	body, err := json.Marshal(map[string]string{
		"login": "vadim", "password": "длинный-пароль",
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	srv.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	cookies := rec.Result().Cookies()
	require.Len(t, cookies, 1)
	cookie := cookies[0]
	require.Equal(t, auth.SessionCookieName, cookie.Name)
	require.True(t, cookie.HttpOnly, "cookie сессии должна быть недоступна скриптам")
	require.Equal(t, http.SameSiteLaxMode, cookie.SameSite)
	require.Equal(t, "/", cookie.Path)
	require.False(t, cookie.Secure, "по HTTP флаг Secure сделал бы вход невозможным")

	// С cookie «я» отвечает.
	meReq := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	meReq.AddCookie(cookie)
	meRec := httptest.NewRecorder()
	srv.ServeHTTP(meRec, meReq)

	require.Equal(t, http.StatusOK, meRec.Code)

	var me map[string]any
	require.NoError(t, json.Unmarshal(meRec.Body.Bytes(), &me))
	require.Equal(t, "vadim", me["login"])
	require.Equal(t, "Тест", me["name"])
}

func TestLoginRejectsWrongPassword(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")

	body, err := json.Marshal(map[string]string{
		"login": "vadim", "password": "не тот пароль",
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	srv.ServeHTTP(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
	require.Empty(t, rec.Result().Cookies(), "отказ не должен выдавать cookie")
}

// Неизвестный логин и неверный пароль отвечают одинаково: разный ответ
// сказал бы, какие логины существуют.
func TestLoginHidesWhetherLoginExists(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")

	var bodies []string
	for _, l := range []string{"vadim", "никого-такого-нет"} {
		body, err := json.Marshal(map[string]string{"login": l, "password": "мимо"})
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		srv.ServeHTTP(rec, req)

		require.Equal(t, http.StatusUnauthorized, rec.Code, "логин %s", l)
		bodies = append(bodies, rec.Body.String())
	}

	require.Equal(t, bodies[0], bodies[1], "тела ответов должны совпадать дословно")
}

func TestMeWithoutCookieIs401(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	rec := httptest.NewRecorder()

	srv.ServeHTTP(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

// Выдуманная cookie не должна отличаться по ответу от отсутствующей, а ещё
// должна гаситься: иначе браузер носил бы мёртвый ключ месяцами.
func TestMeWithUnknownCookieIs401AndClearsIt(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: "выдуманная"})
	rec := httptest.NewRecorder()

	srv.ServeHTTP(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)

	cookies := rec.Result().Cookies()
	require.Len(t, cookies, 1)
	require.Equal(t, auth.SessionCookieName, cookies[0].Name)
	require.Equal(t, -1, cookies[0].MaxAge, "cookie должна гаситься")
}

// Истёкшая сессия отвергается, а её строка удаляется из базы.
func TestExpiredSessionIsRejectedAndDeleted(t *testing.T) {
	today := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	srv := newTestServer(t, today)
	userID := seedUser(t, "vadim", "длинный-пароль")

	q := dbgen.New(testPool)
	id, err := auth.NewSessionID()
	require.NoError(t, err)
	require.NoError(t, q.CreateSession(context.Background(), dbgen.CreateSessionParams{
		ID: id, UserID: userID, ExpiresAt: today.Add(-time.Hour),
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: id})
	rec := httptest.NewRecorder()

	srv.ServeHTTP(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)

	_, err = q.GetSessionByID(context.Background(), id)
	require.Error(t, err, "истёкшая сессия должна быть удалена")
}

// Продление скользящее: сессия, которой осталось меньше половины срока,
// обновляется и выдаёт новую cookie.
func TestSessionIsExtendedWhenHalfSpent(t *testing.T) {
	today := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	srv := newTestServer(t, today)
	userID := seedUser(t, "vadim", "длинный-пароль")

	q := dbgen.New(testPool)
	id, err := auth.NewSessionID()
	require.NoError(t, err)
	nearExpiry := today.Add(10 * 24 * time.Hour)
	require.NoError(t, q.CreateSession(context.Background(), dbgen.CreateSessionParams{
		ID: id, UserID: userID, ExpiresAt: nearExpiry,
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: id})
	rec := httptest.NewRecorder()

	srv.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Len(t, rec.Result().Cookies(), 1, "продление выдаёт свежую cookie")

	sess, err := q.GetSessionByID(context.Background(), id)
	require.NoError(t, err)
	require.True(t, sess.ExpiresAt.After(nearExpiry), "срок должен уехать вперёд")
}

// Свежая сессия не продлевается: запись в базу на каждом запросе — пустая
// работа.
func TestFreshSessionIsNotExtended(t *testing.T) {
	today := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	srv := newTestServer(t, today)
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()

	srv.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Empty(t, rec.Result().Cookies(), "свежей сессии продление не нужно")
}

func TestLogoutDeletesSessionAndClearsCookie(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()

	srv.ServeHTTP(rec, req)

	require.Equal(t, http.StatusNoContent, rec.Code)
	require.Equal(t, -1, rec.Result().Cookies()[0].MaxAge)

	// Старая cookie больше не работает.
	meReq := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	meReq.AddCookie(cookie)
	meRec := httptest.NewRecorder()
	srv.ServeHTTP(meRec, meReq)

	require.Equal(t, http.StatusUnauthorized, meRec.Code)
}

// Выход без cookie — тоже успех: он должен быть идемпотентным.
func TestLogoutWithoutCookieSucceeds(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))

	req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	rec := httptest.NewRecorder()

	srv.ServeHTTP(rec, req)

	require.Equal(t, http.StatusNoContent, rec.Code)
}

// Период вычисляется, а не хранится: начало 1 октября, сто дней, сегодня
// 23 октября — двадцать третий день, осталось 78.
func TestSettingsReturnsComputedPeriod(t *testing.T) {
	today := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	srv := newTestServer(t, today)
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	req := httptest.NewRequest(http.MethodGet, "/api/settings", nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()

	srv.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var out struct {
		Settings struct {
			PeriodTitle  string `json:"periodTitle"`
			PeriodStart  string `json:"periodStart"`
			PeriodDays   int    `json:"periodDays"`
			SleepEnabled bool   `json:"sleepEnabled"`
		} `json:"settings"`
		Period struct {
			Today     string `json:"today"`
			DayNumber int    `json:"dayNumber"`
			DaysLeft  int    `json:"daysLeft"`
			Days      int    `json:"days"`
		} `json:"period"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))

	require.Equal(t, "2026-10-01", out.Settings.PeriodStart)
	require.Equal(t, "2026-10-23", out.Period.Today,
		"период несёт сегодняшнюю дату: по ней дашборд отсчитывает отрезки")
	require.Equal(t, 100, out.Settings.PeriodDays)
	require.True(t, out.Settings.SleepEnabled)
	require.Equal(t, 23, out.Period.DayNumber)
	require.Equal(t, 78, out.Period.DaysLeft)
}

// «Сегодня» определяет зона приложения, а не UTC: в 00:30 по Москве это
// ещё 21:30 предыдущего дня по UTC, и день периода должен считаться
// по московской дате.
func TestTodayUsesApplicationTimezone(t *testing.T) {
	moscow, err := time.LoadLocation("Europe/Moscow")
	require.NoError(t, err)

	// 24 октября 00:30 по Москве = 23 октября 21:30 UTC.
	midnightish := time.Date(2026, 10, 24, 0, 30, 0, 0, moscow)
	require.Equal(t, 23, midnightish.UTC().Day(), "предпосылка теста")

	srv := newTestServer(t, midnightish)
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	req := httptest.NewRequest(http.MethodGet, "/api/settings", nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()

	srv.ServeHTTP(rec, req)

	var out struct {
		Period struct {
			DayNumber int `json:"dayNumber"`
		} `json:"period"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Equal(t, 24, out.Period.DayNumber, "по московской дате это 24-й день")
}

func TestPutSettingsSaves(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	body := `{"periodTitle":"100 дней до запуска","periodStart":"2026-11-01",
	          "periodDays":60,"sleepEnabled":false}`
	req := httptest.NewRequest(http.MethodPut, "/api/settings", bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()

	srv.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	// Перечитываем: ответ мог бы вернуть присланное, не записав.
	getReq := httptest.NewRequest(http.MethodGet, "/api/settings", nil)
	getReq.AddCookie(cookie)
	getRec := httptest.NewRecorder()
	srv.ServeHTTP(getRec, getReq)

	var out struct {
		Settings struct {
			PeriodTitle  string `json:"periodTitle"`
			PeriodStart  string `json:"periodStart"`
			PeriodDays   int    `json:"periodDays"`
			SleepEnabled bool   `json:"sleepEnabled"`
		} `json:"settings"`
		Period struct {
			DayNumber int `json:"dayNumber"`
			DaysLeft  int `json:"daysLeft"`
		} `json:"period"`
	}
	require.NoError(t, json.Unmarshal(getRec.Body.Bytes(), &out))

	require.Equal(t, "100 дней до запуска", out.Settings.PeriodTitle)
	require.Equal(t, "2026-11-01", out.Settings.PeriodStart)
	require.Equal(t, 60, out.Settings.PeriodDays)
	require.False(t, out.Settings.SleepEnabled)
	// Период ещё не начался: номер дня ноль, впереди все 60.
	require.Equal(t, 0, out.Period.DayNumber)
	require.Equal(t, 60, out.Period.DaysLeft)
}

func TestPutSettingsRejectsBadInput(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	cases := []struct {
		name     string
		body     string
		wantCode string
	}{
		{
			name:     "дата не разобрана",
			body:     `{"periodTitle":"a","periodStart":"вчера","periodDays":10,"sleepEnabled":true}`,
			wantCode: "period_start",
		},
		{
			name:     "длительность ноль",
			body:     `{"periodTitle":"a","periodStart":"2026-10-01","periodDays":0,"sleepEnabled":true}`,
			wantCode: "period_days",
		},
		{
			name:     "длительность сверх предела",
			body:     `{"periodTitle":"a","periodStart":"2026-10-01","periodDays":4000,"sleepEnabled":true}`,
			wantCode: "period_days",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPut, "/api/settings",
				bytes.NewReader([]byte(c.body)))
			req.Header.Set("Content-Type", "application/json")
			req.AddCookie(cookie)
			rec := httptest.NewRecorder()

			srv.ServeHTTP(rec, req)

			require.Equal(t, http.StatusUnprocessableEntity, rec.Code)

			var out map[string]string
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
			require.Equal(t, c.wantCode, out["code"])
		})
	}
}

// Чужие данные не видны: у каждого свой период.
func TestSettingsAreScopedToUser(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	otherID := seedUser(t, "someone", "длинный-пароль")

	// Чужому периоду задаём приметную длительность.
	q := dbgen.New(testPool)
	_, err := q.UpsertSettings(context.Background(), dbgen.UpsertSettingsParams{
		UserID:       otherID,
		PeriodTitle:  "чужое",
		PeriodStart:  time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
		PeriodDays:   7,
		SleepEnabled: false,
	})
	require.NoError(t, err)

	cookie := login(t, srv, "vadim", "длинный-пароль")
	req := httptest.NewRequest(http.MethodGet, "/api/settings", nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()

	srv.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.NotContains(t, rec.Body.String(), "чужое")
}

// Живость открыта без сессии: её спрашивает docker compose.
func TestHealthNeedsNoSession(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()

	srv.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
}
