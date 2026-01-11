package report_service.dto;

import jakarta.validation.constraints.*;
import report_service.entity.ReportCategory;

import java.util.List;
import java.util.UUID;

public record ReportRequest(
        @NotBlank(message = "Title is required") @Size(max = 500, message = "Title cannot exceed 500 characters") String title,

        @Size(max = 10000, message = "Description cannot exceed 10000 characters") String description,

        @NotNull(message = "Latitude is required") @DecimalMin(value = "-90.0", message = "Latitude must be between -90 and 90") @DecimalMax(value = "90.0", message = "Latitude must be between -90 and 90") Double latitude,

        @NotNull(message = "Longitude is required") @DecimalMin(value = "-180.0", message = "Longitude must be between -180 and 180") @DecimalMax(value = "180.0", message = "Longitude must be between -180 and 180") Double longitude,

        @NotNull(message = "User ID is required") UUID userId,

        List<UUID> imageIds,

        @NotNull(message = "Report category is required") ReportCategory reportCategory) {
}
