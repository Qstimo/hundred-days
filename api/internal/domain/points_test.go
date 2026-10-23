package domain

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPoints(t *testing.T) {
	hours := func(v float64) *float64 { return &v }

	cases := []struct {
		name  string
		rule  Rule
		value float64
		hours *float64
		want  float64
	}{
		{"одно занятие — один поинт", RulePerCheck, 1, nil, 1},
		{"чек даёт свою цену независимо от часов", RulePerCheck, 2, hours(3), 2},
		{"час чтения — один поинт", RulePerHour, 1, hours(1.5), 1.5},
		{"полтора поинта за час", RulePerHour, 1.5, hours(2), 3},
		{"за час без часов — ноль", RulePerHour, 1, nil, 0},
		{"округление до двух знаков", RulePerHour, 0.333, hours(1), 0.33},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			require.Equal(t, c.want, Points(c.rule, c.value, c.hours))
		})
	}
}

// Правило «за час» у трекера без часов — нарушение инварианта, а не повод
// считать ноль молча: оно проверяется до записи.
func TestValidateRule(t *testing.T) {
	require.NoError(t, ValidateRule(ModeCheckHours, RulePerHour))
	require.NoError(t, ValidateRule(ModeCheckHours, RulePerCheck))
	require.NoError(t, ValidateRule(ModeCheck, RulePerCheck))
	require.ErrorIs(t, ValidateRule(ModeCheck, RulePerHour), ErrRuleNeedsHours)
}

func TestRound2(t *testing.T) {
	require.Equal(t, 0.33, Round2(0.333))
	require.Equal(t, 2.0, Round2(2))
	require.Equal(t, 1.5, Round2(1.5))

	// Ровно половина младшего разряда уходит вверх: math.Round округляет
	// половину от нуля. Случай записан явно, потому что про него легко
	// предположить обратное — будто двоичное представление 0.335 сдвинет
	// результат вниз. Умножение на сто здесь даёт ровно 33.5, и ошибка
	// представления сокращается.
	require.Equal(t, 0.34, Round2(0.335))
	require.Equal(t, 0.35, Round2(0.345))

	// Отрицательных поинтов не бывает — ограничение стоит в базе, — но
	// округление не должно вести себя особым образом на нуле.
	require.Equal(t, 0.0, Round2(0))
	require.Equal(t, 0.0, Round2(0.004))
}
