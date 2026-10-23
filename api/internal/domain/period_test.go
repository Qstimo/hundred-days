package domain

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func day(s string) time.Time {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		panic(err)
	}
	return t
}

func TestDaysLeft(t *testing.T) {
	cases := []struct {
		name  string
		start string
		days  int
		today string
		want  int
	}{
		{"первый день периода", "2026-10-23", 100, "2026-10-23", 100},
		{"середина", "2026-10-23", 100, "2026-11-22", 70},
		{"последний день", "2026-10-23", 100, "2027-01-30", 1},
		{"период кончился", "2026-10-23", 100, "2027-01-31", 0},
		{"кончился давно", "2026-10-23", 100, "2030-01-01", 0},
		{"период ещё не начался", "2026-11-01", 100, "2026-10-23", 100},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			require.Equal(t, c.want, DaysLeft(day(c.start), c.days, day(c.today)))
		})
	}
}

func TestDayNumber(t *testing.T) {
	cases := []struct {
		name  string
		start string
		today string
		want  int
	}{
		{"первый день", "2026-10-23", "2026-10-23", 1},
		{"тридцать первый", "2026-10-23", "2026-11-22", 31},
		{"до начала", "2026-11-01", "2026-10-23", 0},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			require.Equal(t, c.want, DayNumber(day(c.start), day(c.today)))
		})
	}
}
