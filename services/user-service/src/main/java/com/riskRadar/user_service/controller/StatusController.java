package com.riskRadar.user_service.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.management.ManagementFactory;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/status")
public class StatusController {
    private static final String APP_NAME = "user-service";

    @GetMapping
    public ResponseEntity<Map<String, Object>> status() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "OK");
        response.put("timestamp", Instant.now().toString());
        response.put("appName", APP_NAME);
        response.put("uptimeMs", ManagementFactory.getRuntimeMXBean().getUptime());
        return ResponseEntity.ok(response);
    }

}
