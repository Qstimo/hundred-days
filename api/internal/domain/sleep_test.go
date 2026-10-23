package domain

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func clock(h, m int) *time.Duration {
	d := time.Duration(h)*time.Hour + time.Duration(m)*time.Minute
	return &d
}

func durPtr(d time.Duration) *time.Duration { return &d }

func TestSleepDuration(t *testing.T) {
	cases := []struct {
		name string
		bed  *time.Duration
		wake *time.Duration
		want *time.Duration
	}{
		{
			name: "через полночь",
			bed:  clock(23, 40),
			wake: clock(7, 10),
			want: durPtr(7*time.Hour + 30*time.Minute),
		},
		{
			name: "лёг после полуночи",
			bed:  clock(1, 0),
			wake: clock(7, 0),
			want: durPtr(6 * time.Hour),
		},
		{
			name: "дневной сон",
			bed:  clock(14, 0),
			wake: clock(15, 30),
			want: durPtr(90 * time.Minute),
		},
		{
			name: "ровно в полночь лёг",
			bed:  clock(0, 0),
			wake: clock(8, 0),
			want: durPtr(8 * time.Hour),
		},
		{
			// Одинаковое время означает сутки: правило «подъём не позже
			// отхода — это следующие сутки» применяется и к равенству.
			// Случай вымышленный, но граница должна быть на одной стороне.
			name: "лёг и встал в одно время",
			bed:  clock(7, 0),
			wake: clock(7, 0),
			want: durPtr(24 * time.Hour),
		},
		{"нет времени отхода", nil, clock(7, 0), nil},
		{"нет времени подъёма", clock(23, 0), nil, nil},
		{"нет ни одного", nil, nil, nil},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := SleepDuration(c.bed, c.wake)

			if c.want == nil {
				require.Nil(t, got)
				return
			}
			require.NotNil(t, got)
			require.Equal(t, *c.want, *got)
		})
	}
}
