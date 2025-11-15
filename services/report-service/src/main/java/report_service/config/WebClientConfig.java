package report_service.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class WebClientConfig {

    @Value("${audit.service.url:http://audit-log-service:8080}")
    private String auditServiceUrl;

    @Bean
    public WebClient auditWebClient() {
        return WebClient.builder()
                .baseUrl(auditServiceUrl)
                .build();
    }
}
