// Package auth — пароли и сессии.
package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"golang.org/x/crypto/argon2"
)

// ErrPasswordTooShort — пароль короче восьми знаков. Приложение смотрит в
// интернет на своём порту, и восемь знаков здесь нижняя граница, а не
// пожелание.
var ErrPasswordTooShort = errors.New("пароль короче восьми знаков")

// Параметры argon2id. Взяты из рекомендаций OWASP: 19 МиБ памяти и два
// прохода. Приложение на единицы пользователей, вход редкий — экономить на
// стойкости незачем.
const (
	argonTime    = 2
	argonMemory  = 19 * 1024
	argonThreads = 1
	argonKeyLen  = 32
	saltLen      = 16
	minPassword  = 8
)

// HashPassword возвращает хеш в собственном разборчивом формате:
// $argon2id$v=19$m=...,t=...,p=...$соль$хеш.
func HashPassword(password string) (string, error) {
	// Длина в знаках, а не в байтах: восемь русских букв занимают
	// шестнадцать байт, и проверка по len() пропустила бы пароль из
	// четырёх букв.
	if utf8.RuneCountInString(password) < minPassword {
		return "", ErrPasswordTooShort
	}

	salt := make([]byte, saltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("не вышло получить соль: %w", err)
	}

	key := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)

	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, argonMemory, argonTime, argonThreads,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(key),
	), nil
}

// VerifyPassword сравнивает пароль с хешем. Сравнение постоянного времени:
// обычное сравнение байт выдало бы длину совпавшего префикса по времени
// ответа.
func VerifyPassword(password, encoded string) (bool, error) {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false, errors.New("хеш не в формате argon2id")
	}

	var memory, timeCost uint32
	var threads uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &timeCost, &threads); err != nil {
		return false, fmt.Errorf("параметры хеша не разобраны: %w", err)
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false, fmt.Errorf("соль не разобрана: %w", err)
	}
	want, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return false, fmt.Errorf("хеш не разобран: %w", err)
	}
	if len(want) == 0 {
		return false, errors.New("хеш пуст")
	}

	got := argon2.IDKey([]byte(password), salt, timeCost, memory, threads, uint32(len(want)))

	return subtle.ConstantTimeCompare(got, want) == 1, nil
}
