package com.riskRadar.user_service.service;

import com.riskRadar.user_service.entity.Role;
import com.riskRadar.user_service.entity.User;
import com.riskRadar.user_service.exception.UserAlreadyExistsException;
import com.riskRadar.user_service.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.stream.Collectors;

@Service
public class CustomUserDetailsService implements UserDetailsService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public CustomUserDetailsService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public UserDetails loadUserByUsername(String usernameOrEmail) throws UsernameNotFoundException {
        User user = userRepository
                .findByUsernameOrEmail(usernameOrEmail, usernameOrEmail)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + usernameOrEmail));


        Set<GrantedAuthority> authorities = user.getRoles().stream()
                .map(role -> new SimpleGrantedAuthority(role.name()))
                .collect(Collectors.toSet());

        return new org.springframework.security.core.userdetails.User(
                user.getUsername(),
                user.getPassword(),
                authorities
        );
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
        user.setRoles(Set.of(Role.ROLE_ADMIN, Role.ROLE_USER));
        userRepository.save(user);
    }

    public boolean isUserBanned(String username) {
        try {
            if(userRepository.findByUsername(username).isEmpty()){
                return true;
            }
            User user = userRepository.findByUsername(username).get();
            return user.isBanned();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Transactional
    public void banUser(String username) {
        if (userRepository.findByUsername(username).isEmpty()) {
            throw new UsernameNotFoundException("User not found: " + username);
        } else {
            User user = userRepository.findByUsername(username).get();
            if (user.isBanned()) {
                return;
            }
            user.setBanned(true);
            userRepository.save(user);
        }
    }
}

