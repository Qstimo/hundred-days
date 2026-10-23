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

// trackerJSON — трекер в виде контракта.
type trackerJSON struct {
	ID           int64   `json:"id"`
	Title        string  `json:"title"`
	Mode         string  `json:"mode"`
	PointsRule   string  `json:"pointsRule"`
	PointsValue  float64 `json:"pointsValue"`
	SkillID      *int64  `json:"skillId"`
	WeeklyTarget int     `json:"weeklyTarget"`
	SortOrder    int     `json:"sortOrder"`
	Archived     bool    `json:"archived"`
	EntryCount   int     `json:"entryCount"`
}

type seedTrackerInput struct {
	Title        string
	Mode         string
	Rule         string
	Value        float64
	WeeklyTarget int32
	SkillID      *int64
}

// seedTracker заводит трекер прямо в базе, минуя API.
func seedTracker(t *testing.T, userID int64, in seedTrackerInput) int64 {
	t.Helper()

	q := dbgen.New(testPool)
	tr, err := q.CreateTracker(context.Background(), dbgen.CreateTrackerParams{
		UserID:       userID,
		Title:        in.Title,
		Mode:         dbgen.TrackerMode(in.Mode),
		PointsRule:   dbgen.PointsRule(in.Rule),
		PointsValue:  in.Value,
		SkillID:      in.SkillID,
		WeeklyTarget: in.WeeklyTarget,
		SortOrder:    0,
	})
	require.NoError(t, err)
	return tr.ID
}

func TestCreateAndListTracker(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	skillID := seedSkill(t, userID, "Английский уровня B", 300)

	body := fmt.Sprintf(`{"title":"Занятие","mode":"check","pointsRule":"per_check",
	                      "pointsValue":1,"skillId":%d,"weeklyTarget":3}`, skillID)
	rec := do(t, srv, cookie, http.MethodPost, "/api/trackers", body)

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	var created trackerJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &created))
	require.Equal(t, "Занятие", created.Title)
	require.Equal(t, "check", created.Mode)
	require.Equal(t, "per_check", created.PointsRule)
	require.Equal(t, 1.0, created.PointsValue)
	require.NotNil(t, created.SkillID)
	require.Equal(t, skillID, *created.SkillID)
	require.Equal(t, 3, created.WeeklyTarget)
	require.Zero(t, created.EntryCount, "у нового трекера отметок нет")

	listRec := do(t, srv, cookie, http.MethodGet, "/api/trackers", "")
	var list []trackerJSON
	require.NoError(t, json.Unmarshal(listRec.Body.Bytes(), &list))
	require.Len(t, list, 1)
}

// Трекер без навыка — обычная привычка без прогрессии.
func TestTrackerWithoutSkill(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	rec := do(t, srv, cookie, http.MethodPost, "/api/trackers",
		`{"title":"Зарядка","mode":"check","pointsRule":"per_check",
		  "pointsValue":1,"weeklyTarget":7}`)

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	var created trackerJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &created))
	require.Nil(t, created.SkillID)
}

// Инвариант проверяется кодом, а не только ограничением базы: ответ должен
// быть понятным 409 с машинным поводом, а не 500 от нарушения CHECK.
func TestTrackerRejectsPerHourWithoutHours(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	rec := do(t, srv, cookie, http.MethodPost, "/api/trackers",
		`{"title":"Чтение","mode":"check","pointsRule":"per_hour",
		  "pointsValue":1,"weeklyTarget":3}`)

	require.Equal(t, http.StatusConflict, rec.Code, rec.Body.String())

	var out map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Equal(t, "rule_needs_hours", out["code"])
}

// Законное сочетание проходит: часы есть — правило «за час» допустимо.
func TestTrackerAllowsPerHourWithHours(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	rec := do(t, srv, cookie, http.MethodPost, "/api/trackers",
		`{"title":"Чтение","mode":"check_hours","pointsRule":"per_hour",
		  "pointsValue":1,"weeklyTarget":3}`)

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
}

// Трекер с часами может начислять и фиксированную цену: часы тогда просто
// записываются, а на поинты не влияют.
func TestTrackerAllowsPerCheckWithHours(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	rec := do(t, srv, cookie, http.MethodPost, "/api/trackers",
		`{"title":"Тренировка","mode":"check_hours","pointsRule":"per_check",
		  "pointsValue":2,"weeklyTarget":3}`)

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
}

// Правка проверяет инвариант так же, как создание: сменить режим на «без
// часов», оставив правило «за час», нельзя.
func TestTrackerUpdateKeepsInvariant(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	id := seedTracker(t, userID, seedTrackerInput{
		Title: "Чтение", Mode: "check_hours", Rule: "per_hour",
		Value: 1, WeeklyTarget: 3,
	})

	rec := do(t, srv, cookie, http.MethodPut, fmt.Sprintf("/api/trackers/%d", id),
		`{"title":"Чтение","mode":"check","pointsRule":"per_hour",
		  "pointsValue":1,"weeklyTarget":3}`)

	require.Equal(t, http.StatusConflict, rec.Code, rec.Body.String())

	var out map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Equal(t, "rule_needs_hours", out["code"])

	// Трекер не изменился.
	q := dbgen.New(testPool)
	tr, err := q.GetTracker(context.Background(), dbgen.GetTrackerParams{ID: id, UserID: userID})
	require.NoError(t, err)
	require.Equal(t, dbgen.TrackerModeCheckHours, tr.Mode)
}

// Чужой навык нельзя привязать к своему трекеру: ссылка на него раскрыла бы
// его существование и утащила бы поинты в чужую цель.
func TestTrackerRejectsAlienSkill(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	otherID := seedUser(t, "someone", "длинный-пароль")
	alienSkill := seedSkill(t, otherID, "Чужой навык", 100)

	cookie := login(t, srv, "vadim", "длинный-пароль")

	body := fmt.Sprintf(`{"title":"Занятие","mode":"check","pointsRule":"per_check",
	                      "pointsValue":1,"skillId":%d,"weeklyTarget":3}`, alienSkill)
	rec := do(t, srv, cookie, http.MethodPost, "/api/trackers", body)

	require.Equal(t, http.StatusNotFound, rec.Code, rec.Body.String())
}

// Несуществующий навык — тоже 404, тем же ответом: отличать «нет вовсе» от
// «чужой» означало бы сообщать о чужом.
func TestTrackerRejectsMissingSkill(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	rec := do(t, srv, cookie, http.MethodPost, "/api/trackers",
		`{"title":"Занятие","mode":"check","pointsRule":"per_check",
		  "pointsValue":1,"skillId":999999,"weeklyTarget":3}`)

	require.Equal(t, http.StatusNotFound, rec.Code)
}

func TestTrackerRejectsWeeklyTargetOutOfRange(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	for _, target := range []string{"0", "8", "-1"} {
		t.Run("цель "+target, func(t *testing.T) {
			rec := do(t, srv, cookie, http.MethodPost, "/api/trackers",
				fmt.Sprintf(`{"title":"Занятие","mode":"check","pointsRule":"per_check",
				              "pointsValue":1,"weeklyTarget":%s}`, target))

			require.Equal(t, http.StatusUnprocessableEntity, rec.Code)

			var out map[string]string
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
			require.Equal(t, "weekly_target", out["code"])
		})
	}
}

func TestTrackerRejectsNegativePointsValue(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	rec := do(t, srv, cookie, http.MethodPost, "/api/trackers",
		`{"title":"Занятие","mode":"check","pointsRule":"per_check",
		  "pointsValue":-1,"weeklyTarget":3}`)

	require.Equal(t, http.StatusUnprocessableEntity, rec.Code)

	var out map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Equal(t, "points_value", out["code"])
}

func TestTrackerRejectsUnknownModeOrRule(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	cases := []struct {
		name string
		body string
		code string
	}{
		{
			name: "негодный режим",
			body: `{"title":"a","mode":"выдумка","pointsRule":"per_check","pointsValue":1,"weeklyTarget":3}`,
			code: "mode",
		},
		{
			name: "негодное правило",
			body: `{"title":"a","mode":"check","pointsRule":"выдумка","pointsValue":1,"weeklyTarget":3}`,
			code: "points_rule",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := do(t, srv, cookie, http.MethodPost, "/api/trackers", c.body)

			require.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())

			var out map[string]string
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
			require.Equal(t, c.code, out["code"])
		})
	}
}

func TestTrackerOfAnotherUserIs404(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	otherID := seedUser(t, "someone", "длинный-пароль")
	alien := seedTracker(t, otherID, seedTrackerInput{
		Title: "Чужой", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})

	cookie := login(t, srv, "vadim", "длинный-пароль")

	t.Run("правка", func(t *testing.T) {
		rec := do(t, srv, cookie, http.MethodPut, fmt.Sprintf("/api/trackers/%d", alien),
			`{"title":"Моё","mode":"check","pointsRule":"per_check","pointsValue":1,"weeklyTarget":3}`)

		require.Equal(t, http.StatusNotFound, rec.Code)
	})

	t.Run("удаление", func(t *testing.T) {
		rec := do(t, srv, cookie, http.MethodDelete, fmt.Sprintf("/api/trackers/%d", alien), "")

		require.Equal(t, http.StatusNotFound, rec.Code)
	})
}

func TestTrackersListIsScopedToUser(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	mine := seedUser(t, "vadim", "длинный-пароль")
	otherID := seedUser(t, "someone", "длинный-пароль")

	seedTracker(t, mine, seedTrackerInput{
		Title: "Моё", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})
	seedTracker(t, otherID, seedTrackerInput{
		Title: "Чужое", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})

	cookie := login(t, srv, "vadim", "длинный-пароль")
	rec := do(t, srv, cookie, http.MethodGet, "/api/trackers", "")

	var list []trackerJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
	require.Len(t, list, 1)
	require.Equal(t, "Моё", list[0].Title)
}

// Удаление навыка не трогает трекер: он теряет ссылку, но остаётся.
func TestDeletingSkillKeepsTrackerWithoutSkill(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	skillID := seedSkill(t, userID, "Английский", 300)
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check",
		Value: 1, WeeklyTarget: 3, SkillID: &skillID,
	})

	rec := do(t, srv, cookie, http.MethodDelete, fmt.Sprintf("/api/skills/%d", skillID), "")
	require.Equal(t, http.StatusNoContent, rec.Code)

	listRec := do(t, srv, cookie, http.MethodGet, "/api/trackers", "")
	var list []trackerJSON
	require.NoError(t, json.Unmarshal(listRec.Body.Bytes(), &list))

	require.Len(t, list, 1)
	require.Equal(t, trackerID, list[0].ID)
	require.Nil(t, list[0].SkillID, "ссылка на навык снята, трекер остался")
}

// Навык можно отвязать, прислав null.
func TestTrackerSkillCanBeDetached(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	skillID := seedSkill(t, userID, "Английский", 300)
	id := seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check",
		Value: 1, WeeklyTarget: 3, SkillID: &skillID,
	})

	rec := do(t, srv, cookie, http.MethodPut, fmt.Sprintf("/api/trackers/%d", id),
		`{"title":"Занятие","mode":"check","pointsRule":"per_check",
		  "pointsValue":1,"skillId":null,"weeklyTarget":3}`)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var out trackerJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Nil(t, out.SkillID)
}

func TestDeleteTrackerSucceedsAndIsNotFoundTwice(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	id := seedTracker(t, userID, seedTrackerInput{
		Title: "На удаление", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})

	rec := do(t, srv, cookie, http.MethodDelete, fmt.Sprintf("/api/trackers/%d", id), "")
	require.Equal(t, http.StatusNoContent, rec.Code)

	again := do(t, srv, cookie, http.MethodDelete, fmt.Sprintf("/api/trackers/%d", id), "")
	require.Equal(t, http.StatusNotFound, again.Code)
}

func TestArchivedTrackerHiddenByDefault(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	seedTracker(t, userID, seedTrackerInput{
		Title: "Живой", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})
	archived := seedTracker(t, userID, seedTrackerInput{
		Title: "Архивный", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})

	rec := do(t, srv, cookie, http.MethodPut, fmt.Sprintf("/api/trackers/%d", archived),
		`{"title":"Архивный","mode":"check","pointsRule":"per_check",
		  "pointsValue":1,"weeklyTarget":3,"archived":true}`)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	listRec := do(t, srv, cookie, http.MethodGet, "/api/trackers", "")
	var list []trackerJSON
	require.NoError(t, json.Unmarshal(listRec.Body.Bytes(), &list))
	require.Len(t, list, 1)
	require.Equal(t, "Живой", list[0].Title)

	allRec := do(t, srv, cookie, http.MethodGet, "/api/trackers?includeArchived=true", "")
	var all []trackerJSON
	require.NoError(t, json.Unmarshal(allRec.Body.Bytes(), &all))
	require.Len(t, all, 2)
}
