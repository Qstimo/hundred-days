package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
	"github.com/stretchr/testify/require"
)

// entryJSON — отметка в виде контракта.
type entryJSON struct {
	Date          string   `json:"date"`
	Hours         *float64 `json:"hours"`
	PointsAwarded float64  `json:"pointsAwarded"`
}

// entryPath собирает путь отметки.
func entryPath(trackerID int64, date string) string {
	return fmt.Sprintf("/api/trackers/%d/entries/%s", trackerID, date)
}

// entryInDB читает отметку прямо из базы: ответ ручки мог бы вернуть
// присланное, ничего не записав.
func entryInDB(t *testing.T, userID, trackerID int64, date string) (float64, *float64, bool) {
	t.Helper()

	d, err := time.Parse("2006-01-02", date)
	require.NoError(t, err)

	rows, err := dbgen.New(testPool).ListEntriesForDate(context.Background(),
		dbgen.ListEntriesForDateParams{UserID: userID, EntryDate: d})
	require.NoError(t, err)

	for _, r := range rows {
		if r.TrackerID == trackerID {
			return r.PointsAwarded, r.Hours, true
		}
	}
	return 0, nil, false
}

// Поинты фиксируются в записи. Правка цены трекера не переписывает прошлое:
// иначе «забрано 240 из 300» менялось бы от настройки, а не от работы.
func TestEntryKeepsPointsAfterTrackerPriceChange(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})

	// Отметили при цене 1.
	rec := do(t, srv, cookie, http.MethodPut, entryPath(trackerID, "2026-10-20"), "")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	// Подняли цену до 5.
	upd := do(t, srv, cookie, http.MethodPut, fmt.Sprintf("/api/trackers/%d", trackerID),
		`{"title":"Занятие","mode":"check","pointsRule":"per_check",
		  "pointsValue":5,"weeklyTarget":3}`)
	require.Equal(t, http.StatusOK, upd.Code, upd.Body.String())

	// У старой записи поинты прежние.
	points, _, found := entryInDB(t, userID, trackerID, "2026-10-20")
	require.True(t, found)
	require.Equal(t, 1.0, points, "старая отметка должна сохранить прежние поинты")

	// А у новой — новые.
	rec = do(t, srv, cookie, http.MethodPut, entryPath(trackerID, "2026-10-21"), "")
	require.Equal(t, http.StatusOK, rec.Code)

	var out entryJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Equal(t, 5.0, out.PointsAwarded)
}

// Правило «за час» без часов — 422: отметить выполнение, не сказав сколько,
// значит начислить ноль, и это почти наверняка ошибка пользователя.
func TestEntryPerHourRequiresHours(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Чтение", Mode: "check_hours", Rule: "per_hour", Value: 1, WeeklyTarget: 3,
	})

	for _, body := range []string{"", `{}`, `{"hours":null}`} {
		t.Run("тело "+body, func(t *testing.T) {
			rec := do(t, srv, cookie, http.MethodPut,
				entryPath(trackerID, "2026-10-23"), body)

			require.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())

			var out map[string]string
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
			require.Equal(t, "hours_required", out["code"])
		})
	}
}

// Часы умножаются на цену: полтора часа по два поинта — три.
func TestEntryPerHourMultiplies(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Чтение", Mode: "check_hours", Rule: "per_hour", Value: 2, WeeklyTarget: 3,
	})

	rec := do(t, srv, cookie, http.MethodPut,
		entryPath(trackerID, "2026-10-23"), `{"hours":1.5}`)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var out entryJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Equal(t, 3.0, out.PointsAwarded)
	require.NotNil(t, out.Hours)
	require.Equal(t, 1.5, *out.Hours)
}

// Трекер без часов часы игнорирует, а не отвергает: лишнее поле в теле
// запроса не повод ломать отметку.
func TestEntryIgnoresHoursOnCheckOnlyTracker(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Зарядка", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 7,
	})

	rec := do(t, srv, cookie, http.MethodPut,
		entryPath(trackerID, "2026-10-23"), `{"hours":3}`)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var out entryJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Nil(t, out.Hours, "часы у трекера без часов не записываются")
	require.Equal(t, 1.0, out.PointsAwarded)
}

// Повторная отметка перезаписывает, а не плодит дубли.
func TestEntryIsIdempotentPerDay(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Чтение", Mode: "check_hours", Rule: "per_hour", Value: 1, WeeklyTarget: 3,
	})

	for _, h := range []string{`{"hours":1}`, `{"hours":2}`, `{"hours":2.5}`} {
		rec := do(t, srv, cookie, http.MethodPut, entryPath(trackerID, "2026-10-23"), h)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	}

	// В базе одна строка с последними значениями.
	var count int
	err := testPool.QueryRow(context.Background(),
		`SELECT count(*) FROM entries WHERE tracker_id = $1 AND entry_date = $2`,
		trackerID, time.Date(2026, 10, 23, 0, 0, 0, 0, time.UTC)).Scan(&count)
	require.NoError(t, err)
	require.Equal(t, 1, count)

	points, hours, found := entryInDB(t, userID, trackerID, "2026-10-23")
	require.True(t, found)
	require.Equal(t, 2.5, points)
	require.NotNil(t, hours)
	require.Equal(t, 2.5, *hours)
}

// Снятие отметки удаляет строку: отдельного значения «не сделано» нет.
func TestDeleteEntryRemovesRow(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})

	do(t, srv, cookie, http.MethodPut, entryPath(trackerID, "2026-10-23"), "")
	_, _, found := entryInDB(t, userID, trackerID, "2026-10-23")
	require.True(t, found)

	rec := do(t, srv, cookie, http.MethodDelete, entryPath(trackerID, "2026-10-23"), "")
	require.Equal(t, http.StatusNoContent, rec.Code)

	_, _, found = entryInDB(t, userID, trackerID, "2026-10-23")
	require.False(t, found, "строка должна быть удалена")

	// Повторное снятие — 404: нечего снимать.
	again := do(t, srv, cookie, http.MethodDelete, entryPath(trackerID, "2026-10-23"), "")
	require.Equal(t, http.StatusNotFound, again.Code)
}

// Любой день открыт для правки, в том числе давний.
func TestEntryCanBeWrittenForPastDate(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})

	rec := do(t, srv, cookie, http.MethodPut, entryPath(trackerID, "2026-01-15"), "")

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var out entryJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Equal(t, "2026-01-15", out.Date)
}

// Будущая дата отвергается: отметить то, чего ещё не было, нельзя.
func TestEntryRejectsFutureDate(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})

	rec := do(t, srv, cookie, http.MethodPut, entryPath(trackerID, "2026-10-24"), "")

	require.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())

	var out map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Equal(t, "future_date", out["code"])
}

// Сегодняшняя дата по зоне приложения отметить можно, даже если по UTC это
// ещё вчера: иначе в полночь по Москве день нельзя было бы закрыть.
func TestEntryTodayInApplicationTimezoneIsAllowed(t *testing.T) {
	moscow, err := time.LoadLocation("Europe/Moscow")
	require.NoError(t, err)

	// 24 октября 00:30 по Москве = 23 октября 21:30 UTC.
	srv := newTestServer(t, time.Date(2026, 10, 24, 0, 30, 0, 0, moscow))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})

	rec := do(t, srv, cookie, http.MethodPut, entryPath(trackerID, "2026-10-24"), "")

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
}

func TestEntryOnAlienTrackerIs404(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	otherID := seedUser(t, "someone", "длинный-пароль")
	alien := seedTracker(t, otherID, seedTrackerInput{
		Title: "Чужой", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})

	cookie := login(t, srv, "vadim", "длинный-пароль")

	t.Run("отметить", func(t *testing.T) {
		rec := do(t, srv, cookie, http.MethodPut, entryPath(alien, "2026-10-23"), "")
		require.Equal(t, http.StatusNotFound, rec.Code)
	})

	t.Run("снять", func(t *testing.T) {
		rec := do(t, srv, cookie, http.MethodDelete, entryPath(alien, "2026-10-23"), "")
		require.Equal(t, http.StatusNotFound, rec.Code)
	})

	_, _, found := entryInDB(t, otherID, alien, "2026-10-23")
	require.False(t, found, "чужой трекер не должен получить отметку")
}

func TestEntryRejectsGarbageDate(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})

	for _, d := range []string{"вчера", "2026-13-01", "2026-10-32", "20261023"} {
		t.Run(d, func(t *testing.T) {
			rec := do(t, srv, cookie, http.MethodPut, entryPath(trackerID, d), "")

			require.Equal(t, http.StatusNotFound, rec.Code, rec.Body.String())
		})
	}
}

// Отрицательные и запредельные часы отвергаются: ограничение стоит и в базе,
// но ответ должен быть понятным.
func TestEntryRejectsHoursOutOfRange(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Чтение", Mode: "check_hours", Rule: "per_hour", Value: 1, WeeklyTarget: 3,
	})

	for _, h := range []string{"-1", "0", "25"} {
		t.Run("часы "+h, func(t *testing.T) {
			rec := do(t, srv, cookie, http.MethodPut,
				entryPath(trackerID, "2026-10-23"), fmt.Sprintf(`{"hours":%s}`, h))

			require.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())

			var out map[string]string
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
			require.Equal(t, "hours", out["code"])
		})
	}
}
