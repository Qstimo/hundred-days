package httpapi

import (
	"encoding/json"
	"net/http"
	"time"

	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
	"github.com/Qstimo/hundred-days/api/internal/domain"
	"github.com/Qstimo/hundred-days/api/internal/httpapi/gen"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

// toSettings переводит строку базы в вид контракта.
func toSettings(st dbgen.Setting) gen.Settings {
	return gen.Settings{
		PeriodTitle:  st.PeriodTitle,
		PeriodStart:  openapi_types.Date{Time: st.PeriodStart},
		PeriodDays:   int(st.PeriodDays),
		SleepEnabled: st.SleepEnabled,
	}
}

// buildPeriod считает период. Не хранится: номер дня и остаток меняются сами
// собой каждые сутки.
func (s *Server) buildPeriod(st dbgen.Setting) gen.Period {
	today := s.Today()
	return gen.Period{
		Title: st.PeriodTitle,
		Start: openapi_types.Date{Time: st.PeriodStart},
		Days:  int(st.PeriodDays),
		// Сегодня отдаётся отдельным полем, а не выводится клиентом из
		// номера дня: у не начавшегося периода номер нулевой.
		Today:     openapi_types.Date{Time: today},
		DayNumber: domain.DayNumber(st.PeriodStart, today),
		DaysLeft:  domain.DaysLeft(st.PeriodStart, int(st.PeriodDays), today),
	}
}

// GetSettings отдаёт настройки вместе с вычисленным периодом: интерфейсу
// нужны оба, и второй запрос ради шапки был бы лишним.
func (s *Server) GetSettings(w http.ResponseWriter, r *http.Request) {
	st, err := s.store.Settings(r.Context(), UserID(r.Context()))
	if err != nil {
		writeStoreError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, gen.SettingsResponse{
		Settings: toSettings(st),
		Period:   s.buildPeriod(st),
	})
}

// PutSettings сохраняет настройки.
func (s *Server) PutSettings(w http.ResponseWriter, r *http.Request) {
	var in gen.Settings
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusUnprocessableEntity,
			"дата начала не разобрана", "period_start")
		return
	}

	// Пределы те же, что ограничением в базе. Проверка здесь нужна, чтобы
	// ответ был понятным 422 с указанием поля, а не невнятной ошибкой СУБД.
	if in.PeriodDays < 1 || in.PeriodDays > 3650 {
		writeError(w, http.StatusUnprocessableEntity,
			"длительность вне допустимого: от 1 до 3650 дней", "period_days")
		return
	}

	st, err := s.store.SaveSettings(r.Context(), UserID(r.Context()),
		dbgen.UpsertSettingsParams{
			PeriodTitle: in.PeriodTitle,
			// Время отбрасывается: в базе это date, и пришедшая метка со
			// временем молча уехала бы на сутки в другой зоне.
			PeriodStart:  truncateToDate(in.PeriodStart.Time),
			PeriodDays:   int32(in.PeriodDays),
			SleepEnabled: in.SleepEnabled,
		})
	if err != nil {
		writeStoreError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toSettings(st))
}

// truncateToDate оставляет от метки только дату, в UTC.
func truncateToDate(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}
