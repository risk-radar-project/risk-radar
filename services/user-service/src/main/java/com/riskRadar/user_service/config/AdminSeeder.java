package com.riskRadar.user_service.config;

import com.riskRadar.user_service.entity.User;
import com.riskRadar.user_service.repository.UserRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class AdminSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EntityManager entityManager;

    @Value("${app.superadmin.password:}")
    private String superadminPasswordEnv;

    private static final String ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";

    private String generateSecurePassword(int length) {
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }

    @Override
    @Transactional
    public void run(String... args) {
        // Must match the ID used in authz-service migration (has admin role assigned)
        UUID superadminId = UUID.fromString("11111111-1111-1111-1111-111111111111");

        // Check if superadmin exists
        if (!userRepository.existsById(superadminId)) {
            // Generate random password if not provided via environment
            String superadminPassword = (superadminPasswordEnv != null && !superadminPasswordEnv.isEmpty()) 
                ? superadminPasswordEnv 
                : generateSecurePassword(32);

            log.info("============================================================");
            log.info("🔐 SUPERADMIN CREDENTIALS (PRIVATE - DO NOT SHARE):");
            log.info("   username='superadmin' password='{}'", superadminPassword);
            log.info("============================================================");

            entityManager.createNativeQuery(
                    "INSERT INTO users (id, username, email, password, is_banned, created_at) " +
                            "VALUES (:id, :username, :email, :password, :isBanned, :createdAt)")
                    .setParameter("id", superadminId)
                    .setParameter("username", "superadmin")
                    .setParameter("email", "superadmin@riskradar.local")
                    .setParameter("password", passwordEncoder.encode(superadminPassword))
                    .setParameter("isBanned", false)
                    .setParameter("createdAt", Instant.now())
                    .executeUpdate();

            log.info("Successfully seeded superadmin user with ID: {}", superadminId);
        } else {
            log.info("Superadmin user already exists with ID: {}", superadminId);
        }
    }
}
