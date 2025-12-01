package report_service.config;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
@Getter
public class KafkaConfig {

    @Value("${spring.kafka.bootstrap-servers:localhost:9092}")
    private String bootstrapServers;

    @Value("${audit.kafka.topic:audit-log}")
    private String topic;

    @Value("${spring.kafka.client-id:report-service}")
    private String clientId;

}

