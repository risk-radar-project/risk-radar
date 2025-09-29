package report_service.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

import java.time.Duration;
import java.util.Map;

@Service
@Slf4j
public class AuditLogClient {

    private final WebClient webClient;

    private static final Duration RESPONSE_TIMEOUT = Duration.ofSeconds(3);
    private static final int MAX_RETRIES = 3;
    private static final Duration RETRY_BACKOFF = Duration.ofSeconds(1);

    public AuditLogClient(WebClient.Builder builder) {
        this.webClient = builder
                .baseUrl("http://audit-log-service:8080")
                .build();
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
        executeWithRetry(
                webClient.post()
                        .uri("/logs")
                        .bodyValue(body)
                        .retrieve()
                        .bodyToMono(Void.class),
                body.get("service") + ":" + body.get("action")
        );
    }
}
