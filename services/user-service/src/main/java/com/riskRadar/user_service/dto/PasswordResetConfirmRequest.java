package com.riskRadar.user_service.dto;

import jakarta.validation.constraints.NotBlank;

public record PasswordResetConfirmRequest(@NotBlank String token,@NotBlank String newPassword) {
}
