package com.riskRadar.user_service.service;

import com.riskRadar.user_service.dto.Role;
import com.riskRadar.user_service.dto.RoleAndPermissionResponse;
import com.riskRadar.user_service.entity.CustomUserDetails;
import com.riskRadar.user_service.entity.User;
import com.riskRadar.user_service.event.UserCreatedEvent;
import com.riskRadar.user_service.exception.UserAlreadyExistsException;
import com.riskRadar.user_service.repository.UserRepository;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.UUID;
import java.util.stream.Stream;

@Service
@Slf4j
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthzClient authzClient;
    private final ApplicationEventPublisher eventPublisher;

    public CustomUserDetailsService(UserRepository userRepository,
                                    PasswordEncoder passwordEncoder,
                                    AuthzClient authzClient,
                                    ApplicationEventPublisher eventPublisher) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authzClient = authzClient;
        this.eventPublisher = eventPublisher;
    }

    @Override
    @Transactional
    public UserDetails loadUserByUsername(String usernameOrEmail) throws UsernameNotFoundException {
        User user = userRepository
                .findByUsernameOrEmail(usernameOrEmail, usernameOrEmail)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + usernameOrEmail));

        return new CustomUserDetails(user);
    }


    @Transactional
    public void createUser(String username, String rawPassword, String email) {
        if (userRepository.findByUsernameOrEmail(username, email).isPresent()) {
            throw new UserAlreadyExistsException("User with this username or email already exists");
        }

        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setBanned(false);
        user.setPassword(passwordEncoder.encode(rawPassword));
        userRepository.save(user);

        // Assign default role via authz-service
        eventPublisher.publishEvent(new UserCreatedEvent(user.getId()));
    }

    @TransactionalEventListener
    public void handleUserCreated(UserCreatedEvent event) {
        RoleAndPermissionResponse[] rolesResponse = authzClient.getAllRoles();

        UUID roleID = Stream.of(rolesResponse)
                .map(RoleAndPermissionResponse::role)
                .filter(role -> role.name().equals("user"))
                .map(Role::id)
                .findFirst()
                .orElseThrow(() -> new RuntimeException("User role not found"));

        authzClient.assignRole(event.userId(), roleID.toString());
    }


    public boolean isUserBanned(String username) {
        return userRepository.findByUsername(username)
                .map(User::isBanned)
                .orElse(true);
    }

    @Transactional
    public void banUser(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));

        if (!user.isBanned()) {
            user.setBanned(true);
            userRepository.save(user);
        }
    }
}
