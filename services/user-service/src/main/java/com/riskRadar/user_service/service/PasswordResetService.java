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

        String resetToken = Base64.getEncoder().encodeToString(UUID.randomUUID().toString().getBytes());
        String redisKey = "resetToken:" + resetToken;

        redisService.saveWithTTL(redisKey, email, 900, TimeUnit.SECONDS);

        logger.info("Password reset token generated for email: {}", email);

        // Zwracaj token - będzie używany do wysyłki mailem przez zewnętrzny serwis
        return resetToken;
    }

    public String getEmailByToken(String token) {
        if (token == null) {
            return null;
        }
        String redisKey = "resetToken:" + token;
        return redisService.get(redisKey);
    }

    public void invalidateResetToken(String token) {
        if (token == null) {
            return;
        }
        String redisKey = "resetToken:" + token;
        redisService.delete(redisKey);
        logger.info("Password reset token invalidated");
    }
}