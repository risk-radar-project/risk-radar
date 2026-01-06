package com.riskRadar.user_service.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class WebClientConfig {

    @Value("${audit.service.url:http://audit-log-service:8080}")
    private String auditServiceUrl;

    @Value("${notification.service.url:http://notification-service:8086}")
    private String notificationServiceUrl;

    @Bean("auditWebClient")
    public WebClient auditWebClient() {
        return WebClient.builder()
                .baseUrl(auditServiceUrl)
                .build();
    }

    @Bean("notificationWebClient")
    public WebClient notificationWebClient() {
        return WebClient.builder()
                .baseUrl(notificationServiceUrl)
                .build();
    }
}
