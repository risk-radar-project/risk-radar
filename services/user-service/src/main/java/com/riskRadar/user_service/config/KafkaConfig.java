package com.riskRadar.user_service.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class KafkaConfig {

    @Value("${spring.kafka.bootstrap-servers:localhost:9092}")
    private String bootstrapServers;

    @Value("${audit.kafka.topic:audit-log}")
    private String auditTopic;

    @Value("${spring.kafka.client-id:user-service}")
    private String clientId;

    public String getBootstrapServers() {
        return bootstrapServers;
    }

    public String getAuditTopic() {
        return auditTopic;
    }

    public String getClientId() {
        return clientId;
    }
}

