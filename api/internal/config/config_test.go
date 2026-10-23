package config

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestLoadRequiresDatabaseURL(t *testing.T) {
	_, err := Load(func(string) (string, bool) { return "", false })

	require.ErrorContains(t, err, "HD_DATABASE_URL")
}

func TestLoadDefaults(t *testing.T) {
	env := map[string]string{"HD_DATABASE_URL": "postgres://localhost/hd"}

	cfg, err := Load(func(k string) (string, bool) { v, ok := env[k]; return v, ok })

	require.NoError(t, err)
	require.Equal(t, ":3001", cfg.Addr)
	require.Equal(t, "Europe/Moscow", cfg.Location.String())
	require.Equal(t, 30*24*time.Hour, cfg.SessionTTL)
	require.False(t, cfg.SecureCookie)
}

// Зона нужна валидная: по ней определяется «сегодня», и опечатка в имени
// увела бы все даты в UTC молча.
func TestLoadRejectsUnknownTimezone(t *testing.T) {
	env := map[string]string{
		"HD_DATABASE_URL": "postgres://localhost/hd",
		"HD_TIMEZONE":     "Europe/Moskva",
	}

	_, err := Load(func(k string) (string, bool) { v, ok := env[k]; return v, ok })

	require.ErrorContains(t, err, "HD_TIMEZONE")
}
