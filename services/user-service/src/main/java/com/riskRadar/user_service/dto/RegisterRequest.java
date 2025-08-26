package com.riskRadar.user_service.dto;


import jakarta.validation.constraints.NotBlank;

public record RegisterRequest(@NotBlank(message = "Username cannot be blank") String username,
                              @NotBlank(message = "Password cannot be blank") String password,
                              @NotBlank(message = "Email cannot be blank") String email) {
}
