package com.riskRadar.user_service.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.UUID;

public record Role(UUID id, String name, String description, @JsonProperty("created_at") Instant createdDate,
                   @JsonProperty("updated_at") Instant updatedDate) {
    public Role(UUID id, String user) {
        this(id, user, null, null, null);
    }
}
