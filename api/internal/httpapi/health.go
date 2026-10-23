package httpapi

import (
	"encoding/json"
	"net/http"
)

// Health отвечает на проверку живости. Ни база, ни сессия не нужны: ручку
// спрашивает docker compose в момент, когда остальное может быть не поднято.
func Health(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
