package httpapi

import (
	"encoding/json"
	"net/http"

	"github.com/Qstimo/hundred-days/api/internal/httpapi/gen"
	"github.com/Qstimo/hundred-days/api/internal/store"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

// toPlanPayload переводит пункт плана в вид контракта.
func toPlanPayload(p store.DayPlan) gen.DayPlan {
	out := gen.DayPlan{
		Id:            p.ID,
		Date:          openapi_types.Date{Time: p.Date},
		Title:         p.Title,
		Done:          p.Done(),
		SortOrder:     int(p.SortOrder),
		CarriedFromId: p.CarriedFromID,
	}
	if p.DoneAt != nil {
		out.DoneAt = p.DoneAt
	}
	return out
}

// CreateDayPlan добавляет пункт плана.
func (s *Server) CreateDayPlan(w http.ResponseWriter, r *http.Request) {
	var in gen.DayPlanCreate
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "тело запроса не разобрано", "")
		return
	}

	var sortOrder int32
	if in.SortOrder != nil {
		sortOrder = int32(*in.SortOrder)
	}

	plan, err := s.store.CreatePlan(r.Context(), UserID(r.Context()),
		truncateToDate(in.Date.Time), in.Title, sortOrder)
	if err != nil {
		writeStoreError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, toPlanPayload(plan))
}

// PatchDayPlan правит пункт. Присланы только изменяемые поля.
func (s *Server) PatchDayPlan(w http.ResponseWriter, r *http.Request, id int64) {
	var in gen.DayPlanPatch
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "тело запроса не разобрано", "")
		return
	}

	patch := store.DayPlanPatch{Title: in.Title, Done: in.Done}
	if in.SortOrder != nil {
		v := int32(*in.SortOrder)
		patch.SortOrder = &v
	}

	plan, err := s.store.PatchPlan(r.Context(), UserID(r.Context()), id, patch)
	if err != nil {
		writeStoreError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toPlanPayload(plan))
}

// DeleteDayPlan удаляет пункт.
func (s *Server) DeleteDayPlan(w http.ResponseWriter, r *http.Request, id int64) {
	if err := s.store.DeletePlan(r.Context(), UserID(r.Context()), id); err != nil {
		writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// CarryOverDayPlans подтягивает незакрытые пункты со вчера.
func (s *Server) CarryOverDayPlans(w http.ResponseWriter, r *http.Request) {
	var in gen.CarryOverRequest
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "тело запроса не разобрано", "")
		return
	}

	plans, err := s.store.CarryOverPlans(r.Context(), UserID(r.Context()),
		truncateToDate(in.Date.Time))
	if err != nil {
		writeStoreError(w, err)
		return
	}

	// Пустой срез, а не nil: иначе в JSON уедет null вместо [].
	out := make([]gen.DayPlan, 0, len(plans))
	for _, p := range plans {
		out = append(out, toPlanPayload(p))
	}
	writeJSON(w, http.StatusOK, out)
}
