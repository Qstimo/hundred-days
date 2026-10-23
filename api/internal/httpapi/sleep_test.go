package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// sleepJSON — запись сна в виде контракта.
type sleepJSON struct {
	Date            string  `json:"date"`
	WentToBedAt     *string `json:"wentToBedAt"`
	WokeUpAt        *string `json:"wokeUpAt"`
	Quality         *int    `json:"quality"`
	DurationMinutes *int    `json:"durationMinutes"`
}

func sleepPath(date string) string { return "/api/sleep/" + date }

// Главный случай: сон через полночь. Лёг в 23:40, встал в 7:10 — семь с
// половиной часов, а не минус шестнадцать.
func TestSleepDurationAcrossMidnight(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	rec := do(t, srv, cookie, http.MethodPut, sleepPath("2026-10-23"),
		`{"wentToBedAt":"23:40","wokeUpAt":"07:10","quality":4}`)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var out sleepJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Equal(t, "2026-10-23", out.Date)
	require.NotNil(t, out.WentToBedAt)
	require.Equal(t, "23:40", *out.WentToBedAt)
	require.NotNil(t, out.WokeUpAt)
	require.Equal(t, "07:10", *out.WokeUpAt)
	require.NotNil(t, out.Quality)
	require.Equal(t, 4, *out.Quality)
	require.NotNil(t, out.DurationMinutes)
	require.Equal(t, 450, *out.DurationMinutes)
}

func TestSleepDurationWithinOneDay(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	rec := do(t, srv, cookie, http.MethodPut, sleepPath("2026-10-23"),
		`{"wentToBedAt":"01:00","wokeUpAt":"07:00"}`)

	var out sleepJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.NotNil(t, out.DurationMinutes)
	require.Equal(t, 360, *out.DurationMinutes)
}

// Половина данных — не повод выдумывать вторую: длительности нет.
func TestSleepWithOnlyWakeTimeHasNoDuration(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	rec := do(t, srv, cookie, http.MethodPut, sleepPath("2026-10-23"),
		`{"wokeUpAt":"07:00"}`)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var out sleepJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.NotNil(t, out.WokeUpAt)
	require.Nil(t, out.WentToBedAt)
	require.Nil(t, out.DurationMinutes)
}

// Пустая запись законна: блок необязателен целиком.
func TestSleepAllFieldsOptional(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	rec := do(t, srv, cookie, http.MethodPut, sleepPath("2026-10-23"), `{}`)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var out sleepJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Nil(t, out.WentToBedAt)
	require.Nil(t, out.WokeUpAt)
	require.Nil(t, out.Quality)
	require.Nil(t, out.DurationMinutes)
}

// Повторная запись перезаписывает ту же дату, а не плодит строки.
func TestSleepIsIdempotentPerDate(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	do(t, srv, cookie, http.MethodPut, sleepPath("2026-10-23"),
		`{"wentToBedAt":"23:00","wokeUpAt":"06:00","quality":3}`)
	rec := do(t, srv, cookie, http.MethodPut, sleepPath("2026-10-23"),
		`{"wentToBedAt":"22:30","wokeUpAt":"07:00","quality":5}`)

	require.Equal(t, http.StatusOK, rec.Code)

	var out sleepJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Equal(t, "22:30", *out.WentToBedAt)
	require.Equal(t, 5, *out.Quality)
	require.Equal(t, 510, *out.DurationMinutes)
}

// Присланный null стирает прежнее значение, а не оставляет его.
func TestSleepNullClearsValue(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	do(t, srv, cookie, http.MethodPut, sleepPath("2026-10-23"),
		`{"wentToBedAt":"23:00","wokeUpAt":"06:00","quality":3}`)

	rec := do(t, srv, cookie, http.MethodPut, sleepPath("2026-10-23"),
		`{"wentToBedAt":null,"wokeUpAt":"06:00","quality":null}`)

	require.Equal(t, http.StatusOK, rec.Code)

	var out sleepJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Nil(t, out.WentToBedAt)
	require.Nil(t, out.Quality)
	require.Nil(t, out.DurationMinutes, "без времени отхода длительности нет")
}

func TestSleepRejectsQualityOutOfRange(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	for _, q := range []string{"0", "6", "-1"} {
		t.Run("оценка "+q, func(t *testing.T) {
			rec := do(t, srv, cookie, http.MethodPut, sleepPath("2026-10-23"),
				fmt.Sprintf(`{"quality":%s}`, q))

			require.Equal(t, http.StatusUnprocessableEntity, rec.Code)

			var out map[string]string
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
			require.Equal(t, "quality", out["code"])
		})
	}
}

func TestSleepRejectsMalformedTime(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	cases := []struct {
		body string
		code string
	}{
		{`{"wentToBedAt":"25:00"}`, "went_to_bed_at"},
		{`{"wentToBedAt":"7:10"}`, "went_to_bed_at"},
		{`{"wokeUpAt":"полдень"}`, "woke_up_at"},
		{`{"wokeUpAt":"12:60"}`, "woke_up_at"},
	}

	for _, c := range cases {
		t.Run(c.body, func(t *testing.T) {
			rec := do(t, srv, cookie, http.MethodPut, sleepPath("2026-10-23"), c.body)

			require.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())

			var out map[string]string
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
			require.Equal(t, c.code, out["code"])
		})
	}
}

func TestDeleteSleepRemovesRow(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	do(t, srv, cookie, http.MethodPut, sleepPath("2026-10-23"),
		`{"wentToBedAt":"23:00","wokeUpAt":"06:00"}`)

	rec := do(t, srv, cookie, http.MethodDelete, sleepPath("2026-10-23"), "")
	require.Equal(t, http.StatusNoContent, rec.Code)

	again := do(t, srv, cookie, http.MethodDelete, sleepPath("2026-10-23"), "")
	require.Equal(t, http.StatusNotFound, again.Code)
}

// Сон одного пользователя не виден другому.
func TestSleepIsScopedToUser(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	seedUser(t, "someone", "длинный-пароль")

	mine := login(t, srv, "vadim", "длинный-пароль")
	do(t, srv, mine, http.MethodPut, sleepPath("2026-10-23"),
		`{"wentToBedAt":"23:00","wokeUpAt":"06:00"}`)

	// У второго за ту же дату ничего нет — снимать нечего.
	theirs := login(t, srv, "someone", "длинный-пароль")
	rec := do(t, srv, theirs, http.MethodDelete, sleepPath("2026-10-23"), "")

	require.Equal(t, http.StatusNotFound, rec.Code)
}

// Сон можно записать за прошлый день: страница любого дня открыта для правки.
func TestSleepForPastDate(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	rec := do(t, srv, cookie, http.MethodPut, sleepPath("2026-09-01"),
		`{"wentToBedAt":"23:00","wokeUpAt":"06:30"}`)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var out sleepJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Equal(t, "2026-09-01", out.Date)
	require.Equal(t, 450, *out.DurationMinutes)
}
