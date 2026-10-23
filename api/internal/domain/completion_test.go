package domain

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestExpectedCount(t *testing.T) {
	// Три раза в неделю за четыре недели — двенадцать.
	require.Equal(t, 12.0, ExpectedCount(28, 3))
	// Ровно неделя — ровно цель.
	require.Equal(t, 3.0, ExpectedCount(7, 3))
	// Неполная неделя считается пропорционально: цель недельная, а период
	// редко кончается ровно в воскресенье. Три дня из семи при цели три —
	// это 3 * 3 / 7, примерно 1.29.
	require.InDelta(t, 1.29, ExpectedCount(3, 3), 0.005)
	require.Equal(t, 0.0, ExpectedCount(0, 3))
	require.Equal(t, 0.0, ExpectedCount(28, 0))
}

func TestCompletionRate(t *testing.T) {
	require.Equal(t, 1.0, CompletionRate(12, 28, 3))
	require.Equal(t, 0.5, CompletionRate(6, 28, 3))
	// Перевыполнение показывается как есть, а не обрезается до сотни:
	// «сделал больше плана» — полезная правда.
	require.Equal(t, 1.5, CompletionRate(18, 28, 3))
	require.Equal(t, 0.0, CompletionRate(0, 28, 3))
	// Отрезок нулевой длины ожиданий не создаёт.
	require.Equal(t, 0.0, CompletionRate(5, 0, 3))
}
