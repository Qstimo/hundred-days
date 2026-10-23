package httpapi

import (
	"net/http"
	"time"

	"github.com/Qstimo/hundred-days/api/internal/httpapi/gen"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

// GetDay отдаёт всё для страницы дня одним ответом.
//
// Без параметра date берётся сегодня по зоне сервера. Будущий день посмотреть
// можно: запрет на запись в будущее не значит запрета на просмотр, и
// календарь должен открывать любую дату.
func (s *Server) GetDay(w http.ResponseWriter, r *http.Request, params gen.GetDayParams) {
	date := s.Today()
	if params.Date != nil {
		date = truncateToDate(params.Date.Time)
	}

	day, err := s.store.DayData(r.Context(), UserID(r.Context()), date)
	if err != nil {
		writeStoreError(w, err)
		return
	}

	trackers := make([]gen.DayTracker, 0, len(day.Trackers))
	for _, t := range day.Trackers {
		dt := gen.DayTracker{
			Tracker:    toTrackerPayload(t.Tracker),
			WeekDone:   int(t.WeekDone),
			WeekTarget: int(t.WeekTarget),
		}
		if t.Entry != nil {
			dt.Entry = &gen.Entry{
				Date:          openapi_types.Date{Time: t.Entry.Date},
				Hours:         float32Ptr(t.Entry.Hours),
				PointsAwarded: float32(t.Entry.PointsAwarded),
			}
		}
		trackers = append(trackers, dt)
	}

	plans := make([]gen.DayPlan, 0, len(day.Plans))
	for _, p := range day.Plans {
		plans = append(plans, toPlanPayload(p))
	}

	skills := make([]gen.DaySkill, 0, len(day.Skills))
	for _, sk := range day.Skills {
		skills = append(skills, gen.DaySkill{
			Skill:        toSkillPayload(sk.Skill),
			EarnedPoints: float32(sk.EarnedPoints),
		})
	}

	out := gen.DayResponse{
		Date: openapi_types.Date{Time: day.Date},
		// Сегодня по зоне сервера: клиенту нужно знать, открыт прошлый
		// день, сегодняшний или будущий, а вывести это из периода нельзя —
		// у не начавшегося номер дня нулевой.
		Today:              openapi_types.Date{Time: s.Today()},
		Period:             s.buildPeriod(day.Settings),
		SleepEnabled:       day.Settings.SleepEnabled,
		Trackers:           trackers,
		Plans:              plans,
		CarryOverAvailable: day.CarryOverAvailable,
		Skills:             skills,
	}

	if day.Sleep != nil {
		sleep := sleepPayload(*day.Sleep)
		out.Sleep = &sleep
	}

	writeJSON(w, http.StatusOK, out)
}

// dayParamsFrom читает дату из строки запроса.
//
// Негодная дата — 422 с указанием поля, а не 404: параметр прислан и
// разобрать его не вышло, это ошибка запроса, а не отсутствие объекта.
func dayParamsFrom(w http.ResponseWriter, r *http.Request) (gen.GetDayParams, bool) {
	var p gen.GetDayParams

	raw := r.URL.Query().Get("date")
	if raw == "" {
		return p, true
	}

	day, err := time.Parse("2006-01-02", raw)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "дата не разобрана", "date")
		return p, false
	}

	p.Date = &openapi_types.Date{Time: day}
	return p, true
}
