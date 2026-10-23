package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// statsJSON — ответ статистики.
type statsJSON struct {
	From     string `json:"from"`
	To       string `json:"to"`
	Trackers []struct {
		TrackerID int64  `json:"trackerId"`
		Title     string `json:"title"`
		Mode      string `json:"mode"`
		Days      []struct {
			Date   string   `json:"date"`
			Done   bool     `json:"done"`
			Hours  *float64 `json:"hours"`
			Points float64  `json:"points"`
		} `json:"days"`
		TotalDone       int     `json:"totalDone"`
		TotalHours      float64 `json:"totalHours"`
		TotalPoints     float64 `json:"totalPoints"`
		CompletionRate  float64 `json:"completionRate"`
		CurrentStreak   int     `json:"currentStreak"`
		BestStreak      int     `json:"bestStreak"`
		CurrentWeekDone int     `json:"currentWeekDone"`
		WeeklyTarget    int     `json:"weeklyTarget"`
	} `json:"trackers"`
	Skills []struct {
		SkillID      int64   `json:"skillId"`
		Title        string  `json:"title"`
		TargetPoints float64 `json:"targetPoints"`
		EarnedPoints float64 `json:"earnedPoints"`
		PacePerDay   float64 `json:"pacePerDay"`
		Forecast     float64 `json:"forecast"`
		WillReach    bool    `json:"willReach"`
	} `json:"skills"`
	Sleep []struct {
		Date            string  `json:"date"`
		WentToBedAt     *string `json:"wentToBedAt"`
		WokeUpAt        *string `json:"wokeUpAt"`
		DurationMinutes *int    `json:"durationMinutes"`
		Quality         *int    `json:"quality"`
	} `json:"sleep"`
	Plans struct {
		Total int     `json:"total"`
		Done  int     `json:"done"`
		Rate  float64 `json:"rate"`
	} `json:"plans"`
}

// getStats запрашивает статистику за отрезок.
func getStats(t *testing.T, srv http.Handler, cookie *http.Cookie, from, to string) statsJSON {
	t.Helper()

	rec := do(t, srv, cookie, http.MethodGet,
		fmt.Sprintf("/api/stats?from=%s&to=%s", from, to), "")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var out statsJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	return out
}

// Отрезок отдаётся целиком, день за днём: теплокарте нужны и пустые дни.
func TestStatsFillsEveryDayOfRange(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})

	do(t, srv, cookie, http.MethodPut, entryPath(trackerID, "2026-10-20"), "")

	stats := getStats(t, srv, cookie, "2026-10-19", "2026-10-25")

	require.Equal(t, "2026-10-19", stats.From)
	require.Equal(t, "2026-10-25", stats.To)
	require.Len(t, stats.Trackers, 1)
	require.Len(t, stats.Trackers[0].Days, 7, "семь дней отрезка, включая края")
	require.Equal(t, "2026-10-19", stats.Trackers[0].Days[0].Date)
	require.False(t, stats.Trackers[0].Days[0].Done, "19-е пустое")
	require.True(t, stats.Trackers[0].Days[1].Done, "20-е закрыто")
	require.Equal(t, 1.0, stats.Trackers[0].Days[1].Points)
	require.Equal(t, "2026-10-25", stats.Trackers[0].Days[6].Date)
	require.Equal(t, 1, stats.Trackers[0].TotalDone)
}

// Серия считается по неделям и не рвётся незакончившейся неделей.
func TestStatsStreakIgnoresUnfinishedCurrentWeek(t *testing.T) {
	// Сегодня понедельник 26 октября — новая неделя только началась.
	srv := newTestServer(t, time.Date(2026, 10, 26, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})

	// Две полные недели по цели: 12–18 и 19–25 октября.
	for _, d := range []string{
		"2026-10-12", "2026-10-13", "2026-10-14",
		"2026-10-19", "2026-10-20", "2026-10-21",
	} {
		do(t, srv, cookie, http.MethodPut, entryPath(trackerID, d), "")
	}

	stats := getStats(t, srv, cookie, "2026-10-12", "2026-10-26")

	require.Equal(t, 2, stats.Trackers[0].CurrentStreak,
		"текущая неделя пустая, но серия жива")
	require.Equal(t, 2, stats.Trackers[0].BestStreak)
	require.Equal(t, 0, stats.Trackers[0].CurrentWeekDone)
}

// Провал недели рвёт серию, и это видно в лучшей.
func TestStatsStreakBrokenByMissedWeek(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 26, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})

	// Неделя 28 сентября — взята, 5 октября — провал, 12 и 19 — взяты.
	for _, d := range []string{
		"2026-09-28", "2026-09-29", "2026-09-30",
		"2026-10-05",
		"2026-10-12", "2026-10-13", "2026-10-14",
		"2026-10-19", "2026-10-20", "2026-10-21",
	} {
		do(t, srv, cookie, http.MethodPut, entryPath(trackerID, d), "")
	}

	stats := getStats(t, srv, cookie, "2026-10-19", "2026-10-26")

	require.Equal(t, 2, stats.Trackers[0].CurrentStreak, "после провала две недели")
	require.Equal(t, 2, stats.Trackers[0].BestStreak)
}

// Серия считается по всей истории, а не по отрезку: короткий отрезок не
// должен укорачивать серию, начавшуюся раньше.
func TestStatsStreakCountsBeyondRange(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 26, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})

	for _, d := range []string{
		"2026-09-28", "2026-09-29", "2026-09-30",
		"2026-10-05", "2026-10-06", "2026-10-07",
		"2026-10-12", "2026-10-13", "2026-10-14",
		"2026-10-19", "2026-10-20", "2026-10-21",
	} {
		do(t, srv, cookie, http.MethodPut, entryPath(trackerID, d), "")
	}

	// Отрезок — только последняя неделя.
	stats := getStats(t, srv, cookie, "2026-10-19", "2026-10-26")

	require.Equal(t, 4, stats.Trackers[0].CurrentStreak,
		"четыре недели подряд, хотя отрезок охватывает одну")
}

// Часы суммируются только у трекеров с часами.
func TestStatsSumsHours(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	withHours := seedTracker(t, userID, seedTrackerInput{
		Title: "Чтение", Mode: "check_hours", Rule: "per_hour", Value: 2, WeeklyTarget: 3,
	})
	plain := seedTracker(t, userID, seedTrackerInput{
		Title: "Зарядка", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 7,
	})

	do(t, srv, cookie, http.MethodPut, entryPath(withHours, "2026-10-20"), `{"hours":1.5}`)
	do(t, srv, cookie, http.MethodPut, entryPath(withHours, "2026-10-21"), `{"hours":2}`)
	do(t, srv, cookie, http.MethodPut, entryPath(plain, "2026-10-20"), "")

	stats := getStats(t, srv, cookie, "2026-10-19", "2026-10-25")

	byTitle := map[string]float64{}
	points := map[string]float64{}
	for _, tr := range stats.Trackers {
		byTitle[tr.Title] = tr.TotalHours
		points[tr.Title] = tr.TotalPoints
	}

	require.Equal(t, 3.5, byTitle["Чтение"])
	require.Equal(t, 7.0, points["Чтение"], "1.5 и 2 часа по два поинта")
	require.Equal(t, 0.0, byTitle["Зарядка"], "у трекера без часов часов нет")
	require.Equal(t, 1.0, points["Зарядка"])
}

// Процент выполнения: три раза в неделю за неделю — ровно по плану.
func TestStatsCompletionRate(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 26, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})

	for _, d := range []string{"2026-10-19", "2026-10-20", "2026-10-21"} {
		do(t, srv, cookie, http.MethodPut, entryPath(trackerID, d), "")
	}

	stats := getStats(t, srv, cookie, "2026-10-19", "2026-10-25")

	require.Equal(t, 1.0, stats.Trackers[0].CompletionRate)
}

// Перевыполнение показывается как есть, а не обрезается до сотни.
func TestStatsCompletionRateAboveOne(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 26, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 2,
	})

	for _, d := range []string{"2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"} {
		do(t, srv, cookie, http.MethodPut, entryPath(trackerID, d), "")
	}

	stats := getStats(t, srv, cookie, "2026-10-19", "2026-10-25")

	require.Equal(t, 2.0, stats.Trackers[0].CompletionRate, "четыре из двух — двести процентов")
}

// Прогноз навыка считается по темпу последних дней, а не по среднему за всё
// время.
func TestStatsSkillForecast(t *testing.T) {
	// Период: 1 октября, 100 дней. Сегодня 23 октября — осталось 78 дней.
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	skillID := seedSkill(t, userID, "Английский", 300)
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check", Value: 1,
		WeeklyTarget: 7, SkillID: &skillID,
	})

	// Семь отметок за последние две недели: темп 7/14 = 0.5 в день.
	for _, d := range []string{
		"2026-10-16", "2026-10-17", "2026-10-18",
		"2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22",
	} {
		do(t, srv, cookie, http.MethodPut, entryPath(trackerID, d), "")
	}

	stats := getStats(t, srv, cookie, "2026-10-16", "2026-10-23")

	require.Len(t, stats.Skills, 1)
	require.Equal(t, 7.0, stats.Skills[0].EarnedPoints)
	require.Equal(t, 0.5, stats.Skills[0].PacePerDay)
	// 7 + 0.5 * 78 = 46
	require.Equal(t, 46.0, stats.Skills[0].Forecast)
	require.False(t, stats.Skills[0].WillReach, "до 300 такой темп не доведёт")
}

// Скромная цель по такому темпу достигается.
func TestStatsSkillWillReachModestTarget(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	skillID := seedSkill(t, userID, "Скромный навык", 20)
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check", Value: 1,
		WeeklyTarget: 7, SkillID: &skillID,
	})

	for _, d := range []string{
		"2026-10-16", "2026-10-17", "2026-10-18",
		"2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22",
	} {
		do(t, srv, cookie, http.MethodPut, entryPath(trackerID, d), "")
	}

	stats := getStats(t, srv, cookie, "2026-10-16", "2026-10-23")

	require.True(t, stats.Skills[0].WillReach, "46 больше 20")
}

// Доля закрытых планов — отдельная метрика, на поинты не влияет.
func TestStatsPlansRate(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	skillID := seedSkill(t, userID, "Английский", 300)
	seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check", Value: 1,
		WeeklyTarget: 3, SkillID: &skillID,
	})

	a := createPlan(t, srv, cookie, "2026-10-20", "Первое")
	createPlan(t, srv, cookie, "2026-10-21", "Второе")
	createPlan(t, srv, cookie, "2026-10-22", "Третье")
	createPlan(t, srv, cookie, "2026-10-23", "Четвёртое")
	markDone(t, srv, cookie, a.ID)

	stats := getStats(t, srv, cookie, "2026-10-19", "2026-10-25")

	require.Equal(t, 4, stats.Plans.Total)
	require.Equal(t, 1, stats.Plans.Done)
	require.Equal(t, 0.25, stats.Plans.Rate)
	require.Equal(t, 0.0, stats.Skills[0].EarnedPoints, "планы поинтов не дают")
}

// Планов за отрезок не было — нули, а не деление на ноль.
func TestStatsPlansEmpty(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	stats := getStats(t, srv, cookie, "2026-10-19", "2026-10-25")

	require.Equal(t, 0, stats.Plans.Total)
	require.Equal(t, 0.0, stats.Plans.Rate)
}

// Сон отдаётся с посчитанной длительностью.
func TestStatsSleepSeries(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	do(t, srv, cookie, http.MethodPut, sleepPath("2026-10-20"),
		`{"wentToBedAt":"23:40","wokeUpAt":"07:10","quality":4}`)
	do(t, srv, cookie, http.MethodPut, sleepPath("2026-10-21"),
		`{"wokeUpAt":"07:00"}`)

	stats := getStats(t, srv, cookie, "2026-10-19", "2026-10-25")

	require.Len(t, stats.Sleep, 2, "только дни с записями, без заполнения пустых")
	require.Equal(t, "2026-10-20", stats.Sleep[0].Date)
	require.Equal(t, 450, *stats.Sleep[0].DurationMinutes)
	require.Equal(t, 4, *stats.Sleep[0].Quality)
	require.Nil(t, stats.Sleep[1].DurationMinutes, "половина данных — длительности нет")
}

func TestStatsRejectsInvertedRange(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	rec := do(t, srv, cookie, http.MethodGet,
		"/api/stats?from=2026-10-25&to=2026-10-19", "")

	require.Equal(t, http.StatusUnprocessableEntity, rec.Code)

	var out map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Equal(t, "range_inverted", out["code"])
}

// Слишком длинный отрезок отвергается: пять лет по дню на трекер — ответ в
// мегабайты, и его никто не прочтёт.
func TestStatsRejectsHugeRange(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	rec := do(t, srv, cookie, http.MethodGet,
		"/api/stats?from=2020-01-01&to=2026-10-23", "")

	require.Equal(t, http.StatusUnprocessableEntity, rec.Code)

	var out map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Equal(t, "range_too_long", out["code"])
}

// Ровно предельный отрезок проходит: граница на одной стороне.
func TestStatsAllowsMaxRange(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	// 400 дней включительно: от 2025-09-18 до 2026-10-22.
	from := time.Date(2026, 10, 22, 0, 0, 0, 0, time.UTC).AddDate(0, 0, -399)

	rec := do(t, srv, cookie, http.MethodGet, fmt.Sprintf(
		"/api/stats?from=%s&to=2026-10-22", from.Format("2006-01-02")), "")

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
}

func TestStatsRequiresBothDates(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	for _, q := range []string{"", "?from=2026-10-19", "?to=2026-10-25", "?from=вчера&to=2026-10-25"} {
		t.Run("запрос "+q, func(t *testing.T) {
			rec := do(t, srv, cookie, http.MethodGet, "/api/stats"+q, "")

			require.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())
		})
	}
}

func TestStatsIsScopedToUser(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	otherID := seedUser(t, "someone", "длинный-пароль")

	alien := seedTracker(t, otherID, seedTrackerInput{
		Title: "Чужой", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})
	theirs := login(t, srv, "someone", "длинный-пароль")
	do(t, srv, theirs, http.MethodPut, entryPath(alien, "2026-10-20"), "")

	mine := login(t, srv, "vadim", "длинный-пароль")
	stats := getStats(t, srv, mine, "2026-10-19", "2026-10-25")

	require.Empty(t, stats.Trackers)
	require.Equal(t, 0, stats.Plans.Total)
}

// Архивный трекер в статистику не попадает.
func TestStatsHidesArchivedTracker(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	archived := seedTracker(t, userID, seedTrackerInput{
		Title: "Архивный", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})
	do(t, srv, cookie, http.MethodPut, trackerPath(archived),
		`{"title":"Архивный","mode":"check","pointsRule":"per_check",
		  "pointsValue":1,"weeklyTarget":3,"archived":true}`)

	stats := getStats(t, srv, cookie, "2026-10-19", "2026-10-25")

	require.Empty(t, stats.Trackers)
}

func TestStatsNeedsSession(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))

	rec := do(t, srv, nil, http.MethodGet,
		"/api/stats?from=2026-10-19&to=2026-10-25", "")

	require.Equal(t, http.StatusUnauthorized, rec.Code)
}
