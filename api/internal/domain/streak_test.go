package domain

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// Серия считается по неделям, потому что цель недельная. Последний элемент
// среза — текущая, ещё не кончившаяся неделя: она серию не рвёт, пока не
// кончилась, но уже зачтённая — продолжает.
func TestWeeklyStreak(t *testing.T) {
	cases := []struct {
		name         string
		counts       []int
		target       int
		wantCurrent  int
		wantBest     int
		wantWeekDone int
	}{
		{
			name:         "пусто",
			counts:       nil,
			target:       3,
			wantCurrent:  0,
			wantBest:     0,
			wantWeekDone: 0,
		},
		{
			name:         "только текущая неделя, цель ещё не взята",
			counts:       []int{1},
			target:       3,
			wantCurrent:  0,
			wantBest:     0,
			wantWeekDone: 1,
		},
		{
			name:         "только текущая неделя, цель взята",
			counts:       []int{3},
			target:       3,
			wantCurrent:  1,
			wantBest:     1,
			wantWeekDone: 3,
		},
		{
			name:         "три зачтённые недели, текущая пока пустая — серия жива",
			counts:       []int{3, 4, 3, 0},
			target:       3,
			wantCurrent:  3,
			wantBest:     3,
			wantWeekDone: 0,
		},
		{
			name:         "провал в середине",
			counts:       []int{3, 3, 1, 3, 0},
			target:       3,
			wantCurrent:  1,
			wantBest:     2,
			wantWeekDone: 0,
		},
		{
			name:         "лучшая серия в прошлом",
			counts:       []int{3, 3, 3, 0, 3, 1},
			target:       3,
			wantCurrent:  1,
			wantBest:     3,
			wantWeekDone: 1,
		},
		{
			name:         "текущая зачтена и продолжает серию",
			counts:       []int{3, 3, 4},
			target:       3,
			wantCurrent:  3,
			wantBest:     3,
			wantWeekDone: 4,
		},
		{
			name:         "цель в одно выполнение в неделю",
			counts:       []int{1, 1, 1, 0},
			target:       1,
			wantCurrent:  3,
			wantBest:     3,
			wantWeekDone: 0,
		},
		{
			name:         "ни одной зачтённой недели",
			counts:       []int{0, 1, 2, 0},
			target:       3,
			wantCurrent:  0,
			wantBest:     0,
			wantWeekDone: 0,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := WeeklyStreak(c.counts, c.target)

			require.Equal(t, c.wantCurrent, got.Current, "текущая серия")
			require.Equal(t, c.wantBest, got.Best, "лучшая серия")
			require.Equal(t, c.wantWeekDone, got.CurrentWeekDone, "сделано на этой неделе")
			require.Equal(t, c.target, got.CurrentWeekTarget)
		})
	}
}
