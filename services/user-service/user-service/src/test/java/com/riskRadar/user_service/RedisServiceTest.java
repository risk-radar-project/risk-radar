package com.riskRadar.user_service;

import com.riskRadar.user_service.service.RedisService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.*;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RedisServiceTest {

    @Mock
    private RedisTemplate<String, String> redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @InjectMocks
    private RedisService redisService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
    }

    @Test
    void testSaveTokenToBlacklist() {
        String token = "sampleToken";
        redisService.saveTokenToBlacklist(token);
        verify(valueOperations).set(eq("accessToken:" + token), eq("blacklisted"), eq(Duration.ofMinutes(15)));
    }

    @Test
    void testStoreRefreshToken() {
        String username = "testuser";
        String refreshToken = "refreshToken";
        redisService.storeRefreshToken(username, refreshToken);
        verify(valueOperations).set(eq("refreshToken:" + username), eq(refreshToken), eq(7L), eq(TimeUnit.DAYS));
    }

    @Test
    void testIsRefreshTokenValid_True() {
        String username = "testuser";
        String refreshToken = "refreshToken";
        when(valueOperations.get("refreshToken:" + username)).thenReturn(refreshToken);
        assertTrue(redisService.isRefreshTokenValid(username, refreshToken));
    }

    @Test
    void testIsRefreshTokenValid_False() {
        String username = "testuser";
        String refreshToken = "refreshToken";
        when(valueOperations.get("refreshToken:" + username)).thenReturn("otherToken");
        assertFalse(redisService.isRefreshTokenValid(username, refreshToken));
    }

    @Test
    void testRevokeRefreshToken() {
        String username = "testuser";
        redisService.revokeRefreshToken(username);
        verify(redisTemplate).delete("refreshToken:" + username);
    }

    @Test
    void testIsTokenValid_Blacklisted() {
        String token = "sampleToken";
        when(valueOperations.get("accessToken:" + token)).thenReturn("blacklisted");
        assertFalse(redisService.isTokenValid(token));
    }

    @Test
    void testIsTokenValid_NotBlacklisted() {
        String token = "sampleToken";
        when(valueOperations.get("accessToken:" + token)).thenReturn(null);
        assertTrue(redisService.isTokenValid(token));
    }
    @Test
    void testIsRefreshTokenValid_NullStoredValue() {
        String username = "testuser";
        String refreshToken = "refreshToken";
        when(valueOperations.get("refreshToken:" + username)).thenReturn(null);
        assertFalse(redisService.isRefreshTokenValid(username, refreshToken));
    }

    @Test
    void testBanUser() {
        String username = "testuser";
        String reason = "spamming";
        redisService.banUser(username, reason);
        verify(redisTemplate).delete("refreshToken:" + username);
        verify(valueOperations).set(eq("user:" + username), eq(reason), eq(Duration.ofHours(999999)));
    }

    @Test
    void testIsUserBanned_Blacklisted() {
        String username = "testuser";
        when(redisTemplate.hasKey("user:" + username)).thenReturn(false);
        assertFalse(redisService.isUserBanned(username));
    }

    @Test
    void testIsUserBanned_NotBlacklisted() {
        String username = "testuser";
        when(valueOperations.get("user:" + username)).thenReturn(null);
        assertFalse(redisService.isUserBanned(username));
    }
}
