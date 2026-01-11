package com.riskRadar.user_service.service;

import com.riskRadar.user_service.exception.UserAlreadyExistsException;
import com.riskRadar.user_service.entity.User;
import com.riskRadar.user_service.repository.UserRepository;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthzClient authzClient;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, AuthzClient authzClient) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authzClient = authzClient;
    }

    public User getUserByUsernameOrEmail(String usernameOrEmail) {
        return userRepository.findByUsernameOrEmail(usernameOrEmail, usernameOrEmail)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + usernameOrEmail));
    }

    @Transactional
    public void updatePassword(String email, String newPassword) {
        User user = getUserByUsernameOrEmail(email);
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    public boolean isSamePassword(String email, String rawPassword) {
        User user = getUserByUsernameOrEmail(email);
        return passwordEncoder.matches(rawPassword, user.getPassword());
    }

    public java.util.Map<String, Long> getUserStats() {
        long totalUsers = userRepository.count();
        long bannedUsers = userRepository.countByIsBanned(true);

        return java.util.Map.of(
                "totalUsers", totalUsers,
                "bannedUsers", bannedUsers);
    }

    public org.springframework.data.domain.Page<com.riskRadar.user_service.dto.UserResponse> getAllUsers(
            org.springframework.data.domain.Pageable pageable) {
        return userRepository.findAll(pageable)
                .map(this::mapToResponse);
    }

    public com.riskRadar.user_service.dto.UserResponse getUserById(java.util.UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found: " + id));
        return mapToResponse(user);
    }

    @Transactional
    public void updateUserRole(java.util.UUID userId, String roleName) {
        com.riskRadar.user_service.dto.RoleAndPermissionResponse[] allRoles = authzClient.getAllRoles();
        String roleId = java.util.stream.Stream.of(allRoles)
                .map(com.riskRadar.user_service.dto.RoleAndPermissionResponse::role)
                .filter(r -> r.name().equalsIgnoreCase(roleName))
                .findFirst()
                .map(r -> r.id().toString())
                .orElseThrow(() -> new IllegalArgumentException("Role not found: " + roleName));

        try {
            authzClient.revokeRoles(userId);
        } catch (Exception e) {
            // Intentionally ignored - user may have no roles to revoke
        }
        authzClient.assignRole(userId, roleId);
    }

    private com.riskRadar.user_service.dto.UserResponse mapToResponse(User user) {
        java.util.List<String> roles = java.util.Collections.emptyList();
        try {
            com.riskRadar.user_service.dto.Role[] fetchedRoles = authzClient.getRolesByUserId(user.getId());
            roles = java.util.stream.Stream.of(fetchedRoles)
                    .map(com.riskRadar.user_service.dto.Role::name)
                    .toList();
        } catch (Exception e) {
            // Authz service unavailable - return empty roles
        }

        return new com.riskRadar.user_service.dto.UserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.isBanned(),
                user.getCreatedAt(),
                roles);
    }

    @Transactional
    public void changeEmail(String username, String newEmail) {
        if (userRepository.findByEmail(newEmail).isPresent()) {
            throw new UserAlreadyExistsException("Email already in use: " + newEmail);
        }
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
        user.setEmail(newEmail);
        userRepository.save(user);
    }
}
