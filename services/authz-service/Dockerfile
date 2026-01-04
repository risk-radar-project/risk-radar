# First stage: Build the application
FROM golang:1.21-alpine AS build

# Install git (needed for go modules)
RUN apk add --no-cache git

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application (static, stripped)
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o authz-service ./cmd/main.go

# Second stage: Run the application
FROM alpine:3.19

# Install ca-certificates for HTTPS requests
RUN apk --no-cache add ca-certificates

# Create non-root user
RUN adduser -D -s /bin/sh appuser

WORKDIR /home/appuser

# Copy the binary from build stage
COPY --from=build /app/authz-service .

# Copy migrations to correct path
COPY internal/db/migrations ./internal/db/migrations

# Change ownership to appuser
RUN chown -R appuser:appuser /home/appuser

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Run the application directly
CMD ["./authz-service"]
