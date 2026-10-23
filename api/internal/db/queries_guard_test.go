package db

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// Таблицы, строки которых принадлежат пользователю. Запрос к любой из них
// обязан фильтровать по user_id: иначе один человек увидел бы данные
// другого, а проверка в хендлере рано или поздно будет забыта.
//
// Это не обычный тест поведения, а проверка соглашения. Инвариант дизайна
// «проверка прав на уровне выборки» должен держаться механически, а не
// вниманием ревьюера.
var ownedTables = []string{
	"settings", "skills", "trackers", "entries", "sleep_logs", "day_plans",
}

// Запросы, которым фильтр по пользователю не нужен, и причина. Список
// закрытый: добавить сюда запрос значит объяснить, почему он безопасен.
var exempt = map[string]string{
	"GetUserByLogin":        "вход: пользователя ещё нет в контексте",
	"GetUserByID":           "таблица users не принадлежит пользователю, id и есть он сам",
	"CreateUser":            "создание аккаунта командой на сервере",
	"UpdatePasswordHash":    "смена пароля по идентификатору учётки",
	"CreateSession":         "сессия создаётся в момент входа",
	"GetSessionByID":        "сессия и есть то, из чего берётся user_id",
	"DeleteSession":         "выход: удаление по идентификатору сессии",
	"ExtendSession":         "продление по идентификатору сессии",
	"DeleteExpiredSessions": "уборка истёкших, без разбора владельца",
}

var nameRe = regexp.MustCompile(`--\s*name:\s*(\w+)`)

func TestEveryOwnedQueryFiltersByUser(t *testing.T) {
	blocks := readQueryBlocks(t)
	require.NotEmpty(t, blocks, "каталог запросов пуст — проверка бессмысленна")

	checked := 0
	for _, b := range blocks {
		if _, ok := exempt[b.name]; ok {
			continue
		}
		if !touchesOwnedTable(b.lowerSQL) {
			continue
		}

		require.True(t, filtersByUser(b.lowerSQL),
			"запрос %s в %s трогает данные пользователя, но не ограничен им:\n%s",
			b.name, b.file, b.lowerSQL)
		checked++
	}

	require.NotZero(t, checked,
		"ни один запрос не проверен: либо список таблиц разошёлся со схемой, "+
			"либо все запросы попали в исключения")
}

// Исключения должны оставаться осмысленными: запрос, которого больше нет,
// не должен тихо лежать в списке и прикрывать однажды появившийся тёзка.
func TestExemptionsAreNotStale(t *testing.T) {
	blocks := readQueryBlocks(t)

	existing := make(map[string]bool, len(blocks))
	for _, b := range blocks {
		existing[b.name] = true
	}

	for name := range exempt {
		require.True(t, existing[name],
			"запрос %s есть в исключениях, но в queries/ его нет — убери из списка",
			name)
	}
}

type queryBlock struct {
	name     string
	file     string
	lowerSQL string
}

func readQueryBlocks(t *testing.T) []queryBlock {
	t.Helper()

	files, err := os.ReadDir("queries")
	require.NoError(t, err)

	var out []queryBlock
	for _, f := range files {
		if !strings.HasSuffix(f.Name(), ".sql") {
			continue
		}

		raw, err := os.ReadFile(filepath.Join("queries", f.Name()))
		require.NoError(t, err)

		for _, block := range splitQueries(string(raw)) {
			m := nameRe.FindStringSubmatch(block)
			if m == nil {
				continue
			}
			out = append(out, queryBlock{
				name:     m[1],
				file:     f.Name(),
				lowerSQL: strings.ToLower(block),
			})
		}
	}
	return out
}

// userIDBoundRe — фильтр по пользователю: сравнение с параметром запроса.
// Проверять одно вхождение слова «user_id» нельзя: `SELECT user_id FROM
// settings` его содержит, а пользователем не ограничен вовсе. Такая
// проверка давала бы ложную уверенность, и именно она здесь однажды стояла.
var userIDBoundRe = regexp.MustCompile(`user_id\s*=\s*(\$\d+|sqlc\.arg)`)

// insertedUserIDRe — user_id среди колонок вставки. У INSERT нет WHERE, и
// принадлежность задаётся тем, что значение приходит параметром.
var insertedUserIDRe = regexp.MustCompile(`insert\s+into\s+\w+\s*\([^)]*\buser_id\b`)

// filtersByUser отвечает, ограничен ли запрос пользователем: у выборки,
// правки и удаления — сравнением с параметром после WHERE, у вставки —
// наличием user_id среди колонок.
//
// Чего проверка НЕ ловит, и почему так оставлено. Если сравнение стоит
// только в подзапросе, а внешняя выборка открыта, — пропустит:
//
//	SELECT period_title FROM settings
//	WHERE period_days > (SELECT period_days FROM settings WHERE user_id = $1)
//
// Поймать это снятием скобок перед проверкой можно, но тогда ложно
// отвергались бы законные запросы вида `SELECT EXISTS (SELECT 1 FROM ...
// WHERE user_id = $1)`, где подзапрос и есть весь запрос. Исключений
// пришлось бы завести столько, что страж перестал бы что-либо гарантировать.
//
// Граница выбрана по тому, какая ошибка бывает на самом деле: фильтр
// забывают целиком. Запрос, где он спрятан в подзапросе при открытой
// внешней выборке, не возникает от забывчивости — его надо специально
// написать. Это остаётся на ревью.
func filtersByUser(lowerSQL string) bool {
	if insertedUserIDRe.MatchString(lowerSQL) {
		return true
	}

	where := strings.Index(lowerSQL, "where")
	if where < 0 {
		return false
	}
	return userIDBoundRe.MatchString(lowerSQL[where:])
}

func touchesOwnedTable(lowerSQL string) bool {
	for _, tbl := range ownedTables {
		if strings.Contains(lowerSQL, tbl) {
			return true
		}
	}
	return false
}

// splitQueries режет файл на блоки по строкам «-- name:».
func splitQueries(s string) []string {
	parts := strings.Split(s, "-- name:")
	out := make([]string, 0, len(parts))
	for i, p := range parts {
		// Первый кусок — то, что стоит до первого «-- name:»: шапка файла,
		// а не запрос.
		if i == 0 {
			continue
		}
		out = append(out, "-- name:"+p)
	}
	return out
}
