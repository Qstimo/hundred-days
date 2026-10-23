package domain

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPace(t *testing.T) {
	require.Equal(t, 2.0, Pace(28, 14))
	require.Equal(t, 0.0, Pace(0, 14))
	// Окно нулевой длины — не повод делить на ноль.
	require.Equal(t, 0.0, Pace(10, 0))
	require.Equal(t, 0.0, Pace(10, -5))
}

func TestForecast(t *testing.T) {
	// Забрано 100 поинтов, темп два в день, осталось 50 дней.
	require.Equal(t, 200.0, Forecast(100, 2, 50))
	// Период кончился — прогноз равен тому, что уже есть.
	require.Equal(t, 100.0, Forecast(100, 2, 0))
	// Ничего не делалось — прогноз тоже ничего не обещает.
	require.Equal(t, 0.0, Forecast(0, 0, 50))
}

func TestWillReach(t *testing.T) {
	require.True(t, WillReach(100, 2, 50, 200))
	require.False(t, WillReach(100, 2, 50, 201))
	// Цель уже взята — прогноз не важен.
	require.True(t, WillReach(300, 0, 0, 200))
	// Нулевой темп при недостигнутой цели успеха не обещает.
	require.False(t, WillReach(100, 0, 50, 200))
}
