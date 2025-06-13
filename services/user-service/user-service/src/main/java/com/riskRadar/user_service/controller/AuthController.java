package com.riskRadar.user_service.controller;

import com.riskRadar.user_service.dto.LoginRequest;
import com.riskRadar.user_service.dto.RegisterRequest;
import com.riskRadar.user_service.exception.UserAlreadyExistsException;
import com.riskRadar.user_service.security.TokenBloomFilter;
import com.riskRadar.user_service.security.TokenRedisService;
import com.riskRadar.user_service.service.CustomUserDetailsService;
import com.riskRadar.user_service.service.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final CustomUserDetailsService userService; // service to save and load users
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final TokenRedisService tokenRedisService;
    private final TokenBloomFilter bloomFilter;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        try {
            userService.createUser(request.username(), request.password(), request.email());
            return ResponseEntity.status(HttpStatus.CREATED).body("User registered successfully");
        } catch (UserAlreadyExistsException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("Username or email already exists");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Registration failed");
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        // Authenticate user
        try{
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.username(), request.password())
            );
            SecurityContextHolder.getContext().setAuthentication(authentication);

            UserDetails userDetails = userService.loadUserByUsername(request.username());

            String jwt = jwtService.generateToken(userDetails.getUsername());

            tokenRedisService.saveToken(jwt);

            bloomFilter.addToken(jwt);

            return ResponseEntity.ok(Map.of("token", jwt));
        }catch (BadCredentialsException ex) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid username or password");
        }

    }
    @GetMapping("/profile")
    public ResponseEntity<String> getProfile() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        System.out.println(authentication);
        if (authentication == null || !authentication.isAuthenticated() || authentication.getPrincipal().equals("anonymousUser")) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        String username = authentication.getName(); // gets username from principal
        return ResponseEntity.ok("Hello, " + username + "! This is a protected endpoint.");
    }
}
