"""
Kafka Client for AI Verification-Duplication Service

Provides async Kafka producer/consumer for event-driven communication:
- Publishes verification results to 'verification_events' topic
- Consumes report events from 'report' topic for auto-verification
- Sends notifications via 'notification_events' topic
"""

import asyncio
import json
import logging
import os
import time
from typing import Any, Callable, Dict, List, Optional

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from kafka import KafkaAdminClient
from kafka.admin import NewTopic
from kafka.errors import TopicAlreadyExistsError

logger = logging.getLogger(__name__)


class KafkaClient:
    """Async Kafka client with producer and consumer support."""

    def __init__(self):
        self.bootstrap_servers = os.getenv("KAFKA_BROKERS", "kafka:9092")
        self.client_id = os.getenv(
            "KAFKA_CLIENT_ID", "ai-verification-duplication-service"
        )
        self.producer: Optional[AIOKafkaProducer] = None
        self.consumer: Optional[AIOKafkaConsumer] = None
        self.enabled = os.getenv("KAFKA_ENABLED", "true").lower() == "true"

    def create_topics(self, topics: List[Dict[str, Any]], max_retries: int = 5) -> bool:
        """
        Create Kafka topics if they don't exist (with retry logic).

        Args:
            topics: List of {"name": str, "partitions": int, "replication_factor": int}
            max_retries: Max connection attempts with exponential backoff
        """
        if not self.enabled:
            logger.info("Kafka disabled, skipping topic creation")
            return False

        for attempt in range(max_retries):
            try:
                admin_client = KafkaAdminClient(
                    bootstrap_servers=self.bootstrap_servers,
                    client_id="verification-service-admin",
                )

                new_topics = [
                    NewTopic(
                        name=topic["name"],
                        num_partitions=topic.get("partitions", 2),
                        replication_factor=topic.get("replication_factor", 1),
                    )
                    for topic in topics
                ]

                try:
                    admin_client.create_topics(
                        new_topics=new_topics, validate_only=False
                    )
                    logger.info(f"Created topics: {[t['name'] for t in topics]}")
                except TopicAlreadyExistsError:
                    logger.info(f"Topics already exist: {[t['name'] for t in topics]}")

                admin_client.close()
                return True

            except Exception as e:
                logger.warning(
                    f"Attempt {attempt + 1}/{max_retries} failed to create topics: {e}"
                )
                if attempt < max_retries - 1:
                    time.sleep(2**attempt)  # Exponential backoff
                else:
                    logger.error(
                        f"Failed to create topics after {max_retries} attempts"
                    )
                    return False

        return False

    async def start_producer(self) -> None:
        """Initialize and start async Kafka producer."""
        if not self.enabled:
            logger.info("Kafka disabled")
            return

        try:
            self.producer = AIOKafkaProducer(
                bootstrap_servers=self.bootstrap_servers,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            )
            await self.producer.start()
            logger.info(f"Kafka producer connected to {self.bootstrap_servers}")
        except Exception as e:
            logger.error(f"Failed to start Kafka producer: {e}")
            self.enabled = False

    async def stop_producer(self) -> None:
        """Stop Kafka producer gracefully."""
        if self.producer:
            await self.producer.stop()
            logger.info("Kafka producer stopped")

    async def publish(
        self, topic: str, message: Dict, key: Optional[str] = None
    ) -> None:
        """Publish JSON message to Kafka topic."""
        if not self.enabled or not self.producer:
            logger.warning(f"Kafka unavailable, skipping publish to {topic}")
            return

        try:
            key_bytes = key.encode("utf-8") if key else None
            await self.producer.send_and_wait(topic, value=message, key=key_bytes)
            logger.info(f"Published message to {topic}")
        except Exception as e:
            logger.error(f"Failed to publish to {topic}: {e}")

    async def start_consumer(
        self, topics: List[str], group_id: str, handler: Callable
    ) -> None:
        """Start consuming messages from specified topics."""
        if not self.enabled:
            return

        try:
            self.consumer = AIOKafkaConsumer(
                *topics,
                bootstrap_servers=self.bootstrap_servers,
                group_id=group_id,
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                auto_offset_reset="earliest",
                enable_auto_commit=True,
            )
            await self.consumer.start()
            logger.info(f"Kafka consumer started for topics: {topics}")

            # Run message processing in background task
            asyncio.create_task(self._consume_messages(handler))

        except Exception as e:
            logger.error(f"Failed to start Kafka consumer: {e}")
            self.enabled = False

    async def _consume_messages(self, handler: Callable) -> None:
        """Internal loop to process incoming messages."""
        if self.consumer is None:
            return

        try:
            async for message in self.consumer:
                try:
                    await handler(
                        message.value, message.topic, message.partition, message.offset
                    )
                except Exception as e:
                    logger.error(f"Error processing message: {e}")
        except Exception as e:
            logger.error(f"Consumer error: {e}")

    async def stop_consumer(self) -> None:
        """Stop Kafka consumer gracefully."""
        if self.consumer:
            await self.consumer.stop()
            logger.info("Kafka consumer stopped")


# =============================================================================
# Singleton Instance
# =============================================================================

_kafka_client: Optional[KafkaClient] = None


def get_kafka_client() -> KafkaClient:
    """Get singleton Kafka client instance (lazy initialization)."""
    global _kafka_client
    if _kafka_client is None:
        _kafka_client = KafkaClient()
    return _kafka_client
