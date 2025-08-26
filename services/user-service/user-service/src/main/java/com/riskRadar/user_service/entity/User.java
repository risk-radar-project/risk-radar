package com.riskRadar.user_service.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter @Setter
public class User {
    @Id
    @GeneratedValue(generator = "UUID")
    @Column(columnDefinition = "uuid", updatable = false, nullable = false)
    private UUID id;

    @NotBlank(message = "Email must not be blank")
    @Column(unique = true, nullable = false)
    private String email;

    @NotBlank(message = "Username must not be blank")
    @Column(unique = true, nullable = false)
    private String username;

    @NotBlank(message = "Password must not be blank")
    @Column(nullable = false)
    private String password;

    private boolean isBanned;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
