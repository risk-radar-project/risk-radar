package com.riskRadar.user_service.controller;

import com.riskRadar.user_service.dto.*;
import com.riskRadar.user_service.exception.UserAlreadyExistsException;
import com.riskRadar.user_service.service.CustomUserDetailsService;
import com.riskRadar.user_service.service.JwtService;
import com.riskRadar.user_service.service.RedisService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final CustomUserDetailsService userService;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final RedisService redisService;

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
        try {
            userService.createUser(request.username(), request.password(), request.email());
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("message", "User registered successfully"));
        } catch (UserAlreadyExistsException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Username or email already exists"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "An unexpected error occurred"));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        try {
            Authentication authentication = authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(request.username(), request.password()));
            SecurityContextHolder.getContext().setAuthentication(authentication);
            UserDetails userDetails;
            try {
                userDetails = userService.loadUserByUsername(request.username());
            } catch (UsernameNotFoundException e) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "User not found"));
            }
            String username = userDetails.getUsername();

            if (redisService.isUserBanned(username) || userService.isUserBanned(username)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "User is banned"));
            }

            String oldToken = extractTokenFromCookies(httpRequest);

            if (oldToken != null && jwtService.isTokenValid(oldToken) && jwtService.isTokenExpired(oldToken)) {
                redisService.saveTokenToBlacklist(oldToken);
            }

            String newToken = jwtService.generateAccessToken(userDetails.getUsername());
            String newRefreshToken = jwtService.generateRefreshToken(userDetails.getUsername());
            redisService.revokeRefreshToken(username);
            redisService.storeRefreshToken(username, newRefreshToken);

            return ResponseEntity.ok(new JwtResponse(newToken, newRefreshToken));
        } catch (BadCredentialsException ex) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid username or password"));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest httpRequest) {
        String authHeader = httpRequest.getHeader(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "No token found, please login again"));
        }
        String token = authHeader.substring(7);

        String username;

        try {
            if (!jwtService.isTokenValid(token)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid token, please login again"));
            }
            username = jwtService.extractUsername(token);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Malformed token, please re-login"));
        }

        redisService.saveTokenToBlacklist(token);

        redisService.revokeRefreshToken(username);

        return ResponseEntity.ok(Map.of("message", "Logout successful"));
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestBody RefreshRequest request) {
        String refreshToken = request.refreshToken();
        String username;
        try {
            username = jwtService.extractUsername(refreshToken);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Malformed token, please re-login"));
        }

        if (!jwtService.isTokenValid(refreshToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid token, please login again"));
        }
        if (!redisService.isRefreshTokenValid(username, refreshToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Token has expired, please login again"));
        }
        if (redisService.isUserBanned(username)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "User owning this refresh token is banned, please login again"));
        }

        String newAccessToken = jwtService.generateAccessToken(username);
        String newRefreshToken = jwtService.generateRefreshToken(username);

        redisService.revokeRefreshToken(username);
        redisService.storeRefreshToken(username, newRefreshToken);

        return ResponseEntity.ok(new JwtResponse(newAccessToken, newRefreshToken));

    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/banUser")
    public ResponseEntity<?> banUser(@Valid @RequestBody BanUserRequest request) {

        if (redisService.isUserBanned(request.username()) || userService.isUserBanned(request.username())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "User is already banned"));
        }
        try {
            userService.loadUserByUsername(request.username());
        } catch (UsernameNotFoundException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "User not found"));
        }
        redisService.banUser(request.username(), request.reason());
        userService.banUser(request.username());
        return ResponseEntity.ok(Map.of("message", "User banned successfully"));
    }

    @GetMapping("/profile")
    public ResponseEntity<?> getProfile() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || authentication.getPrincipal().equals("anonymousUser")) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        String username = authentication.getName();
        return ResponseEntity.ok(Map.of("message", "Hello, " + username + "!" + " This is your profile."));
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
}
