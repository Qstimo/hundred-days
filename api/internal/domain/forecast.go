package domain

// Pace — темп в поинтах за день: сколько набрано за окно, делённое на его
// длину. Окно нулевой длины даёт ноль, а не деление на ноль.
func Pace(pointsInWindow float64, windowDays int) float64 {
	if windowDays <= 0 {
		return 0
	}
	return Round2(pointsInWindow / float64(windowDays))
}

// Forecast — сколько поинтов будет к концу периода, если темп сохранится.
func Forecast(earned, pacePerDay float64, daysLeft int) float64 {
	if daysLeft <= 0 {
		return Round2(earned)
	}
	return Round2(earned + pacePerDay*float64(daysLeft))
}

// WillReach отвечает, хватит ли темпа на цель к концу периода.
func WillReach(earned, pacePerDay float64, daysLeft int, target float64) bool {
	return Forecast(earned, pacePerDay, daysLeft) >= target
}
