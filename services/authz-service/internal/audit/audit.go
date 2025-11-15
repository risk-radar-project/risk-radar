package audit

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"sync/atomic"
	"time"
)

// AuditLog represents the payload sent to audit-log-service
type AuditLog struct {
	Service     string         `json:"service"`
	Action      string         `json:"action"`
	Actor       map[string]any `json:"actor,omitempty"`
	Target      map[string]any `json:"target,omitempty"`
	Status      string         `json:"status"`
	LogType     string         `json:"log_type"`
	Metadata    map[string]any `json:"metadata,omitempty"`
	OperationID string         `json:"operation_id,omitempty"`
	Timestamp   time.Time      `json:"timestamp"`
}

const (
	defaultBufferSize = 1000
	defaultTimeout    = 800 * time.Millisecond
	maxRetries        = 5
	baseBackoff       = 100 * time.Millisecond
)

var (
	logCh       chan *AuditLog
	httpClient  *http.Client
	endpointURL string
	started     atomic.Bool

	sentCount    atomic.Uint64
	failedCount  atomic.Uint64
	droppedCount atomic.Uint64
	retryCount   atomic.Uint64
)

var (
	publishToKafka = publishKafka
	kafkaActive    = kafkaIsEnabled
)

// Init initializes the audit dispatcher
func Init() {
	if started.Load() {
		return
	}
	configureKafka()
	raw := strings.TrimSpace(os.Getenv("AUDIT_LOG_URL"))
	if raw == "" {
		raw = "http://audit-log-service:8080"
	}
	if !strings.HasSuffix(raw, "/logs") {
		raw = strings.TrimRight(raw, "/") + "/logs"
	}
	endpointURL = raw
	logCh = make(chan *AuditLog, defaultBufferSize)
	httpClient = &http.Client{Timeout: defaultTimeout}
	started.Store(true)
	go worker()
}

// Shutdown drains remaining logs or stops when ctx done
func Shutdown(ctx context.Context) {
	if !started.Load() {
		return
	}
	// Capture current channel, mark as stopped so future LogAction calls will re-init with a new channel
	ch := logCh
	started.Store(false)
	logCh = nil
	// Closing triggers worker to drain remaining buffered events
	close(ch)
	// Best-effort wait for worker to finish or context cancellation
	select {
	case <-ctx.Done():
	case <-time.After(100 * time.Millisecond):
	}

	shutdownKafka()
}

// LogAction queues an audit log (non-blocking)
func LogAction(al *AuditLog) {
	if al == nil {
		return
	}
	if !started.Load() {
		Init()
	}
	enrich(al)
	defer func() {
		if r := recover(); r != nil { // channel was likely closed during Shutdown
			// Re-init and try once more non-blocking
			started.Store(false)
			Init()
			select {
			case logCh <- al:
			default:
				droppedCount.Add(1)
			}
		}
	}()
	select {
	case logCh <- al:
	default:
		droppedCount.Add(1)
	}
}

// AccessDecision helper
func AccessDecision(actorID, resourceType, resourceID, action string, granted bool, meta map[string]any, ip string) {
	if meta == nil {
		meta = make(map[string]any)
	}
	meta["resource"] = resourceType + ":" + resourceID
	if ip != "" {
		meta["ip"] = stripPort(ip)
	}
	meta["action"] = action
	status := "failure"
	act := "access_denied"
	if granted {
		status = "success"
		act = "access_granted"
	}
	LogAction(&AuditLog{Service: "authz-service", Action: act, Actor: map[string]any{"id": actorID, "type": actorType(actorID)}, Target: map[string]any{"id": resourceID, "type": resourceType}, Status: status, LogType: "SECURITY", Metadata: meta})
}

// RoleChanged helper (kind: create|update|delete)
func RoleChanged(kind, actorID, roleID, roleName string, changedFields []string, meta map[string]any) {
	if meta == nil {
		meta = make(map[string]any)
	}
	meta["role_name"] = roleName
	if len(changedFields) > 0 {
		meta["changed_fields"] = changedFields
	}
	act := "role_" + kind
	LogAction(&AuditLog{Service: "authz-service", Action: act, Actor: map[string]any{"id": actorID, "type": actorType(actorID)}, Target: map[string]any{"id": roleID, "type": "role"}, Status: "success", LogType: "ACTION", Metadata: meta})
}

// UserRoleLink helper (mode: assign|remove)
func UserRoleLink(mode, actorID, userID, roleID string, meta map[string]any) {
	if meta == nil {
		meta = make(map[string]any)
	}
	meta["user_id"] = userID
	act := "user_role_" + mode
	LogAction(&AuditLog{Service: "authz-service", Action: act, Actor: map[string]any{"id": actorID, "type": actorType(actorID)}, Target: map[string]any{"id": roleID, "type": "role"}, Status: "success", LogType: "ACTION", Metadata: meta})
}

// PermissionChanged helper (kind: create|update|delete)
func PermissionChanged(kind, actorID, permissionID, actionName, resource, description string, meta map[string]any) {
	if meta == nil {
		meta = make(map[string]any)
	}
	if actionName != "" {
		meta["permission_action"] = actionName
	}
	if resource != "" {
		meta["permission_resource"] = resource
	}
	if description != "" {
		meta["description"] = description
	}
	act := "permission_" + kind
	LogAction(&AuditLog{Service: "authz-service", Action: act, Actor: map[string]any{"id": actorID, "type": actorType(actorID)}, Target: map[string]any{"id": permissionID, "type": "permission"}, Status: "success", LogType: "ACTION", Metadata: meta})
}

// DBError helper
func DBError(operation, class string) {
	LogAction(&AuditLog{Service: "authz-service", Action: "db_error", Status: "error", LogType: "ERROR", Metadata: map[string]any{"operation": operation, "error_class": class}})
}

// GenericEvent helper
func GenericEvent(eventType string, payload any) {
	LogAction(&AuditLog{Service: "authz-service", Action: eventType, Status: "success", LogType: "INFO", Metadata: map[string]any{"payload": payload}})
}

func enrich(a *AuditLog) {
	if a.Timestamp.IsZero() {
		a.Timestamp = time.Now().UTC()
	}
	if a.OperationID == "" {
		a.OperationID = randomID16()
	}
	if a.Service == "" {
		a.Service = "authz-service"
	}
	if a.Status == "" {
		a.Status = "success"
	}
	if a.LogType == "" {
		a.LogType = "INFO"
	}
}

func worker() {
	for al := range logCh {
		sendWithRetry(al)
	}
}

func sendWithRetry(al *AuditLog) {
	body, err := json.Marshal(al)
	if err != nil {
		failedCount.Add(1)
		return
	}

	if kafkaActive() {
		if err := publishToKafka(al, body); err == nil {
			sentCount.Add(1)
			return
		} else {
			log.Printf("audit: kafka publish failed, falling back to HTTP: %v", err)
		}
	}
	var attempt int
	for {
		req, _ := http.NewRequest(http.MethodPost, endpointURL, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := httpClient.Do(req)
		if err == nil {
			io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
			if resp.StatusCode >= 200 && resp.StatusCode < 300 {
				sentCount.Add(1)
				return
			}
			if resp.StatusCode == http.StatusConflict {
				sentCount.Add(1)
				return
			}
			if resp.StatusCode < 500 {
				failedCount.Add(1)
				return
			}
		} else if !isRetryableErr(err) {
			failedCount.Add(1)
			return
		}
		attempt++
		if attempt >= maxRetries {
			failedCount.Add(1)
			return
		}
		retryCount.Add(1)
		time.Sleep(backoffDuration(attempt))
	}
}

func isRetryableErr(err error) bool {
	if err == nil {
		return false
	}
	var ne net.Error
	if errors.As(err, &ne) {
		return true
	}
	msg := err.Error()
	return strings.Contains(msg, "timeout") || strings.Contains(msg, "connection refused") || strings.Contains(msg, "TLS")
}

func backoffDuration(attempt int) time.Duration {
	d := baseBackoff << (attempt - 1)
	if d > 1600*time.Millisecond {
		d = 1600 * time.Millisecond
	}
	jitterRange := int64(d) / 10
	if jitterRange > 0 {
		b := make([]byte, 2)
		rand.Read(b)
		v := int64(b[0])<<8 | int64(b[1])
		offset := (v % (2 * jitterRange)) - jitterRange
		d = time.Duration(int64(d) + offset)
	}
	return d
}

func randomID16() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "fallbackid000000"
	}
	return hex.EncodeToString(b)
}
func stripPort(hostport string) string {
	if hostport == "" {
		return hostport
	}
	if strings.Contains(hostport, ":") {
		if h, _, err := net.SplitHostPort(hostport); err == nil {
			return h
		}
	}
	return hostport
}
func actorType(id string) string {
	if id == "" || id == "unknown" || strings.HasPrefix(id, "[") {
		return "unknown"
	}
	return "user"
}
func Counters() (sent, failed, dropped, retries uint64) {
	return sentCount.Load(), failedCount.Load(), droppedCount.Load(), retryCount.Load()
}
