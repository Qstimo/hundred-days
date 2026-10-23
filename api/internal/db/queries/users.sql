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
