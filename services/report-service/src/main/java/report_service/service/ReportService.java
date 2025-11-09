package report_service.service;

import lombok.AllArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import report_service.dto.ReportRequest;
import report_service.entity.Report;
import report_service.entity.ReportStatus;
import report_service.repository.ReportRepository;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
@AllArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;


    public void createReport(ReportRequest request) {
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
    }

    // ----------------- Aktualizacja statusu raportu -----------------
    public void updateReportStatus(UUID id, ReportStatus status) {
        Optional<Report> reportOpt = reportRepository.findById(id);
        if (reportOpt.isPresent()) {
            Report report = reportOpt.get();
            report.setStatus(status);
            reportRepository.save(report);

        } else {
            throw new RuntimeException("Report not found");
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
