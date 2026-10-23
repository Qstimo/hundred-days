package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// planJSON — пункт плана в виде контракта.
type planJSON struct {
	ID            int64   `json:"id"`
	Date          string  `json:"date"`
	Title         string  `json:"title"`
	Done          bool    `json:"done"`
	DoneAt        *string `json:"doneAt"`
	SortOrder     int     `json:"sortOrder"`
	CarriedFromID *int64  `json:"carriedFromId"`
}

// createPlan добавляет пункт и возвращает его.
func createPlan(t *testing.T, srv http.Handler, cookie *http.Cookie,
	date, title string,
) planJSON {
	t.Helper()

	rec := do(t, srv, cookie, http.MethodPost, "/api/day-plans",
		fmt.Sprintf(`{"date":%q,"title":%q}`, date, title))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	var out planJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	return out
}

// markDone закрывает пункт.
func markDone(t *testing.T, srv http.Handler, cookie *http.Cookie, id int64) planJSON {
	t.Helper()

	rec := do(t, srv, cookie, http.MethodPatch,
		fmt.Sprintf("/api/day-plans/%d", id), `{"done":true}`)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var out planJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	return out
}

// carryOver подтягивает незакрытые со вчера.
func carryOver(t *testing.T, srv http.Handler, cookie *http.Cookie, date string) []planJSON {
	t.Helper()

	rec := do(t, srv, cookie, http.MethodPost, "/api/day-plans/carry-over",
		fmt.Sprintf(`{"date":%q}`, date))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var out []planJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	return out
}

func TestCreatePlan(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	plan := createPlan(t, srv, cookie, "2026-10-23", "Написать план")

	require.NotZero(t, plan.ID)
	require.Equal(t, "2026-10-23", plan.Date)
	require.Equal(t, "Написать план", plan.Title)
	require.False(t, plan.Done)
	require.Nil(t, plan.DoneAt)
	require.Nil(t, plan.CarriedFromID)
}

func TestPlanRejectsEmptyTitle(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	for _, title := range []string{"", "   "} {
		rec := do(t, srv, cookie, http.MethodPost, "/api/day-plans",
			fmt.Sprintf(`{"date":"2026-10-23","title":%q}`, title))

		require.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())

		var out map[string]string
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
		require.Equal(t, "title", out["code"])
	}
}

// Закрытие ставит метку времени, открытие — снимает.
func TestPlanDoneTogglesTimestamp(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	plan := createPlan(t, srv, cookie, "2026-10-23", "Пункт")

	closed := markDone(t, srv, cookie, plan.ID)
	require.True(t, closed.Done)
	require.NotNil(t, closed.DoneAt)

	rec := do(t, srv, cookie, http.MethodPatch,
		fmt.Sprintf("/api/day-plans/%d", plan.ID), `{"done":false}`)
	require.Equal(t, http.StatusOK, rec.Code)

	var reopened planJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &reopened))
	require.False(t, reopened.Done)
	require.Nil(t, reopened.DoneAt)
}

// Правка касается только присланных полей: отсутствие поля — «не менять».
func TestPlanPatchTouchesOnlySentFields(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	plan := createPlan(t, srv, cookie, "2026-10-23", "Исходный текст")
	markDone(t, srv, cookie, plan.ID)

	// Правим только текст — закрытость должна остаться.
	rec := do(t, srv, cookie, http.MethodPatch,
		fmt.Sprintf("/api/day-plans/%d", plan.ID), `{"title":"Новый текст"}`)
	require.Equal(t, http.StatusOK, rec.Code)

	var out planJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Equal(t, "Новый текст", out.Title)
	require.True(t, out.Done, "закрытость не должна сброситься")
}

// Перенос копирует незакрытые пункты предыдущего дня в указанный, оставляя
// в исходном дне след: видно, что планировалось и уехало, а не исчезло.
func TestCarryOverCopiesUnfinishedFromPreviousDay(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	done := createPlan(t, srv, cookie, "2026-10-22", "Сделанное")
	undone := createPlan(t, srv, cookie, "2026-10-22", "Несделанное")
	markDone(t, srv, cookie, done.ID)

	created := carryOver(t, srv, cookie, "2026-10-23")

	require.Len(t, created, 1)
	require.Equal(t, "Несделанное", created[0].Title)
	require.Equal(t, "2026-10-23", created[0].Date)
	require.NotNil(t, created[0].CarriedFromID)
	require.Equal(t, undone.ID, *created[0].CarriedFromID)
	require.False(t, created[0].Done)

	// Исходный пункт остался в своём дне незакрытым.
	var stillThere bool
	err := testPool.QueryRow(context.Background(), `
		SELECT done_at IS NULL FROM day_plans WHERE id = $1`, undone.ID).Scan(&stillThere)
	require.NoError(t, err)
	require.True(t, stillThere, "исходный пункт должен остаться незакрытым")
}

// Повторный перенос не плодит копии: иначе двойное нажатие удвоило бы список.
func TestCarryOverIsIdempotent(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	createPlan(t, srv, cookie, "2026-10-22", "Несделанное")

	first := carryOver(t, srv, cookie, "2026-10-23")
	second := carryOver(t, srv, cookie, "2026-10-23")

	require.Len(t, first, 1)
	require.Empty(t, second, "пункт уже перенесён — копировать нечего")
}

// Перенесённый и закрытый пункт второй раз не переносится.
func TestCarryOverSkipsClosedCopy(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	createPlan(t, srv, cookie, "2026-10-22", "Несделанное")
	created := carryOver(t, srv, cookie, "2026-10-23")
	require.Len(t, created, 1)

	markDone(t, srv, cookie, created[0].ID)

	again := carryOver(t, srv, cookie, "2026-10-23")
	require.Empty(t, again, "копия есть, пусть и закрытая")
}

// Переносить нечего — пустой список, а не ошибка.
func TestCarryOverWithNothingToCarry(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	require.Empty(t, carryOver(t, srv, cookie, "2026-10-23"))
}

// Перенос берёт только предыдущий день, а не всю историю.
func TestCarryOverTakesOnlyPreviousDay(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	createPlan(t, srv, cookie, "2026-10-20", "Давнее")
	createPlan(t, srv, cookie, "2026-10-22", "Вчерашнее")

	created := carryOver(t, srv, cookie, "2026-10-23")

	require.Len(t, created, 1)
	require.Equal(t, "Вчерашнее", created[0].Title)
}

// Чужие пункты не переносятся и не правятся.
func TestPlanOfAnotherUserIs404(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	seedUser(t, "someone", "длинный-пароль")

	theirs := login(t, srv, "someone", "длинный-пароль")
	alien := createPlan(t, srv, theirs, "2026-10-23", "Чужой пункт")

	mine := login(t, srv, "vadim", "длинный-пароль")

	t.Run("правка", func(t *testing.T) {
		rec := do(t, srv, mine, http.MethodPatch,
			fmt.Sprintf("/api/day-plans/%d", alien.ID), `{"done":true}`)
		require.Equal(t, http.StatusNotFound, rec.Code)
	})

	t.Run("удаление", func(t *testing.T) {
		rec := do(t, srv, mine, http.MethodDelete,
			fmt.Sprintf("/api/day-plans/%d", alien.ID), "")
		require.Equal(t, http.StatusNotFound, rec.Code)
	})
}

func TestCarryOverIsScopedToUser(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	seedUser(t, "someone", "длинный-пароль")

	theirs := login(t, srv, "someone", "длинный-пароль")
	createPlan(t, srv, theirs, "2026-10-22", "Чужое несделанное")

	mine := login(t, srv, "vadim", "длинный-пароль")
	created := carryOver(t, srv, mine, "2026-10-23")

	require.Empty(t, created, "чужие пункты переноситься не должны")
}

func TestDeletePlan(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	plan := createPlan(t, srv, cookie, "2026-10-23", "На удаление")

	rec := do(t, srv, cookie, http.MethodDelete,
		fmt.Sprintf("/api/day-plans/%d", plan.ID), "")
	require.Equal(t, http.StatusNoContent, rec.Code)

	again := do(t, srv, cookie, http.MethodDelete,
		fmt.Sprintf("/api/day-plans/%d", plan.ID), "")
	require.Equal(t, http.StatusNotFound, again.Code)
}

// Удаление исходного пункта не ломает копию: ссылка снимается, копия живёт.
func TestDeletingSourceKeepsCarriedCopy(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	source := createPlan(t, srv, cookie, "2026-10-22", "Несделанное")
	created := carryOver(t, srv, cookie, "2026-10-23")
	require.Len(t, created, 1)

	rec := do(t, srv, cookie, http.MethodDelete,
		fmt.Sprintf("/api/day-plans/%d", source.ID), "")
	require.Equal(t, http.StatusNoContent, rec.Code)

	var carriedFrom *int64
	err := testPool.QueryRow(context.Background(),
		`SELECT carried_from_id FROM day_plans WHERE id = $1`, created[0].ID).Scan(&carriedFrom)
	require.NoError(t, err, "копия должна остаться")
	require.Nil(t, carriedFrom, "ссылка на удалённый исходник снята")
}
