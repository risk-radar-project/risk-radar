package com.riskRadar.user_service.controller;

import com.riskRadar.user_service.dto.*;
import com.riskRadar.user_service.entity.CustomUserDetails;
import com.riskRadar.user_service.entity.User;
import com.riskRadar.user_service.exception.UserAlreadyExistsException;
import com.riskRadar.user_service.exception.UserOperationException;
import com.riskRadar.user_service.service.*;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
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
        private final PasswordResetService passwordResetService;

        @PostMapping("/register")
        public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request, HttpServletRequest httpRequest) {
                String clientIp = extractClientIp(httpRequest);
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
                                                                        "ip", clientIp),
                                                        "status", "success",
                                                        "log_type", "ACTION",
                                                        "metadata", Map.of(
                                                                        "description", "User registered successfully",
                                                                        "user_agent", userAgent)));

                        return ResponseEntity.status(HttpStatus.CREATED)
                                        .body(Map.of("message", "User registered successfully"));
                } catch (UserAlreadyExistsException e) {
                        auditLogClient.logAction(
                                        Map.of(
                                                        "service", "user-service",
                                                        "action", "register",
                                                        "actor", Map.of(
                                                                        "id", request.username(),
                                                                        "type", "user",
                                                                        "ip", clientIp),
                                                        "status", "failure",
                                                        "log_type", "SECURITY",
                                                        "metadata", Map.of(
                                                                        "description",
                                                                        "Username or email already exists",
                                                                        "user_agent", userAgent)));
                        return ResponseEntity.status(HttpStatus.CONFLICT)
                                        .body(Map.of("error", "Username or email already exists"));
                } catch (Exception e) {
                        log.error("Unexpected error during registration for username '{}'", request.username(), e);

                        auditLogClient.logAction(
                                        Map.of(
                                                        "service", "user-service",
                                                        "action", "register",
                                                        "actor", Map.of(
                                                                        "id", request.username(),
                                                                        "type", "user",
                                                                        "ip", clientIp),
                                                        "status", "failure",
                                                        "log_type", "ERROR",
                                                        "metadata", Map.of(
                                                                        "description",
                                                                        "Unexpected error during registration",
                                                                        "user_agent", userAgent)));
                        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                                        .body(Map.of("error", "An unexpected error occurred"));
                }
        }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        String clientIp = extractClientIp(httpRequest);
        String userAgent = Optional.ofNullable(httpRequest.getHeader("User-Agent")).orElse("unknown");

                try {
                        if (userDetailsService.isUserBanned(request.username())) {
                                auditLogClient.logAction(Map.of(
                                                "service", "user-service",
                                                "action", "login",
                                                "actor", Map.of(
                                                                "id", request.username(),
                                                                "type", "user",
                                                                "ip", clientIp),
                                                "status", "failure",
                                                "log_type", "SECURITY",
                                                "metadata", Map.of(
                                                                "description", "Account is locked",
                                                                "user_agent", userAgent)));
                                throw new UserOperationException("Account is locked",
                                                UserOperationException.ErrorType.USER_BANNED);
                        }

                        Authentication authentication;
                        try {
                                authentication = authenticationManager.authenticate(
                                                new UsernamePasswordAuthenticationToken(request.username(),
                                                                request.password()));
                        } catch (org.springframework.security.authentication.LockedException e) {
                                log.warn("Account is locked for user: {}", request.username());
                                auditLogClient.logAction(Map.of(
                                                "service", "user-service",
                                                "action", "login",
                                                "actor", Map.of(
                                                                "id", request.username(),
                                                                "type", "user",
                                                                "ip", clientIp),
                                                "status", "failure",
                                                "log_type", "SECURITY",
                                                "metadata", Map.of(
                                                                "description", "Account is locked",
                                                                "user_agent", userAgent)));
                                throw new UserOperationException("Account is locked",
                                                UserOperationException.ErrorType.USER_BANNED);
                        } catch (BadCredentialsException e) {
                                auditLogClient.logAction(Map.of(
                                                "service", "user-service",
                                                "action", "login",
                                                "actor", Map.of(
                                                                "id", request.username(),
                                                                "type", "user",
                                                                "ip", clientIp),
                                                "status", "failure",
                                                "log_type", "SECURITY",
                                                "metadata", Map.of(
                                                                "description", "Invalid credentials",
                                                                "user_agent", userAgent)));
                                throw new UserOperationException("Invalid username or password",
                                                UserOperationException.ErrorType.INVALID_CREDENTIALS);
                        }

                        SecurityContextHolder.getContext().setAuthentication(authentication);
                        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
                        User user = userDetails.getUser();

            if (redisService.isUserBanned(user.getUsername())) {
                auditLogClient.logAction(Map.of(
                        "service", "user-service",
                        "action", "login",
                        "actor", Map.of(
                                "id", user.getId() != null ? user.getId().toString() : request.username(),
                                "type", "user",
                                "ip", clientIp
                        ),
                        "status", "failure",
                        "log_type", "SECURITY",
                        "metadata", Map.of(
                                "description", "User is banned",
                                "user_agent", userAgent
                        )
                ));
                throw new UserOperationException("User is banned",
                    UserOperationException.ErrorType.USER_BANNED);
            }

                        Map<String, Object> claims = extractClaims(user);
                        String oldToken = extractTokenFromCookies(httpRequest);
                        boolean rememberMe = request.rememberMe() != null && request.rememberMe();
                        JwtResponse jwtResponse = generateTokens(user, claims, oldToken, rememberMe);

            auditLogClient.logAction(Map.of(
                    "service", "user-service",
                    "action", "login",
                    "actor", Map.of(
                            "id", user.getId().toString(),
                            "type", "user",
                            "ip", clientIp
                    ),
                    "status", "success",
                    "log_type", "ACTION",
                    "metadata", Map.of(
                            "description", "User logged in successfully",
                            "user_agent", userAgent,
                            "username", user.getUsername()
                    )
            ));

                        return ResponseEntity.ok(jwtResponse);

                } catch (UserOperationException e) {
                        throw e;
                } catch (Exception e) {
                        log.error("Login failed", e);
                        auditLogClient.logAction(Map.of(
                                        "service", "user-service",
                                        "action", "login",
                                        "actor", Map.of(
                                                        "id", request.username(),
                                                        "type", "user",
                                                        "ip", clientIp),
                                        "status", "failure",
                                        "log_type", "ERROR",
                                        "metadata", Map.of(
                                                        "description", "Login failed due to unexpected error",
                                                        "user_agent", userAgent)));
                        throw new UserOperationException("Login failed",
                                        UserOperationException.ErrorType.OPERATION_FAILED, e);
                }
        }

    @PostMapping("/logout")
        public ResponseEntity<?> logout(HttpServletRequest httpRequest) {
                String clientIp = extractClientIp(httpRequest);
        String userAgent = Optional.ofNullable(httpRequest.getHeader("User-Agent")).orElse("unknown");

                String authHeader = httpRequest.getHeader(HttpHeaders.AUTHORIZATION);
                if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                        log.warn("No Bearer token found in request");
                        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                        .body(Map.of("error", "No token found, please login again"));
                }

                String token = authHeader.substring(7);
                String username;

                try {
                        // Check token and extract username securely
                        if (!jwtService.isAccessTokenValid(token)) {
                                auditLogClient.logAction(Map.of(
                                                "service", "user-service",
                                                "action", "logout",
                                                "actor", Map.of(
                                                                "id", "unknown",
                                                                "type", "user",
                                                                "ip", clientIp),
                                                "status", "failure",
                                                "log_type", "SECURITY",
                                                "metadata", Map.of(
                                                                "description", "Invalid or expired token",
                                                                "user_agent", userAgent)));
                                throw new UserOperationException("Invalid or expired token",
                                                UserOperationException.ErrorType.INVALID_CREDENTIALS);
                        }

                        try {
                                username = jwtService.extractAccessUsername(token);
                        } catch (Exception e) {
                                log.error("Failed to extract username from token", e);
                                auditLogClient.logAction(Map.of(
                                                "service", "user-service",
                                                "action", "logout",
                                                "actor", Map.of(
                                                                "id", "unknown",
                                                                "type", "user",
                                                                "ip", clientIp),
                                                "status", "failure",
                                                "log_type", "SECURITY",
                                                "metadata", Map.of(
                                                                "description", "Malformed token",
                                                                "user_agent", userAgent)));
                                throw new UserOperationException("Invalid token format",
                                                UserOperationException.ErrorType.INVALID_CREDENTIALS);
                        }

                        redisService.saveTokenToBlacklist(token);
                        redisService.revokeRefreshToken(username);

                        auditLogClient.logAction(Map.of(
                                        "service", "user-service",
                                        "action", "logout",
                                        "actor", Map.of(
                                                        "id", username,
                                                        "type", "user",
                                                        "ip", clientIp),
                                        "status", "success",
                                        "log_type", "ACTION",
                                        "metadata", Map.of(
                                                        "description", "User logged out successfully",
                                                        "user_agent", userAgent)));

                        return ResponseEntity.ok(Map.of("message", "Logout successful"));

                } catch (UserOperationException e) {
                        throw e;
                } catch (Exception e) {
                        log.error("Logout failed", e);
                        auditLogClient.logAction(Map.of(
                                        "service", "user-service",
                                        "action", "logout",
                                        "actor", Map.of(
                                                        "id", "unknown",
                                                        "type", "user",
                                                        "ip", clientIp),
                                        "status", "failure",
                                        "log_type", "ERROR",
                                        "metadata", Map.of(
                                                        "description", "Logout failed due to unexpected error",
                                                        "user_agent", userAgent)));
                        throw new UserOperationException("Logout failed",
                                        UserOperationException.ErrorType.OPERATION_FAILED, e);
                }
        }

        @PostMapping("/validate-reset-token")
        public ResponseEntity<?> validateResetToken(@RequestBody Map<String, String> request) {
                String token = request.get("token");
                String email = passwordResetService.getEmailByToken(token);
                if (email == null) {
                        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid or expired token"));
                }
                return ResponseEntity.ok(Map.of("valid", true));
        }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestBody RefreshRequest request, HttpServletRequest httpRequest) {
        String clientIp = extractClientIp(httpRequest);
        String userAgent = Optional.ofNullable(httpRequest.getHeader("User-Agent")).orElse("unknown");
        String refreshToken = request.refreshToken();

                try {
                        // First check if token is syntactically valid and not expired
                        if (!jwtService.isRefreshTokenValid(refreshToken)) {
                                auditLogClient.logAction(Map.of(
                                                "service", "user-service",
                                                "action", "refresh",
                                                "actor", Map.of(
                                                                "id", "unknown",
                                                                "type", "user",
                                                                "ip", clientIp),
                                                "status", "failure",
                                                "log_type", "SECURITY",
                                                "metadata", Map.of(
                                                                "description", "Invalid or expired refresh token",
                                                                "user_agent", userAgent)));
                                throw new UserOperationException("Invalid or expired token, please login again",
                                                UserOperationException.ErrorType.INVALID_CREDENTIALS);
                        }

                        // If token is valid, we can safely extract username
                        String username;
                        try {
                                username = jwtService.extractRefreshUsername(refreshToken);
                        } catch (Exception e) {
                                log.error("Failed to extract username from valid refresh token", e);
                                auditLogClient.logAction(Map.of(
                                                "service", "user-service",
                                                "action", "refresh",
                                                "actor", Map.of(
                                                                "id", "unknown",
                                                                "type", "user",
                                                                "ip", clientIp),
                                                "status", "failure",
                                                "log_type", "SECURITY",
                                                "metadata", Map.of(
                                                                "description", "Malformed refresh token",
                                                                "user_agent", userAgent)));
                                throw new UserOperationException("Invalid token format, please login again",
                                                UserOperationException.ErrorType.INVALID_CREDENTIALS);
                        }

                        if (!redisService.isRefreshTokenValid(username, refreshToken)) {
                                auditLogClient.logAction(Map.of(
                                                "service", "user-service",
                                                "action", "refresh",
                                                "actor", Map.of(
                                                                "id", username,
                                                                "type", "user",
                                                                "ip", clientIp),
                                                "status", "failure",
                                                "log_type", "SECURITY",
                                                "metadata", Map.of(
                                                                "description",
                                                                "Refresh token not found in Redis or expired",
                                                                "user_agent", userAgent)));
                                throw new UserOperationException(
                                                "Token has expired or been revoked, please login again",
                                                UserOperationException.ErrorType.INVALID_CREDENTIALS);
                        }

                        if (redisService.isUserBanned(username)) {
                                auditLogClient.logAction(Map.of(
                                                "service", "user-service",
                                                "action", "refresh",
                                                "actor", Map.of(
                                                                "id", username,
                                                                "type", "user",
                                                                "ip", clientIp),
                                                "status", "failure",
                                                "log_type", "SECURITY",
                                                "metadata", Map.of(
                                                                "description", "User is banned",
                                                                "user_agent", userAgent)));
                                throw new UserOperationException("User is banned, please contact support",
                                                UserOperationException.ErrorType.USER_BANNED);
                        }

                        User user = userService.getUserByUsernameOrEmail(username);
                        if (user == null) {
                                throw new UserOperationException("User not found",
                                                UserOperationException.ErrorType.USER_NOT_FOUND);
                        }

                        Map<String, Object> claims = extractClaims(user);
                        String newAccessToken = jwtService.generateAccessToken(username, claims);
                        // Check if the existing refresh token was extended (Remember Me was checked)
                        boolean wasRememberMe = jwtService.isRefreshTokenExtended(refreshToken);
                        String newRefreshToken = jwtService.generateRefreshToken(username, wasRememberMe);

                        redisService.revokeRefreshToken(username);
                        redisService.storeRefreshToken(username, newRefreshToken);

            auditLogClient.logAction(Map.of(
                    "service", "user-service",
                    "action", "refresh",
                    "actor", Map.of(
                                                "id", user.getId() != null ? user.getId().toString() : username,
                        "type", "user",
                        "ip", clientIp
                    ),
                    "status", "success",
                    "log_type", "ACTION",
                    "metadata", Map.of(
                            "description", "Token successfully renewed",
                            "user_agent", userAgent
                    )
            ));

                        return ResponseEntity.ok(new JwtResponse(newAccessToken, newRefreshToken));

        } catch (UserOperationException e) {
            throw e;
        } catch (Exception e) {
            log.error("Token refresh failed", e);
            auditLogClient.logAction(Map.of(
                    "service", "user-service",
                    "action", "refresh",
                    "actor", Map.of(
                        "id", "unknown",
                        "type", "user",
                        "ip", clientIp
                    ),
                    "status", "failure",
                    "log_type", "ERROR",
                    "metadata", Map.of(
                            "description", "Token refresh failed due to unexpected error",
                            "user_agent", userAgent
                    )
            ));
            throw new UserOperationException("Token refresh failed",
                UserOperationException.ErrorType.OPERATION_FAILED, e);
        }
    }

        @GetMapping("/me")
        public ResponseEntity<?> me(HttpServletRequest httpRequest) {
                String authHeader = httpRequest.getHeader(HttpHeaders.AUTHORIZATION);

                if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "No token provided"));
                }

                String token = authHeader.substring(7);

                try {
                        if (!jwtService.isAccessTokenValid(token)) {
                                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid or expired token"));
                        }

                        // Validate token structure (ensures it's not malformed)
                        jwtService.extractAllAccessClaims(token);
                        String username = jwtService.extractAccessUsername(token);

                        User user = userService.getUserByUsernameOrEmail(username);

                        // Get fresh roles from database instead of JWT claims
                        com.riskRadar.user_service.dto.UserResponse userResponse = userService.getUserById(user.getId());

                        List<String> permissions = List.of();
                        try {
                                Permission[] permissionsResponse = authzClient.getPermissionsByUserId(user.getId());
                                if (permissionsResponse != null) {
                                        permissions = Arrays.stream(permissionsResponse)
                                                        .filter(Objects::nonNull)
                                                        .map(Permission::name)
                                                        .toList();
                                }
                        } catch (Exception e) {
                                log.error("Failed to fetch permissions for user: {}", user.getId(), e);
                        }

                        return ResponseEntity.ok(Map.of(
                                        "id", user.getId().toString(),
                                        "username", user.getUsername(),
                                        "email", user.getEmail(),
                                        "roles", userResponse.roles(),
                                        "permissions", permissions
                        ));
                } catch (Exception e) {
                        log.error("Failed to fetch current user", e);
                        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unable to fetch user info"));
                }
        }

        private String extractClientIp(HttpServletRequest request) {
                String forwardedFor = request.getHeader("X-Forwarded-For");
                if (forwardedFor != null && !forwardedFor.isBlank()) {
                        // Take the first IP in the X-Forwarded-For chain
                        return forwardedFor.split(",")[0].trim();
                }
                return Optional.ofNullable(request.getRemoteAddr()).orElse("unknown");
        }

        private String extractTokenFromCookies(HttpServletRequest request) {
                Cookie[] cookies = request.getCookies();
                if (cookies == null) {
                        return null;
                }

                return Arrays.stream(cookies)
                                .filter(cookie -> "auth_token".equals(cookie.getName()))
                                .findFirst()
                                .map(Cookie::getValue)
                                .orElse(null);
        }

        private Map<String, Object> extractClaims(User user) {
                try {
                        if (user == null || user.getId() == null) {
                                throw new IllegalArgumentException("User or user ID is null");
                        }

                        Role[] rolesResponse = authzClient.getRolesByUserId(user.getId());
                        Permission[] permissionsResponse = authzClient.getPermissionsByUserId(user.getId());

                        if (rolesResponse == null) {
                                log.warn("No roles returned from authz-service for user: {}", user.getId());
                        }
                        if (permissionsResponse == null) {
                                log.warn("No permissions returned from authz-service for user: {}", user.getId());
                        }

                        List<String> roles = rolesResponse != null
                                        ? Arrays.stream(rolesResponse)
                                                        .filter(Objects::nonNull)
                                                        .map(Role::name)
                                                        .filter(name -> name != null && !name.isEmpty())
                                                        .map(r -> "ROLE_" + r.toUpperCase())
                                                        .distinct()
                                                        .toList()
                                        : List.of();

                        List<String> permissions = permissionsResponse != null
                                        ? Arrays.stream(permissionsResponse)
                                                        .filter(Objects::nonNull)
                                                        .map(Permission::name)
                                                        .filter(name -> name != null && !name.isEmpty())
                                                        .map(p -> "PERM_" + p.toUpperCase())
                                                        .distinct()
                                                        .toList()
                                        : List.of();

                        Map<String, Object> claims = new HashMap<>();
                        claims.put("roles", roles);
                        claims.put("permissions", permissions);
                        claims.put("userId", user.getId().toString());
                        return claims;

                } catch (Exception e) {
                        log.error("Error extracting claims for user: {}", user.getId(), e);
                        // Return minimal claims in case of error
                        return Map.of(
                                        "roles", List.of(),
                                        "permissions", List.of(),
                                        "userId", user.getId().toString());
                }
        }

        private JwtResponse generateTokens(User user, Map<String, Object> claims, String oldToken, boolean rememberMe) {
                try {
                        if (user == null) {
                                throw new UserOperationException("User cannot be null",
                                                UserOperationException.ErrorType.OPERATION_FAILED);
                        }

                        Map<String, Object> enrichedClaims = new HashMap<>(claims);
                        enrichedClaims.put("userId", user.getId().toString());
                        enrichedClaims.put("username", user.getUsername());
                        enrichedClaims.put("email", user.getEmail());
                        enrichedClaims.put("created_at", Instant.now().toString());

                        String newAccessToken = jwtService.generateAccessToken(user.getUsername(), enrichedClaims);
                        String newRefreshToken = jwtService.generateRefreshToken(user.getUsername(), rememberMe);

                        redisService.revokeRefreshToken(user.getUsername());

                        if (oldToken != null && !oldToken.isEmpty()) {
                                redisService.saveTokenToBlacklist(oldToken);
                        }

                        redisService.storeRefreshToken(user.getUsername(), newRefreshToken);

                        log.debug("Generated new tokens for user: {} (rememberMe: {})", user.getUsername(), rememberMe);
                        return new JwtResponse(newAccessToken, newRefreshToken);
                } catch (Exception e) {
                        assert user != null;
                        log.error("Failed to generate tokens for user: {}", user.getUsername(), e);
                        throw new UserOperationException("Token generation failed",
                                        UserOperationException.ErrorType.OPERATION_FAILED, e);
                }
        }
}
