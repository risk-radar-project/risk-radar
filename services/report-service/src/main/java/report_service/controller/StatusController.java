package report_service.controller;

import lombok.RequiredArgsConstructor;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.ListTopicsResult;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.management.ManagementFactory;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.ExecutionException;

@RestController
@RequiredArgsConstructor
@RequestMapping("/status")
public class StatusController {

    private static final String APP_NAME = "report-service";

    private final JdbcTemplate jdbcTemplate;

    @Value("${spring.kafka.bootstrap-servers}")
    private String kafkaBootstrapServers;


    @GetMapping
    public ResponseEntity<Map<String, Object>> status() {
        Map<String, Object> response = new HashMap<>();
        boolean dbUp = false;
        boolean kafkaUp = false;

        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            dbUp = true;
        } catch (Exception e) {

        }

        Properties props = new Properties();
        props.put("bootstrap.servers", kafkaBootstrapServers);
        try (AdminClient client = AdminClient.create(props)) {
            ListTopicsResult topics = client.listTopics();
            topics.names().get();
            kafkaUp = true;
        } catch (InterruptedException | ExecutionException ignored) {
        }

        response.put("status", dbUp && kafkaUp ? "UP" : "DOWN");
        response.put("database", dbUp ? "UP" : "DOWN");
        response.put("kafka", kafkaUp ? "UP" : "DOWN");
        response.put("timestamp", Instant.now().toString());
        response.put("appName", APP_NAME);
        response.put("uptimeMs", ManagementFactory.getRuntimeMXBean().getUptime());

        return ResponseEntity.ok(response);
    }
}
