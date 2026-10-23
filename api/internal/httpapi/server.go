package httpapi

import (
	"net/http"
	"time"

	"github.com/Qstimo/hundred-days/api/internal/config"
	"github.com/Qstimo/hundred-days/api/internal/httpapi/gen"
	"github.com/Qstimo/hundred-days/api/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Clock отдаёт текущий момент. Вынесен в зависимость, чтобы тесты на
// остаток дней периода не меняли ответ каждые сутки.
type Clock func() time.Time

// Server — приложение: хранилище, настройки, часы.
type Server struct {
	store *store.Store
	cfg   config.Config
	now   Clock
}

// Сервер обязан покрывать весь контракт: новая операция в спецификации
// ломает сборку, пока у неё нет хендлера.
//
// Маршрутизатор при этом пишется руками, а не берётся у генератора со
// строгими ответами. Строгий сервер раздавал бы маршруты сам, и границу
// «открыто / под сессией» пришлось бы ставить посредником, разбирающим путь
// запроса. Для границы аутентификации это плохой приём: ошибка в сравнении
// пути открывает наружу всё. Здесь граница видна глазами — в NewRouter.
var _ gen.ServerInterface = (*Server)(nil)

// NewRouter собирает маршруты. Открытыми остаются только живость, вход и
// выход; всё остальное — под посредником сессии.
func NewRouter(pool *pgxpool.Pool, cfg config.Config, now Clock) http.Handler {
	s := &Server{store: store.New(pool), cfg: cfg, now: now}

	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.Recoverer)

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", s.GetHealth)
		r.Post("/auth/login", s.Login)
		// Выход открыт нарочно: с истёкшей сессией он должен гасить cookie,
		// а не отвечать отказом.
		r.Post("/auth/logout", s.Logout)

		r.Group(func(r chi.Router) {
			r.Use(s.requireSession)

			r.Get("/auth/me", s.GetMe)
			r.Get("/settings", s.GetSettings)
			r.Put("/settings", s.PutSettings)

			r.Get("/skills", func(w http.ResponseWriter, r *http.Request) {
				s.ListSkills(w, r, skillsParamsFrom(r))
			})
			r.Post("/skills", s.CreateSkill)
			r.Put("/skills/{id}", withID(s.UpdateSkill))
			r.Delete("/skills/{id}", withID(s.DeleteSkill))

			r.Get("/trackers", func(w http.ResponseWriter, r *http.Request) {
				s.ListTrackers(w, r, trackersParamsFrom(r))
			})
			r.Post("/trackers", s.CreateTracker)
			r.Put("/trackers/{id}", withID(s.UpdateTracker))
			r.Delete("/trackers/{id}", withID(s.DeleteTracker))

			r.Put("/trackers/{id}/entries/{date}", withIDAndDate(s.PutEntry))
			r.Delete("/trackers/{id}/entries/{date}", withIDAndDate(s.DeleteEntry))
			// Остальные маршруты добавляются в чанках 4–6.
		})
	})

	return r
}

// Today возвращает сегодняшнюю дату в зоне приложения. Зона своя, а не
// браузерная: иначе запись в час ночи уехала бы на другую дату, а
// статистика разошлась бы между телефоном и ноутбуком.
func (s *Server) Today() time.Time {
	t := s.now().In(s.cfg.Location)
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}
