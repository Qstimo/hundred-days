// Package store — доступ к данным. Каждая функция принимает userID первым
// аргументом: так проверку принадлежности нельзя забыть, она в сигнатуре.
// Инвариант дизайна — проверка прав на уровне выборки, а не в хендлере.
package store

import (
	dbgen "github.com/Qstimo/hundred-days/api/internal/db/gen"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store — хранилище поверх пула и порождённых sqlc запросов.
type Store struct {
	pool *pgxpool.Pool
	q    *dbgen.Queries
}

// New собирает хранилище.
func New(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool, q: dbgen.New(pool)}
}

// Queries открывает доступ к порождённым запросам там, где обёртка не
// добавляет ничего: учётки и сессии пользователю не принадлежат, их
// идентификатор и есть права на них.
//
// Для данных пользователя пользоваться этим нельзя: userID обязан проходить
// через функции этого пакета, иначе он однажды не пройдёт нигде.
func (s *Store) Queries() *dbgen.Queries { return s.q }
