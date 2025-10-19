package report_service.controller;

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
import report_service.service.ReportService;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    // ----------------- Tworzenie nowego raportu -----------------

    @PostMapping("/createReport")
    public ResponseEntity<?> createReport(@RequestBody ReportRequest request) {
        try {
            reportService.createReport(request);

            return ResponseEntity.status(HttpStatus.CREATED).body(
                    Map.of(
                            "message", "Report created successfully",
                            "status", "success"
                    )
            );

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                    Map.of(
                            "message", "Failed to create report",
                            "status", "failure",
                            "error", e.getMessage()
                    )
            );
        }
    }

    // ----------------- Zmiana statusu raportu -----------------
    @PatchMapping("/report/{id}/status")
    public ResponseEntity<?> updateReportStatus(
            @PathVariable UUID id,
            @RequestParam ReportStatus status) {
        try {
            reportService.updateReportStatus(id, status);
            return ResponseEntity.ok(Map.of(
                    "message", "Report status updated",
                    "status", "success"
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                    Map.of(
                            "message", "Failed to update report status",
                            "status", "failure",
                            "error", e.getMessage()
                    )
            );
        }
    }

    // ----------------- Pobieranie raportów z paginacją -----------------
    @GetMapping("/reports")
    public ResponseEntity<?> getReports(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sort,
            @RequestParam(defaultValue = "desc") String direction) {
        try {
            Page<Report> reports = reportService.getReports(
                    PageRequest.of(page, size, Sort.by(Sort.Direction.fromString(direction), sort))
            );
            return ResponseEntity.ok(reports);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                    Map.of(
                            "message", "Failed to fetch reports",
                            "status", "failure",
                            "error", e.getMessage()
                    )
            );
        }
    }
    @GetMapping("/report/{id}")
    public ResponseEntity<?> getReportById(@PathVariable UUID id) {
        try {
            Report report = reportService.getReportById(id);
            return ResponseEntity.ok(report);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                    Map.of(
                            "message", "Report not found",
                            "status", "failure",
                            "error", e.getMessage()
                    )
            );
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                    Map.of(
                            "message", "Failed to fetch report",
                            "status", "failure",
                            "error", e.getMessage()
                    )
            );
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
                            "error", e.getMessage()
                    )
            );
        }
    }

}



