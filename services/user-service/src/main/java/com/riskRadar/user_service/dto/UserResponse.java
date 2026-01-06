package com.riskRadar.user_service.dto;

import java.time.Instant;
import java.util.UUID;
import java.util.List;

public record UserResponse(
        UUID id,
        String username,
        String email,
        boolean isBanned,
        Instant createdAt,
        List<String> roles) {
}
