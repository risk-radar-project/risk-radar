package com.riskRadar.user_service.controller;

import com.riskRadar.user_service.dto.*;
import com.riskRadar.user_service.entity.CustomUserDetails;
import com.riskRadar.user_service.entity.User;
import com.riskRadar.user_service.exception.UserAlreadyExistsException;
import com.riskRadar.user_service.service.*;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;

@RestController
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final CustomUserDetailsService userDetailsService;
    private final UserService userService;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final RedisService redisService;
    private final AuthzClient authzClient;
    private final AuditLogClient auditLogClient;

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request, HttpServletRequest httpRequest) {
        String clientIp = Optional.ofNullable(httpRequest.getHeader("X-Forwarded-For"))
                .orElse(httpRequest.getRemoteAddr());
        String userAgent = Optional.ofNullable(httpRequest.getHeader("User-Agent")).orElse("unknown");

        try {
            userDetailsService.createUser(request.username(), request.password(), request.email());

            auditLogClient.logAction(
                    Map.of(
                            "service", "user-service",
                            "action", "register",
                            "actor", Map.of(
                                    "id", request.username(),
                                    "type", "user",
                                    "ip", clientIp
                            ),
                            "status", "success",
                            "log_type", "ACTION",
                            "metadata", Map.of(
                                    "description", "User registered successfully",
                                    "user_agent", userAgent
                            )
                    )
            );

            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("message", "User registered successfully"));
        } catch (UserAlreadyExistsException e) {
            auditLogClient.logAction(
                    Map.of(
                            "service", "user-service",
                            "action", "register",
                            "actor", Map.of(
                                    "id", request.username(),
                                    "type", "user",
                                    "ip", clientIp
                            ),
                            "status", "failure",
                            "log_type", "SECURITY",
                            "metadata", Map.of(
                                    "description", "Username or email already exists",
                                    "user_agent", userAgent
                            )
                    )
            );
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Username or email already exists"));
        } catch (Exception e) {
            log.error("Unexpected error during registration for username '{}'", request.username(), e);

            auditLogClient.logAction(
                    Map.of(
                            "service", "user-service",
                            "action", "register",
                            "actor", Map.of(
                                    "id", request.username(),
                                    "type", "user",
                                    "ip", clientIp
                            ),
                            "status", "failure",
                            "log_type", "ERROR",
                            "metadata", Map.of(
                                    "description", "Unexpected error during registration",
                                    "user_agent", userAgent
                            )
                    )
            );
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "An unexpected error occurred"));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        String clientIp = Optional.ofNullable(httpRequest.getHeader("X-Forwarded-For"))
                .orElse(httpRequest.getRemoteAddr());
        String userAgent = Optional.ofNullable(httpRequest.getHeader("User-Agent")).orElse("unknown");

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.username(), request.password())
            );
            SecurityContextHolder.getContext().setAuthentication(authentication);

            CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
            User user = userDetails.getUser();

            if (redisService.isUserBanned(user.getUsername())) {
                auditLogClient.logAction(
                        Map.of(
                                "service", "user-service",
                                "action", "login",
                                "actor", Map.of(
                                        "id", request.username(),
                                        "type", "user",
                                        "ip", clientIp
                                ),
                                "status", "failure",
                                "log_type", "SECURITY",
                                "metadata", Map.of(
                                        "description", "User is banned",
                                        "user_agent", userAgent
                                )
                        )
                );
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "User is banned"));
            }

            Map<String, Object> claims = extractClaims(user);
            String oldToken = extractTokenFromCookies(httpRequest);
            JwtResponse jwtResponse = generateTokens(user, claims, oldToken);

            auditLogClient.logAction(
                    Map.of(
                            "service", "user-service",
                            "action", "login",
                            "actor", Map.of(
                                    "id", request.username(),
                                    "type", "user",
                                    "ip", clientIp
                            ),
                            "status", "success",
                            "log_type", "ACTION",
                            "metadata", Map.of(
                                    "description", "User logged in successfully",
                                    "user_agent", userAgent
                            )
                    )
            );
            return ResponseEntity.ok(jwtResponse);

        } catch (BadCredentialsException ex) {
            auditLogClient.logAction(
                    Map.of(
                            "service", "user-service",
                            "action", "login",
                            "actor", Map.of(
                                    "id", request.username(),
                                    "type", "user",
                                    "ip", clientIp
                            ),
                            "status", "failure",
                            "log_type", "SECURITY",
                            "metadata", Map.of(
                                    "description", "Invalid username or password",
                                    "user_agent", userAgent
                            )
                    )
            );
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid username or password"));
        } catch (Exception ex) {
            log.error("Login failed", ex);
            auditLogClient.logAction(
                    Map.of(
                            "service", "user-service",
                            "action", "login",
                            "actor", Map.of(
                                    "id", request.username(),
                                    "type", "user",
                                    "ip", clientIp
                            ),
                            "status", "failure",
                            "log_type", "ERROR",
                            "metadata", Map.of(
                                    "description", "Login failed due to unexpected error",
                                    "user_agent", userAgent
                            )
                    )
            );
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Login failed"));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest httpRequest) {
        String clientIp = Optional.ofNullable(httpRequest.getHeader("X-Forwarded-For"))
                .orElse(httpRequest.getRemoteAddr());
        String userAgent = Optional.ofNullable(httpRequest.getHeader("User-Agent")).orElse("unknown");

        String authHeader = httpRequest.getHeader(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.warn("No Bearer token found in request");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "No token found, please login again"));
        }

        String token = authHeader.substring(7);
        String username = null;
        try {
            if (!jwtService.isAccessTokenValid(token)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Invalid token, please login again"));
            }
            username = jwtService.extractAccessUsername(token);
            redisService.saveTokenToBlacklist(token);
            redisService.revokeRefreshToken(username);

            auditLogClient.logAction(
                    Map.of(
                            "service", "user-service",
                            "action", "logout",
                            "actor", Map.of(
                                    "id", username,
                                    "type", "user",
                                    "ip", clientIp
                            ),
                            "status", "success",
                            "log_type", "ACTION",
                            "metadata", Map.of(
                                    "description", "User logged out successfully",
                                    "user_agent", userAgent
                            )
                    )
            );

            return ResponseEntity.ok(Map.of("message", "Logout successful"));
        } catch (Exception e) {
            log.error("Logout failed", e);
            auditLogClient.logAction(
                    Map.of(
                            "service", "user-service",
                            "action", "logout",
                            "actor", Map.of(
                                    "id", username != null ? username : "unknown",
                                    "type", "user",
                                    "ip", clientIp
                            ),
                            "status", "failure",
                            "log_type", "ERROR",
                            "metadata", Map.of(
                                    "description", "Logout failed due to unexpected error",
                                    "user_agent", userAgent
                            )
                    )
            );
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Logout failed"));
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestBody RefreshRequest request, HttpServletRequest httpRequest) {
        String clientIp = Optional.ofNullable(httpRequest.getHeader("X-Forwarded-For"))
                .orElse(httpRequest.getRemoteAddr());
        String userAgent = Optional.ofNullable(httpRequest.getHeader("User-Agent")).orElse("unknown");
        String refreshToken = request.refreshToken();
        String username = null;
        try {
            username = jwtService.extractRefreshUsername(refreshToken);

            if (!jwtService.isRefreshTokenValid(refreshToken)) {
                auditLogClient.logAction(Map.of(
                        "service", "user-service",
                        "action", "refresh",
                        "actor", Map.of("id", username, "type", "user", "ip", clientIp),
                        "status", "failure",
                        "log_type", "SECURITY",
                        "metadata", Map.of(
                                "description", "Invalid refresh token",
                                "user_agent", userAgent
                        )
                ));
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Invalid token, please login again"));
            }
            if (!redisService.isRefreshTokenValid(username, refreshToken)) {
                auditLogClient.logAction(Map.of(
                        "service", "user-service",
                        "action", "refresh",
                        "actor", Map.of("id", username, "type", "user", "ip", clientIp),
                        "status", "failure",
                        "log_type", "SECURITY",
                        "metadata", Map.of(
                                "description", "Refresh token expired",
                                "user_agent", userAgent
                        )
                ));
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Token has expired, please login again"));
            }
            if (redisService.isUserBanned(username)) {
                auditLogClient.logAction(Map.of(
                        "service", "user-service",
                        "action", "refresh",
                        "actor", Map.of("id", username, "type", "user", "ip", clientIp),
                        "status", "failure",
                        "log_type", "SECURITY",
                        "metadata", Map.of(
                                "description", "User owning this refresh token is banned",
                                "user_agent", userAgent
                        )
                ));
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "User owning this refresh token is banned, please login again"));
            }

            User user = userService.getUserByUsernameOrEmail(username);
            Map<String, Object> claims = extractClaims(user);

            String newAccessToken = jwtService.generateAccessToken(username, claims);
            String newRefreshToken = jwtService.generateRefreshToken(username);

            redisService.revokeRefreshToken(username);
            redisService.storeRefreshToken(username, newRefreshToken);

            auditLogClient.logAction(Map.of(
                    "service", "user-service",
                    "action", "refresh",
                    "actor", Map.of("id", username, "type", "user", "ip", clientIp),
                    "status", "success",
                    "log_type", "ACTION",
                    "metadata", Map.of(
                            "description", "Token successfully renewed",
                            "user_agent", userAgent
                    )
            ));

            return ResponseEntity.ok(new JwtResponse(newAccessToken, newRefreshToken));

        } catch (Exception e) {
            auditLogClient.logAction(Map.of(
                    "service", "user-service",
                    "action", "refresh",
                    "actor", Map.of("id", username != null ? username : "unknown", "type", "user", "ip", clientIp),
                    "status", "failure",
                    "log_type", "ERROR",
                    "metadata", Map.of(
                            "description", "Malformed refresh token",
                            "user_agent", userAgent
                    )
            ));
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Malformed token, please re-login"));
        }
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/banUser")
    public ResponseEntity<?> banUser(@Valid @RequestBody BanUserRequest request, HttpServletRequest httpRequest) {
        String clientIp = Optional.ofNullable(httpRequest.getHeader("X-Forwarded-For"))
                .orElse(httpRequest.getRemoteAddr());
        String userAgent = Optional.ofNullable(httpRequest.getHeader("User-Agent")).orElse("unknown");

        if (redisService.isUserBanned(request.username()) || userDetailsService.isUserBanned(request.username())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "User is already banned"));
        }
        try {
            userDetailsService.loadUserByUsername(request.username());
        } catch (UsernameNotFoundException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "User not found"));
        }

        redisService.banUser(request.username(), request.reason());
        userDetailsService.banUser(request.username());

        auditLogClient.logAction(Map.of(
                "service", "user-service",
                "action", "banUser",
                "actor", Map.of(
                        "id", request.username(),
                        "type", "user",
                        "ip", clientIp
                ),
                "status", "success",
                "log_type", "ACTION",
                "metadata", Map.of(
                        "description", "User banned successfully",
                        "user_agent", userAgent
                ),
                "target", Map.of(
                        "id", request.username(),
                        "reason", request.reason()
                )
        ));

        return ResponseEntity.ok(Map.of("message", "User banned successfully"));
    }



    private String extractTokenFromCookies(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return null;
        }
        for (Cookie cookie : request.getCookies()) {
            if ("auth_token".equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private Map<String, Object> extractClaims(User user) {

        Role[] rolesResponse = authzClient.getRolesByUserId(user.getId());
        Permission[] permissionsResponse = authzClient.getPermissionsByUserId(user.getId());

        List<String> roles = rolesResponse != null
                ? Arrays.stream(rolesResponse)
                .map(Role::name)
                .map(r -> "ROLE_" + r.toUpperCase())
                .toList()
                : List.of();

        List<String> permissions = permissionsResponse != null
                ? Arrays.stream(permissionsResponse)
                .map(Permission::name)
                .map(p -> "PERM_" + p.toUpperCase())
                .toList()
                : List.of();

        Map<String, Object> claims = new HashMap<>();
        claims.put("roles", roles);
        claims.put("permissions", permissions);
        return claims;
    }

    private JwtResponse generateTokens(User user, Map<String, Object> claims, String oldToken) {

        claims.put("userId", user.getId().toString());

        String newAccessToken = jwtService.generateAccessToken(user.getUsername(), claims);
        String newRefreshToken = jwtService.generateRefreshToken(user.getUsername());

        redisService.revokeRefreshToken(user.getUsername());
        redisService.storeRefreshToken(user.getUsername(), newRefreshToken);

        return new JwtResponse(newAccessToken, newRefreshToken);
    }
}
