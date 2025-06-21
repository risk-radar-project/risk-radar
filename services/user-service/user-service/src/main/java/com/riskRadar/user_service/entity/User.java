package com.riskRadar.user_service.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "users")
@Getter @Setter
public class User {
    @Id
    @GeneratedValue
    private long id;

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

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_roles")
    @Enumerated(EnumType.STRING)
    private Set<Role> roles = new HashSet<>();

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
