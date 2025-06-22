package com.riskRadar.user_service.service;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.TimeUnit;


@Service
public class RedisService {
    private final RedisTemplate<String, String> redisTemplate;

    public RedisService(RedisTemplate<String, String> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public void saveTokenToBlacklist(String token) {
        redisTemplate.opsForValue().set("token:" + token, "blacklisted", Duration.ofMinutes(15));
    }

    public void banUser(String username, String reason) {
        revokeRefreshToken(username);
        redisTemplate.opsForValue().set("user:" + username, reason, Duration.ofHours(999999));
    }

    public void storeRefreshToken(String username, String refreshToken) {
        redisTemplate.opsForValue().set("refreshToken:" + username, refreshToken, 7, TimeUnit.DAYS);

    }

    public boolean isRefreshTokenValid(String username, String refreshToken) {
        String redisKey = "refreshToken:" + username;
        String value = redisTemplate.opsForValue().get(redisKey);
        return refreshToken.equals(value);
    }

    public void revokeRefreshToken(String username) {
        redisTemplate.delete("refreshToken:" + username);
    }

    public boolean isTokenValid(String token) {
        String redisKey = "token:" + token;
        String value = redisTemplate.opsForValue().get(redisKey);
        return !"blacklisted".equals(value);
    }

    public boolean isUserBanned(String username) {
        String redisKey = "user:" + username;
        String value = redisTemplate.opsForValue().get(redisKey);
        return "blacklisted".equals(value);
    }

}
