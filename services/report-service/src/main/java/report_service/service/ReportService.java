package report_service.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import report_service.dto.ReportRequest;
import report_service.entity.Report;
import report_service.entity.ReportStatus;
import report_service.entity.ReportCategory;
import report_service.repository.ReportRepository;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.web.client.RestTemplate;
import org.springframework.boot.web.client.RestTemplateBuilder;
import report_service.service.NotificationClient;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.HashMap;

import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
public class ReportService {

    private final ReportRepository reportRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate;
    private final NotificationClient notificationClient;

    @Value("${report.kafka.topic:report}")
    private String reportTopic = "report";

    @Value("${media.service.url:http://media-service:8080}")
    private String mediaServiceUrl = "http://media-service:8080";

    public ReportService(ReportRepository reportRepository,
                         KafkaTemplate<String, Object> kafkaTemplate,
                         NotificationClient notificationClient,
                         RestTemplateBuilder restTemplateBuilder,
                         @Value("${media.service.url:http://media-service:8080}") String mediaServiceUrl) {
        this.reportRepository = reportRepository;
        this.kafkaTemplate = kafkaTemplate;
        this.notificationClient = notificationClient;
        this.restTemplate = restTemplateBuilder.build();
        this.mediaServiceUrl = mediaServiceUrl;
    }

    @Transactional
    public void createReport(ReportRequest request) {
        Report report = new Report();
        report.setTitle(request.title());
        report.setLatitude(request.latitude());
        report.setLongitude(request.longitude());
        report.setDescription(request.description());
        report.setUserId(request.userId());
        report.setImageIds(request.imageIds());
        report.setCategory(request.reportCategory());
        report.setCreatedAt(LocalDateTime.now());
        // Default status is usually PENDING, ensure it's set if not default
        if (report.getStatus() == null) {
            report.setStatus(ReportStatus.PENDING);
        }

        Report savedReport = reportRepository.save(report);

        if (savedReport.getId() == null) {
            throw new IllegalStateException("Report was not saved correctly – no ID returned.");
        }

        // Confirm images in media-service
        if (savedReport.getImageIds() != null && !savedReport.getImageIds().isEmpty()) {
            confirmImages(savedReport.getImageIds());
        }

        // Send Notification
        try {
            notificationClient.sendReportCreatedNotification(savedReport.getUserId(), savedReport.getTitle());
        } catch (Exception e) {
            log.error("Failed to send report created notification", e);
        }

        Map<String, String> payload = reportToPayload(savedReport);
        log.info("Sending report saved to topic: " + reportTopic);

        kafkaTemplate.send(reportTopic, savedReport.getId().toString(), payload);
    }

    private void confirmImages(List<UUID> imageIds) {
        try {
            if (mediaServiceUrl == null || mediaServiceUrl.isBlank()) {
                log.warn("Media service URL not configured; skipping image confirmation");
                return;
            }

            Map<String, Object> body = new HashMap<>();
            body.put("ids", imageIds);
            
            String url = mediaServiceUrl + "/temporary/keep";
            log.info("Confirming {} images at {}", imageIds.size(), url);
            
            restTemplate.postForObject(url, body, Void.class);
            log.info("Images confirmed successfully");
        } catch (Exception e) {
            log.error("Failed to confirm images in media-service", e);
            // We assume report creation should not fail if image confirmation fails
            // In production, this should be retried or handled via event bus
        }
    }

    @Transactional
    public void updateReportStatus(UUID id, ReportStatus status) {
        Optional<Report> reportOpt = reportRepository.findById(id);
        if (reportOpt.isPresent()) {
            Report report = reportOpt.get();
            report.setStatus(status);
            Report updatedReport = reportRepository.save(report);

             // Send Notification
            try {
                notificationClient.sendReportStatusChangedNotification(updatedReport.getUserId(), updatedReport.getTitle(), updatedReport.getStatus().toString());
            } catch (Exception e) {
                log.error("Failed to send report status changed notification", e);
            }

            Map<String, String> payload = reportToPayload(updatedReport);
            kafkaTemplate.send(reportTopic, updatedReport.getId().toString(), payload);
        } else {
            throw new RuntimeException("Report not found");
        }
    }

    // Methods for Admin
    public Report updateReport(UUID id, ReportRequest request) {
        Report report = reportRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Report not found with id: " + id));

        // Update fields
        report.setTitle(request.title());
        report.setDescription(request.description());
        report.setLatitude(request.latitude());
        report.setLongitude(request.longitude());
        report.setCategory(request.reportCategory());

        return reportRepository.save(report);
    }

    public void deleteReport(UUID id) {
        if (!reportRepository.existsById(id)) {
            throw new RuntimeException("Report not found with id: " + id);
        }
        reportRepository.deleteById(id);
    }

    public Page<Report> getReports(Pageable pageable, ReportStatus status, String categoryStr) {
        Specification<Report> spec = Specification.where(null);

        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }

        if (categoryStr != null && !categoryStr.isEmpty() && !"all".equalsIgnoreCase(categoryStr)) {
            try {
                ReportCategory category = ReportCategory.valueOf(categoryStr);
                spec = spec.and((root, query, cb) -> cb.equal(root.get("category"), category));
            } catch (IllegalArgumentException e) {
                log.warn("Invalid category filter: " + categoryStr);
            }
        }

        return reportRepository.findAll(spec, pageable);
    }

    public Report getReportById(UUID id) {
        return reportRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Report not found"));
    }

    public List<Report> getVerifiedReports() {
        return reportRepository.findByStatus(ReportStatus.VERIFIED);
    }

    public List<Report> getPendingReports() {
        return reportRepository.findByStatus(ReportStatus.PENDING);
    }

    public Page<Report> getUserReports(UUID userId, ReportStatus status, ReportCategory category, Pageable pageable) {
        return reportRepository.findUserReports(userId, status, category, pageable);
    }

    // Methods for Users (with ownership check)
    public void deleteReport(UUID id, UUID userId) {
        Report report = getReportById(id);
        if (!report.getUserId().equals(userId)) {
            throw new SecurityException("User not authorized to delete this report");
        }
        reportRepository.delete(report);
    }

    public Report updateReport(UUID id, UUID userId, Map<String, Object> updates) {
        Report report = getReportById(id);
        if (!report.getUserId().equals(userId)) {
            throw new SecurityException("User not authorized to update this report");
        }

        if (updates.containsKey("title")) {
            report.setTitle((String) updates.get("title"));
        }
        if (updates.containsKey("description")) {
            report.setDescription((String) updates.get("description"));
        }
        if (updates.containsKey("category")) {
            String categoryStr = (String) updates.get("category");
            report.setCategory(ReportCategory.valueOf(categoryStr));
        }

        return reportRepository.save(report);
    }

    /**
     * Find reports within a radius from the given location
     * Uses Haversine formula for accurate distance calculation
     */
    public List<Report> getReportsWithinRadius(Double latitude, Double longitude, Double radiusKm) {
        return reportRepository.findReportsWithinRadius(latitude, longitude, radiusKm);
    }

    private Map<String, String> reportToPayload(Report report) {
        return Map.of(
                "id", report.getId().toString(),
                "title", report.getTitle(),
                "description", report.getDescription(),
                "user_id", report.getUserId().toString(),
                "status", report.getStatus() != null ? report.getStatus().toString() : "PENDING");
    }

    public Map<String, Object> getReportStats() {
        long total = reportRepository.count();
        long pending = reportRepository.countByStatus(ReportStatus.PENDING);
        long verified = reportRepository.countByStatus(ReportStatus.VERIFIED);
        long rejected = reportRepository.countByStatus(ReportStatus.REJECTED);

        LocalDateTime startOfDay = LocalDateTime.now().withHour(0).withMinute(0).withSecond(0).withNano(0);
        long today = reportRepository.countByCreatedAtAfter(startOfDay);

        long thisWeek = reportRepository.countByCreatedAtAfter(startOfDay.minusDays(7));

        return Map.of(
                "totalReports", total,
                "pendingReports", pending,
                "verifiedReports", verified,
                "rejectedReports", rejected,
                "reportsToday", today,
                "reportsThisWeek", thisWeek);
    }
}
