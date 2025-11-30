package risk_radar.map_service.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record ReportDTO(UUID id,
                        Double latitude,
                        Double longitude,
                        String title,
                        String description,
                        UUID userID,
                        List<UUID> imageIds,
                        String status,
                        String category,
                        LocalDateTime createdAt
                        ) {}
