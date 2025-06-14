package com.riskRadar.user_service.service;

import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.stereotype.Service;
import org.springframework.data.redis.core.RedisTemplate;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.NoSuchElementException;


@Service
public class TokenRedisService {
    private final RedisTemplate<String, String> redisTemplate;

    public TokenRedisService(RedisTemplate<String, String> redisTemplate){
            this.redisTemplate = redisTemplate;
        }

    public List<String> getAllValidTokens() {
        List<String> validTokens = new ArrayList<>();
        ScanOptions options = ScanOptions.scanOptions().match("token:*").count(1000).build();

        redisTemplate.execute((RedisCallback<Void>) connection -> {
            try (Cursor<byte[]> cursor = connection.scan(options)) {
                while (cursor.hasNext()) {
                    String key = new String(cursor.next());
                    String status = redisTemplate.opsForValue().get(key);
                    if ("valid".equals(status)) {
                        validTokens.add(key.substring("token:".length()));
                    }
                }
            } catch (NoSuchElementException e) {
                e.printStackTrace();
            }
            return null;
        });

        return validTokens;
    }



    public String getTokenByUsername(String username){
        return redisTemplate.opsForValue().get("user:" + username);
    }
    public void saveToken(String token, String username){
        redisTemplate.opsForValue().set("token:" + token, "valid", Duration.ofHours(24));
        redisTemplate.opsForValue().set("user:" + username, token, Duration.ofHours(24));
    }
    public void blacklistToken(String token){
        String redisKey = "token:" + token;
        redisTemplate.opsForValue().set(redisKey, "invalid", Duration.ofHours(24));
    }

    public boolean isTokenValid(String token){
        String redisKey = "token:" + token;
        String value = redisTemplate.opsForValue().get(redisKey);
        return "valid".equals(value);
    }
    public void removeToken(String token){
        redisTemplate.delete(token);
    }

}
