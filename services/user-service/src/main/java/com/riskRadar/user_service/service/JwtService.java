package com.riskRadar.user_service.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.Key;
import java.util.Base64;
import java.util.Date;
import java.util.Map;
import java.util.function.Function;

@Service
public class JwtService {

    private Key accessKey;
    private Key refreshKey;

    @Value("${jwt.access-secret}")
    private String accessSecretEncoded;

    @Value("${jwt.refresh-secret}")
    private String refreshSecretEncoded;

    private static final long ACCESS_TOKEN_EXPIRATION_MS = 1000 * 60 * 15; // 15 minut
    private static final long REFRESH_TOKEN_EXPIRATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 dni
    private static final long REFRESH_TOKEN_EXTENDED_EXPIRATION_MS = 1000L * 60 * 60 * 24 * 30; // 30 dni (Remember Me)

    @PostConstruct
    public void init() {
        byte[] accessKeyBytes = Base64.getDecoder().decode(accessSecretEncoded);
        this.accessKey = Keys.hmacShaKeyFor(accessKeyBytes);

        byte[] refreshKeyBytes = Base64.getDecoder().decode(refreshSecretEncoded);
        this.refreshKey = Keys.hmacShaKeyFor(refreshKeyBytes);
    }

    // ========================= GENERATE =========================
    public String generateAccessToken(String username, Map<String, Object> claims) {
        return Jwts.builder()
                .setHeaderParam("typ", "JWT")
                .setSubject(username)
                .addClaims(claims)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + ACCESS_TOKEN_EXPIRATION_MS))
                .signWith(accessKey, SignatureAlgorithm.HS256)
                .compact();
    }

    public String generateRefreshToken(String username) {
        return generateRefreshToken(username, false);
    }

    public String generateRefreshToken(String username, boolean rememberMe) {
        long expirationTime = rememberMe ? REFRESH_TOKEN_EXTENDED_EXPIRATION_MS : REFRESH_TOKEN_EXPIRATION_MS;
        return Jwts.builder()
                .setHeaderParam("typ", "JWT")
                .setSubject(username)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + expirationTime))
                .signWith(refreshKey, SignatureAlgorithm.HS256)
                .compact();
    }

    // ========================= VALIDATE =========================
    public boolean isAccessTokenValid(String token) {
        return isTokenValid(token, accessKey);
    }

    public boolean isRefreshTokenValid(String token) {
        return isTokenValid(token, refreshKey);
    }

    private boolean isTokenValid(String token, Key key) {
        try {
            extractAllClaims(token, key);
            return !isTokenExpired(token, key);
        } catch (JwtException e) {
            return false;
        }
    }

    // ========================= EXTRACT =========================
    // Access token helpers
    public Claims extractAllAccessClaims(String token) {
        return extractAllClaims(token, accessKey);
    }

    public String extractAccessUsername(String token) {
        try {
            return extractClaim(token, Claims::getSubject, accessKey);
        } catch (Exception e) {
            throw new JwtException("Failed to extract username from access token", e);
        }
    }

    public Date extractAccessExpiration(String token) {
        return extractClaim(token, Claims::getExpiration, accessKey);
    }


    public String extractRefreshUsername(String token) {
        try {
            return extractClaim(token, Claims::getSubject, refreshKey);
        } catch (Exception e) {
            throw new JwtException("Failed to extract username from refresh token", e);
        }
    }

    public Date extractRefreshExpiration(String token) {
        return extractClaim(token, Claims::getExpiration, refreshKey);
    }

    public boolean isRefreshTokenExtended(String token) {
        try {
            Date expiration = extractRefreshExpiration(token);
            Date issued = extractClaim(token, Claims::getIssuedAt, refreshKey);
            long tokenLifetime = expiration.getTime() - issued.getTime();
            // Consider token extended if lifetime is more than 14 days (halfway between 7 and 30)
            return tokenLifetime > (1000L * 60 * 60 * 24 * 14);
        } catch (Exception e) {
            return false; // Default to standard token if unable to determine
        }
    }


    // Generic extraction
    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver, Key key) {
        final Claims claims = extractAllClaims(token, key);
        return claimsResolver.apply(claims);
    }

    public Claims extractAllClaims(String token, Key key) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public boolean isTokenExpired(String token, Key key) {
        return extractClaim(token, Claims::getExpiration, key).before(new Date());
    }
}
