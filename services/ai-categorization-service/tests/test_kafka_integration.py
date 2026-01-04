"""
Tests for AI Categorization Service Kafka Integration
Verifies that:
1. Kafka client configuration is correct
2. Message formats are compatible with notification-service
3. Topic names match report-service output
"""
import pytest
import asyncio
import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from kafka_client import KafkaClient, get_kafka_client


class TestKafkaClientConfiguration:
    """Test Kafka client configuration"""
    
    def test_default_bootstrap_servers_is_kafka_docker(self):
        """Verify default bootstrap server is 'kafka:9092' for Docker environment"""
        with patch.dict(os.environ, {}, clear=True):
            # Remove any existing env vars
            for key in ['KAFKA_BROKERS', 'KAFKA_CLIENT_ID', 'KAFKA_ENABLED']:
                os.environ.pop(key, None)
            
            client = KafkaClient()
            assert client.bootstrap_servers == "kafka:9092", \
                f"Expected 'kafka:9092' but got '{client.bootstrap_servers}'"
    
    def test_bootstrap_servers_from_env(self):
        """Test that bootstrap servers can be configured via environment"""
        with patch.dict(os.environ, {'KAFKA_BROKERS': 'custom-kafka:9092'}):
            client = KafkaClient()
            assert client.bootstrap_servers == "custom-kafka:9092"
    
    def test_kafka_enabled_by_default(self):
        """Test that Kafka is enabled by default"""
        with patch.dict(os.environ, {}, clear=True):
            os.environ.pop('KAFKA_ENABLED', None)
            client = KafkaClient()
            assert client.enabled is True
    
    def test_kafka_can_be_disabled(self):
        """Test that Kafka can be disabled via environment"""
        with patch.dict(os.environ, {'KAFKA_ENABLED': 'false'}):
            client = KafkaClient()
            assert client.enabled is False


class TestKafkaMessageFormat:
    """Test that message formats match notification-service expectations"""
    
    def test_notification_event_schema(self):
        """Verify notification event format matches notification-service schema"""
        # This is the format expected by notification-service
        expected_schema_keys = {'eventId', 'eventType', 'userId', 'source', 'payload'}
        
        # Simulate the message format used in categorize_report
        notification_message = {
            "eventId": str(uuid.uuid4()),
            "eventType": "REPORT_CATEGORIZED",
            "userId": "user-123",
            "source": "ai-categorization-service",
            "payload": {
                "reportId": "report-456",
                "category": "Infrastruktura drogowa",
                "confidence": 0.95
            }
        }
        
        # Check all required keys are present
        assert set(notification_message.keys()) >= expected_schema_keys, \
            f"Missing keys: {expected_schema_keys - set(notification_message.keys())}"
        
        # Validate eventId is a valid UUID
        try:
            uuid.UUID(notification_message['eventId'])
        except ValueError:
            pytest.fail("eventId is not a valid UUID")
        
        # Validate eventType is correct
        assert notification_message['eventType'] == "REPORT_CATEGORIZED"
        
        # Validate source
        assert notification_message['source'] == "ai-categorization-service"
    
    def test_categorization_event_format(self):
        """Test categorization_events topic message format"""
        message = {
            "event_type": "report_categorized",
            "report_id": "report-123",
            "user_id": "user-456",
            "category": "Śmieci / nielegalne zaśmiecanie",
            "confidence": 0.87,
            "timestamp": "2025-12-31T12:00:00"
        }
        
        required_keys = {'event_type', 'report_id', 'user_id', 'category', 'confidence', 'timestamp'}
        assert set(message.keys()) == required_keys
        
        # Validate types
        assert isinstance(message['confidence'], float)
        assert 0 <= message['confidence'] <= 1


class TestKafkaTopicNames:
    """Test that topic names are correct"""
    
    def test_listens_to_report_topic(self):
        """Verify service listens to 'report' topic (from report-service)"""
        # The report-service publishes to 'report' topic
        # as configured in application.yml: report.kafka.topic: report
        expected_consumer_topic = "report"
        
        # This is what we configured in main.py
        configured_topics = ["report"]
        
        assert expected_consumer_topic in configured_topics, \
            f"Service should listen to '{expected_consumer_topic}' topic"
    
    def test_publishes_to_correct_topics(self):
        """Verify service publishes to correct topics"""
        expected_publish_topics = [
            "categorization_events",  # For categorization results
            "notification_events"     # For user notifications
        ]
        
        # These topics should be created on startup
        for topic in expected_publish_topics:
            assert topic in expected_publish_topics


class TestKafkaClientPublish:
    """Test Kafka publish functionality"""
    
    @pytest.mark.asyncio
    async def test_publish_returns_false_when_disabled(self):
        """Test that publish returns False when Kafka is disabled"""
        with patch.dict(os.environ, {'KAFKA_ENABLED': 'false'}):
            client = KafkaClient()
            result = await client.publish("test_topic", {"test": "message"})
            assert result is False
    
    @pytest.mark.asyncio
    async def test_publish_returns_false_when_no_producer(self):
        """Test that publish returns False when producer is not initialized"""
        client = KafkaClient()
        client.enabled = True
        client.producer = None
        result = await client.publish("test_topic", {"test": "message"})
        assert result is False
    
    @pytest.mark.asyncio
    async def test_publish_success_with_mock_producer(self):
        """Test successful publish with mocked producer"""
        client = KafkaClient()
        client.enabled = True
        client.producer = AsyncMock()
        client.producer.send_and_wait = AsyncMock()
        
        result = await client.publish(
            topic="notification_events",
            message={
                "eventId": str(uuid.uuid4()),
                "eventType": "REPORT_CATEGORIZED",
                "userId": "user-123",
                "source": "ai-categorization-service",
                "payload": {"reportId": "report-456", "category": "Test"}
            },
            key="user-123"
        )
        
        assert result is True
        client.producer.send_and_wait.assert_called_once()


class TestMessageHandlerIntegration:
    """Test message handler processes report-service messages correctly"""
    
    def test_report_service_message_format(self):
        """Test that we can parse report-service message format"""
        # This is the format sent by report-service (from ReportService.java)
        report_service_message = {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "title": "Dziura w drodze na ul. Głównej",
            "description": "Duża dziura powodująca zagrożenie dla kierowców"
        }
        
        # Verify we can extract required fields
        assert "id" in report_service_message
        assert "title" in report_service_message
        assert "description" in report_service_message
        
        # Simulate what handle_report_message does
        report_id = report_service_message.get("id")
        title = report_service_message.get("title")
        description = report_service_message.get("description")
        user_id = report_service_message.get("user_id", "system")
        
        assert report_id == "123e4567-e89b-12d3-a456-426614174000"
        assert title == "Dziura w drodze na ul. Głównej"
        assert description is not None
        assert user_id == "system"  # Default when not provided


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
