package auth

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestNewSessionIDIsLongAndUnique(t *testing.T) {
	a, err := NewSessionID()
	require.NoError(t, err)
	b, err := NewSessionID()
	require.NoError(t, err)

	require.NotEqual(t, a, b)
	// 32 случайных байта в base64url — 43 знака. Короче брать нельзя:
	// идентификатор сессии и есть ключ ко всем данным.
	require.Len(t, a, 43)
}

// Идентификатор уходит в cookie и в адресную строку служебных запросов —
// в нём не должно быть знаков, требующих кодирования.
func TestNewSessionIDIsURLSafe(t *testing.T) {
	id, err := NewSessionID()
	require.NoError(t, err)

	for _, r := range id {
		isSafe := (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') ||
			(r >= '0' && r <= '9') || r == '-' || r == '_'
		require.True(t, isSafe, "знак %q небезопасен для cookie", r)
	}
}

// Продление скользящее: сессия обновляется, только когда прошла половина
// срока. Иначе запись в базу шла бы на каждом запросе.
func TestNeedsExtension(t *testing.T) {
	now := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	ttl := 30 * 24 * time.Hour

	require.False(t, NeedsExtension(now.Add(20*24*time.Hour), now, ttl))
	require.True(t, NeedsExtension(now.Add(10*24*time.Hour), now, ttl))
	// Ровно половина срока ещё не повод: граница на одной стороне.
	require.False(t, NeedsExtension(now.Add(15*24*time.Hour), now, ttl))
	// Истёкшая сессия не продлевается: её надо отвергнуть, а не оживить.
	require.False(t, NeedsExtension(now.Add(-time.Hour), now, ttl))
}

func TestIsExpired(t *testing.T) {
	now := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)

	require.False(t, IsExpired(now.Add(time.Minute), now))
	require.True(t, IsExpired(now.Add(-time.Minute), now))
	// Ровно наступивший срок считается истёкшим.
	require.True(t, IsExpired(now, now))
}
