package risk_radar.map_service.client;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import risk_radar.map_service.dto.ReportDTO;

import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class ReportServiceClient {

    private final RestTemplate restTemplate;

    @Value("${app.services.report-service-url}")
    private String reportServiceUrl;

    public List<ReportDTO> getVerifiedReports() {
        // report-service endpoint is now /verified (changed from /reports/verified)
        String url = reportServiceUrl + "/verified";

        ReportDTO[] reports = restTemplate.getForObject(url, ReportDTO[].class);

        return List.of(Objects.requireNonNullElse(reports, new ReportDTO[0]));
    }
}