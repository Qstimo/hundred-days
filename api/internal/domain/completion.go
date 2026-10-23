package domain

// ExpectedCount — сколько выполнений ожидается за столько-то дней при
// недельной цели. Считается по дням, а не по числу затронутых недель:
// период редко начинается в понедельник и кончается в воскресенье, и счёт
// по неделям завысил бы ожидание на двух краях сразу.
func ExpectedCount(days int, weeklyTarget int) float64 {
	if days <= 0 || weeklyTarget <= 0 {
		return 0
	}
	return Round2(float64(weeklyTarget) * float64(days) / 7)
}

// CompletionRate — доля выполненного от ожидаемого. Единица означает «ровно
// по плану», больше единицы — перевыполнение, и оно не обрезается.
func CompletionRate(done int, days int, weeklyTarget int) float64 {
	expected := ExpectedCount(days, weeklyTarget)
	if expected == 0 {
		return 0
	}
	return Round2(float64(done) / expected)
}
