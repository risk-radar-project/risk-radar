package com.riskRadar.user_service.security;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.data.redis.core.RedisTemplate;

import java.time.Duration;


@Service
public class TokenRedisService {
    private final RedisTemplate<String, String> redisTemplate;

    public TokenRedisService(@Qualifier("redisTemplate") RedisTemplate<String, String> redisTemplate){
        this.redisTemplate = redisTemplate;
    }

    public void saveToken(String token){
        redisTemplate.opsForValue().set(token, "valid", Duration.ofHours(24));
    }

    public boolean isTokenValid(String token){
        return redisTemplate.hasKey(token);
    }
    public void removeToken(String token){
        redisTemplate.delete(token);
    }

}
