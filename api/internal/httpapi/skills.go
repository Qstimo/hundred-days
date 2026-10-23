package httpapi

import (
	"encoding/json"
	"net/http"

	"github.com/Qstimo/hundred-days/api/internal/httpapi/gen"
	"github.com/Qstimo/hundred-days/api/internal/store"
)

// toSkillPayload переводит навык в вид контракта.
func toSkillPayload(s store.Skill) gen.Skill {
	return gen.Skill{
		Id:           s.ID,
		Title:        s.Title,
		TargetPoints: float32(s.TargetPoints),
		UnitLabel:    s.UnitLabel,
		SortOrder:    int(s.SortOrder),
		Archived:     s.Archived,
	}
}

// skillInputFrom читает тело запроса.
func skillInputFrom(r *http.Request) (store.SkillInput, error) {
	var in gen.SkillInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		return store.SkillInput{}, err
	}

	out := store.SkillInput{
		Title:        in.Title,
		TargetPoints: float64(in.TargetPoints),
	}
	if in.UnitLabel != nil {
		out.UnitLabel = *in.UnitLabel
	}
	if in.SortOrder != nil {
		out.SortOrder = int32(*in.SortOrder)
	}
	if in.Archived != nil {
		out.Archived = *in.Archived
	}
	return out, nil
}

// ListSkills отдаёт навыки пользователя.
func (s *Server) ListSkills(w http.ResponseWriter, r *http.Request, params gen.ListSkillsParams) {
	includeArchived := params.IncludeArchived != nil && *params.IncludeArchived

	skills, err := s.store.Skills(r.Context(), UserID(r.Context()), includeArchived)
	if err != nil {
		writeStoreError(w, err)
		return
	}

	// Пустой срез, а не nil: иначе в JSON уедет null вместо [], и клиенту
	// придётся это обходить.
	out := make([]gen.Skill, 0, len(skills))
	for _, sk := range skills {
		out = append(out, toSkillPayload(sk))
	}
	writeJSON(w, http.StatusOK, out)
}

// CreateSkill заводит навык.
func (s *Server) CreateSkill(w http.ResponseWriter, r *http.Request) {
	in, err := skillInputFrom(r)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "тело запроса не разобрано", "")
		return
	}

	skill, err := s.store.CreateSkill(r.Context(), UserID(r.Context()), in)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toSkillPayload(skill))
}

// UpdateSkill правит навык.
func (s *Server) UpdateSkill(w http.ResponseWriter, r *http.Request, id int64) {
	in, err := skillInputFrom(r)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "тело запроса не разобрано", "")
		return
	}

	skill, err := s.store.UpdateSkill(r.Context(), UserID(r.Context()), id, in)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toSkillPayload(skill))
}

// DeleteSkill удаляет навык.
func (s *Server) DeleteSkill(w http.ResponseWriter, r *http.Request, id int64) {
	if err := s.store.DeleteSkill(r.Context(), UserID(r.Context()), id); err != nil {
		writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// skillsParamsFrom читает параметры строки запроса для списка навыков.
// Генератор ждёт их отдельным аргументом, а разбирает их тот, кто
// регистрирует маршрут.
func skillsParamsFrom(r *http.Request) gen.ListSkillsParams {
	var p gen.ListSkillsParams
	if r.URL.Query().Get("includeArchived") == "true" {
		yes := true
		p.IncludeArchived = &yes
	}
	return p
}
