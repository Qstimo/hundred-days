// Package config читает настройки из переменных окружения. Отсутствие
// обязательной переменной — ошибка запуска, а не значение по умолчанию:
// приложение, молча поднявшееся не с той базой, хуже не поднявшегося.
package config

import (
	"fmt"
	"time"
)

// Lookup — источник переменных. Вынесен в параметр, чтобы тесты не трогали
// настоящее окружение процесса.
type Lookup func(key string) (string, bool)

// Config — все настройки приложения.
type Config struct {
	DatabaseURL  string
	Addr         string
	Location     *time.Location
	SessionTTL   time.Duration
	SecureCookie bool
}

// Load собирает настройки. Обязательна только строка подключения к базе.
func Load(lookup Lookup) (Config, error) {
	cfg := Config{
		Addr:       ":3001",
		SessionTTL: 30 * 24 * time.Hour,
	}

	url, ok := lookup("HD_DATABASE_URL")
	if !ok || url == "" {
		return Config{}, fmt.Errorf("HD_DATABASE_URL не задан")
	}
	cfg.DatabaseURL = url

	if addr, ok := lookup("HD_ADDR"); ok && addr != "" {
		cfg.Addr = addr
	}

	tz := "Europe/Moscow"
	if v, ok := lookup("HD_TIMEZONE"); ok && v != "" {
		tz = v
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return Config{}, fmt.Errorf("HD_TIMEZONE: неизвестная зона %q: %w", tz, err)
	}
	cfg.Location = loc

	// Флаг Secure у cookie: по HTTP он сделал бы вход невозможным, поэтому
	// включается отдельно, вместе с HTTPS.
	if v, ok := lookup("HD_SECURE_COOKIE"); ok && v == "true" {
		cfg.SecureCookie = true
	}

	return cfg, nil
}
