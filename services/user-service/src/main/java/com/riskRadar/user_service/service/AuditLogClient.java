package com.riskRadar.user_service.service;

import com.riskRadar.user_service.config.KafkaConfig;
import lombok.RequiredArgsConstructor;
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
import java.util.concurrent.TimeoutException;

@Service
@Slf4j
@RequiredArgsConstructor
public class AuditLogClient {

    private final WebClient webClient;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final KafkaConfig kafkaConfig;

    private static final Duration RESPONSE_TIMEOUT = Duration.ofSeconds(3);
    private static final Duration KAFKA_TIMEOUT = Duration.ofSeconds(5);
    private static final int MAX_RETRIES = 3;
    private static final Duration RETRY_BACKOFF = Duration.ofSeconds(1);

    private void executeWithRetry(Mono<Void> mono) {
        try {
            mono.timeout(RESPONSE_TIMEOUT)
                    .retryWhen(Retry.backoff(MAX_RETRIES, RETRY_BACKOFF)
                            .filter(this::shouldRetry))
                    .doOnError(ex -> log.error("Error during call to audit-log-service [{}]. Error: {}",
                            "POST /logs", ex.getMessage()))
                    .onErrorResume(ex -> {
                        log.warn("Fallback triggered for void call [{}]", "POST /logs");
                        return Mono.empty();
                    })
                    .block();
        } catch (Exception e) {
            log.error("Final fallback triggered for void call [{}]. Error: {}", "POST /logs", e.getMessage());
        }
    }

    public void logAction(Map<String, Object> body) {
        if (body == null || !body.containsKey("service") || !body.containsKey("action")) {
            log.error("Invalid audit log body: {}", body);
            return;
        }

        String logContext = body.get("service") + ":" + body.get("action");
        log.info("[Kafka Debug] Konfiguracja Kafki - Bootstrap Servers: {}, Topic: {}, Client ID: {}",
                kafkaConfig.getBootstrapServers(), kafkaConfig.getAuditTopic(), kafkaConfig.getClientId());
        log.info("[Kafka Debug] Próba wysłania wiadomości - Context: {}, Body: {}", logContext, body);

        try {
            log.debug("[Kafka Debug] Inicjalizacja wysyłania do Kafki...");
            CompletableFuture<SendResult<String, Object>> future = kafkaTemplate
                    .send(kafkaConfig.getAuditTopic(), body);

            log.info("[Kafka Debug] Wysłano zapytanie do Kafki. Topic: {}, Context: {}",
                    kafkaConfig.getAuditTopic(), logContext);

            future.orTimeout(KAFKA_TIMEOUT.toSeconds(), TimeUnit.SECONDS)
                    .whenComplete((result, ex) -> {
                        if (ex == null) {
                            log.debug("Audit log sent successfully to Kafka topic: {}", kafkaConfig.getAuditTopic());
                        } else {
                            if (ex instanceof TimeoutException) {
                                log.error("Timeout while sending audit log to Kafka");
                            } else {
                                log.error("Failed to send audit log to Kafka. Error: {}", ex.getMessage());
                            }
                            // Fallback to REST API
                            executeWithRetry(webClient.post()
                                    .uri("/logs")
                                    .bodyValue(body)
                                    .retrieve()
                                    .bodyToMono(Void.class));
                        }
                    });
        } catch (Exception e) {
            log.error("Error while sending audit log: {}", e.getMessage());
            // Fallback to REST API
            executeWithRetry(webClient.post()
                    .uri("/logs")
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Void.class));
        }
    }

    private boolean shouldRetry(Throwable ex) {
        // Retry on network related exceptions
        return ex instanceof java.net.ConnectException ||
               ex instanceof java.net.SocketTimeoutException ||
               ex instanceof TimeoutException ||
               ex instanceof org.springframework.web.reactive.function.client.WebClientRequestException;
    }
}
