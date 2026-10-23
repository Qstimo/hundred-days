package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
	"github.com/stretchr/testify/require"
)

// skillJSON — навык в виде, в котором его отдаёт контракт.
type skillJSON struct {
	ID           int64   `json:"id"`
	Title        string  `json:"title"`
	TargetPoints float64 `json:"targetPoints"`
	UnitLabel    string  `json:"unitLabel"`
	SortOrder    int     `json:"sortOrder"`
	Archived     bool    `json:"archived"`
}

// seedSkill заводит навык прямо в базе, минуя API.
func seedSkill(t *testing.T, userID int64, title string, target float64) int64 {
	t.Helper()

	q := dbgen.New(testPool)
	s, err := q.CreateSkill(context.Background(), dbgen.CreateSkillParams{
		UserID:       userID,
		Title:        title,
		TargetPoints: target,
		UnitLabel:    "",
		SortOrder:    0,
	})
	require.NoError(t, err)
	return s.ID
}

// do выполняет запрос с cookie и возвращает ответ.
func do(t *testing.T, srv http.Handler, cookie *http.Cookie,
	method, path, body string,
) *httptest.ResponseRecorder {
	t.Helper()

	var r *http.Request
	if body == "" {
		r = httptest.NewRequest(method, path, nil)
	} else {
		r = httptest.NewRequest(method, path, bytes.NewReader([]byte(body)))
		r.Header.Set("Content-Type", "application/json")
	}
	if cookie != nil {
		r.AddCookie(cookie)
	}

	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, r)
	return rec
}

func TestCreateAndListSkill(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	rec := do(t, srv, cookie, http.MethodPost, "/api/skills",
		`{"title":"Английский уровня B","targetPoints":300,"unitLabel":"занятие"}`)

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	var created skillJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &created))
	require.NotZero(t, created.ID)
	require.Equal(t, "Английский уровня B", created.Title)
	require.Equal(t, 300.0, created.TargetPoints)
	require.Equal(t, "занятие", created.UnitLabel)
	require.False(t, created.Archived)

	listRec := do(t, srv, cookie, http.MethodGet, "/api/skills", "")
	require.Equal(t, http.StatusOK, listRec.Code)

	var list []skillJSON
	require.NoError(t, json.Unmarshal(listRec.Body.Bytes(), &list))
	require.Len(t, list, 1)
	require.Equal(t, created.ID, list[0].ID)
}

// Цель должна быть положительной: ноль сделал бы прогресс делением на ноль.
func TestSkillRejectsNonPositiveTarget(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	for _, target := range []string{"0", "-5"} {
		t.Run("цель "+target, func(t *testing.T) {
			rec := do(t, srv, cookie, http.MethodPost, "/api/skills",
				fmt.Sprintf(`{"title":"Навык","targetPoints":%s}`, target))

			require.Equal(t, http.StatusUnprocessableEntity, rec.Code)

			var out map[string]string
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
			require.Equal(t, "target_points", out["code"])
		})
	}
}

func TestSkillRejectsEmptyTitle(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	// Пробелы названием не считаются: в базе стоит CHECK на btrim.
	rec := do(t, srv, cookie, http.MethodPost, "/api/skills",
		`{"title":"   ","targetPoints":10}`)

	require.Equal(t, http.StatusUnprocessableEntity, rec.Code)

	var out map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Equal(t, "title", out["code"])
}

// Чужой навык отвечает 404, а не 403: ответ 403 сообщил бы, что он есть.
func TestSkillOfAnotherUserIs404(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	otherID := seedUser(t, "someone", "длинный-пароль")
	alien := seedSkill(t, otherID, "Чужой навык", 100)

	cookie := login(t, srv, "vadim", "длинный-пароль")

	t.Run("правка", func(t *testing.T) {
		rec := do(t, srv, cookie, http.MethodPut,
			fmt.Sprintf("/api/skills/%d", alien),
			`{"title":"Моё","targetPoints":10}`)

		require.Equal(t, http.StatusNotFound, rec.Code)
	})

	t.Run("удаление", func(t *testing.T) {
		rec := do(t, srv, cookie, http.MethodDelete,
			fmt.Sprintf("/api/skills/%d", alien), "")

		require.Equal(t, http.StatusNotFound, rec.Code)
	})

	// Чужой навык остался цел.
	q := dbgen.New(testPool)
	_, err := q.GetSkill(context.Background(), dbgen.GetSkillParams{
		ID: alien, UserID: otherID,
	})
	require.NoError(t, err, "чужой навык не должен быть задет")
}

// Список отдаёт только свои навыки.
func TestSkillsListIsScopedToUser(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	mine := seedUser(t, "vadim", "длинный-пароль")
	otherID := seedUser(t, "someone", "длинный-пароль")

	seedSkill(t, mine, "Моё", 100)
	seedSkill(t, otherID, "Чужое", 100)

	cookie := login(t, srv, "vadim", "длинный-пароль")
	rec := do(t, srv, cookie, http.MethodGet, "/api/skills", "")

	var list []skillJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
	require.Len(t, list, 1)
	require.Equal(t, "Моё", list[0].Title)
	require.NotContains(t, rec.Body.String(), "Чужое")
}

// Архивный навык не попадает в список без явного запроса.
func TestArchivedSkillHiddenByDefault(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	live := seedSkill(t, userID, "Живой", 100)
	archived := seedSkill(t, userID, "Архивный", 100)

	rec := do(t, srv, cookie, http.MethodPut,
		fmt.Sprintf("/api/skills/%d", archived),
		`{"title":"Архивный","targetPoints":100,"archived":true}`)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var updated skillJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &updated))
	require.True(t, updated.Archived)

	t.Run("по умолчанию скрыт", func(t *testing.T) {
		rec := do(t, srv, cookie, http.MethodGet, "/api/skills", "")

		var list []skillJSON
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
		require.Len(t, list, 1)
		require.Equal(t, live, list[0].ID)
	})

	t.Run("по запросу виден", func(t *testing.T) {
		rec := do(t, srv, cookie, http.MethodGet, "/api/skills?includeArchived=true", "")

		var list []skillJSON
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
		require.Len(t, list, 2)
	})

	t.Run("разархивируется обратно", func(t *testing.T) {
		rec := do(t, srv, cookie, http.MethodPut,
			fmt.Sprintf("/api/skills/%d", archived),
			`{"title":"Архивный","targetPoints":100,"archived":false}`)
		require.Equal(t, http.StatusOK, rec.Code)

		var out skillJSON
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
		require.False(t, out.Archived)
	})
}

func TestDeleteSkillSucceedsAndIsNotFoundTwice(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	id := seedSkill(t, userID, "На удаление", 50)

	rec := do(t, srv, cookie, http.MethodDelete, fmt.Sprintf("/api/skills/%d", id), "")
	require.Equal(t, http.StatusNoContent, rec.Code)

	// Повторное удаление — 404: ноль затронутых строк не успех.
	again := do(t, srv, cookie, http.MethodDelete, fmt.Sprintf("/api/skills/%d", id), "")
	require.Equal(t, http.StatusNotFound, again.Code)
}

func TestSkillsNeedSession(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))

	rec := do(t, srv, nil, http.MethodGet, "/api/skills", "")

	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

// Нечисловой идентификатор в пути — 404, а не падение: путь не разобран,
// значит такой записи нет.
func TestSkillWithGarbageIDIs404(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	rec := do(t, srv, cookie, http.MethodDelete, "/api/skills/не-число", "")

	require.Equal(t, http.StatusNotFound, rec.Code)
}
