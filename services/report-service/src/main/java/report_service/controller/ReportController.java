package report_service.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import report_service.dto.ReportRequest;
import report_service.entity.Report;
import report_service.entity.ReportStatus;
import report_service.service.AuditLogClient;
import report_service.service.ReportService;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import report_service.entity.ReportCategory;

@RestController
@RequiredArgsConstructor
public class ReportController {

        private final ReportService reportService;
        private final AuditLogClient auditLogClient;

        @PostMapping("/createReport")
        public ResponseEntity<?> createReport(@RequestBody ReportRequest request,
                        HttpServletRequest httpRequest, Principal principal) {
                String userAgent = Optional.ofNullable(httpRequest.getHeader("User-Agent")).orElse("unknown");

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

        @PatchMapping("/{id}/status")
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

        @GetMapping("")
        public ResponseEntity<?> getReports(
                        @RequestParam(defaultValue = "0") int page,
                        @RequestParam(defaultValue = "10") int size,
                        @RequestParam(defaultValue = "createdAt") String sort,
                        @RequestParam(defaultValue = "desc") String direction) {
                try {
                        Page<Report> reports = reportService.getReports(
                                        PageRequest.of(page, size,
                                                        Sort.by(Sort.Direction.fromString(direction), sort)));
                        return ResponseEntity.ok(reports);
                } catch (Exception e) {
                        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                                        Map.of(
                                                        "message", "Failed to fetch reports",
                                                        "status", "failure",
                                                        "error", e.getMessage()));
                }
        }

        @GetMapping("/{id}")
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

        @GetMapping("/verified")
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

        @GetMapping("/pending")
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

        @GetMapping("/my-reports")
        public ResponseEntity<?> getMyReports(
                        @RequestParam(defaultValue = "0") int page,
                        @RequestParam(defaultValue = "10") int size,
                        @RequestParam(defaultValue = "createdAt") String sort,
                        @RequestParam(defaultValue = "desc") String direction,
            @RequestParam(required = false) ReportStatus status,
            @RequestParam(required = false) ReportCategory category,
            HttpServletRequest httpRequest) {
        try {
            String userIdHeader = httpRequest.getHeader("X-User-ID");
            if (userIdHeader == null || userIdHeader.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                        Map.of("message", "Missing User ID", "status", "failure"));
            }
            UUID userId = UUID.fromString(userIdHeader);

            Page<Report> reports = reportService.getUserReports(
                    userId,
                    status,
                    category,
                    PageRequest.of(page, size, Sort.by(Sort.Direction.fromString(direction), sort)));

            return ResponseEntity.ok(reports);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                    Map.of(
                            "message", "Failed to fetch user reports",
                            "status", "failure",
                            "error", e.getMessage()));
        }
    }

        @PatchMapping("/{id}")
        public ResponseEntity<?> updateReport(
                        @PathVariable UUID id,
                        @RequestBody Map<String, Object> updates,
                        HttpServletRequest httpRequest,
                        Principal principal) {
                try {
                        String userIdHeader = httpRequest.getHeader("X-User-ID");
                        if (userIdHeader == null || userIdHeader.isEmpty()) {
                                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                                                Map.of("message", "Missing User ID", "status", "failure"));
                        }
                        UUID userId = UUID.fromString(userIdHeader);

                        Report updatedReport = reportService.updateReport(id, userId, updates);

                        auditLogClient.logAction(Map.of(
                                        "service", "report-service",
                                        "action", "update_report",
                                        "actor", getActor(principal, httpRequest),
                                        "status", "success",
                                        "log_type", "ACTION",
                                        "metadata", Map.of(
                                                        "description", "Report updated successfully",
                                                        "report_id", id.toString(),
                                                        "user_agent", Optional.ofNullable(httpRequest.getHeader("User-Agent"))
                                                                        .orElse("unknown"))));

                        return ResponseEntity.ok(updatedReport);

                } catch (SecurityException e) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(
                                        Map.of("message", e.getMessage(), "status", "failure"));
                } catch (Exception e) {
                        auditLogClient.logAction(Map.of(
                                        "service", "report-service",
                                        "action", "update_report",
                                        "actor", getActor(principal, httpRequest),
                                        "status", "failure",
                                        "log_type", "ERROR",
                                        "metadata", Map.of(
                                                        "description", "Failed to update report",
                                                        "report_id", id.toString(),
                                                        "error", e.getMessage(),
                                                        "user_agent", Optional.ofNullable(httpRequest.getHeader("User-Agent"))
                                                                        .orElse("unknown"))));

                        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                                        Map.of(
                                                        "message", "Failed to update report",
                                                        "status", "failure",
                                                        "error", e.getMessage()));
                }
        }

        @DeleteMapping("/{id}")
        public ResponseEntity<?> deleteReport(
                        @PathVariable UUID id,
                        HttpServletRequest httpRequest,
                        Principal principal) {
                try {
                        String userIdHeader = httpRequest.getHeader("X-User-ID");
                        if (userIdHeader == null || userIdHeader.isEmpty()) {
                                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                                                Map.of("message", "Missing User ID", "status", "failure"));
                        }
                        UUID userId = UUID.fromString(userIdHeader);

                        reportService.deleteReport(id, userId);

                        auditLogClient.logAction(Map.of(
                                        "service", "report-service",
                                        "action", "delete_report",
                                        "actor", getActor(principal, httpRequest),
                                        "status", "success",
                                        "log_type", "ACTION",
                                        "metadata", Map.of(
                                                        "description", "Report deleted successfully",
                                                        "report_id", id.toString(),
                                                        "user_agent", Optional.ofNullable(httpRequest.getHeader("User-Agent"))
                                                                        .orElse("unknown"))));

                        return ResponseEntity.ok(Map.of(
                                        "message", "Report deleted successfully",
                                        "status", "success"));

                } catch (SecurityException e) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(
                                        Map.of("message", e.getMessage(), "status", "failure"));
                } catch (Exception e) {
                        auditLogClient.logAction(Map.of(
                                        "service", "report-service",
                                        "action", "delete_report",
                                        "actor", getActor(principal, httpRequest),
                                        "status", "failure",
                                        "log_type", "ERROR",
                                        "metadata", Map.of(
                                                        "description", "Failed to delete report",
                                                        "error", e.getMessage())));

                        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                                        Map.of(
                                                        "message", "Failed to delete report",
                                                        "status", "failure",
                                                        "error", e.getMessage()));
                }
        }

        /**
         * Get reports within a specified radius from the given location
         * Used for AI Assistant threat analysis
         */
        @GetMapping("/nearby")
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