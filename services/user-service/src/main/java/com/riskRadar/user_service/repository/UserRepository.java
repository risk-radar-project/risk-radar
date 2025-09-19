package com.riskRadar.user_service.repository;

import com.riskRadar.user_service.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsernameOrEmail(String usernameOrEmail, String usernameOrEmail1);

    Optional<User> findByUsername(String username);
}
