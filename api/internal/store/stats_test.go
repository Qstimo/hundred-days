package store

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func week(s string) time.Time {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		panic(err)
	}
	return t
}

// Неделя без записей в базе отсутствует, но в срезе обязана быть нулём:
// иначе провал стал бы невидим и серия склеилась бы через него.
func TestWeekCountsFillsGapsWithZero(t *testing.T) {
	rows := []weekRow{
		{WeekStart: week("2026-09-28"), Done: 3},
		// Неделя 5 октября пропущена — в ней не было ни одной записи.
		{WeekStart: week("2026-10-12"), Done: 2},
	}

	got := weekCounts(rows, week("2026-10-19"))

	require.Equal(t, []int{3, 0, 2, 0}, got)
}

func TestWeekCountsWithoutGaps(t *testing.T) {
	rows := []weekRow{
		{WeekStart: week("2026-10-05"), Done: 3},
		{WeekStart: week("2026-10-12"), Done: 4},
		{WeekStart: week("2026-10-19"), Done: 1},
	}

	got := weekCounts(rows, week("2026-10-19"))

	require.Equal(t, []int{3, 4, 1}, got)
}

// Пустая история даёт один нуль: текущая неделя есть всегда, и срез не
// должен быть пустым — функция серий ждёт последним элементом её.
func TestWeekCountsEmptyHistory(t *testing.T) {
	require.Equal(t, []int{0}, weekCounts(nil, week("2026-10-19")))
}

// Запись только на текущей неделе — один элемент.
func TestWeekCountsOnlyCurrentWeek(t *testing.T) {
	rows := []weekRow{{WeekStart: week("2026-10-19"), Done: 2}}

	require.Equal(t, []int{2}, weekCounts(rows, week("2026-10-19")))
}

// Записи только в прошлом: хвост до текущей недели добивается нулями, иначе
// серия выглядела бы живой, хотя давно оборвалась.
func TestWeekCountsPadsTailToCurrentWeek(t *testing.T) {
	rows := []weekRow{{WeekStart: week("2026-09-28"), Done: 3}}

	got := weekCounts(rows, week("2026-10-19"))

	require.Equal(t, []int{3, 0, 0, 0}, got)
}

// Запись, оказавшаяся позже текущей недели, срез не ломает: такого быть не
// должно (отметки в будущем отвергаются), но тихо уронить всё хуже, чем
// обрезать.
func TestWeekCountsIgnoresWeeksAfterCurrent(t *testing.T) {
	rows := []weekRow{
		{WeekStart: week("2026-10-12"), Done: 3},
		{WeekStart: week("2026-10-26"), Done: 5},
	}

	got := weekCounts(rows, week("2026-10-19"))

	require.Equal(t, []int{3, 0}, got)
}
