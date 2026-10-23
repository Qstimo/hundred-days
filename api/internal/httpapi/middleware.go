package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/Qstimo/hundred-days/api/internal/auth"
	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

type ctxKey string

const userIDKey ctxKey = "userID"

// UserID достаёт пользователя из контекста. Отсутствие — ошибка сборки
// роутера, а не запроса: до хендлера под охраной без него не доходят,
// и молчаливый ноль здесь означал бы обращение к данным пользователя
// с идентификатором 0.
func UserID(ctx context.Context) int64 {
	id, ok := ctx.Value(userIDKey).(int64)
	if !ok {
		panic("хендлер под охраной сессии вызван без userID в контексте")
	}
	return id
}

// requireSession пропускает дальше только с живой сессией. Истёкшую удаляет
// и гасит cookie: иначе браузер носил бы мёртвый ключ месяцами.
//
// Неизвестная и истёкшая сессии отвечают так же, как отсутствующая: разница
// в ответах подсказывала бы, какие идентификаторы когда-то существовали.
func (s *Server) requireSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(auth.SessionCookieName)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "нужен вход", "")
			return
		}

		sess, err := s.store.Queries().GetSessionByID(r.Context(), cookie.Value)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				s.clearSessionCookie(w)
				writeError(w, http.StatusUnauthorized, "нужен вход", "")
				return
			}
			writeError(w, http.StatusInternalServerError, "не вышло проверить сессию", "")
			return
		}

		now := s.now()
		if auth.IsExpired(sess.ExpiresAt, now) {
			_ = s.store.Queries().DeleteSession(r.Context(), sess.ID)
			s.clearSessionCookie(w)
			writeError(w, http.StatusUnauthorized, "нужен вход", "")
			return
		}

		if auth.NeedsExtension(sess.ExpiresAt, now, s.cfg.SessionTTL) {
			expires := now.Add(s.cfg.SessionTTL)
			// Неудача продления не повод отказывать во входе: сессия ещё
			// жива, а запись можно повторить на следующем запросе.
			if err := s.store.Queries().ExtendSession(r.Context(), dbgen.ExtendSessionParams{
				ID: sess.ID, ExpiresAt: expires,
			}); err == nil {
				s.setSessionCookie(w, sess.ID, expires)
			}
		}

		ctx := context.WithValue(r.Context(), userIDKey, sess.UserID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (s *Server) setSessionCookie(w http.ResponseWriter, id string, expires time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     auth.SessionCookieName,
		Value:    id,
		Path:     "/",
		Expires:  expires,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.cfg.SecureCookie,
	})
}

func (s *Server) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     auth.SessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.cfg.SecureCookie,
	})
}

// withID разбирает числовой идентификатор из пути и передаёт его хендлеру.
//
// Генератор объявляет идентификатор отдельным аргументом хендлера, потому
// что его маршрутизатор разобрал бы его сам. Маршруты здесь собраны руками,
// и разбор делает эта обёртка — иначе аргумент остался бы мёртвым, а каждый
// хендлер лазил бы в путь второй раз.
//
// Неразобранный путь — 404, а не 400: такого объекта нет, и сообщать о
// разнице между «негодный номер» и «нет такого» незачем.
func withID(h func(http.ResponseWriter, *http.Request, int64)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil || id <= 0 {
			writeError(w, http.StatusNotFound, "нет такой записи", "")
			return
		}
		h(w, r, id)
	}
}
