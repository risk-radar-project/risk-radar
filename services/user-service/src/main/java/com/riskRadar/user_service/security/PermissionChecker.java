package com.riskRadar.user_service.security;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

@Component("permissionChecker")
@RequiredArgsConstructor
@Slf4j
public class PermissionChecker {

    private final WebClient.Builder webClientBuilder;
    private static final Duration TIMEOUT = Duration.ofSeconds(2);

    public boolean hasPermission(String permission) {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || !auth.isAuthenticated()) {
                log.warn("No authenticated user found");
                return false;
            }

            String username = auth.getName();
            if (username == null) {
                log.warn("Username is null");
                return false;
            }

            // Get userId from JWT claims or lookup
            String userId = extractUserId(auth);
            if (userId == null) {
                log.warn("Could not extract userId for user: {}", username);
                return false;
            }

            WebClient webClient = webClientBuilder
                    .baseUrl("http://authz-service:8080")
                    .build();

            HasPermissionResponse response = webClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/has-permission")
                            .queryParam("permission", permission)
                            .build())
                    .header("X-User-ID", userId)
                    .retrieve()
                    .bodyToMono(HasPermissionResponse.class)
                    .timeout(TIMEOUT)
                    .onErrorResume(ex -> {
                        log.error("Error checking permission {} for user {}: {}", permission, username, ex.getMessage());
                        return Mono.just(new HasPermissionResponse(false));
                    })
                    .block();

            boolean hasPermission = response != null && response.hasPermission();
            log.debug("Permission check for user {} on {}: {}", username, permission, hasPermission);
            return hasPermission;

        } catch (Exception e) {
            log.error("Exception during permission check for {}: {}", permission, e.getMessage());
            return false;
        }
    }

    private String extractUserId(Authentication auth) {
        try {
            // Get userId from authentication details (set by JwtTokenFilter)
            if (auth.getDetails() instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> details = (Map<String, Object>) auth.getDetails();
                Object userIdObj = details.get("userId");
                if (userIdObj != null) {
                    return userIdObj.toString();
                }
            }
            
            log.warn("userId not found in authentication details for user: {}", auth.getName());
            return null;
        } catch (Exception e) {
            log.error("Error extracting userId: {}", e.getMessage());
            return null;
        }
    }

    private static class HasPermissionResponse {
        private boolean hasPermission;

        public HasPermissionResponse() {
        }

        public HasPermissionResponse(boolean hasPermission) {
            this.hasPermission = hasPermission;
        }

        public boolean hasPermission() {
            return hasPermission;
        }

           @com.fasterxml.jackson.annotation.JsonProperty("has_permission")
        public void setHasPermission(boolean hasPermission) {
            this.hasPermission = hasPermission;
        }
    }
}
