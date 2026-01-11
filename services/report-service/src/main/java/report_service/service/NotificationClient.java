package report_service.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
public class NotificationClient {

    private final WebClient webClient;

    public NotificationClient(@Value("${notification.service.url:http://notification-service:8086}") String notificationServiceUrl) {
        this.webClient = WebClient.builder()
                .baseUrl(notificationServiceUrl)
                .build();
    }

    public void sendReportCreatedNotification(UUID userId, String reportTitle) {
        var payload = Map.of(
                "eventType", "REPORT_CREATED",
                "userId", userId.toString(),
                "payload", Map.of(
                        "title", reportTitle));

        sendNotification(payload, "Failed to send report created notification for user " + userId);
    }

    public void sendReportStatusChangedNotification(UUID userId, String reportTitle, String newStatus) {
        var payload = Map.of(
                "eventType", "REPORT_STATUS_CHANGED",
                "userId", userId.toString(),
                "payload", Map.of(
                        "title", reportTitle,
                        "newStatus", newStatus));

        sendNotification(payload, "Failed to send report status changed notification for user " + userId);
    }

    public void sendReportVerifiedNotification(UUID userId, String reportTitle) {
        var payload = Map.of(
                "eventType", "REPORT_AI_VERIFIED",
                "userId", userId.toString(),
                "payload", Map.of(
                        "title", reportTitle));

        sendNotification(payload, "Failed to send report verified notification for user " + userId);
    }

    public void sendReportFlaggedNotification(UUID userId, String reportTitle) {
        var payload = Map.of(
                "eventType", "REPORT_AI_FLAGGED",
                "userId", userId.toString(),
                "payload", Map.of(
                        "title", reportTitle));

        sendNotification(payload, "Failed to send report flagged notification for user " + userId);
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
