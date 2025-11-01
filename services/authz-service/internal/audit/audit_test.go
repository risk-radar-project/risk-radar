package audit

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func startTestServer(t *testing.T, statusSequence ...int) func() {
	t.Helper()
	var idx atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		i := int(idx.Load())
		if i >= len(statusSequence) {
			i = len(statusSequence) - 1
		}
		w.WriteHeader(statusSequence[i])
		idx.Add(1)
	}))
	endpointURL = srv.URL
	return srv.Close
}

func TestLogActionSuccess(t *testing.T) {
	Init()
	closeFn := startTestServer(t, 201)
	defer closeFn()
	before, _, _, _ := Counters()
	LogAction(&AuditLog{Action: "test_success", Status: "success", LogType: "INFO"})
	time.Sleep(50 * time.Millisecond)
	after, _, _, _ := Counters()
	if after <= before {
		t.Fatalf("expected sent counter to increase")
	}
}

func TestRetryAndSuccess(t *testing.T) {
	Init()
	closeFn := startTestServer(t, 500, 500, 201)
	defer closeFn()
	s1, f1, _, r1 := Counters()
	LogAction(&AuditLog{Action: "will_retry", Status: "success", LogType: "INFO"})
	time.Sleep(300 * time.Millisecond)
	s2, f2, _, r2 := Counters()
	if s2 <= s1 {
		t.Fatalf("expected sent increased after retries")
	}
	if r2 <= r1 {
		t.Fatalf("expected retry counter increase")
	}
	if f2 != f1 {
		t.Fatalf("no failures expected, got delta")
	}
}

func TestClientErrorNoRetry(t *testing.T) {
	Init()
	closeFn := startTestServer(t, 400)
	defer closeFn()
	_, f1, _, r1 := Counters()
	LogAction(&AuditLog{Action: "client_error", Status: "success", LogType: "INFO"})
	time.Sleep(50 * time.Millisecond)
	_, f2, _, r2 := Counters()
	if f2 <= f1 {
		t.Fatalf("expected failure counter increment")
	}
	if r2 != r1 {
		t.Fatalf("retry counter should not change on 4xx")
	}
}

func TestQueueDrop(t *testing.T) {
	Init()
	for i := 0; i < 1100; i++ {
		LogAction(&AuditLog{Action: "flood", Status: "success", LogType: "INFO"})
	}
	_, _, dropped, _ := Counters()
	if dropped == 0 {
		t.Fatalf("expected some dropped logs when flooding the queue")
	}
}

func TestShutdownDrains(t *testing.T) {
	Init()
	closeFn := startTestServer(t, 201)
	defer closeFn()
	for i := 0; i < 10; i++ {
		LogAction(&AuditLog{Action: "drain", Status: "success", LogType: "INFO"})
	}
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()
	Shutdown(ctx)
	if len(logCh) != 0 {
		t.Fatalf("expected channel drained")
	}
}

func TestAccessDecisionIncludesIP(t *testing.T) {
	Init()
	closeFn := startTestServer(t, 201)
	defer closeFn()
	before, _, _, _ := Counters()
	AccessDecision("user-1", "resource", "res-123", "read", true, nil, "127.0.0.1:5555")
	time.Sleep(50 * time.Millisecond)
	after, _, _, _ := Counters()
	if after <= before {
		t.Fatalf("expected sent counter to increase for access decision")
	}
}

func TestKafkaSuccessShortCircuitsHTTP(t *testing.T) {
	Init()
	defer func() {
		publishToKafka = publishKafka
		kafkaActive = kafkaIsEnabled
	}()

	publishToKafka = func(*AuditLog, []byte) error {
		return nil
	}
	kafkaActive = func() bool { return true }

	before, _, _, _ := Counters()
	LogAction(&AuditLog{Action: "kafka_success", Status: "success", LogType: "INFO"})
	time.Sleep(20 * time.Millisecond)
	after, _, _, _ := Counters()
	if after <= before {
		t.Fatalf("expected sent counter to increase when kafka succeeds")
	}
}

func TestKafkaFailureFallsBackToHTTP(t *testing.T) {
	Init()
	closeFn := startTestServer(t, 201)
	defer closeFn()

	defer func() {
		publishToKafka = publishKafka
		kafkaActive = kafkaIsEnabled
	}()

	publishToKafka = func(*AuditLog, []byte) error {
		return errors.New("broker down")
	}
	kafkaActive = func() bool { return true }

	beforeSent, beforeFailed, _, _ := Counters()
	LogAction(&AuditLog{Action: "kafka_fallback", Status: "success", LogType: "INFO"})
	time.Sleep(100 * time.Millisecond)
	afterSent, afterFailed, _, _ := Counters()
	if afterSent <= beforeSent {
		t.Fatalf("expected sent counter to increase via HTTP fallback")
	}
	if afterFailed != beforeFailed {
		t.Fatalf("fallback should not mark as failed when HTTP succeeds")
	}
}
