package store

import (
	"context"

	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
)

// Settings возвращает настройки пользователя.
func (s *Store) Settings(ctx context.Context, userID int64) (dbgen.Setting, error) {
	return s.q.GetSettings(ctx, userID)
}

// SaveSettings записывает настройки, создавая строку при первом сохранении.
//
// userID подставляется здесь, а не берётся из переданных параметров:
// хендлер не должен иметь возможности прислать чужой.
func (s *Store) SaveSettings(
	ctx context.Context, userID int64, in dbgen.UpsertSettingsParams,
) (dbgen.Setting, error) {
	in.UserID = userID
	return s.q.UpsertSettings(ctx, in)
}
