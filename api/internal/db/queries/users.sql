-- name: GetUserByLogin :one
SELECT id, login, name, password_hash
FROM users
WHERE login = $1;

-- name: GetUserByID :one
SELECT id, login, name
FROM users
WHERE id = $1;

-- name: CreateUser :one
INSERT INTO users (login, name, password_hash)
VALUES ($1, $2, $3)
RETURNING id, login, name;

-- name: UpdatePasswordHash :exec
UPDATE users SET password_hash = $2 WHERE id = $1;

-- name: CreateSession :exec
INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3);

-- name: GetSessionByID :one
SELECT id, user_id, expires_at FROM sessions WHERE id = $1;

-- name: ExtendSession :exec
UPDATE sessions SET expires_at = $2 WHERE id = $1;

-- name: DeleteSession :exec
DELETE FROM sessions WHERE id = $1;

-- name: DeleteExpiredSessions :exec
DELETE FROM sessions WHERE expires_at < now();

-- name: AnyUserExists :one
SELECT EXISTS (SELECT 1 FROM users) AS exists;

-- Проверка и вставка одним запросом: отдельная проверка перед вставкой
-- оставила бы щель, в которую два одновременных запроса создали бы два
-- «первых» аккаунта. Ноль вставленных строк и есть «регистрация закрыта».
-- name: RegisterFirstUser :one
INSERT INTO users (login, name, password_hash)
SELECT $1, $2, $3
WHERE NOT EXISTS (SELECT 1 FROM users)
RETURNING id, login, name;
