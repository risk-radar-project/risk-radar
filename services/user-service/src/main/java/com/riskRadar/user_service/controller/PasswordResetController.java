package com.riskRadar.user_service.controller;

import com.riskRadar.user_service.dto.PasswordResetConfirmRequest;
import com.riskRadar.user_service.dto.PasswordResetRequest;
import com.riskRadar.user_service.service.PasswordResetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/password-reset")
@RequiredArgsConstructor
public class PasswordResetController {

    private final PasswordResetService passwordResetService;

    @PostMapping("/request")
    public ResponseEntity<String> requestReset(@RequestBody PasswordResetRequest request) {
        String token = passwordResetService.createResetToken(request.email());
        return ResponseEntity.ok(token); // for now we just return token
    }

    @PostMapping("/confirm")
    public ResponseEntity<String> confirmReset(@RequestBody PasswordResetConfirmRequest request) {
        passwordResetService.resetPassword(request.token(), request.newPassword());
        return ResponseEntity.ok("Password successfully reset");
    }
}
