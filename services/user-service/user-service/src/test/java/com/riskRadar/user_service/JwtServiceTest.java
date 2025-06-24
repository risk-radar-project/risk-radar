package com.riskRadar.user_service;

import com.riskRadar.user_service.service.JwtService;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class JwtServiceTest {

    @Mock
    private UserDetailsService userDetailsService;

    @InjectMocks
    private JwtService jwtService;

    private final String username = "testuser";

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        jwtService.init();
    }

    @Test
    void testGenerateAccessToken() {
        UserDetails userDetails = new User(username, "password", List.of((GrantedAuthority) () -> "ROLE_USER"));
        when(userDetailsService.loadUserByUsername(username)).thenReturn(userDetails);

        String token = jwtService.generateAccessToken(username);

        assertNotNull(token);
        assertEquals(username, jwtService.extractUsername(token));
        System.out.println(jwtService.isTokenValid(token));
        assertTrue(jwtService.isTokenValid(token));
    }

    @Test
    void testGenerateRefreshToken() {
        String refreshToken = jwtService.generateRefreshToken(username);
        assertNotNull(refreshToken);
        assertEquals(username, jwtService.extractUsername(refreshToken));
    }

    @Test
    void testExtractClaims() {
        UserDetails userDetails = new User(username, "password", List.of((GrantedAuthority) () -> "ROLE_USER"));
        when(userDetailsService.loadUserByUsername(username)).thenReturn(userDetails);

        String token = jwtService.generateAccessToken(username);
        Claims claims = jwtService.extractAllClaims(token);
        assertEquals(username, claims.getSubject());
    }

    @Test
    void testIsTokenExpired() throws InterruptedException {
        UserDetails userDetails = new User(username, "password", List.of((GrantedAuthority) () -> "ROLE_USER"));
        when(userDetailsService.loadUserByUsername(username)).thenReturn(userDetails);

        String token = jwtService.generateAccessToken(username);
        assertFalse(jwtService.isTokenExpired(token));
    }
    @Test
    void testExtractClaims_WithMalformedToken() {
        String invalidToken = "this.is.not.a.jwt";
        assertThrows(Exception.class, () -> jwtService.extractAllClaims(invalidToken));
    }

    @Test
    void testIsTokenValid_InvalidToken() {
        String invalidToken = "invalid.jwt.token";
        assertFalse(jwtService.isTokenValid(invalidToken));
    }
}
