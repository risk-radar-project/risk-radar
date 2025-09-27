package com.riskRadar.user_service.dto;

public record PasswordResetConfirmRequest(String token, String newPassword) {
}
