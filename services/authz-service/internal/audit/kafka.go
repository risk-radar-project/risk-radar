package audit

import (
	"context"
	"errors"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/segmentio/kafka-go"
)

type kafkaSettings struct {
	enabled      bool
	brokers      []string
	topic        string
	clientID     string
	requiredAcks kafka.RequiredAcks
	writeTimeout time.Duration
	dialTimeout  time.Duration
	maxAttempts  int
}

var (
	kafkaCfg         kafkaSettings
	kafkaMu          sync.Mutex
	kafkaWriter      *kafka.Writer
	errKafkaDisabled = errors.New("audit kafka disabled")
)

func configureKafka() {
	kafkaMu.Lock()
	defer kafkaMu.Unlock()
	kafkaCfg = loadKafkaSettings()
	if !kafkaCfg.enabled {
		closeKafkaWriterLocked()
	}
}

func shutdownKafka() {
	kafkaMu.Lock()
	defer kafkaMu.Unlock()
	closeKafkaWriterLocked()
}

func kafkaIsEnabled() bool {
	kafkaMu.Lock()
	defer kafkaMu.Unlock()
	return kafkaCfg.enabled && len(kafkaCfg.brokers) > 0
}

func publishKafka(al *AuditLog, payload []byte) error {
	cfg := currentKafkaConfig()
	if !cfg.enabled || len(cfg.brokers) == 0 {
		return errKafkaDisabled
	}

	writer, err := ensureKafkaWriter(cfg)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), cfg.writeTimeout)
	defer cancel()

	key := deriveKafkaKey(al)
	headers := buildKafkaHeaders(al)

	msg := kafka.Message{
		Key:     key,
		Value:   payload,
		Headers: headers,
		Time:    al.Timestamp,
	}

	if err := writer.WriteMessages(ctx, msg); err != nil {
		resetKafkaWriter()
		return err
	}
	return nil
}

func currentKafkaConfig() kafkaSettings {
	kafkaMu.Lock()
	defer kafkaMu.Unlock()
	return kafkaCfg
}

func ensureKafkaWriter(cfg kafkaSettings) (*kafka.Writer, error) {
	kafkaMu.Lock()
	defer kafkaMu.Unlock()
	if kafkaWriter != nil {
		return kafkaWriter, nil
	}
	if !kafkaCfg.enabled || len(kafkaCfg.brokers) == 0 {
		return nil, errKafkaDisabled
	}

	dialer := &kafka.Dialer{
		Timeout:   cfg.dialTimeout,
		DualStack: true,
		ClientID:  cfg.clientID,
	}

	writer := kafka.NewWriter(kafka.WriterConfig{
		Brokers:      cfg.brokers,
		Topic:        cfg.topic,
		Balancer:     &kafka.Hash{},
		RequiredAcks: int(cfg.requiredAcks),
		Async:        false,
		Dialer:       dialer,
		WriteTimeout: cfg.writeTimeout,
		BatchTimeout: 10 * time.Millisecond,
		MaxAttempts:  cfg.maxAttempts,
	})
	writer.AllowAutoTopicCreation = false

	kafkaWriter = writer
	return kafkaWriter, nil
}

func resetKafkaWriter() {
	kafkaMu.Lock()
	defer kafkaMu.Unlock()
	closeKafkaWriterLocked()
}

func closeKafkaWriterLocked() {
	if kafkaWriter != nil {
		if err := kafkaWriter.Close(); err != nil {
			log.Printf("audit: failed to close kafka writer: %v", err)
		}
		kafkaWriter = nil
	}
}

func loadKafkaSettings() kafkaSettings {
	brokers := envList("AUDIT_KAFKA_BROKERS")
	enabled := envBool("AUDIT_KAFKA_ENABLED", len(brokers) > 0)
	topic := envString("AUDIT_KAFKA_TOPIC", "audit_logs")
	clientID := envString("AUDIT_KAFKA_CLIENT_ID", "authz-service")
	ackStr := envString("AUDIT_KAFKA_ACKS", "-1")
	writeTimeout := time.Duration(envInt("AUDIT_KAFKA_SEND_TIMEOUT_MS", 5000)) * time.Millisecond
	dialTimeout := time.Duration(envInt("AUDIT_KAFKA_CONNECTION_TIMEOUT_MS", 3000)) * time.Millisecond
	maxAttempts := envInt("AUDIT_KAFKA_RETRIES", 3)
	if maxAttempts <= 0 {
		maxAttempts = 1
	}

	settings := kafkaSettings{
		enabled:      enabled && len(brokers) > 0,
		brokers:      brokers,
		topic:        topic,
		clientID:     clientID,
		requiredAcks: parseAcks(ackStr),
		writeTimeout: writeTimeout,
		dialTimeout:  dialTimeout,
		maxAttempts:  maxAttempts,
	}

	return settings
}

func deriveKafkaKey(al *AuditLog) []byte {
	if al == nil {
		return nil
	}
	if al.OperationID != "" {
		return []byte(al.OperationID)
	}
	if al.Target != nil {
		if id, ok := al.Target["id"].(string); ok && id != "" {
			return []byte(id)
		}
	}
	if al.Actor != nil {
		if id, ok := al.Actor["id"].(string); ok && id != "" {
			return []byte(id)
		}
	}
	return nil
}

func buildKafkaHeaders(al *AuditLog) []kafka.Header {
	headers := make([]kafka.Header, 0, 4)
	if al == nil {
		return headers
	}
	if al.Service != "" {
		headers = append(headers, kafka.Header{Key: "service", Value: []byte(al.Service)})
	}
	if al.Action != "" {
		headers = append(headers, kafka.Header{Key: "action", Value: []byte(al.Action)})
	}
	if al.Status != "" {
		headers = append(headers, kafka.Header{Key: "status", Value: []byte(al.Status)})
	}
	if al.LogType != "" {
		headers = append(headers, kafka.Header{Key: "log_type", Value: []byte(al.LogType)})
	}
	if al.OperationID != "" {
		headers = append(headers, kafka.Header{Key: "operation_id", Value: []byte(al.OperationID)})
	}
	return headers
}

func envString(key, def string) string {
	if val := strings.TrimSpace(os.Getenv(key)); val != "" {
		return val
	}
	return def
}

func envList(key string) []string {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func envBool(key string, def bool) bool {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return def
	}
	switch strings.ToLower(val) {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return def
	}
}

func envInt(key string, def int) int {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return def
	}
	if n, err := strconv.Atoi(val); err == nil {
		return n
	}
	return def
}

func parseAcks(value string) kafka.RequiredAcks {
	switch strings.TrimSpace(value) {
	case "0":
		return kafka.RequireNone
	case "1":
		return kafka.RequireOne
	default:
		return kafka.RequireAll
	}
}
