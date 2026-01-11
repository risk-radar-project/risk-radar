package com.riskRadar.user_service.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
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
        String resetUrl = "http://localhost:3000/reset-password?token=" + URLEncoder.encode(token, StandardCharsets.UTF_8);

        var payload = Map.of(
                "eventType", "USER_PASSWORD_RESET_REQUESTED",
                "userId", userId.toString(),
                "payload", Map.of(
                        "email", email,
                        "resetUrl", resetUrl));

        sendNotification(payload, "Failed to send password reset email request for user " + userId);
    }

    public void sendWelcomeNotification(UUID userId, String email, String username) {
        var payload = Map.of(
                "eventType", "USER_REGISTERED",
                "userId", userId.toString(),
                "payload", Map.of(
                        "email", email,
                        "username", username));

        sendNotification(payload, "Failed to send welcome notification for user " + userId);
    }

    public void sendPasswordChangedNotification(UUID userId, String email) {
        var payload = Map.of(
                "eventType", "PASSWORD_CHANGED",
                "userId", userId.toString(),
                "payload", Map.of(
                        "email", email));

        sendNotification(payload, "Failed to send password changed notification for user " + userId);
    }

    public void sendBanNotification(UUID userId, String email, String reason) {
        var payload = Map.of(
                "eventType", "USER_BANNED",
                "userId", userId.toString(),
                "payload", Map.of(
                        "email", email,
                        "reason", reason));

        sendNotification(payload, "Failed to send ban notification for user " + userId);
    }

    public void sendUnbanNotification(UUID userId, String email) {
        var payload = Map.of(
                "eventType", "USER_UNBANNED",
                "userId", userId.toString(),
                "payload", Map.of(
                        "email", email));

        sendNotification(payload, "Failed to send unban notification for user " + userId);
    }

    public void sendRoleAssignedNotification(UUID userId, String roleName) {
        var payload = Map.of(
                "eventType", "ROLE_ASSIGNED",
                "userId", userId.toString(),
                "payload", Map.of(
                        "title", "Nowa rola przypisana",
                        "body", "Otrzymałeś nową rolę: " + roleName));

        sendNotification(payload, "Failed to send role assigned notification for user " + userId);
    }

    private void sendNotification(Object payload, String errorMessage) {
        webClient.post()
                .uri("/notifications/send")
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(Void.class)
                .subscribe(
                        success -> log.info("Notification sent successfully"),
                        error -> log.error("{}: {}", errorMessage, error.getMessage()));
    }
}
