package risk_radar.map_service.dto;

import java.time.LocalDateTime;

public record VerificationDataDTO(
        String reportId,
        Boolean isFake,
        Double fakeProbability,
        String verificationConfidence,
        LocalDateTime verifiedAt,
        Boolean isDuplicate,
        Double duplicateProbability,
        LocalDateTime duplicateCheckedAt
) {}
