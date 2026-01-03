package com.riskRadar.user_service.config;

import com.riskRadar.user_service.entity.User;
import com.riskRadar.user_service.repository.UserRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class AdminSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EntityManager entityManager;

    @Override
    @Transactional
    public void run(String... args) {
        // Must match the ID used in authz-service migration
        UUID adminId = UUID.fromString("11111111-1111-1111-1111-111111111111");

        if (userRepository.existsById(adminId)) {
            log.info("Admin user already exists with ID: {}", adminId);
            return;
        }

        if (userRepository.findByUsernameOrEmail("admin", "admin@riskradar.local").isPresent()) {
            log.warn("Admin user already exists by username/email, but ID might not match. Skipping seeding.");
            return;
        }

        log.info("Seeding default admin user...");
        User admin = new User();
        admin.setId(adminId);
        admin.setUsername("admin");
        admin.setEmail("admin@riskradar.local");
        admin.setPassword(passwordEncoder.encode("admin"));
        admin.setBanned(false);

        // Use native query to force INSERT with the provided ID, bypassing Hibernate's
        // detached entity check.
        entityManager.createNativeQuery(
                "INSERT INTO users (id, username, email, password, is_banned, created_at) " +
                        "VALUES (:id, :username, :email, :password, :isBanned, :createdAt)")
                .setParameter("id", adminId)
                .setParameter("username", "admin")
                .setParameter("email", "admin@riskradar.local")
                .setParameter("password", passwordEncoder.encode("admin"))
                .setParameter("isBanned", false)
                .setParameter("createdAt", Instant.now())
                .executeUpdate();

        log.info("Successfully seeded admin user with ID: {}", adminId);
    }
}
