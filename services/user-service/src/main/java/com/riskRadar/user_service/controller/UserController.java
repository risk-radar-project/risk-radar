package com.riskRadar.user_service.controller;

import com.riskRadar.user_service.dto.BanUserRequest;
import com.riskRadar.user_service.dto.UpdateRoleRequest;
import com.riskRadar.user_service.dto.ChangeEmailRequest;
import com.riskRadar.user_service.service.CustomUserDetailsService;
import com.riskRadar.user_service.service.RedisService;
import com.riskRadar.user_service.service.UserService;
import com.riskRadar.user_service.exception.UserAlreadyExistsException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
    @PreAuthorize("hasAuthority('PERM_USERS:BAN') or hasAuthority('PERM_*:*')")
    public ResponseEntity<?> banUser(@RequestBody BanUserRequest request) {
        if (request.username() == null || request.username().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username is required"));
        }

        try {
            userDetailsService.banUser(request.username());
            // Also ban in Redis to block immediate access
            redisService.banUser(request.username(), "Banned by admin");

            return ResponseEntity.ok(Map.of("message", "User banned successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/users/{id}/unban")
    @PreAuthorize("hasAuthority('PERM_USERS:BAN') or hasAuthority('PERM_*:*')")
    public ResponseEntity<?> unbanUser(@PathVariable UUID id) {
        try {
            var user = userService.getUserById(id);
            userDetailsService.unbanUser(user.username());
            redisService.unbanUser(user.username());

            return ResponseEntity.ok(Map.of("message", "User unbanned successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/users/{id}/roles")
    @PreAuthorize("hasAuthority('PERM_ROLES:ASSIGN') or hasAuthority('PERM_*:*')")
    public ResponseEntity<?> updateUserRole(@PathVariable UUID id, @RequestBody UpdateRoleRequest request) {
        try {
            userService.updateUserRole(id, request.roleName());
            return ResponseEntity.ok(Map.of("message", "User role updated successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/users")
    @PreAuthorize("hasAuthority('PERM_USERS:VIEW') or hasAuthority('PERM_*:*')")
    public ResponseEntity<?> getAllUsers(Pageable pageable) {
        return ResponseEntity.ok(userService.getAllUsers(pageable));
    }

    @GetMapping("/users/{id}")
    @PreAuthorize("hasAuthority('PERM_USERS:VIEW') or hasAuthority('PERM_*:*')")
    public ResponseEntity<?> getUserById(@PathVariable UUID id) {
        return ResponseEntity.ok(userService.getUserById(id));
    }

    @GetMapping("/users/stats")
    @PreAuthorize("hasAuthority('PERM_STATS:VIEW') or hasAuthority('PERM_USERS:VIEW') or hasAuthority('PERM_*:*')")
    public ResponseEntity<?> getUserStats() {
        return ResponseEntity.ok(userService.getUserStats());
    }
}
