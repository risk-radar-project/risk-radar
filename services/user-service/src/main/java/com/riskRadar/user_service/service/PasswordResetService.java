package com.riskRadar.user_service.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Base64;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
public class PasswordResetService {

    private final RedisService redisService;
    private static final Logger logger = LoggerFactory.getLogger(PasswordResetService.class);

    public PasswordResetService(RedisService redisService) {
        this.redisService = redisService;
    }

    public String generatePasswordResetToken(String email) {
        if (email == null) {
            logger.warn("Cannot generate token for null email");
            return null;
        }

        String redisKey = "resetToken:" + email;
        redisService.delete(redisKey);

        String resetToken = Base64.getEncoder().encodeToString(UUID.randomUUID().toString().getBytes());

        redisService.saveWithTTL(redisKey, resetToken, 900, TimeUnit.SECONDS);

        logger.info("Password reset token generated for email: {}", email);

        // Zwracaj token - będzie używany do wysyłki mailem przez zewnętrzny serwis
        return resetToken;
    }

    public boolean validateResetToken(String email, String token) {
        if (token == null || email == null) {
            logger.warn("Validation failed - null token or email");
            return false;
        }

        String redisKey = "resetToken:" + email;
        String storedToken = redisService.get(redisKey);

        if (storedToken == null) {
            logger.warn("No reset token found for email: {}", email);
            return false;
        }

        boolean isValid = storedToken.equals(token);
        logger.debug("Token validation result for email {}: {}", email, isValid);

        return isValid;
    }

    public void invalidateResetToken(String email) {
        if (email == null) {
            logger.warn("Cannot invalidate token - null email");
            return;
        }

        String redisKey = "resetToken:" + email;
        redisService.delete(redisKey);
        logger.info("Password reset token invalidated for email: {}", email);
    }
}