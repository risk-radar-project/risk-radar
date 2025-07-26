package db

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/lib/pq"
)

// Database wraps sql.DB with additional functionality
type Database struct {
	DB *sql.DB
}

// NewDatabase creates a new database connection with retry logic
func NewDatabase(databaseURL string) (*Database, error) {
	const maxRetries = 10
	const retryDelay = 3 * time.Second

	var db *sql.DB
	var err error

	for attempt := 1; attempt <= maxRetries; attempt++ {
		log.Printf("Attempting to connect to database (attempt %d/%d)...", attempt, maxRetries)

		db, err = sql.Open("postgres", databaseURL)
		if err != nil {
			log.Printf("Failed to open database connection on attempt %d: %v", attempt, err)
			if attempt == maxRetries {
				return nil, fmt.Errorf("failed to open database connection after %d attempts: %w", maxRetries, err)
			}
			time.Sleep(retryDelay)
			continue
		}

		// Test connection with retry
		err = db.Ping()
		if err != nil {
			log.Printf("Failed to ping database on attempt %d: %v", attempt, err)
			db.Close() // Close the connection before retrying
			if attempt == maxRetries {
				return nil, fmt.Errorf("failed to ping database after %d attempts: %w", maxRetries, err)
			}
			time.Sleep(retryDelay)
			continue
		}

		// Connection successful
		log.Printf("Successfully connected to database on attempt %d", attempt)
		break
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	return &Database{DB: db}, nil
}

// Close the database connection
func (d *Database) Close() error {
	return d.DB.Close()
}

// Run database migrations
func (d *Database) Migrate() error {
	driver, err := postgres.WithInstance(d.DB, &postgres.Config{})
	if err != nil {
		return fmt.Errorf("failed to create postgres driver: %w", err)
	}

	m, err := migrate.NewWithDatabaseInstance(
		"file://internal/db/migrations",
		"postgres",
		driver,
	)
	if err != nil {
		return fmt.Errorf("failed to create migrate instance: %w", err)
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	return nil
}
