"""
Kafka Client for AI Assistant Service
Handles Kafka producer/consumer operations
"""
import asyncio
import json
import logging
from typing import Optional, Dict, Any, Callable, List
from aiokafka import AIOKafkaProducer, AIOKafkaConsumer
from aiokafka.errors import KafkaError
from kafka import KafkaAdminClient
from kafka.admin import NewTopic
from kafka.errors import TopicAlreadyExistsError
import os
import time

logger = logging.getLogger(__name__)

class KafkaClient:
    """Kafka client for publishing and consuming messages"""
    
    def __init__(self):
        self.bootstrap_servers = os.getenv("KAFKA_BROKERS", "kafka:9092")
        self.client_id = os.getenv("KAFKA_CLIENT_ID", "ai-assistant-service")
        self.producer: Optional[AIOKafkaProducer] = None
        self.consumer: Optional[AIOKafkaConsumer] = None
        self.enabled = os.getenv("KAFKA_ENABLED", "true").lower() == "true"
        
    def create_topics(self, topics: List[Dict[str, Any]], max_retries: int = 5) -> bool:
        """Create Kafka topics if they don't exist"""
        if not self.enabled:
            logger.info("Kafka is disabled, skipping topic creation")
            return False
        
        for attempt in range(max_retries):
            try:
                admin_client = KafkaAdminClient(
                    bootstrap_servers=self.bootstrap_servers,
                    client_id=f"{self.client_id}-admin"
                )
                
                new_topics = [
                    NewTopic(
                        name=topic['name'],
                        num_partitions=topic.get('partitions', 2),
                        replication_factor=topic.get('replication_factor', 1)
                    )
                    for topic in topics
                ]
                
                try:
                    admin_client.create_topics(new_topics=new_topics, validate_only=False)
                    logger.info(f"Created topics: {[t['name'] for t in topics]}")
                except TopicAlreadyExistsError:
                    logger.info(f"Topics already exist: {[t['name'] for t in topics]}")
                
                admin_client.close()
                return True
                
            except Exception as e:
                logger.warning(f"Attempt {attempt + 1}/{max_retries} failed to create topics: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff
                else:
                    logger.error(f"Failed to create topics after {max_retries} attempts")
                    return False
        
        return False
    
    async def start_producer(self):
        """Initialize and start Kafka producer"""
        if not self.enabled:
            logger.info("Kafka producer is disabled")
            return
            
        try:
            self.producer = AIOKafkaProducer(
                bootstrap_servers=self.bootstrap_servers,
                client_id=self.client_id,
                value_serializer=lambda v: json.dumps(v).encode('utf-8')
            )
            await self.producer.start()
            logger.info(f"Kafka producer started: {self.bootstrap_servers}")
        except KafkaError as e:
            logger.error(f"Failed to start Kafka producer: {e}")
            raise
    
    async def stop_producer(self):
        """Stop Kafka producer"""
        if self.producer:
            await self.producer.stop()
            logger.info("Kafka producer stopped")
    
    async def publish(self, topic: str, message: Dict[str, Any], key: Optional[str] = None) -> bool:
        """
        Publish message to Kafka topic
        
        Args:
            topic: Kafka topic name
            message: Message payload (dict)
            key: Optional message key for partitioning
            
        Returns:
            bool: True if successful, False otherwise
        """
        if not self.enabled or not self.producer:
            logger.warning("Kafka producer not available")
            return False
            
        try:
            key_bytes = key.encode('utf-8') if key else None
            await self.producer.send_and_wait(topic, value=message, key=key_bytes)
            logger.debug(f"Published message to topic {topic}")
            return True
        except Exception as e:
            logger.error(f"Failed to publish to Kafka topic {topic}: {e}")
            return False
    
    async def start_consumer(self, topics: list[str], group_id: str, handler: Callable):
        """
        Start Kafka consumer
        
        Args:
            topics: List of topics to subscribe to
            group_id: Consumer group ID
            handler: Async function to handle messages
        """
        if not self.enabled:
            logger.info("Kafka consumer is disabled")
            return
            
        try:
            self.consumer = AIOKafkaConsumer(
                *topics,
                bootstrap_servers=self.bootstrap_servers,
                group_id=group_id,
                client_id=f"{self.client_id}-consumer",
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                auto_offset_reset='latest',
                enable_auto_commit=True
            )
            await self.consumer.start()
            logger.info(f"Kafka consumer started for topics: {topics}")
            
            # Start consuming messages
            asyncio.create_task(self._consume_messages(handler))
        except KafkaError as e:
            logger.error(f"Failed to start Kafka consumer: {e}")
            raise
    
    async def _consume_messages(self, handler: Callable):
        """Internal method to consume messages"""
        try:
            async for message in self.consumer:
                try:
                    await handler(message.value, message.topic, message.partition, message.offset)
                except Exception as e:
                    logger.error(f"Error handling Kafka message: {e}")
        except Exception as e:
            logger.error(f"Kafka consumer error: {e}")
    
    async def stop_consumer(self):
        """Stop Kafka consumer"""
        if self.consumer:
            await self.consumer.stop()
            logger.info("Kafka consumer stopped")

# Global instance
_kafka_client: Optional[KafkaClient] = None

def get_kafka_client() -> KafkaClient:
    """Get global Kafka client instance"""
    global _kafka_client
    if _kafka_client is None:
        _kafka_client = KafkaClient()
    return _kafka_client
