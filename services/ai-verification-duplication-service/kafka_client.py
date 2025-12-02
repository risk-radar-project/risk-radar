"""
Kafka Client for AI Verification-Duplication Service
Handles async message publishing and consumption
"""
from aiokafka import AIOKafkaProducer, AIOKafkaConsumer
from typing import Dict, Optional, Callable
import json
import logging
import asyncio
import os

logger = logging.getLogger(__name__)

class KafkaClient:
    def __init__(self):
        self.bootstrap_servers = os.getenv("KAFKA_BROKERS", "localhost:9092")
        self.producer: Optional[AIOKafkaProducer] = None
        self.consumer: Optional[AIOKafkaConsumer] = None
        self.enabled = os.getenv("KAFKA_ENABLED", "true").lower() == "true"
        
    async def start_producer(self):
        """Initialize Kafka producer"""
        if not self.enabled:
            logger.info("Kafka is disabled")
            return
            
        try:
            self.producer = AIOKafkaProducer(
                bootstrap_servers=self.bootstrap_servers,
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                acks='all',
                enable_idempotence=True,
                retry_backoff_ms=100,
                max_in_flight_requests_per_connection=5
            )
            await self.producer.start()
            logger.info(f"Kafka producer connected to {self.bootstrap_servers}")
        except Exception as e:
            logger.error(f"Failed to start Kafka producer: {e}")
            self.enabled = False
            
    async def stop_producer(self):
        """Stop Kafka producer"""
        if self.producer:
            await self.producer.stop()
            logger.info("Kafka producer stopped")
            
    async def publish(self, topic: str, message: Dict, key: Optional[str] = None):
        """Publish message to Kafka topic"""
        if not self.enabled or not self.producer:
            logger.warning(f"Kafka not available, skipping publish to {topic}")
            return
            
        try:
            key_bytes = key.encode('utf-8') if key else None
            await self.producer.send_and_wait(
                topic,
                value=message,
                key=key_bytes
            )
            logger.info(f"Published message to {topic}")
        except Exception as e:
            logger.error(f"Failed to publish to {topic}: {e}")
            
    async def start_consumer(
        self,
        topics: list,
        group_id: str,
        handler: Callable
    ):
        """Start consuming messages from topics"""
        if not self.enabled:
            return
            
        try:
            self.consumer = AIOKafkaConsumer(
                *topics,
                bootstrap_servers=self.bootstrap_servers,
                group_id=group_id,
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                auto_offset_reset='earliest',
                enable_auto_commit=True
            )
            await self.consumer.start()
            logger.info(f"Kafka consumer started for topics: {topics}")
            
            # Start consuming in background
            asyncio.create_task(self._consume_messages(handler))
            
        except Exception as e:
            logger.error(f"Failed to start Kafka consumer: {e}")
            self.enabled = False
            
    async def _consume_messages(self, handler: Callable):
        """Internal method to consume messages"""
        try:
            async for message in self.consumer:
                try:
                    await handler(message.value)
                except Exception as e:
                    logger.error(f"Error processing message: {e}")
        except Exception as e:
            logger.error(f"Consumer error: {e}")
            
    async def stop_consumer(self):
        """Stop Kafka consumer"""
        if self.consumer:
            await self.consumer.stop()
            logger.info("Kafka consumer stopped")

# Singleton instance
_kafka_client = None

def get_kafka_client() -> KafkaClient:
    """Get singleton Kafka client instance"""
    global _kafka_client
    if _kafka_client is None:
        _kafka_client = KafkaClient()
    return _kafka_client
