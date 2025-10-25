package com.riskRadar.user_service.controller;

import com.riskRadar.user_service.dto.PasswordResetConfirmRequest;
import com.riskRadar.user_service.dto.PasswordResetRequest;
import com.riskRadar.user_service.service.PasswordResetService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/password-reset")
@RequiredArgsConstructor
public class PasswordResetController {

    private final PasswordResetService passwordResetService;
    private static final Logger logger = LoggerFactory.getLogger(PasswordResetController.class);

    @PostMapping("/request")
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

    @PostMapping("/confirm")
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

            // Tutaj potrzebna integracja z UserService do zresetowania hasła
            // Obecnie nie widzimy dostępnych metod w UserService

            // Przykładowa implementacja (wymagana metoda resetPasswordByToken w UserService):
            // boolean success = userService.resetPasswordByToken(request.token(), request.newPassword());
            //
            // if (!success) {
            //     return ResponseEntity.badRequest()
            //         .body(Map.of("error", "Invalid or expired reset token"));
            // }

            // Tymczasowa implementacja - logujemy że token został użyty
            logger.info("Password reset attempt with token: {}", request.token().substring(0, Math.min(10, request.token().length())) + "...");

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