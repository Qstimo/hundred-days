package httpapi

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// Время суток PostgreSQL хранит микросекундами от полуночи. Перевод туда и
// обратно — самое вероятное место ошибки на единицу во всём чанке, поэтому
// он проверяется отдельно от HTTP и базы.
func TestClockRoundTrip(t *testing.T) {
	for _, s := range []string{"00:00", "00:01", "07:10", "12:34", "23:40", "23:59"} {
		t.Run(s, func(t *testing.T) {
			micros, err := parseClock(s)
			require.NoError(t, err)
			require.Equal(t, s, formatClock(micros))
		})
	}
}

func TestParseClockValues(t *testing.T) {
	cases := []struct {
		in   string
		want int64
	}{
		{"00:00", 0},
		{"00:01", 60 * 1_000_000},
		{"01:00", 3600 * 1_000_000},
		{"23:59", (23*3600 + 59*60) * 1_000_000},
	}

	for _, c := range cases {
		t.Run(c.in, func(t *testing.T) {
			got, err := parseClock(c.in)
			require.NoError(t, err)
			require.Equal(t, c.want, got)
		})
	}
}

func TestParseClockRejectsGarbage(t *testing.T) {
	// «7:10» без ведущего нуля отвергается нарочно: формат один, и
	// допускать второй значит однажды получить «07:10» и «7:10» как разные
	// значения одного времени.
	for _, s := range []string{"24:00", "7:10", "12:60", "полдень", "", "12:34:56", "-1:00"} {
		t.Run(s, func(t *testing.T) {
			_, err := parseClock(s)
			require.Error(t, err, "должно отвергаться: %q", s)
		})
	}
}
