package com.riskRadar.user_service.service;

import com.riskRadar.user_service.dto.Permission;
import com.riskRadar.user_service.dto.Role;
import com.riskRadar.user_service.dto.RoleAndPermissionResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
public class AuthzClient {

        private final WebClient webClient;

        private static final Duration RESPONSE_TIMEOUT = Duration.ofSeconds(3);
        private static final int MAX_RETRIES = 3;
        private static final Duration RETRY_BACKOFF = Duration.ofSeconds(1);

        public AuthzClient(WebClient.Builder builder) {
                this.webClient = builder
                                .baseUrl("http://authz-service:8080")
                                .build();
        }

        private <T> T getWithRetry(Mono<T> mono, T fallback, String logContext) {
                try {
                        return mono
                                        .timeout(RESPONSE_TIMEOUT)
                                        .retryWhen(Retry.backoff(MAX_RETRIES, RETRY_BACKOFF)
                                                        .filter(ex -> ex instanceof RuntimeException))
                                        .doOnError(ex -> log.error("Error during call to authz-service [{}]",
                                                        logContext, ex))
                                        .onErrorReturn(fallback)
                                        .block();
                } catch (Exception e) {
                        log.error("Final fallback triggered for [{}]", logContext, e);
                        return fallback;
                }
        }

        private void executeWithRetry(Mono<Void> mono, String logContext) {
                try {
                        mono.timeout(RESPONSE_TIMEOUT)
                                        .retryWhen(Retry.backoff(MAX_RETRIES, RETRY_BACKOFF)
                                                        .filter(ex -> ex instanceof RuntimeException))
                                        .doOnError(ex -> log.error("Error during call to authz-service [{}]",
                                                        logContext, ex))
                                        .onErrorResume(ex -> {
                                                log.warn("Fallback triggered for void call [{}]", logContext);
                                                return Mono.empty();
                                        })
                                        .block();
                } catch (Exception e) {
                        log.error("Final fallback triggered for void call [{}]", logContext, e);
                }
        }

        public RoleAndPermissionResponse[] getAllRoles() {
                return getWithRetry(
                                webClient.get()
                                                .uri("/roles")
                                                .retrieve()
                                                .bodyToMono(RoleAndPermissionResponse[].class),
                                new RoleAndPermissionResponse[0],
                                "getAllRoles");
        }

        public Role[] getRolesByUserId(UUID userId) {
                return getWithRetry(
                                webClient.get()
                                                .uri("/users/{userId}/roles", userId)
                                                .retrieve()
                                                .onStatus(status -> status.value() == 404, response -> Mono.empty())
                                                .bodyToMono(Role[].class)
                                                .defaultIfEmpty(new Role[0]),
                                new Role[0],
                                "getRolesByUserId " + userId);
        }

        public Permission[] getPermissionsByUserId(UUID userId) {
                return getWithRetry(
                                webClient.get()
                                                .uri("/users/{userId}/permissions", userId)
                                                .retrieve()
                                                .onStatus(status -> status.value() == 404, response -> Mono.empty())
                                                .bodyToMono(Permission[].class)
                                                .defaultIfEmpty(new Permission[0]),
                                new Permission[0],
                                "getPermissionsByUserId " + userId);
        }

        public void assignRole(UUID userId, String roleId) {
                try {
                        webClient.post()
                                        .uri("/users/{userId}/roles", userId)
                                        .header("X-User-ID", "11111111-1111-1111-1111-111111111111")
                                        .bodyValue(Map.of("role_id", roleId))
                                        .retrieve()
                                        .bodyToMono(Void.class)
                                        .timeout(RESPONSE_TIMEOUT)
                                        .retryWhen(Retry.backoff(MAX_RETRIES, RETRY_BACKOFF))
                                        .block();
                } catch (Exception e) {
                        log.error("Failed to assign role {} to user {}. Propagating error.", roleId, userId, e);
                        throw new RuntimeException("Failed to assign role", e);
                }
        }

        public void revokeRoles(UUID userId) {
                executeWithRetry(
                                webClient.post()
                                                .uri("/roles/revoke?userId={id}", userId)
                                                .retrieve()
                                                .bodyToMono(Void.class),
                                "revokeRoles " + userId);
        }
}
