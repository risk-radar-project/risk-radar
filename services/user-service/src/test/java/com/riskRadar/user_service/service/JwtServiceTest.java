package com.riskRadar.user_service.service;

import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private JwtService jwtService;

    @BeforeEach
    void setUp() throws Exception {
        jwtService = new JwtService();
        Field accessField = JwtService.class.getDeclaredField("accessSecretEncoded");
        accessField.setAccessible(true);
        accessField.set(jwtService, "9og/yVWLsUd5yQpvRvvFeSH0GAnQfsZhRqPvet0v67zDPFu/ZYO8b9GZZDjZmgHy92sdUDNpLcWN3qKqcJbfkg==");

        Field refreshField = JwtService.class.getDeclaredField("refreshSecretEncoded");
        refreshField.setAccessible(true);
        refreshField.set(jwtService, "9og/yVWLsUd5yQpvRvvFeSH0GAnQfsZhRqPvet0v67zDPFu/ZYO8b9GZZDjZmgHy92sdUDNpLcWN3qKqcJbfkg==");
        jwtService.init();
    }

    @Test
    void testGenerateAndValidateAccessToken() {
        String username = "userTest";
        Map<String, Object> claims = Map.of("role", "USER");

        String token = jwtService.generateAccessToken(username, claims);
        assertNotNull(token);
        assertTrue(jwtService.isAccessTokenValid(token));
        assertEquals(username, jwtService.extractAccessUsername(token));

        Claims extractedClaims = jwtService.extractAllAccessClaims(token);
        assertEquals("USER", extractedClaims.get("role"));
    }

    @Test
    void testGenerateAndValidateRefreshToken() {
        String username = "userTest";
        String token = jwtService.generateRefreshToken(username, false);

        assertNotNull(token);
        assertTrue(jwtService.isRefreshTokenValid(token));
        assertEquals(username, jwtService.extractRefreshUsername(token));
    }

}
