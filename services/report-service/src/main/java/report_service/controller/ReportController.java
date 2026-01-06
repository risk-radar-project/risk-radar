package report_service.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;
import report_service.dto.ReportRequest;
import report_service.entity.Report;
import report_service.entity.ReportStatus;
import report_service.service.AuditLogClient;
import report_service.service.ReportService;
import org.springframework.security.access.prepost.PreAuthorize;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
public class ReportController {

        private final ReportService reportService;
        private final AuditLogClient auditLogClient;

        @PostMapping("/createReport")
        public ResponseEntity<?> createReport(@Valid @RequestBody ReportRequest request,
                        BindingResult bindingResult,
                        HttpServletRequest httpRequest, Principal principal) {
                String userAgent = Optional.ofNullable(httpRequest.getHeader("User-Agent")).orElse("unknown");

                // Check for validation errors
                if (bindingResult.hasErrors()) {
                        String errorMessage = bindingResult.getFieldErrors().stream()
                                        .map(error -> error.getField() + ": " + error.getDefaultMessage())
                                        .collect(Collectors.joining(", "));

                        auditLogClient.logAction(Map.of(
                                        "service", "report-service",
                                        "action", "create_report",
                                        "actor", getActor(principal, httpRequest),
                                        "status", "failure",
                                        "log_type", "ERROR",
                                        "metadata", Map.of(
                                                        "description", "Validation failed for create report",
                                                        "error", errorMessage,
                                                        "user_agent", userAgent)));

                        return ResponseEntity.badRequest().body(Map.of(
                                        "message", "Validation failed",
                                        "status", "failure",
                                        "error", errorMessage));
                }

                try {
                        // Extract User ID from header
                        String userIdHeader = httpRequest.getHeader("X-User-ID");
                        UUID userId = request.userId();
                        if (userId == null && userIdHeader != null && !userIdHeader.isEmpty()) {
                                try {
                                        userId = UUID.fromString(userIdHeader);
                                } catch (IllegalArgumentException e) {
                                        return ResponseEntity.badRequest().body(Map.of(
                                                        "message", "Invalid User ID format in header",
                                                        "status", "failure",
                                                        "error", "Invalid UUID string: " + userIdHeader));
                                }
                        }

                        // Create new request with injected User ID if needed
                        ReportRequest effectiveRequest = request;
                        if (userId != null && !userId.equals(request.userId())) {
                                effectiveRequest = new ReportRequest(
                                                request.title(),
                                                request.description(),
                                                request.latitude(),
                                                request.longitude(),
                                                userId,
                                                request.imageIds(),
                                                request.reportCategory());
                        }

                        reportService.createReport(effectiveRequest);

                        auditLogClient.logAction(Map.of(
                                        "service", "report-service",
                                        "action", "create_report",
                                        "actor", getActor(principal, httpRequest),
                                        "status", "success",
                                        "log_type", "ACTION",
                                        "metadata", Map.of(
                                                        "description", "Report created successfully",
                                                        "user_agent", userAgent)));

                        return ResponseEntity.status(HttpStatus.CREATED).body(
                                        Map.of(
                                                        "message", "Report created successfully",
                                                        "status", "success"));

                } catch (Exception e) {
                        auditLogClient.logAction(Map.of(
                                        "service", "report-service",
                                        "action", "create_report",
                                        "actor", getActor(principal, httpRequest),
                                        "status", "failure",
                                        "log_type", "ERROR",
                                        "metadata", Map.of(
                                                        "description", "Failed to create report",
                                                        "error", e.getMessage(),
                                                        "user_agent", httpRequest.getHeader("User-Agent"))));

                        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                                        Map.of(
                                                        "message", "Failed to create report",
                                                        "status", "failure",
                                                        "error", e.getMessage()));
                }
        }

        @PatchMapping("/report/{id}/status")
        @PreAuthorize("hasAuthority('PERM_REPORTS:EDIT') or hasAuthority('PERM_*:*')")
        public ResponseEntity<?> updateReportStatus(
                        @PathVariable UUID id,
                        @RequestParam ReportStatus status,
                        HttpServletRequest httpRequest, Principal principal) {
                try {
                        reportService.updateReportStatus(id, status);

                        auditLogClient.logAction(Map.of(
                                        "service", "report-service",
                                        "action", "update_report_status",
                                        "actor", getActor(principal, httpRequest),
                                        "status", "success",
                                        "log_type", "ACTION",
                                        "metadata", Map.of(
                                                        "description", "Report status updated for id: " + id,
                                                        "new_status", status.toString(),
                                                        "user_agent", httpRequest.getHeader("User-Agent"))));

                        return ResponseEntity.ok(Map.of(
                                        "message", "Report status updated",
                                        "status", "success"));
                } catch (Exception e) {
                        auditLogClient.logAction(Map.of(
                                        "service", "report-service",
                                        "action", "update_report_status",
                                        "actor", getActor(principal, httpRequest),
                                        "status", "failure",
                                        "log_type", "ERROR",
                                        "metadata", Map.of(
                                                        "description", "Failed to update report status for id: " + id,
                                                        "error", e.getMessage(),
                                                        "user_agent", httpRequest.getHeader("User-Agent"))));

                        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                                        Map.of(
                                                        "message", "Failed to update report status",
                                                        "status", "failure",
                                                        "error", e.getMessage()));
                }
        }

        @GetMapping("/reports")
        public ResponseEntity<?> getReports(
                        @RequestParam(defaultValue = "0") int page,
                        @RequestParam(defaultValue = "10") int size,
                        @RequestParam(defaultValue = "createdAt") String sort,
                        @RequestParam(defaultValue = "desc") String direction,
                        @RequestParam(required = false) ReportStatus status,
                        @RequestParam(required = false) String category) {
                try {
                        Page<Report> reports = reportService.getReports(
                                        PageRequest.of(page, size,
                                                        Sort.by(Sort.Direction.fromString(direction), sort)),
                                        status,
                                        category);
                        return ResponseEntity.ok(reports);
                } catch (Exception e) {
                        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                                        Map.of(
                                                        "message", "Failed to fetch reports",
                                                        "status", "failure",
                                                        "error", e.getMessage()));
                }
        }

        @GetMapping("/report/{id}")
        public ResponseEntity<?> getReportById(
                        @PathVariable UUID id) {
                try {
                        Report report = reportService.getReportById(id);
                        return ResponseEntity.ok(report);

                } catch (RuntimeException e) {
                        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                                        Map.of(
                                                        "message", "Report not found",
                                                        "status", "failure",
                                                        "error", e.getMessage()));
                } catch (Exception e) {
                        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                                        Map.of(
                                                        "message", "Failed to fetch report",
                                                        "status", "failure",
                                                        "error", e.getMessage()));
                }
        }

        @GetMapping("/reports/verified")
        public ResponseEntity<?> getVerifiedReports() {
                try {
                        List<Report> reports = reportService.getVerifiedReports();
                        return ResponseEntity.ok(reports);
                } catch (Exception e) {
                        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                                        Map.of(
                                                        "message", "Failed to fetch verified reports",
                                                        "status", "failure",
                                                        "error", e.getMessage()));
                }
        }

        @GetMapping("/reports/pending")
        @PreAuthorize("hasAuthority('PERM_REPORTS:VALIDATE') or hasAuthority('PERM_*:*')")
        public ResponseEntity<?> getPendingReports() {
                try {
                        List<Report> reports = reportService.getPendingReports();
                        return ResponseEntity.ok(reports);
                } catch (Exception e) {
                        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                                        Map.of(
                                                        "message", "Failed to fetch pending reports",
                                                        "status", "failure",
                                                        "error", e.getMessage()));
                }
        }

        /**
         * Get reports within a specified radius from the given location
         * Used for AI Assistant threat analysis
         */
        @GetMapping("/reports/nearby")
        public ResponseEntity<?> getReportsNearby(
                        @RequestParam Double latitude,
                        @RequestParam Double longitude,
                        @RequestParam(defaultValue = "1.0") Double radiusKm) {
                try {
                        List<Report> reports = reportService.getReportsWithinRadius(latitude, longitude, radiusKm);
                        return ResponseEntity.ok(Map.of(
                                        "location", Map.of("lat", latitude, "lng", longitude),
                                        "radiusKm", radiusKm,
                                        "count", reports.size(),
                                        "reports", reports));
                } catch (Exception e) {
                        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                                        Map.of(
                                                        "message", "Failed to fetch nearby reports",
                                                        "status", "failure",
                                                        "error", e.getMessage()));
                }
        }

        @GetMapping("/reports/stats")
        @PreAuthorize("hasAuthority('PERM_STATS:VIEW') or hasAuthority('PERM_REPORTS:VIEW') or hasAuthority('PERM_*:*')")
        public ResponseEntity<?> getReportStats() {
                try {
                        return ResponseEntity.ok(reportService.getReportStats());
                } catch (Exception e) {
                        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                                        Map.of(
                                                        "message", "Failed to get report stats",
                                                        "status", "failure",
                                                        "error", e.getMessage()));
                }
        }

        @PutMapping("/report/{id}")
        @PreAuthorize("hasAuthority('PERM_REPORTS:EDIT') or hasAuthority('PERM_*:*')")
        public ResponseEntity<?> updateReport(
                        @PathVariable UUID id,
                        @Valid @RequestBody ReportRequest request,
                        BindingResult bindingResult,
                        HttpServletRequest httpRequest, Principal principal) {
                try {
                        // Check for validation errors
                        if (bindingResult.hasErrors()) {
                                String errorMessage = bindingResult.getFieldErrors().stream()
                                                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                                                .collect(Collectors.joining(", "));

                                return ResponseEntity.badRequest().body(Map.of(
                                                "message", "Validation failed",
                                                "status", "failure",
                                                "error", errorMessage));
                        }

                        Report updatedReport = reportService.updateReport(id, request);

                        auditLogClient.logAction(Map.of(
                                        "service", "report-service",
                                        "action", "update_report",
                                        "actor", getActor(principal, httpRequest),
                                        "status", "success",
                                        "log_type", "ACTION",
                                        "metadata", Map.of(
                                                        "description", "Report updated successfully for id: " + id,
                                                        "user_agent", httpRequest.getHeader("User-Agent"))));

                        return ResponseEntity.ok(updatedReport);
                } catch (RuntimeException e) {
                        auditLogClient.logAction(Map.of(
                                        "service", "report-service",
                                        "action", "update_report",
                                        "actor", getActor(principal, httpRequest),
                                        "status", "failure",
                                        "log_type", "ERROR",
                                        "metadata", Map.of(
                                                        "description", "Failed to update report for id: " + id,
                                                        "error", e.getMessage(),
                                                        "user_agent", httpRequest.getHeader("User-Agent"))));

                        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                                        Map.of(
                                                        "message", "Report not found",
                                                        "status", "failure",
                                                        "error", e.getMessage()));
                } catch (Exception e) {
                        auditLogClient.logAction(Map.of(
                                        "service", "report-service",
                                        "action", "update_report",
                                        "actor", getActor(principal, httpRequest),
                                        "status", "failure",
                                        "log_type", "ERROR",
                                        "metadata", Map.of(
                                                        "description", "Failed to update report for id: " + id,
                                                        "error", e.getMessage(),
                                                        "user_agent", httpRequest.getHeader("User-Agent"))));

                        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                                        Map.of(
                                                        "message", "Failed to update report",
                                                        "status", "failure",
                                                        "error", e.getMessage()));
                }
        }

        @DeleteMapping("/report/{id}")
        @PreAuthorize("hasAuthority('PERM_REPORTS:DELETE') or hasAuthority('PERM_*:*')")
        public ResponseEntity<?> deleteReport(
                        @PathVariable UUID id,
                        HttpServletRequest httpRequest, Principal principal) {
                try {
                        reportService.deleteReport(id);

                        auditLogClient.logAction(Map.of(
                                        "service", "report-service",
                                        "action", "delete_report",
                                        "actor", getActor(principal, httpRequest),
                                        "status", "success",
                                        "log_type", "ACTION",
                                        "metadata", Map.of(
                                                        "description", "Report deleted successfully for id: " + id,
                                                        "user_agent", httpRequest.getHeader("User-Agent"))));

                        return ResponseEntity.ok(Map.of(
                                        "message", "Report deleted successfully",
                                        "status", "success"));
                } catch (RuntimeException e) {
                        auditLogClient.logAction(Map.of(
                                        "service", "report-service",
                                        "action", "delete_report",
                                        "actor", getActor(principal, httpRequest),
                                        "status", "failure",
                                        "log_type", "ERROR",
                                        "metadata", Map.of(
                                                        "description", "Failed to delete report for id: " + id,
                                                        "error", e.getMessage(),
                                                        "user_agent", httpRequest.getHeader("User-Agent"))));

                        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                                        Map.of(
                                                        "message", "Report not found",
                                                        "status", "failure",
                                                        "error", e.getMessage()));
                } catch (Exception e) {
                        auditLogClient.logAction(Map.of(
                                        "service", "report-service",
                                        "action", "delete_report",
                                        "actor", getActor(principal, httpRequest),
                                        "status", "failure",
                                        "log_type", "ERROR",
                                        "metadata", Map.of(
                                                        "description", "Failed to delete report for id: " + id,
                                                        "error", e.getMessage(),
                                                        "user_agent", httpRequest.getHeader("User-Agent"))));

                        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                                        Map.of(
                                                        "message", "Failed to delete report",
                                                        "status", "failure",
                                                        "error", e.getMessage()));
                }
        }

        private Map<String, Object> getActor(Principal principal, HttpServletRequest request) {
                String actorId = (principal != null) ? principal.getName() : "anonymous";
                String actorType = (principal != null) ? "user" : "system";
                return Map.of(
                                "id", actorId,
                                "type", actorType,
                                "ip", getClientIp(request));
        }

        private String getClientIp(HttpServletRequest request) {
                String xfHeader = request.getHeader("X-Forwarded-For");
                if (xfHeader == null || xfHeader.isEmpty() || "unknown".equalsIgnoreCase(xfHeader)) {
                        return request.getRemoteAddr();
                }
                return xfHeader.split(",")[0];
        }
}