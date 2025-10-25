package com.riskRadar.user_service.repository;

import com.riskRadar.user_service.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByUsernameOrEmail(String usernameOrEmail, String usernameOrEmail1);

    Optional<User> findByEmail(String email);

    Optional<User> findByUsername(String username);
}
