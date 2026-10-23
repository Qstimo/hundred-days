package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/Qstimo/hundred-days/api/internal/auth"
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
	case errors.Is(err, store.ErrWeeklyTargetOutOfRange):
		writeError(w, http.StatusUnprocessableEntity,
			"недельная цель должна быть от 1 до 7", "weekly_target")
	case errors.Is(err, store.ErrPointsValueNegative):
		writeError(w, http.StatusUnprocessableEntity,
			"цена выполнения не может быть отрицательной", "points_value")
	case errors.Is(err, store.ErrUnknownMode):
		writeError(w, http.StatusUnprocessableEntity,
			"неизвестный режим трекера", "mode")
	case errors.Is(err, store.ErrUnknownRule):
		writeError(w, http.StatusUnprocessableEntity,
			"неизвестное правило начисления", "points_rule")
	case errors.Is(err, store.ErrHoursRequired):
		writeError(w, http.StatusUnprocessableEntity,
			"у этого трекера поинты считаются за час — укажите часы", "hours_required")
	case errors.Is(err, store.ErrHoursOutOfRange):
		writeError(w, http.StatusUnprocessableEntity,
			"часы должны быть больше нуля и не больше 24", "hours")
	case errors.Is(err, store.ErrQualityOutOfRange):
		writeError(w, http.StatusUnprocessableEntity,
			"оценка сна должна быть от 1 до 5", "quality")
	case errors.Is(err, store.ErrRangeInverted):
		writeError(w, http.StatusUnprocessableEntity,
			"конец отрезка раньше начала", "range_inverted")
	case errors.Is(err, store.ErrRegistrationClosed):
		writeError(w, http.StatusConflict,
			"регистрация закрыта: аккаунт уже существует", "registration_closed")
	case errors.Is(err, store.ErrLoginTaken):
		writeError(w, http.StatusConflict, "логин занят", "login_taken")
	case errors.Is(err, store.ErrEmptyLogin):
		writeError(w, http.StatusUnprocessableEntity, "логин пустой", "login")
	case errors.Is(err, auth.ErrPasswordTooShort):
		writeError(w, http.StatusUnprocessableEntity,
			"пароль короче восьми знаков", "password")
	case errors.Is(err, store.ErrRangeTooLong):
		writeError(w, http.StatusUnprocessableEntity,
			"отрезок длиннее 400 дней", "range_too_long")
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
