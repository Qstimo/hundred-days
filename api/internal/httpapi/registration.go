package httpapi

import (
	"encoding/json"
	"net/http"

	"github.com/Qstimo/hundred-days/api/internal/auth"
	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
	"github.com/Qstimo/hundred-days/api/internal/httpapi/gen"
)

// DefaultPeriodDays — длительность периода у нового аккаунта.
const DefaultPeriodDays = 100

// GetRegistrationState отвечает, открыта ли регистрация.
func (s *Server) GetRegistrationState(w http.ResponseWriter, r *http.Request) {
	isOpen, err := s.store.RegistrationOpen(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "внутренняя ошибка", "")
		return
	}
	writeJSON(w, http.StatusOK, gen.RegistrationState{IsOpen: isOpen})
}

// Register заводит первый аккаунт и сразу входит.
//
// Вход сразу, а не отправка на форму входа: заставлять вводить те же логин и
// пароль второй раз подряд незачем.
func (s *Server) Register(w http.ResponseWriter, r *http.Request) {
	var in gen.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "тело запроса не разобрано", "")
		return
	}

	name := ""
	if in.Name != nil {
		name = *in.Name
	}

	user, err := s.store.Register(r.Context(), in.Login, name, in.Password,
		s.Today(), DefaultPeriodDays)
	if err != nil {
		writeStoreError(w, err)
		return
	}

	id, err := auth.NewSessionID()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "не вышло создать сессию", "")
		return
	}

	expires := s.now().Add(s.cfg.SessionTTL)
	if err := s.store.Queries().CreateSession(r.Context(), dbgen.CreateSessionParams{
		ID: id, UserID: user.ID, ExpiresAt: expires,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "не вышло создать сессию", "")
		return
	}

	s.setSessionCookie(w, id, expires)
	writeJSON(w, http.StatusCreated, gen.User{
		Id: user.ID, Login: user.Login, Name: user.Name,
	})
}
