# mealvoting 後端（Gin API，入口：cmd/api）
# 建置（在 backend 目錄）：
#   docker build -t mealvote-api .
# 執行範例（必須提供 PostgreSQL 連線字串）：
#   docker run --rm -p 8080:8080 \
#     -e HTTP_ADDR=:8080 -e DATABASE_URL='postgres://user:pass@host:5432/dbname?sslmode=disable' mealvote-api

FROM golang:1.24-alpine AS builder
WORKDIR /src
RUN apk add --no-cache git ca-certificates
ENV CGO_ENABLED=0 GOTOOLCHAIN=auto
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -trimpath -ldflags="-s -w" -o /mealvote-api ./cmd/api

FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata \
  && adduser -D -H -u 10001 appuser
WORKDIR /app
COPY --from=builder /mealvote-api /usr/local/bin/mealvote-api
USER appuser
EXPOSE 8080
ENV HTTP_ADDR=:8080
CMD ["mealvote-api"]
