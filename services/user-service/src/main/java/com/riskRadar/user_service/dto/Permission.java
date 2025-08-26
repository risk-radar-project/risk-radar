package com.riskRadar.user_service.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.UUID;

public record Permission(UUID id, String name, String description, String resource, String action,
                         @JsonProperty("created_at") Instant createdAt) {
}
