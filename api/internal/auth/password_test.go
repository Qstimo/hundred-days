package auth

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestHashAndVerify(t *testing.T) {
	hash, err := HashPassword("правильный-пароль")
	require.NoError(t, err)
	require.True(t, strings.HasPrefix(hash, "$argon2id$"))

	ok, err := VerifyPassword("правильный-пароль", hash)
	require.NoError(t, err)
	require.True(t, ok)

	ok, err = VerifyPassword("другой-пароль", hash)
	require.NoError(t, err)
	require.False(t, ok)
}

// Соль случайна: два хеша одного пароля не совпадают, иначе по базе было бы
// видно, у кого пароли одинаковые.
func TestHashIsSalted(t *testing.T) {
	a, err := HashPassword("пароль-подольше")
	require.NoError(t, err)
	b, err := HashPassword("пароль-подольше")
	require.NoError(t, err)

	require.NotEqual(t, a, b)
}

func TestVerifyRejectsGarbageHash(t *testing.T) {
	cases := []string{
		"не хеш вовсе",
		"",
		"$argon2id$v=19$сломано",
		"$bcrypt$v=19$m=19456,t=2,p=1$c29sdA$aGFzaA",
		"$argon2id$v=19$m=плохо,t=2,p=1$c29sdA$aGFzaA",
		"$argon2id$v=19$m=19456,t=2,p=1$не-base64!$aGFzaA",
	}

	for _, c := range cases {
		t.Run(c, func(t *testing.T) {
			_, err := VerifyPassword("пароль", c)
			require.Error(t, err)
		})
	}
}

func TestHashRejectsShortPassword(t *testing.T) {
	_, err := HashPassword("1234567")
	require.ErrorIs(t, err, ErrPasswordTooShort)

	// Ровно восемь знаков — уже можно: граница на одной стороне.
	_, err = HashPassword("12345678")
	require.NoError(t, err)
}

// Длина считается в знаках, а не в байтах: восемь русских букв — шестнадцать
// байт, и проверка по длине строки пропустила бы пароль из четырёх букв.
func TestShortPasswordCountedInRunes(t *testing.T) {
	_, err := HashPassword("паролик")

	require.ErrorIs(t, err, ErrPasswordTooShort, "семь букв — мало, хоть и 14 байт")
}
