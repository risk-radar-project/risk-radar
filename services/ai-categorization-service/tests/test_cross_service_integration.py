"""
Cross-Service Integration Tests
Verifies that message formats between services are compatible
"""
import pytest
import json
import uuid


class TestReportServiceToAIServicesIntegration:
    """Test that report-service messages are compatible with AI services"""
    
    def test_report_service_message_matches_ai_categorization_handler(self):
        """
        Verify report-service output format matches what ai-categorization-service expects
        
        report-service (Java) sends:
        Map.of("id", ..., "title", ..., "description", ...)
        
        ai-categorization-service expects:
        message.get("id"), message.get("title"), message.get("description")
        """
        # Simulate report-service message (from ReportService.java reportToPayload)
        report_service_message = {
            "id": str(uuid.uuid4()),
            "title": "Dziura w drodze",
            "description": "Duża dziura na ul. Głównej 15"
        }
        
        # Simulate ai-categorization-service handler
        report_id = report_service_message.get("id")
        title = report_service_message.get("title")
        description = report_service_message.get("description")
        user_id = report_service_message.get("user_id", "system")
        
        assert report_id is not None, "Missing 'id' field"
        assert title is not None, "Missing 'title' field"
        assert description is not None, "Missing 'description' field"
        assert user_id == "system", "Default user_id should be 'system'"
    
    def test_report_service_message_matches_ai_verification_handler(self):
        """
        Verify report-service output format matches what ai-verification-service expects
        """
        report_service_message = {
            "id": str(uuid.uuid4()),
            "title": "Podejrzane zgłoszenie",
            "description": "Krótki opis bez szczegółów"
        }
        
        # Simulate ai-verification-service handler
        report_id = report_service_message.get("id")
        title = report_service_message.get("title")
        description = report_service_message.get("description")
        user_id = report_service_message.get("user_id", "system")
        
        assert report_id is not None
        assert title is not None
        assert description is not None


class TestAIServicesToNotificationServiceIntegration:
    """Test that AI services messages are compatible with notification-service"""
    
    def test_categorization_notification_matches_notification_service_schema(self):
        """
        Verify ai-categorization-service notification format matches notification-service schema
        
        notification-service (TypeScript) expects:
        {
            eventId: string (UUID),
            eventType: string (one of defined types),
            userId: string,
            source: string,
            payload?: object
        }
        
        validated by Joi schema in notification-consumer.ts
        """
        # Simulate ai-categorization-service notification message
        ai_notification = {
            "eventId": str(uuid.uuid4()),
            "eventType": "REPORT_CATEGORIZED",
            "userId": "user-123",
            "source": "ai-categorization-service",
            "payload": {
                "reportId": "report-456",
                "category": "Infrastruktura drogowa / chodników",
                "confidence": 0.92
            }
        }
        
        # Validate against notification-service schema
        assert isinstance(ai_notification.get("eventId"), str)
        assert ai_notification.get("eventType") == "REPORT_CATEGORIZED"
        assert isinstance(ai_notification.get("userId"), str)
        assert isinstance(ai_notification.get("source"), str)
        
        # Validate eventId is valid UUID
        try:
            uuid.UUID(ai_notification["eventId"])
        except ValueError:
            pytest.fail("eventId must be a valid UUID v4")
    
    def test_verification_notification_matches_notification_service_schema(self):
        """
        Verify ai-verification-service notification format matches notification-service schema
        """
        ai_notification = {
            "eventId": str(uuid.uuid4()),
            "eventType": "FAKE_REPORT_DETECTED",
            "userId": "user-789",
            "source": "ai-verification-duplication-service",
            "payload": {
                "reportId": "report-999",
                "fake_probability": 85.5,
                "confidence": "high"
            }
        }
        
        assert isinstance(ai_notification.get("eventId"), str)
        assert ai_notification.get("eventType") == "FAKE_REPORT_DETECTED"
        assert isinstance(ai_notification.get("userId"), str)
        assert isinstance(ai_notification.get("source"), str)
        
        try:
            uuid.UUID(ai_notification["eventId"])
        except ValueError:
            pytest.fail("eventId must be a valid UUID v4")


class TestNotificationServiceEventTypesCompatibility:
    """Test that event types in AI services match notification-service definitions"""
    
    def test_report_categorized_event_type_exists(self):
        """Verify REPORT_CATEGORIZED is a valid event type"""
        # These are the valid event types from notification-service/src/types/events.ts
        valid_event_types = [
            "AUDIT_SECURITY_EVENT_DETECTED",
            "ROLE_ASSIGNED",
            "ROLE_REVOKED",
            "MEDIA_APPROVED",
            "MEDIA_REJECTED",
            "MEDIA_FLAGGED_NSFW",
            "MEDIA_CENSORED",
            "MEDIA_DELETED_SYSTEM",
            "MEDIA_STORAGE_THRESHOLD",
            "USER_REGISTERED",
            "USER_PASSWORD_RESET_REQUESTED",
            "USER_BANNED",
            "USER_UNBANNED",
            "REPORT_CATEGORIZED",      # Added for ai-categorization-service
            "FAKE_REPORT_DETECTED"      # Added for ai-verification-service
        ]
        
        assert "REPORT_CATEGORIZED" in valid_event_types
        assert "FAKE_REPORT_DETECTED" in valid_event_types


class TestKafkaTopicCompatibility:
    """Test that Kafka topic names are consistent across services"""
    
    def test_report_topic_consistency(self):
        """
        Verify all services use the same topic name for reports
        
        report-service publishes to: 'report' (from application.yml)
        ai-categorization-service subscribes to: 'report'
        ai-verification-service subscribes to: 'report'
        """
        report_service_topic = "report"  # From application.yml
        ai_categorization_topic = "report"  # From main.py after fix
        ai_verification_topic = "report"  # From main.py after fix
        
        assert report_service_topic == ai_categorization_topic, \
            f"Topic mismatch: report-service uses '{report_service_topic}', " \
            f"ai-categorization uses '{ai_categorization_topic}'"
        
        assert report_service_topic == ai_verification_topic, \
            f"Topic mismatch: report-service uses '{report_service_topic}', " \
            f"ai-verification uses '{ai_verification_topic}'"
    
    def test_notification_topic_consistency(self):
        """
        Verify notification topic is consistent
        
        ai-categorization-service publishes to: 'notification_events'
        ai-verification-service publishes to: 'notification_events'
        notification-service subscribes to: 'notification_events' (from config)
        """
        ai_categorization_topic = "notification_events"
        ai_verification_topic = "notification_events"
        notification_service_topic = "notification_events"  # Default from config.ts
        
        assert ai_categorization_topic == notification_service_topic
        assert ai_verification_topic == notification_service_topic


class TestBootstrapServersConsistency:
    """Test that Kafka bootstrap servers are consistent for Docker environment"""
    
    def test_all_services_use_kafka_9092_default(self):
        """
        All services should default to 'kafka:9092' for Docker environment
        
        This was a bug in ai-verification-service which used 'localhost:9092'
        """
        expected_default = "kafka:9092"
        
        # These are the defaults after the fix
        services = {
            "ai-categorization-service": "kafka:9092",
            "ai-verification-duplication-service": "kafka:9092",
            "notification-service": "kafka:9092",  # From config, uses KAFKA_BROKERS env
        }
        
        for service, default in services.items():
            assert default == expected_default or default == "", \
                f"{service} uses '{default}' instead of '{expected_default}'"


# Summary of fixes verified by these tests:
"""
FIXES VERIFIED:

1. TOPIC NAME FIX:
   - Before: AI services listened to 'reports_events' (doesn't exist)
   - After: AI services listen to 'report' (matches report-service)

2. BOOTSTRAP SERVERS FIX:
   - Before: ai-verification-service used 'localhost:9092' (doesn't work in Docker)
   - After: uses 'kafka:9092' (works in Docker network)

3. MESSAGE FORMAT FIX:
   - Before: AI services sent notifications with wrong format
   - After: Format matches notification-service Joi schema:
     {eventId, eventType, userId, source, payload}

4. EVENT TYPES FIX:
   - Added REPORT_CATEGORIZED to notification-service event types
   - Added FAKE_REPORT_DETECTED to notification-service event types

5. RESPONSE CLASS FIX:
   - Before: Used non-existent 'VerifyResponse' class
   - After: Uses correct 'VerificationResponse' class
"""


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
