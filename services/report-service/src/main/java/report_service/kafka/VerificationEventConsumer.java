package report_service.kafka;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import report_service.entity.Report;
import report_service.entity.ReportStatus;

import report_service.repository.ReportRepository;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class VerificationEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(VerificationEventConsumer.class);
    private final ReportRepository reportRepository;
    private final ObjectMapper objectMapper;
    private final report_service.service.NotificationClient notificationClient;

    public VerificationEventConsumer(ReportRepository reportRepository, report_service.service.NotificationClient notificationClient) {
        this.reportRepository = reportRepository;
        this.notificationClient = notificationClient;
        this.objectMapper = new ObjectMapper();
    }

    @KafkaListener(topics = "verification_events", groupId = "report-service-verification-group")
    public void handleVerificationEvent(String message) {
        try {
            JsonNode event = objectMapper.readTree(message);
            String eventType = event.get("event_type").asText();
            String reportId = event.get("report_id").asText();

            log.info("Received verification event: {} for report: {}", eventType, reportId);

            if ("report_verified".equals(eventType)) {
                boolean isFake = event.get("is_fake").asBoolean();
                double fakeProbability = event.get("fake_probability").asDouble();
                String confidence = event.get("confidence").asText();

                log.info("Processing verification for report {}: isFake={}, probability={}, confidence={}",
                        reportId, isFake, fakeProbability, confidence);

                Report report = reportRepository.findById(UUID.fromString(reportId))
                        .orElse(null);

                if (report != null) {
                    // Save AI verification data
                    report.setAiIsFake(isFake);
                    report.setAiFakeProbability(fakeProbability);
                    report.setAiConfidence(confidence);
                    report.setAiVerifiedAt(LocalDateTime.now());

                    // AI NEVER auto-rejects - only human moderators can reject
                    // If is_fake=true -> PENDING (needs manual review by moderator)
                    // If is_fake=false -> VERIFIED (auto-accepted)
                    if (!isFake) {
                        report.setStatus(ReportStatus.VERIFIED);
                        log.info("Report {} marked as VERIFIED (AI verified as authentic)", reportId);
                        try {
                            notificationClient.sendReportVerifiedNotification(report.getUserId(), report.getTitle());
                        } catch (Exception e) {
                            log.error("Failed to send notification", e);
                        }
                    } else {
                        // Suspicious report - keep as PENDING for human moderator to decide
                        report.setStatus(ReportStatus.PENDING);
                        log.info("Report {} remains PENDING (AI flagged as suspicious - needs moderator review)",
                                reportId);
                        try {
                             notificationClient.sendReportFlaggedNotification(report.getUserId(), report.getTitle());
                        } catch (Exception e) {
                             log.error("Failed to send notification", e);
                        }
                    }
                    reportRepository.save(report);
                } else {
                    log.warn("Report {} not found in database", reportId);
                }
            }

        } catch (Exception e) {
            log.error("Error processing verification event", e);
        }
    }
}
