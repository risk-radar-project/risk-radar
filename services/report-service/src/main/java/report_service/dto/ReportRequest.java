package report_service.dto;


import java.util.List;
import java.util.UUID;

public record ReportRequest(String title, String description, Double latitude, Double longitude ,UUID userId, List<UUID> imageIds) {
}
