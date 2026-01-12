package com.riskRadar.user_service.controller;

import com.riskRadar.user_service.service.NotificationClient;
import com.riskRadar.user_service.dto.BanUserRequest;
import com.riskRadar.user_service.dto.UpdateRoleRequest;
import com.riskRadar.user_service.dto.ChangeEmailRequest;
import com.riskRadar.user_service.service.CustomUserDetailsService;
import com.riskRadar.user_service.service.RedisService;
import com.riskRadar.user_service.service.UserService;
import com.riskRadar.user_service.security.PermissionChecker;
import com.riskRadar.user_service.exception.UserAlreadyExistsException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class UserController {

    private final CustomUserDetailsService userDetailsService;
    private final RedisService redisService;
    private final UserService userService;
    private final NotificationClient notificationClient;
    private final PermissionChecker permissionChecker;

    @PostMapping("/change-email")
    public ResponseEntity<?> changeEmail(@Valid @RequestBody ChangeEmailRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();

        try {
            userService.changeEmail(username, request.newEmail());
            return ResponseEntity.ok(Map.of("message", "Email changed successfully"));
        } catch (UserAlreadyExistsException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/banUser")
    public ResponseEntity<?> banUser(@RequestBody BanUserRequest request) {
        if (!permissionChecker.hasPermission("users:ban")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Insufficient permissions: requires users:ban"));
        }
        
        if (request.username() == null || request.username().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username is required"));
        }

        try {
            userDetailsService.banUser(request.username());
            // Also ban in Redis to block immediate access
            redisService.banUser(request.username(), "Banned by admin");
            try {
                var user = userService.getUserByUsernameOrEmail(request.username());
                notificationClient.sendBanNotification(user.getId(), user.getEmail(), "Admin decision");
            } catch (Exception e) {
                // ignore, user might not exist or notification failed
            }
            
            return ResponseEntity.ok(Map.of("message", "User banned successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }


    @PostMapping("/users/{id}/unban")
    public ResponseEntity<?> unbanUser(@PathVariable UUID id) {
        if (!permissionChecker.hasPermission("users:ban")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Insufficient permissions: requires users:ban"));
        }
        try {
            var user = userService.getUserById(id);
            userDetailsService.unbanUser(user.username());

            redisService.unbanUser(user.username());
                        try {
                            notificationClient.sendUnbanNotification(user.id(), user.email());
                        } catch (Exception e) {
                            // ignore
                        }

            return ResponseEntity.ok(Map.of("message", "User unbanned successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/users/{id}/roles")
    public ResponseEntity<?> updateUserRole(@PathVariable UUID id, @RequestBody UpdateRoleRequest request) {
        if (!permissionChecker.hasPermission("roles:assign")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Insufficient permissions: requires roles:assign"));
        }
        try {
            userService.updateUserRole(id, request.roleName());
            try {
                notificationClient.sendRoleAssignedNotification(id, request.roleName());
            } catch (Exception e) {
                // ignore
            }
            return ResponseEntity.ok(Map.of("message", "User role updated successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers(Pageable pageable) {
        if (!permissionChecker.hasPermission("users:view")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Insufficient permissions: requires users:view"));
        }
        return ResponseEntity.ok(userService.getAllUsers(pageable));
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<?> getUserById(@PathVariable UUID id) {
        if (!permissionChecker.hasPermission("users:view")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Insufficient permissions: requires users:view"));
        }
        return ResponseEntity.ok(userService.getUserById(id));
    }

    @GetMapping("/users/stats")
    public ResponseEntity<?> getUserStats() {
        if (!permissionChecker.hasPermission("stats:view") && !permissionChecker.hasPermission("users:view")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Insufficient permissions: requires stats:view or users:view"));
        }
        return ResponseEntity.ok(userService.getUserStats());
    }
}
