// Package domain содержит вычисления, названные в дизайне вычисляемыми: они
// не хранятся в базе и не зависят ни от базы, ни от HTTP. Поэтому тесты
// здесь — обычные табличные, без контейнеров и моков.
package domain

import "time"

// DaysLeft возвращает число дней до конца периода, считая сегодняшний.
// Период кончился — ноль. Не начался — вся длина: впереди ещё всё.
func DaysLeft(start time.Time, days int, today time.Time) int {
	if days <= 0 {
		return 0
	}

	start = truncateDay(start)
	today = truncateDay(today)

	if today.Before(start) {
		return days
	}

	passed := int(today.Sub(start).Hours() / 24)
	left := days - passed
	if left < 0 {
		return 0
	}
	return left
}

// DayNumber — номер сегодняшнего дня в периоде, считая с единицы.
// Ноль означает, что период ещё не начался.
func DayNumber(start time.Time, today time.Time) int {
	start = truncateDay(start)
	today = truncateDay(today)

	if today.Before(start) {
		return 0
	}
	return int(today.Sub(start).Hours()/24) + 1
}

// truncateDay отбрасывает время, оставляя дату, и уносит её в UTC.
//
// Две причины. Первая: разность дат, посчитанная по меткам со временем, даёт
// дробное число дней и ошибку на единицу. Вторая: в зоне с переходом на
// летнее время сутки бывают длиной 23 и 25 часов, и деление на 24 там
// врёт — в UTC переходов нет.
func truncateDay(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}
