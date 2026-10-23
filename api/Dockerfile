# Сборка в статический бинарник: в итоговом образе нет ни компилятора, ни
# оболочки — меньше образ и меньше того, чем можно воспользоваться при взломе.
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY api/go.mod api/go.sum ./
RUN go mod download
COPY api/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/api ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/api /api
USER nonroot
EXPOSE 3001
ENTRYPOINT ["/api"]
