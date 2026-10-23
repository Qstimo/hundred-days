package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/Qstimo/hundred-days/api/internal/auth"
	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
	"github.com/Qstimo/hundred-days/api/internal/httpapi/gen"
	"github.com/jackc/pgx/v5"
)

// GetHealth отвечает на проверку живости.
func (s *Server) GetHealth(w http.ResponseWriter, r *http.Request) {
	Health(w, r)
}

// Login проверяет пароль и выдаёт cookie сессии.
//
// Неизвестный логин и неверный пароль отвечают одинаково, одним и тем же
// телом: разный ответ сказал бы, какие логины в системе есть.
func (s *Server) Login(w http.ResponseWriter, r *http.Request) {
	var in gen.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "тело запроса не разобрано", "")
		return
	}

	user, err := s.store.Queries().GetUserByLogin(r.Context(), in.Login)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeUnauthorizedLogin(w)
			return
		}
		writeError(w, http.StatusInternalServerError, "внутренняя ошибка", "")
		return
	}

	ok, err := auth.VerifyPassword(in.Password, user.PasswordHash)
	if err != nil || !ok {
		writeUnauthorizedLogin(w)
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
	writeJSON(w, http.StatusOK, gen.User{
		Id: user.ID, Login: user.Login, Name: user.Name,
	})
}

// writeUnauthorizedLogin — единственный отказ входа. Вынесен в функцию,
// чтобы два места не разошлись текстом: разный текст выдал бы, какая из
// двух причин сработала.
func writeUnauthorizedLogin(w http.ResponseWriter) {
	writeError(w, http.StatusUnauthorized, "логин или пароль не подходят", "")
}

// Logout удаляет сессию и гасит cookie. Отсутствие cookie — тоже успех:
// выход должен быть идемпотентным.
func (s *Server) Logout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(auth.SessionCookieName); err == nil {
		_ = s.store.Queries().DeleteSession(r.Context(), cookie.Value)
	}
	s.clearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

// GetMe отдаёт текущего пользователя.
func (s *Server) GetMe(w http.ResponseWriter, r *http.Request) {
	user, err := s.store.Queries().GetUserByID(r.Context(), UserID(r.Context()))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, gen.User{
		Id: user.ID, Login: user.Login, Name: user.Name,
	})
}
