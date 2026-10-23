package httpapi

import (
	"net/http"
	"time"

	"github.com/Qstimo/hundred-days/api/internal/httpapi/gen"
	"github.com/Qstimo/hundred-days/api/internal/store"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

// GetStats отдаёт статистику за отрезок.
func (s *Server) GetStats(w http.ResponseWriter, r *http.Request, params gen.GetStatsParams) {
	stats, err := s.store.StatsData(r.Context(), UserID(r.Context()),
		truncateToDate(params.From.Time), truncateToDate(params.To.Time), s.Today())
	if err != nil {
		writeStoreError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, gen.StatsResponse{
		From:     openapi_types.Date{Time: stats.From},
		To:       openapi_types.Date{Time: stats.To},
		Trackers: statsTrackersPayload(stats.Trackers),
		Skills:   statsSkillsPayload(stats.Skills),
		Sleep:    statsSleepPayload(stats.Sleep),
		Plans: gen.StatsPlans{
			Total: stats.Plans.Total,
			Done:  stats.Plans.Done,
			Rate:  float32(stats.Plans.Rate),
		},
	})
}

func statsTrackersPayload(in []store.StatsTracker) []gen.StatsTracker {
	out := make([]gen.StatsTracker, 0, len(in))
	for _, t := range in {
		days := make([]gen.StatsDay, 0, len(t.Days))
		for _, d := range t.Days {
			days = append(days, gen.StatsDay{
				Date:   openapi_types.Date{Time: d.Date},
				Done:   d.Done,
				Hours:  float32Ptr(d.Hours),
				Points: float32(d.Points),
			})
		}

		out = append(out, gen.StatsTracker{
			TrackerId:       t.Tracker.ID,
			Title:           t.Tracker.Title,
			Mode:            gen.TrackerMode(t.Tracker.Mode),
			WeeklyTarget:    int(t.Tracker.WeeklyTarget),
			Days:            days,
			TotalDone:       t.TotalDone,
			TotalHours:      float32(t.TotalHours),
			TotalPoints:     float32(t.TotalPoints),
			CompletionRate:  float32(t.CompletionRate),
			CurrentStreak:   t.Streak.Current,
			BestStreak:      t.Streak.Best,
			CurrentWeekDone: t.Streak.CurrentWeekDone,
		})
	}
	return out
}

func statsSkillsPayload(in []store.StatsSkill) []gen.StatsSkill {
	out := make([]gen.StatsSkill, 0, len(in))
	for _, sk := range in {
		out = append(out, gen.StatsSkill{
			SkillId:      sk.Skill.ID,
			Title:        sk.Skill.Title,
			UnitLabel:    sk.Skill.UnitLabel,
			TargetPoints: float32(sk.Skill.TargetPoints),
			EarnedPoints: float32(sk.EarnedPoints),
			PacePerDay:   float32(sk.PacePerDay),
			Forecast:     float32(sk.Forecast),
			WillReach:    sk.WillReach,
		})
	}
	return out
}

// statsSleepPayload отдаёт только дни с записями: пустые ночи заполнять
// незачем — график сна размыкается на них сам.
func statsSleepPayload(in []store.StatsSleep) []gen.StatsSleep {
	out := make([]gen.StatsSleep, 0, len(in))
	for _, sl := range in {
		item := gen.StatsSleep{Date: openapi_types.Date{Time: sl.Date}}

		if sl.WentToBedAt != nil {
			v := formatClock(*sl.WentToBedAt)
			item.WentToBedAt = &v
		}
		if sl.WokeUpAt != nil {
			v := formatClock(*sl.WokeUpAt)
			item.WokeUpAt = &v
		}
		if sl.Quality != nil {
			q := int(*sl.Quality)
			item.Quality = &q
		}

		// Длительность считается тем же правилом, что на странице дня:
		// переиспользуется sleepPayload, а не пишется второй раз.
		if d := sleepPayload(store.Sleep{
			Date: sl.Date, WentToBedAt: sl.WentToBedAt, WokeUpAt: sl.WokeUpAt,
		}).DurationMinutes; d != nil {
			item.DurationMinutes = d
		}

		out = append(out, item)
	}
	return out
}

// statsParamsFrom читает обязательные края отрезка.
//
// Оба обязательны: отрезок без края не имеет смысла, а догадываться о нём
// значило бы отдавать не то, что просили.
func statsParamsFrom(w http.ResponseWriter, r *http.Request) (gen.GetStatsParams, bool) {
	var p gen.GetStatsParams
	q := r.URL.Query()

	from, ok := parseRequiredDate(w, q.Get("from"), "from")
	if !ok {
		return p, false
	}
	to, ok := parseRequiredDate(w, q.Get("to"), "to")
	if !ok {
		return p, false
	}

	p.From = openapi_types.Date{Time: from}
	p.To = openapi_types.Date{Time: to}
	return p, true
}

func parseRequiredDate(w http.ResponseWriter, raw, field string) (time.Time, bool) {
	if raw == "" {
		writeError(w, http.StatusUnprocessableEntity, "нужна дата "+field, field)
		return time.Time{}, false
	}

	d, err := time.Parse("2006-01-02", raw)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "дата не разобрана", field)
		return time.Time{}, false
	}
	return d, true
}
