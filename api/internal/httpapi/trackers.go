package httpapi

import (
	"encoding/json"
	"net/http"

	"github.com/Qstimo/hundred-days/api/internal/domain"
	"github.com/Qstimo/hundred-days/api/internal/httpapi/gen"
	"github.com/Qstimo/hundred-days/api/internal/store"
)

// toTrackerPayload переводит трекер в вид контракта.
func toTrackerPayload(t store.Tracker) gen.Tracker {
	return gen.Tracker{
		Id:           t.ID,
		Title:        t.Title,
		Mode:         gen.TrackerMode(t.Mode),
		PointsRule:   gen.PointsRule(t.PointsRule),
		PointsValue:  float32(t.PointsValue),
		SkillId:      t.SkillID,
		WeeklyTarget: int(t.WeeklyTarget),
		SortOrder:    int(t.SortOrder),
		Archived:     t.Archived,
		EntryCount:   int(t.EntryCount),
	}
}

// trackerInputFrom читает тело запроса.
//
// Режим и правило приходят строками и здесь не проверяются: негодное
// значение отвергнет хранилище — там же, где лежит инвариант их сочетания.
func trackerInputFrom(r *http.Request) (store.TrackerInput, error) {
	var in gen.TrackerInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		return store.TrackerInput{}, err
	}

	out := store.TrackerInput{
		Title:        in.Title,
		Mode:         domain.Mode(in.Mode),
		PointsRule:   domain.Rule(in.PointsRule),
		PointsValue:  float64(in.PointsValue),
		SkillID:      in.SkillId,
		WeeklyTarget: int32(in.WeeklyTarget),
	}
	if in.SortOrder != nil {
		out.SortOrder = int32(*in.SortOrder)
	}
	if in.Archived != nil {
		out.Archived = *in.Archived
	}
	return out, nil
}

// trackersParamsFrom читает параметры строки запроса для списка трекеров.
func trackersParamsFrom(r *http.Request) gen.ListTrackersParams {
	var p gen.ListTrackersParams
	if r.URL.Query().Get("includeArchived") == "true" {
		yes := true
		p.IncludeArchived = &yes
	}
	return p
}

// ListTrackers отдаёт трекеры пользователя.
func (s *Server) ListTrackers(w http.ResponseWriter, r *http.Request, params gen.ListTrackersParams) {
	includeArchived := params.IncludeArchived != nil && *params.IncludeArchived

	trackers, err := s.store.Trackers(r.Context(), UserID(r.Context()), includeArchived)
	if err != nil {
		writeStoreError(w, err)
		return
	}

	out := make([]gen.Tracker, 0, len(trackers))
	for _, t := range trackers {
		out = append(out, toTrackerPayload(t))
	}
	writeJSON(w, http.StatusOK, out)
}

// CreateTracker заводит трекер.
func (s *Server) CreateTracker(w http.ResponseWriter, r *http.Request) {
	in, err := trackerInputFrom(r)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "тело запроса не разобрано", "")
		return
	}

	tracker, err := s.store.CreateTracker(r.Context(), UserID(r.Context()), in)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toTrackerPayload(tracker))
}

// UpdateTracker правит трекер.
func (s *Server) UpdateTracker(w http.ResponseWriter, r *http.Request, id int64) {
	in, err := trackerInputFrom(r)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "тело запроса не разобрано", "")
		return
	}

	tracker, err := s.store.UpdateTracker(r.Context(), UserID(r.Context()), id, in)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toTrackerPayload(tracker))
}

// DeleteTracker удаляет трекер вместе с его отметками.
func (s *Server) DeleteTracker(w http.ResponseWriter, r *http.Request, id int64) {
	if err := s.store.DeleteTracker(r.Context(), UserID(r.Context()), id); err != nil {
		writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
