package report_service.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class AuditLogClient {

    private final WebClient webClient;
    private final KafkaTemplate<String, Map<String, Object>> kafkaTemplate;

    private static final Duration RESPONSE_TIMEOUT = Duration.ofSeconds(3);
    private static final int MAX_RETRIES = 3;
    private static final Duration RETRY_BACKOFF = Duration.ofSeconds(1);
    private static final String AUDIT_LOG_TOPIC = "audit-logs";

    public AuditLogClient(WebClient.Builder builder, KafkaTemplate<String, Map<String, Object>> kafkaTemplate) {
        this.webClient = builder
                .baseUrl("http://audit-log-service:8080")
                .build();
        this.kafkaTemplate = kafkaTemplate;
    }

    private void executeWithRetry(Mono<Void> mono, String logContext) {
        try {
            mono.timeout(RESPONSE_TIMEOUT)
                    .retryWhen(Retry.backoff(MAX_RETRIES, RETRY_BACKOFF)
                            .filter(ex -> ex instanceof RuntimeException))
                    .doOnError(ex -> log.error("Error during call to audit-log-service [{}]", logContext, ex))
                    .onErrorResume(ex -> {
                        log.warn("Fallback triggered for void call [{}]", logContext);
                        return Mono.empty();
                    })
                    .block();
        } catch (Exception e) {
            log.error("Final fallback triggered for void call [{}]", logContext, e);
        }
    }

    public void logAction(Map<String, Object> body) {
        String logContext = body.get("service") + ":" + body.get("action");

        try {
            // Próba wysłania do Kafki z timeoutem
            CompletableFuture<SendResult<String, Map<String, Object>>> future =
                    CompletableFuture.supplyAsync(() -> {
                        try {
                            return kafkaTemplate.send(AUDIT_LOG_TOPIC, logContext, body).get(
                                    RESPONSE_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
                        } catch (Exception e) {
                            throw new RuntimeException(e);
                        }
                    });

            future.whenComplete((result, ex) -> {
                if (ex != null) {
                    log.warn("Kafka send failed for [{}], falling back to HTTP. Error: {}", logContext, ex.getMessage());
                    fallbackToHttp(body, logContext);
                } else {
                    log.debug("Successfully sent audit log to Kafka [{}]", logContext);
                }
            });
        } catch (Exception e) {
            log.warn("Failed to initiate Kafka send for [{}], falling back to HTTP immediately", logContext);
            fallbackToHttp(body, logContext);
        }
    }

    private void fallbackToHttp(Map<String, Object> body, String logContext) {
        try {
            executeWithRetry(
                    webClient.post()
                            .uri("/logs")
                            .bodyValue(body)
                            .retrieve()
                            .bodyToMono(Void.class),
                    logContext
            );
        } catch (Exception e) {
            log.error("Both Kafka and HTTP fallback failed for [{}]. Error: {}", logContext, e.getMessage());
            // Kontynuuj działanie aplikacji mimo błędu
        }
    }
}
