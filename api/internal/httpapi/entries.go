package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/Qstimo/hundred-days/api/internal/httpapi/gen"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

// PutEntry ставит или перезаписывает отметку выполнения.
func (s *Server) PutEntry(
	w http.ResponseWriter, r *http.Request, id int64, date openapi_types.Date,
) {
	day := truncateToDate(date.Time)

	// Дата в будущем отвергается: отметить то, чего ещё не было, нельзя.
	// «Сегодня» берётся из зоны приложения, а не из браузера — проверка
	// живёт здесь, а не в хранилище, потому что требует знания о часах
	// сервера.
	if day.After(s.Today()) {
		writeError(w, http.StatusUnprocessableEntity, "дата в будущем", "future_date")
		return
	}

	hours, err := entryHoursFrom(r)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "тело запроса не разобрано", "")
		return
	}

	entry, err := s.store.SaveEntry(r.Context(), UserID(r.Context()), id, day, hours)
	if err != nil {
		writeStoreError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, gen.Entry{
		Date:          openapi_types.Date{Time: entry.Date},
		Hours:         float32Ptr(entry.Hours),
		PointsAwarded: float32(entry.PointsAwarded),
	})
}

// DeleteEntry снимает отметку.
func (s *Server) DeleteEntry(
	w http.ResponseWriter, r *http.Request, id int64, date openapi_types.Date,
) {
	err := s.store.DeleteEntry(r.Context(), UserID(r.Context()), id,
		truncateToDate(date.Time))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// entryHoursFrom читает часы из тела. Тело необязательно: у трекера без
// часов отметка — это просто галочка, и пустой запрос законен.
func entryHoursFrom(r *http.Request) (*float64, error) {
	var in gen.EntryInput

	err := json.NewDecoder(r.Body).Decode(&in)
	if errors.Is(err, io.EOF) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if in.Hours == nil {
		return nil, nil
	}
	h := float64(*in.Hours)
	return &h, nil
}

// float32Ptr переводит часы в тип контракта. Отсутствие остаётся
// отсутствием: ноль часов и «часов нет» — разные вещи.
func float32Ptr(v *float64) *float32 {
	if v == nil {
		return nil
	}
	f := float32(*v)
	return &f
}

// withIDAndDate разбирает идентификатор и дату из пути.
//
// Неразобранное — 404: такого объекта нет. Дата проверяется строго, без
// догадок о формате, и «2026-13-01» отвергается здесь, а не в базе.
func withIDAndDate(
	h func(http.ResponseWriter, *http.Request, int64, openapi_types.Date),
) http.HandlerFunc {
	return withID(func(w http.ResponseWriter, r *http.Request, id int64) {
		raw := chiURLParam(r, "date")

		day, err := time.Parse("2006-01-02", raw)
		if err != nil {
			writeError(w, http.StatusNotFound, "нет такой записи", "")
			return
		}

		h(w, r, id, openapi_types.Date{Time: day})
	})
}
