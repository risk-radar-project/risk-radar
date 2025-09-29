package report_service.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import report_service.dto.ReportRequest;
import report_service.entity.Report;
import report_service.entity.ReportStatus;
import report_service.repository.ReportRepository;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;
    private final KafkaTemplate<String, Report> kafkaTemplate;
    private final AuditLogClient auditLogClient;


    public void createReport(ReportRequest request) {
        try {
            System.out.println(request);
            Report report = new Report();
            report.setTitle(request.title());
            report.setLatitude(request.latitude());
            report.setLongitude(request.longitude());
            report.setDescription(request.description());
            report.setUserId(request.userId());
            report.setImageIds(request.imageIds());
            report.setCreatedAt(LocalDateTime.now());

            Report savedReport = reportRepository.save(report);

            if (savedReport.getId() == null) {
                throw new IllegalStateException("Report was not saved correctly – no ID returned.");
            }

            // === Audit log: save to DB ===
            auditLogClient.logAction(
                    Map.of(
                            "service", "report-service",
                            "action", "report_saved",
                            "actor", Map.of(
                                    "id", request.userId(),
                                    "type", "user"
                            ),
                            "status", "success",
                            "log_type", "ACTION",
                            "metadata", Map.of(
                                    "reportId", savedReport.getId(),
                                    "description", "Report successfully saved in DB"
                            )
                    )
            );
            // Kafka
            kafkaTemplate.send("reports", savedReport)
                    .whenComplete((result, ex) -> {
                        if (ex == null) {
                            auditLogClient.logAction(
                                    Map.of(
                                            "service", "report-service",
                                            "action", "kafka_publish",
                                            "actor", Map.of(
                                                    "id", request.userId(),
                                                    "type", "user"
                                            ),
                                            "status", "success",
                                            "log_type", "ACTION",
                                            "metadata", Map.of(
                                                    "reportId", savedReport.getId(),
                                                    "offset", result.getRecordMetadata().offset(),
                                                    "description", "Report successfully sent to Kafka"
                                            )
                                    )
                            );
                        } else {
                            auditLogClient.logAction(
                                    Map.of(
                                            "service", "report-service",
                                            "action", "kafka_publish",
                                            "actor", Map.of(
                                                    "id", request.userId(),
                                                    "type", "user"
                                            ),
                                            "status", "failure",
                                            "log_type", "ERROR",
                                            "metadata", Map.of(
                                                    "reportId", savedReport.getId(),
                                                    "error", ex.getMessage()
                                            )
                                    )
                            );
                        }
                    });

        } catch (Exception e) {
            // === Audit log: globalny error ===
            auditLogClient.logAction(
                    Map.of(
                            "service", "report-service",
                            "action", "create_report",
                            "actor", Map.of(
                                    "id", request.userId(),
                                    "type", "user"
                            ),
                            "status", "failure",
                            "log_type", "ERROR",
                            "metadata", Map.of(
                                    "error", e.getMessage()
                            )
                    )
            );
            throw e;
        }
    }
    // ----------------- Aktualizacja statusu raportu -----------------
    public void updateReportStatus(UUID id, ReportStatus status) {
        try {
            Optional<Report> reportOpt = reportRepository.findById(id);
            if (reportOpt.isPresent()) {
                Report report = reportOpt.get();
                ReportStatus oldStatus = report.getStatus();
                report.setStatus(status);
                reportRepository.save(report);

                // === Audit log: status update success ===
                auditLogClient.logAction(
                        Map.of(
                                "service", "report-service",
                                "action", "update_report_status",
                                "actor", Map.of(
                                        "id", "system",
                                        "type", "system"
                                ),
                                "status", "success",
                                "log_type", "ACTION",
                                "metadata", Map.of(
                                        "reportId", id,
                                        "oldStatus", oldStatus.toString(),
                                        "newStatus", status.toString(),
                                        "description", "Report status successfully updated"
                                )
                        )
                );
            } else {
                // === Audit log: report not found ===
                auditLogClient.logAction(
                        Map.of(
                                "service", "report-service",
                                "action", "update_report_status",
                                "actor", Map.of(
                                        "id", "system",
                                        "type", "system"
                                ),
                                "status", "failure",
                                "log_type", "ERROR",
                                "metadata", Map.of(
                                        "reportId", id,
                                        "error", "Report not found"
                                )
                        )
                );
                throw new RuntimeException("Report not found");
            }
        } catch (Exception e) {
            auditLogClient.logAction(
                    Map.of(
                            "service", "report-service",
                            "action", "update_report_status",
                            "actor", Map.of(
                                    "id", "system",
                                    "type", "system"
                            ),
                            "status", "failure",
                            "log_type", "ERROR",
                            "metadata", Map.of(
                                    "reportId", id,
                                    "targetStatus", status.toString(),
                                    "error", e.getMessage()
                            )
                    )
            );
            throw e;
        }
    }

    // ----------------- Pobranie raportów z paginacją i sortowaniem -----------------
    public Page<Report> getReports(Pageable pageable) {
        return reportRepository.findAll(pageable);
    }
    public Report getReportById(UUID id) {
        return reportRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Report not found"));
    }

}
