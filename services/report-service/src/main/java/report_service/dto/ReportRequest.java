package report_service.dto;

import jakarta.validation.constraints.*;
import report_service.entity.ReportCategory;

import java.util.List;
import java.util.UUID;

public record ReportRequest(
        @NotBlank(message = "Tytuł jest wymagany") @Size(max = 500, message = "Tytuł nie może przekraczać 500 znaków") String title,

        @Size(max = 10000, message = "Opis nie może przekraczać 10000 znaków") String description,

        @NotNull(message = "Szerokość geograficzna jest wymagana") @DecimalMin(value = "-90.0", message = "Szerokość geograficzna musi być między -90 a 90") @DecimalMax(value = "90.0", message = "Szerokość geograficzna musi być między -90 a 90") Double latitude,

        @NotNull(message = "Długość geograficzna jest wymagana") @DecimalMin(value = "-180.0", message = "Długość geograficzna musi być między -180 a 180") @DecimalMax(value = "180.0", message = "Długość geograficzna musi być między -180 a 180") Double longitude,

        @NotNull(message = "ID użytkownika jest wymagane") UUID userId,

        List<UUID> imageIds,

        @NotNull(message = "Kategoria zgłoszenia jest wymagana") ReportCategory reportCategory) {
}
