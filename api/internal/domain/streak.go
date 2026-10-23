package domain

// Streak — состояние серии трекера.
type Streak struct {
	// Current — сколько недель подряд цель взята, считая назад от текущей.
	Current int
	// Best — самая длинная серия за весь рассмотренный отрезок.
	Best int
	// CurrentWeekDone — сколько выполнений уже есть на этой неделе.
	CurrentWeekDone int
	// CurrentWeekTarget — недельная цель, для подписи «2 из 3».
	CurrentWeekTarget int
}

// WeeklyStreak считает серию по числу выполнений в неделях. Срез идёт по
// возрастанию недель без пропусков — неделя без выполнений это нуль, а не
// отсутствующий элемент, иначе провал стал бы невидим. Последний элемент —
// текущая неделя.
func WeeklyStreak(counts []int, target int) Streak {
	s := Streak{CurrentWeekTarget: target}
	if len(counts) == 0 {
		return s
	}

	s.CurrentWeekDone = counts[len(counts)-1]

	// Лучшая серия — по всему срезу, включая текущую неделю, если она уже
	// зачтена.
	run := 0
	for _, c := range counts {
		if c >= target {
			run++
			if run > s.Best {
				s.Best = run
			}
			continue
		}
		run = 0
	}

	// Текущая серия отсчитывается с конца. Незачтённая текущая неделя
	// пропускается, а не обрывает счёт: иначе каждый понедельник показывал
	// бы ноль, хотя ничего ещё не потеряно.
	from := len(counts) - 1
	if counts[from] < target {
		from--
	}
	for i := from; i >= 0; i-- {
		if counts[i] < target {
			break
		}
		s.Current++
	}

	return s
}
