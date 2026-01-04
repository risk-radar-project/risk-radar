package risk_radar.map_service.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import risk_radar.map_service.dto.VerificationDataDTO;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class VerificationCacheService {

    private static final Logger log = LoggerFactory.getLogger(VerificationCacheService.class);
    
    // In-memory cache for verification data
    private final Map<String, VerificationData> verificationCache = new ConcurrentHashMap<>();

    @KafkaListener(topics = "verification_events", groupId = "map-service-verification-group")
    public void consumeVerificationEvent(JsonNode message) {
        try {
            String eventType = message.get("event_type").asText();
            String reportId = message.get("report_id").asText();

            log.info("Received verification event: {} for report: {}", eventType, reportId);

            VerificationData data = verificationCache.computeIfAbsent(reportId, k -> new VerificationData());

            if ("report_verified".equals(eventType)) {
                data.isFake = message.get("is_fake").asBoolean();
                data.fakeProbability = message.get("fake_probability").asDouble();
                data.verificationConfidence = message.get("confidence").asText();
                data.verifiedAt = parseTimestamp(message.get("timestamp").asText());
                log.info("Updated verification data for report {}: isFake={}, probability={}", 
                        reportId, data.isFake, data.fakeProbability);
            } else if ("duplicate_check".equals(eventType)) {
                data.isDuplicate = message.get("is_duplicate").asBoolean();
                data.duplicateProbability = message.get("max_similarity").asDouble();
                data.duplicateCheckedAt = parseTimestamp(message.get("timestamp").asText());
                log.info("Updated duplicate data for report {}: isDuplicate={}, similarity={}", 
                        reportId, data.isDuplicate, data.duplicateProbability);
            }

        } catch (Exception e) {
            log.error("Error processing verification event", e);
        }
    }

    public VerificationDataDTO getVerificationData(String reportId) {
        VerificationData data = verificationCache.get(reportId);
        if (data == null) {
            return null;
        }

        return new VerificationDataDTO(
                reportId,
                data.isFake,
                data.fakeProbability,
                data.verificationConfidence,
                data.verifiedAt,
                data.isDuplicate,
                data.duplicateProbability,
                data.duplicateCheckedAt
        );
    }

    private LocalDateTime parseTimestamp(String timestamp) {
        try {
            return LocalDateTime.parse(timestamp, DateTimeFormatter.ISO_DATE_TIME);
        } catch (Exception e) {
            log.warn("Failed to parse timestamp: {}", timestamp);
            return LocalDateTime.now();
        }
    }

    private static class VerificationData {
        Boolean isFake;
        Double fakeProbability;
        String verificationConfidence;
        LocalDateTime verifiedAt;
        Boolean isDuplicate;
        Double duplicateProbability;
        LocalDateTime duplicateCheckedAt;
    }
}
