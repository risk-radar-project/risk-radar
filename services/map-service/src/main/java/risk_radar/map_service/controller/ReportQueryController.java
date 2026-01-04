package risk_radar.map_service.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import risk_radar.map_service.client.ReportServiceClient;
import risk_radar.map_service.dto.ReportDTO;
import risk_radar.map_service.dto.VerificationDataDTO;
import risk_radar.map_service.service.VerificationCacheService;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class ReportQueryController {

    private final ReportServiceClient reportServiceClient;
    private final VerificationCacheService verificationCacheService;

    @GetMapping("/reports")
    public List<ReportDTO> getAllVerifiedReports() {
        return reportServiceClient.getVerifiedReports();
    }

    @GetMapping("/verification/{reportId}")
    public ResponseEntity<VerificationDataDTO> getVerificationData(@PathVariable String reportId) {
        VerificationDataDTO data = verificationCacheService.getVerificationData(reportId);
        if (data == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(data);
    }
}