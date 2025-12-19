package com.riskRadar.user_service.controller;

import com.riskRadar.user_service.dto.PasswordResetConfirmRequest;
import com.riskRadar.user_service.dto.PasswordResetRequest;
import com.riskRadar.user_service.service.PasswordResetService;
import com.riskRadar.user_service.service.UserService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequiredArgsConstructor
public class PasswordResetController {

    private final PasswordResetService passwordResetService;
    private final UserService userService;
    private static final Logger logger = LoggerFactory.getLogger(PasswordResetController.class);

    @PostMapping("/forgot-password")
    public ResponseEntity<?> requestReset(@RequestBody PasswordResetRequest request) {
        try {
            if (request.email() == null || request.email().trim().isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Email is required"));
            }

            // Generuj token ale nie zwracaj go bezpośrednio - luka bezpieczeństwa
            String token = passwordResetService.generatePasswordResetToken(request.email());

            if (token == null) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "Failed to generate reset token"));
            }

            // TODO: Integracja z zewnętrznym serwisem mailowym
            // externalEmailService.sendPasswordResetEmail(request.email(), token);

            logger.info("Password reset token generated for email: {}", request.email());

            // Bezpieczna odpowiedź - nie ujawniamy czy email istnieje
            return ResponseEntity.ok(Map.of(
                    "message", "If the email address exists in our system, password reset instructions have been sent",
                    "status", "success"
            ));

        } catch (Exception e) {
            logger.error("Error processing password reset request for email: {}", request.email(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "An error occurred processing your request"));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> confirmReset(@RequestBody PasswordResetConfirmRequest request) {
        try {
            if (request.token() == null || request.token().trim().isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Reset token is required"));
            }

            if (request.newPassword() == null || request.newPassword().length() < 6) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "New password must be at least 6 characters long"));
            }

            String email = passwordResetService.getEmailByToken(request.token());
            if (email == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Invalid or expired reset token"));
            }

            userService.updatePassword(email, request.newPassword());
            passwordResetService.invalidateResetToken(request.token());

            logger.info("Password successfully reset for email: {}", email);

            return ResponseEntity.ok(Map.of(
                    "message", "Password successfully reset",
                    "status", "success"
            ));

        } catch (Exception e) {
            logger.error("Error processing password reset confirmation", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "An error occurred resetting your password"));
        }
    }
}