package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"authz-service/internal/db"
	apphandlers "authz-service/internal/handlers"
	"authz-service/internal/middleware"
	"authz-service/internal/services"
	"authz-service/internal/utils"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables - try current dir first, then parent dir
	if err := godotenv.Load(); err != nil {
		if err := godotenv.Load("../.env"); err != nil {
			log.Printf("Warning: .env file not found: %v", err)
		}
	}

	// Get configuration
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	port := os.Getenv("HTTP_PORT")
	if port == "" {
		port = "8080"
	}

	// Initialize database
	database, err := db.NewDatabase(dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	// Run migrations
	if err := database.Migrate(); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Initialize services
	roleRepo := db.NewRoleRepository(database.DB)
	permissionRepo := db.NewPermissionRepository(database.DB)
	userRoleRepo := db.NewUserRoleRepository(database.DB)

	roleService := services.NewRoleService(roleRepo, permissionRepo)
	authzService := services.NewAuthzService(userRoleRepo, permissionRepo)
	permissionService := services.NewPermissionService(permissionRepo)

	// Initialize handlers
	roleHandler := apphandlers.NewRoleHandler(roleService)
	authzHandler := apphandlers.NewAuthzHandler(authzService)
	permissionHandler := apphandlers.NewPermissionHandler(permissionService)
	healthHandler := apphandlers.NewHealthHandler(database.DB)

	// Setup router
	r := mux.NewRouter()

	// Health endpoint
	r.HandleFunc("/status", healthHandler.GetStatus).Methods("GET")

	// Role management endpoints
	r.HandleFunc("/roles", roleHandler.GetRoles).Methods("GET")
	r.HandleFunc("/roles/{roleId}", roleHandler.GetRole).Methods("GET")
	r.HandleFunc("/roles", roleHandler.CreateRole).Methods("POST")
	r.HandleFunc("/roles/{roleId}", roleHandler.UpdateRole).Methods("PUT")
	r.HandleFunc("/roles/{roleId}", roleHandler.DeleteRole).Methods("DELETE")

	// Permission management endpoints
	r.HandleFunc("/permissions", permissionHandler.GetPermissions).Methods("GET")
	r.HandleFunc("/permissions/{permissionId}", permissionHandler.GetPermission).Methods("GET")
	r.HandleFunc("/permissions", permissionHandler.CreatePermission).Methods("POST")
	r.HandleFunc("/permissions/{permissionId}", permissionHandler.UpdatePermission).Methods("PUT")
	r.HandleFunc("/permissions/{permissionId}", permissionHandler.DeletePermission).Methods("DELETE")

	// Authorization endpoints
	r.HandleFunc("/has-permission", authzHandler.HasPermission).Methods("GET")
	r.HandleFunc("/users/{userId}/permissions", authzHandler.GetUserPermissions).Methods("GET")
	r.HandleFunc("/users/{userId}/roles", authzHandler.GetUserRoles).Methods("GET")
	r.HandleFunc("/users/{userId}/roles", authzHandler.AssignRole).Methods("POST")
	r.HandleFunc("/users/{userId}/roles/{roleId}", authzHandler.RemoveRole).Methods("DELETE")

	// Custom logging middleware
	loggedRouter := middleware.LoggingMiddleware(r)

	// Create HTTP server
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      loggedRouter,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Log startup
	utils.LogEvent("service.startup", map[string]interface{}{
		"service": "authz-service",
		"port":    port,
	})

	// Start server in a goroutine
	go func() {
		log.Printf("authz-service starting on port %s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Create a context with timeout for shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Attempt graceful shutdown
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	// Close database connection
	database.Close()

	log.Println("Server exited")
}
