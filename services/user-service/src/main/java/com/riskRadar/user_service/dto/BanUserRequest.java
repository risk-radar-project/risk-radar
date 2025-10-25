package com.riskRadar.user_service.dto;


import jakarta.validation.constraints.NotBlank;

public record BanUserRequest(@NotBlank String username,
                             @NotBlank String reason) {
}
