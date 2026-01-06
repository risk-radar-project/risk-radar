package com.riskRadar.user_service.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
public class NotificationClient {

    private final WebClient webClient;

    public NotificationClient(@Qualifier("notificationWebClient") WebClient webClient) {
        this.webClient = webClient;
    }

    public void sendPasswordResetEmail(UUID userId, String email, String token) {
        // TODO: Externalize frontend URL or use configuration
        String resetUrl = "http://localhost:3000/reset-password?token=" + token;

        var payload = Map.of(
                "eventType", "USER_PASSWORD_RESET_REQUESTED",
                "userId", userId.toString(),
                "payload", Map.of(
                        "email", email,
                        "resetUrl", resetUrl));

        webClient.post()
                .uri("/notifications/send")
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(Void.class)
                .subscribe(
                        success -> log.info("Password reset email request sent for user {}", userId),
                        error -> log.error("Failed to send password reset email request for user {}: {}", userId,
                                error.getMessage()));
    }
}
