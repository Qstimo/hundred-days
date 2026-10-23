package domain

import (
	"errors"
	"math"
)

// Mode — режим трекера: только галочка или галочка с часами.
type Mode string

const (
	ModeCheck      Mode = "check"
	ModeCheckHours Mode = "check_hours"
)

// Rule — за что начисляются поинты.
type Rule string

const (
	RulePerCheck Rule = "per_check"
	RulePerHour  Rule = "per_hour"
)

// ErrRuleNeedsHours — правило «за час» у трекера, который часов не
// спрашивает.
var ErrRuleNeedsHours = errors.New("правило «за час» требует режима с часами")

// ValidateRule проверяет инвариант сочетания режима и правила. Тот же
// инвариант стоит ограничением в базе: проверка в одном месте рано или
// поздно обходится.
func ValidateRule(mode Mode, rule Rule) error {
	if rule == RulePerHour && mode != ModeCheckHours {
		return ErrRuleNeedsHours
	}
	return nil
}

// Points считает поинты одного выполнения. Правило «за чек» часы
// игнорирует: трекер с часами может начислять и фиксированную цену.
func Points(rule Rule, value float64, hours *float64) float64 {
	if rule == RulePerHour {
		if hours == nil {
			return 0
		}
		return Round2(value * *hours)
	}
	return Round2(value)
}

// Round2 округляет до двух знаков. Поинты и часы хранятся как числа с
// плавающей точкой, и округление на записи не даёт копиться мусору в
// младших разрядах при суммировании сотен записей.
func Round2(v float64) float64 {
	return math.Round(v*100) / 100
}
