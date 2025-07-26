package utils

import (
	"encoding/json"
	"fmt"
	"time"
)

// AuditEvent represents an audit log entry
type AuditEvent struct {
	Timestamp   time.Time   `json:"timestamp"`
	EventType   string      `json:"event_type"`
	ServiceName string      `json:"service_name"`
	Payload     interface{} `json:"payload"`
}

// LogEvent logs an audit event to console
// In production, this should send to audit-log-service
func LogEvent(eventType string, payload interface{}) {
	event := AuditEvent{
		Timestamp:   time.Now().UTC(),
		EventType:   eventType,
		ServiceName: "authz-service",
		Payload:     payload,
	}

	eventJSON, err := json.Marshal(event)
	if err != nil {
		fmt.Printf("ERROR: Failed to marshal audit event: %v\n", err)
		return
	}

	// For now, print to console
	// TODO: Send to audit-log-service via HTTP/Kafka
	fmt.Printf("AUDIT: %s\n", string(eventJSON))
}
