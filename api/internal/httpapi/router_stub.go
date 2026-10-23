package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// RouterStub — роутер первого чанка: только проверка живости. Заменяется
// настоящим роутером в задаче 3.6.
func RouterStub() http.Handler {
	r := chi.NewRouter()
	r.Get("/api/health", Health)
	return r
}
