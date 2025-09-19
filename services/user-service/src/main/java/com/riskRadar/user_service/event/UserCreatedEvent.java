package com.riskRadar.user_service.event;

import java.util.UUID;

public record UserCreatedEvent(UUID userId) {
}