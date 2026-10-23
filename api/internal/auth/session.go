package auth

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"time"
)

// SessionCookieName — имя cookie сессии.
const SessionCookieName = "hd_session"

// NewSessionID выдаёт идентификатор сессии: 32 случайных байта в base64url.
// Это ключ ко всем данным пользователя, поэтому берётся из системного
// источника случайности, а не из счётчика или времени. Кодировка без
// заполнения и без знаков, требующих экранирования в cookie.
func NewSessionID() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("не вышло получить случайные байты: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// IsExpired отвечает, истёк ли срок. Ровно наступивший срок считается
// истёкшим: граница должна быть на одной стороне.
func IsExpired(expiresAt, now time.Time) bool {
	return !expiresAt.After(now)
}

// NeedsExtension отвечает, пора ли продлить сессию. Продление скользящее и
// редкое: запись в базу на каждом запросе ради продления на минуту — пустая
// работа. Истёкшая сессия не продлевается.
func NeedsExtension(expiresAt, now time.Time, ttl time.Duration) bool {
	if IsExpired(expiresAt, now) {
		return false
	}
	return expiresAt.Sub(now) < ttl/2
}
