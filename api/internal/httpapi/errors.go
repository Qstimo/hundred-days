package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/Qstimo/hundred-days/api/internal/domain"
	"github.com/Qstimo/hundred-days/api/internal/httpapi/gen"
	"github.com/Qstimo/hundred-days/api/internal/store"
	"github.com/jackc/pgx/v5"
)

// writeError отдаёт ошибку одним форматом. code — машинный повод, нужный
// интерфейсу, чтобы показать своё сообщение у конкретного поля.
func writeError(w http.ResponseWriter, status int, message, code string) {
	payload := gen.Error{Message: message}
	if code != "" {
		payload.Code = &code
	}
	writeJSON(w, status, payload)
}

// writeStoreError переводит ошибку хранилища в код ответа.
//
// Отсутствие записи — всегда 404, даже если причина в чужом владельце:
// ответ 403 сообщил бы, что запись существует. Это инвариант дизайна.
func writeStoreError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		writeError(w, http.StatusNotFound, "нет такой записи", "")
	case errors.Is(err, domain.ErrRuleNeedsHours):
		writeError(w, http.StatusConflict,
			"правило «за час» требует режима с часами", "rule_needs_hours")
	case errors.Is(err, store.ErrEmptyTitle):
		writeError(w, http.StatusUnprocessableEntity, "название пустое", "title")
	case errors.Is(err, store.ErrTargetNotPositive):
		writeError(w, http.StatusUnprocessableEntity,
			"цель должна быть больше нуля", "target_points")
	default:
		writeError(w, http.StatusInternalServerError, "внутренняя ошибка", "")
	}
}

// writeJSON отдаёт ответ. Заголовок ставится до кода состояния: после
// WriteHeader заголовки уже ушли и меняться не будут.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
