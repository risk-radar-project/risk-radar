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

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import report_service.entity.ReportCategory;

@Slf4j
@Service
public class ReportService {

    private final ReportRepository reportRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${report.kafka.topic}")
    private String reportTopic;

    public ReportService(ReportRepository reportRepository, KafkaTemplate<String, Object> kafkaTemplate) {
        this.reportRepository = reportRepository;
        this.kafkaTemplate = kafkaTemplate;
    }

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

        Report savedReport = reportRepository.save(report);

        if (savedReport.getId() == null) {
            throw new IllegalStateException("Report was not saved correctly – no ID returned.");
        }

        Map<String, String> payload = reportToPayload(savedReport);
        log.info("Sending report saved to topic: " + reportTopic);

        kafkaTemplate.send(reportTopic, payload);
    }

    public void updateReportStatus(UUID id, ReportStatus status) {
        Optional<Report> reportOpt = reportRepository.findById(id);
        if (reportOpt.isPresent()) {
            Report report = reportOpt.get();
            report.setStatus(status);
            Report updatedReport = reportRepository.save(report);
        } else {
            throw new RuntimeException("Report not found");
        }
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
                "description", report.getDescription());
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
