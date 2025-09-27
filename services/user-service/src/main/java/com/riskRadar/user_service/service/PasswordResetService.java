package com.riskRadar.user_service.service;

import com.riskRadar.user_service.entity.User;
import com.riskRadar.user_service.repository.UserRepository;
import com.riskRadar.user_service.security.JwtTokenFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class PasswordResetService {
    private final RedisService redisService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    private static final String RESET_TOKEN_PREFIX="resetToken:";
    private static final long RESET_TOKEN_TTL= 15;

    public String createResetToken(String email) {
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isPresent()) {
            String uuid = UUID.randomUUID().toString();

            String oldKey = redisService.get(RESET_TOKEN_PREFIX+email);
            if (oldKey != null) {
                redisService.delete(oldKey);
            }
            redisService.saveWithTTL(RESET_TOKEN_PREFIX + email, uuid, RESET_TOKEN_TTL, TimeUnit.MINUTES);

            // token = Base64(email:uuid);
            String token = email+":"+uuid;
            return Base64.getEncoder().encodeToString(token.getBytes(StandardCharsets.UTF_8));
        }
        return null;
    }
    public void resetPassword(String token, String newPassword) {
        // decode Base64
        String decoded = new String(Base64.getDecoder().decode(token), StandardCharsets.UTF_8);
        String[] parts = decoded.split(":", 2);
        if (parts.length != 2) throw new IllegalArgumentException("Invalid token format");

        String email = parts[0];
        String uuid = parts[1];

        String storedUuid = redisService.get(RESET_TOKEN_PREFIX + email);
        if (storedUuid == null || !storedUuid.equals(uuid)) {
            throw new IllegalArgumentException("Invalid or expired reset token");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalStateException("User not found"));

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        // Clean up: delete the token
        redisService.delete(RESET_TOKEN_PREFIX + email);
    }
}
