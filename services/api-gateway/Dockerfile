# syntax=docker/dockerfile:1
FROM golang:1.22-alpine AS build
WORKDIR /app
COPY go.mod ./
COPY go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o api-gateway ./

FROM alpine:3.19
RUN adduser -D -s /bin/sh appuser
WORKDIR /app
COPY --from=build /app/api-gateway /app/
COPY config.yaml /app/config.yaml
COPY openapi.yaml /app/openapi.yaml
RUN chown -R appuser:appuser /app
USER appuser
EXPOSE 8080
ENV GATEWAY_CONFIG=/app/config.yaml
ENTRYPOINT ["/app/api-gateway"]
