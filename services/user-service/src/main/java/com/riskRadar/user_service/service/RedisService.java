package com.riskRadar.user_service.service;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.TimeUnit;


@Service
public class RedisService {
    private final RedisTemplate<String, String> redisTemplate;
    private static final long PERMANENT_BAN_TTL = 999999;
    private final JwtService jwtService;

    public RedisService(RedisTemplate<String, String> redisTemplate, JwtService jwtService) {
        this.redisTemplate = redisTemplate;
        this.jwtService = jwtService;
    }

    public void saveTokenToBlacklist(String token) {
        long ttl = jwtService.extractAccessExpiration(token).getTime() - System.currentTimeMillis();
        redisTemplate.opsForValue().set("accessToken:" + token, "blacklisted", Duration.ofMillis(ttl));
    }

    public void banUser(String username, String reason) {
        revokeRefreshToken(username);
        redisTemplate.opsForValue().set("bannedUser:" + username, reason, Duration.ofHours(PERMANENT_BAN_TTL));
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
        String redisKey = "accessToken:" + token;
        String value = redisTemplate.opsForValue().get(redisKey);
        return !"blacklisted".equals(value);
    }

    public boolean isUserBanned(String username) {
        String redisKey = "bannedUser:" + username;
        String value = redisTemplate.opsForValue().get(redisKey);
        return value != null;
    }

}
