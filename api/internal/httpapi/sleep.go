package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/Qstimo/hundred-days/api/internal/domain"
	"github.com/Qstimo/hundred-days/api/internal/httpapi/gen"
	"github.com/Qstimo/hundred-days/api/internal/store"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

const microsPerMinute = 60 * 1_000_000

// parseClock переводит «ЧЧ:ММ» в микросекунды от полуночи — вид, в котором
// PostgreSQL хранит время суток.
//
// Формат строгий, с ведущим нулём. Допускать второй («7:10») значит однажды
// получить два разных значения одного времени.
func parseClock(s string) (int64, error) {
	if len(s) != 5 || s[2] != ':' {
		return 0, fmt.Errorf("время не в формате ЧЧ:ММ: %q", s)
	}

	var h, m int
	// Sscanf с %2d принял бы и «7:10», поэтому длина проверена выше.
	if _, err := fmt.Sscanf(s, "%2d:%2d", &h, &m); err != nil {
		return 0, fmt.Errorf("время не разобрано: %q", s)
	}
	if h < 0 || h > 23 || m < 0 || m > 59 {
		return 0, fmt.Errorf("время вне суток: %q", s)
	}

	return int64(h*3600+m*60) * 1_000_000, nil
}

// formatClock переводит микросекунды обратно в «ЧЧ:ММ».
func formatClock(micros int64) string {
	totalMinutes := micros / microsPerMinute
	return fmt.Sprintf("%02d:%02d", totalMinutes/60, totalMinutes%60)
}

// sleepPayload собирает ответ, досчитывая длительность.
//
// Длительность вычисляется здесь по domain.SleepDuration, а не хранится:
// правило перехода через полночь должно жить в одном месте, и это место —
// пакет вычислений.
func sleepPayload(s store.Sleep) gen.Sleep {
	out := gen.Sleep{Date: openapi_types.Date{Time: s.Date}}

	if s.WentToBedAt != nil {
		v := formatClock(*s.WentToBedAt)
		out.WentToBedAt = &v
	}
	if s.WokeUpAt != nil {
		v := formatClock(*s.WokeUpAt)
		out.WokeUpAt = &v
	}
	if s.Quality != nil {
		q := int(*s.Quality)
		out.Quality = &q
	}

	if d := domain.SleepDuration(durationPtr(s.WentToBedAt), durationPtr(s.WokeUpAt)); d != nil {
		minutes := int(d.Minutes())
		out.DurationMinutes = &minutes
	}

	return out
}

// durationPtr переводит микросекунды от полуночи в time.Duration — вид,
// который принимает domain.
func durationPtr(micros *int64) *time.Duration {
	if micros == nil {
		return nil
	}
	d := time.Duration(*micros) * time.Microsecond
	return &d
}

// PutSleep записывает сон за дату.
func (s *Server) PutSleep(w http.ResponseWriter, r *http.Request, date openapi_types.Date) {
	var in gen.SleepInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "тело запроса не разобрано", "")
		return
	}

	out := store.SleepInput{}

	if in.WentToBedAt != nil {
		micros, err := parseClock(*in.WentToBedAt)
		if err != nil {
			writeError(w, http.StatusUnprocessableEntity,
				"время отхода не в формате ЧЧ:ММ", "went_to_bed_at")
			return
		}
		out.WentToBedAt = &micros
	}

	if in.WokeUpAt != nil {
		micros, err := parseClock(*in.WokeUpAt)
		if err != nil {
			writeError(w, http.StatusUnprocessableEntity,
				"время подъёма не в формате ЧЧ:ММ", "woke_up_at")
			return
		}
		out.WokeUpAt = &micros
	}

	if in.Quality != nil {
		q := int16(*in.Quality)
		out.Quality = &q
	}

	saved, err := s.store.SaveSleep(r.Context(), UserID(r.Context()),
		truncateToDate(date.Time), out)
	if err != nil {
		writeStoreError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, sleepPayload(saved))
}

// DeleteSleep убирает запись сна.
func (s *Server) DeleteSleep(w http.ResponseWriter, r *http.Request, date openapi_types.Date) {
	err := s.store.DeleteSleep(r.Context(), UserID(r.Context()), truncateToDate(date.Time))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// withDate разбирает дату из пути. Неразобранная — 404: такого дня нет.
func withDate(
	h func(http.ResponseWriter, *http.Request, openapi_types.Date),
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		day, err := time.Parse("2006-01-02", chiURLParam(r, "date"))
		if err != nil {
			writeError(w, http.StatusNotFound, "нет такой записи", "")
			return
		}
		h(w, r, openapi_types.Date{Time: day})
	}
}
