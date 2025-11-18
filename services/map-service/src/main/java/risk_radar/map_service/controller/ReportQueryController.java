package risk_radar.map_service.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import risk_radar.map_service.client.ReportServiceClient;
import risk_radar.map_service.dto.ReportDTO;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class ReportQueryController {

    private final ReportServiceClient reportServiceClient;

    @GetMapping("/api/reports")
    public List<ReportDTO> getAllVerifiedReports() {
        return reportServiceClient.getVerifiedReports();
    }
}