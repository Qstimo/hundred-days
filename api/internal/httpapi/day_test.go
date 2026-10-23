package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// dayJSON — ответ страницы дня.
type dayJSON struct {
	Date   string `json:"date"`
	Period struct {
		Title     string `json:"title"`
		Today     string `json:"today"`
		DayNumber int    `json:"dayNumber"`
		DaysLeft  int    `json:"daysLeft"`
	} `json:"period"`
	SleepEnabled bool       `json:"sleepEnabled"`
	Sleep        *sleepJSON `json:"sleep"`
	Trackers     []struct {
		Tracker    trackerJSON `json:"tracker"`
		Entry      *entryJSON  `json:"entry"`
		WeekDone   int         `json:"weekDone"`
		WeekTarget int         `json:"weekTarget"`
	} `json:"trackers"`
	Plans              []planJSON `json:"plans"`
	CarryOverAvailable bool       `json:"carryOverAvailable"`
	Skills             []struct {
		Skill        skillJSON `json:"skill"`
		EarnedPoints float64   `json:"earnedPoints"`
	} `json:"skills"`
}

// getDay запрашивает страницу дня.
func getDay(t *testing.T, srv http.Handler, cookie *http.Cookie, date string) dayJSON {
	t.Helper()

	path := "/api/day"
	if date != "" {
		path += "?date=" + date
	}

	rec := do(t, srv, cookie, http.MethodGet, path, "")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var out dayJSON
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	return out
}

// Один запрос отдаёт всё для главного экрана: период, трекеры с отметкой,
// недельный счёт, сон, планы и прогресс навыков. Шесть запросов дали бы
// шесть индикаторов загрузки на экране, который открывается каждый день.
func TestDayReturnsEverythingAtOnce(t *testing.T) {
	// 23 октября 2026 — пятница.
	today := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	srv := newTestServer(t, today)
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	skillID := seedSkill(t, userID, "Английский уровня B", 300)
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check", Value: 1,
		WeeklyTarget: 3, SkillID: &skillID,
	})

	// Понедельник и среда той же недели.
	do(t, srv, cookie, http.MethodPut, entryPath(trackerID, "2026-10-19"), "")
	do(t, srv, cookie, http.MethodPut, entryPath(trackerID, "2026-10-21"), "")
	createPlan(t, srv, cookie, "2026-10-23", "Написать план")
	do(t, srv, cookie, http.MethodPut, sleepPath("2026-10-23"),
		`{"wentToBedAt":"23:40","wokeUpAt":"07:10","quality":4}`)

	day := getDay(t, srv, cookie, "2026-10-23")

	require.Equal(t, "2026-10-23", day.Date)
	require.Equal(t, "2026-10-23", day.Period.Today)
	require.Equal(t, 23, day.Period.DayNumber)
	require.Equal(t, 78, day.Period.DaysLeft)
	require.True(t, day.SleepEnabled)

	require.Len(t, day.Trackers, 1)
	// Отметки за сегодня нет: сегодня ещё не делали.
	require.Nil(t, day.Trackers[0].Entry)
	// А на этой неделе уже два раза из трёх.
	require.Equal(t, 2, day.Trackers[0].WeekDone)
	require.Equal(t, 3, day.Trackers[0].WeekTarget)

	require.NotNil(t, day.Sleep)
	require.Equal(t, 450, *day.Sleep.DurationMinutes)

	require.Len(t, day.Plans, 1)
	require.Equal(t, "Написать план", day.Plans[0].Title)

	require.Len(t, day.Skills, 1)
	require.Equal(t, 2.0, day.Skills[0].EarnedPoints)
	require.Equal(t, 300.0, day.Skills[0].Skill.TargetPoints)
}

// Отметка за запрошенный день приходит вместе с трекером.
func TestDayShowsTodayEntry(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Чтение", Mode: "check_hours", Rule: "per_hour", Value: 2, WeeklyTarget: 3,
	})

	do(t, srv, cookie, http.MethodPut, entryPath(trackerID, "2026-10-23"), `{"hours":1.5}`)

	day := getDay(t, srv, cookie, "2026-10-23")

	require.Len(t, day.Trackers, 1)
	require.NotNil(t, day.Trackers[0].Entry)
	require.Equal(t, 3.0, day.Trackers[0].Entry.PointsAwarded)
	require.Equal(t, 1.5, *day.Trackers[0].Entry.Hours)
	require.Equal(t, 1, day.Trackers[0].WeekDone)
}

// Неделя считается с понедельника: воскресенье относится к той же неделе,
// что предшествующий понедельник, а не к следующей.
func TestDayWeekStartsOnMonday(t *testing.T) {
	// 25 октября 2026 — воскресенье, 19 октября — понедельник той же недели.
	srv := newTestServer(t, time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})

	do(t, srv, cookie, http.MethodPut, entryPath(trackerID, "2026-10-19"), "")

	day := getDay(t, srv, cookie, "2026-10-25")

	require.Equal(t, 1, day.Trackers[0].WeekDone,
		"понедельник и воскресенье — одна неделя")
}

// Отметка предыдущей недели в счёт этой не идёт.
func TestDayWeekExcludesPreviousWeek(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})

	// 18 октября — воскресенье предыдущей недели.
	do(t, srv, cookie, http.MethodPut, entryPath(trackerID, "2026-10-18"), "")

	day := getDay(t, srv, cookie, "2026-10-23")

	require.Equal(t, 0, day.Trackers[0].WeekDone)
}

// Без параметра date отдаётся сегодня в зоне сервера.
func TestDayWithoutDateIsToday(t *testing.T) {
	moscow, err := time.LoadLocation("Europe/Moscow")
	require.NoError(t, err)

	// 24 октября 00:30 по Москве = 23 октября 21:30 UTC.
	srv := newTestServer(t, time.Date(2026, 10, 24, 0, 30, 0, 0, moscow))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	day := getDay(t, srv, cookie, "")

	require.Equal(t, "2026-10-24", day.Date, "по московской дате это 24-е")
	require.Equal(t, 24, day.Period.DayNumber)
}

// Архивный трекер на странице дня не показывается.
func TestDayHidesArchivedTrackers(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	seedTracker(t, userID, seedTrackerInput{
		Title: "Живой", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})
	archived := seedTracker(t, userID, seedTrackerInput{
		Title: "Архивный", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})
	do(t, srv, cookie, http.MethodPut, trackerPath(archived),
		`{"title":"Архивный","mode":"check","pointsRule":"per_check",
		  "pointsValue":1,"weeklyTarget":3,"archived":true}`)

	day := getDay(t, srv, cookie, "2026-10-23")

	require.Len(t, day.Trackers, 1)
	require.Equal(t, "Живой", day.Trackers[0].Tracker.Title)
}

// Кнопка переноса появляется только если со вчера есть что переносить.
func TestDayCarryOverAvailableFlag(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	t.Run("нечего переносить", func(t *testing.T) {
		day := getDay(t, srv, cookie, "2026-10-23")
		require.False(t, day.CarryOverAvailable)
	})

	t.Run("есть незакрытое со вчера", func(t *testing.T) {
		createPlan(t, srv, cookie, "2026-10-22", "Несделанное")

		day := getDay(t, srv, cookie, "2026-10-23")
		require.True(t, day.CarryOverAvailable)
	})

	t.Run("после переноса снова нечего", func(t *testing.T) {
		carryOver(t, srv, cookie, "2026-10-23")

		day := getDay(t, srv, cookie, "2026-10-23")
		require.False(t, day.CarryOverAvailable)
	})
}

// Закрытое вчера переносить не нужно.
func TestDayCarryOverIgnoresClosedYesterday(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	plan := createPlan(t, srv, cookie, "2026-10-22", "Сделанное")
	markDone(t, srv, cookie, plan.ID)

	day := getDay(t, srv, cookie, "2026-10-23")

	require.False(t, day.CarryOverAvailable)
}

// Выключенный тумблер сна виден в ответе: интерфейс по нему скрывает блок.
func TestDayReportsSleepDisabled(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	do(t, srv, cookie, http.MethodPut, "/api/settings",
		`{"periodTitle":"100 дней до","periodStart":"2026-10-01",
		  "periodDays":100,"sleepEnabled":false}`)

	day := getDay(t, srv, cookie, "2026-10-23")

	require.False(t, day.SleepEnabled)
}

// Прогресс навыка — сумма зафиксированных поинтов, а не пересчёт по текущей
// цене трекеров.
func TestDaySkillProgressUsesFixedPoints(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	skillID := seedSkill(t, userID, "Английский", 300)
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check", Value: 1,
		WeeklyTarget: 3, SkillID: &skillID,
	})

	do(t, srv, cookie, http.MethodPut, entryPath(trackerID, "2026-10-19"), "")
	do(t, srv, cookie, http.MethodPut, entryPath(trackerID, "2026-10-20"), "")

	// Подняли цену, навык оставили прежним: прошлые поинты меняться не должны.
	do(t, srv, cookie, http.MethodPut, trackerPath(trackerID),
		fmt.Sprintf(`{"title":"Занятие","mode":"check","pointsRule":"per_check",
		              "pointsValue":10,"skillId":%d,"weeklyTarget":3}`, skillID))

	day := getDay(t, srv, cookie, "2026-10-23")

	require.Len(t, day.Skills, 1)
	require.Equal(t, 2.0, day.Skills[0].EarnedPoints,
		"две отметки по старой цене — два поинта")
}

// Отвязка трекера от навыка убирает его поинты из прогресса навыка.
//
// Это решение, а не недосмотр: прогресс навыка — сумма поинтов трекеров,
// которые его питают сейчас. Отвязка означает «эта деятельность больше не
// про этот навык», и считать её вклад было бы странно. Инвариант про
// фиксацию поинтов это не нарушает: поинты в отметках целы, и возврат
// привязки вернёт их в прогресс.
func TestDaySkillLosesPointsWhenTrackerDetached(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	skillID := seedSkill(t, userID, "Английский", 300)
	trackerID := seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check", Value: 1,
		WeeklyTarget: 3, SkillID: &skillID,
	})
	do(t, srv, cookie, http.MethodPut, entryPath(trackerID, "2026-10-19"), "")

	before := getDay(t, srv, cookie, "2026-10-23")
	require.Equal(t, 1.0, before.Skills[0].EarnedPoints)

	// Отвязали навык.
	do(t, srv, cookie, http.MethodPut, trackerPath(trackerID),
		`{"title":"Занятие","mode":"check","pointsRule":"per_check",
		  "pointsValue":1,"skillId":null,"weeklyTarget":3}`)

	after := getDay(t, srv, cookie, "2026-10-23")
	require.Equal(t, 0.0, after.Skills[0].EarnedPoints)

	// Вернули навык — поинты вернулись: отметки целы.
	do(t, srv, cookie, http.MethodPut, trackerPath(trackerID),
		fmt.Sprintf(`{"title":"Занятие","mode":"check","pointsRule":"per_check",
		              "pointsValue":1,"skillId":%d,"weeklyTarget":3}`, skillID))

	back := getDay(t, srv, cookie, "2026-10-23")
	require.Equal(t, 1.0, back.Skills[0].EarnedPoints,
		"поинты зафиксированы в отметках и возвращаются вместе с привязкой")
}

// Несколько трекеров питают один навык: поинты складываются.
func TestDaySkillSumsSeveralTrackers(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	skillID := seedSkill(t, userID, "Английский", 300)
	lesson := seedTracker(t, userID, seedTrackerInput{
		Title: "Занятие", Mode: "check", Rule: "per_check", Value: 1,
		WeeklyTarget: 3, SkillID: &skillID,
	})
	reading := seedTracker(t, userID, seedTrackerInput{
		Title: "Чтение", Mode: "check_hours", Rule: "per_hour", Value: 2,
		WeeklyTarget: 3, SkillID: &skillID,
	})

	do(t, srv, cookie, http.MethodPut, entryPath(lesson, "2026-10-21"), "")
	do(t, srv, cookie, http.MethodPut, entryPath(reading, "2026-10-22"), `{"hours":1.5}`)

	day := getDay(t, srv, cookie, "2026-10-23")

	require.Len(t, day.Skills, 1)
	require.Equal(t, 4.0, day.Skills[0].EarnedPoints, "1 за занятие и 3 за чтение")
}

// Трекер без навыка в прогресс навыков не попадает.
func TestDaySkillExcludesTrackerWithoutSkill(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	userID := seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	seedSkill(t, userID, "Английский", 300)
	loose := seedTracker(t, userID, seedTrackerInput{
		Title: "Зарядка", Mode: "check", Rule: "per_check", Value: 5, WeeklyTarget: 7,
	})
	do(t, srv, cookie, http.MethodPut, entryPath(loose, "2026-10-23"), "")

	day := getDay(t, srv, cookie, "2026-10-23")

	require.Len(t, day.Skills, 1)
	require.Equal(t, 0.0, day.Skills[0].EarnedPoints)
}

// Чужой день не виден: у каждого свои трекеры, планы и сон.
func TestDayIsScopedToUser(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	otherID := seedUser(t, "someone", "длинный-пароль")

	seedTracker(t, otherID, seedTrackerInput{
		Title: "Чужой трекер", Mode: "check", Rule: "per_check", Value: 1, WeeklyTarget: 3,
	})
	theirs := login(t, srv, "someone", "длинный-пароль")
	createPlan(t, srv, theirs, "2026-10-23", "Чужой пункт")

	mine := login(t, srv, "vadim", "длинный-пароль")
	day := getDay(t, srv, mine, "2026-10-23")

	require.Empty(t, day.Trackers)
	require.Empty(t, day.Plans)
	require.NotContains(t, "Чужой", day.Date)
}

func TestDayRejectsGarbageDate(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	for _, d := range []string{"вчера", "2026-13-01", "20261023"} {
		t.Run(d, func(t *testing.T) {
			rec := do(t, srv, cookie, http.MethodGet, "/api/day?date="+d, "")

			require.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())

			var out map[string]string
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
			require.Equal(t, "date", out["code"])
		})
	}
}

// Будущий день посмотреть можно — отметить нельзя. Запрет на запись не
// значит запрета на просмотр: календарь должен открывать любую дату.
func TestDayAllowsFutureDateForViewing(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	day := getDay(t, srv, cookie, "2026-11-01")

	require.Equal(t, "2026-11-01", day.Date)
}

func TestDayNeedsSession(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))

	rec := do(t, srv, nil, http.MethodGet, "/api/day", "")

	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

// trackerPath собирает путь трекера.
func trackerPath(id int64) string {
	return fmt.Sprintf("/api/trackers/%d", id)
}

// Поле today в периоде — сегодняшняя дата сервера, а не открытая: по ним
// клиент понимает, что открыт прошлый или будущий день.
func TestDayTodayIsIndependentOfOpenedDate(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	past := getDay(t, srv, cookie, "2026-10-01")
	require.Equal(t, "2026-10-01", past.Date)
	require.Equal(t, "2026-10-23", past.Period.Today)

	future := getDay(t, srv, cookie, "2026-11-01")
	require.Equal(t, "2026-11-01", future.Date)
	require.Equal(t, "2026-10-23", future.Period.Today)
}

// Период ещё не начался — today всё равно верное. Вывести его из периода
// в этом случае было бы нельзя: номер дня нулевой.
func TestDayTodayWhenPeriodNotStarted(t *testing.T) {
	srv := newTestServer(t, time.Date(2026, 9, 20, 12, 0, 0, 0, time.UTC))
	seedUser(t, "vadim", "длинный-пароль")
	cookie := login(t, srv, "vadim", "длинный-пароль")

	day := getDay(t, srv, cookie, "2026-09-20")

	require.Equal(t, 0, day.Period.DayNumber, "период начинается 1 октября")
	require.Equal(t, "2026-09-20", day.Period.Today)
}
