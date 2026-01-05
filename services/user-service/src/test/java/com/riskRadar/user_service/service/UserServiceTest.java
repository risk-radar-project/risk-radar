package com.riskRadar.user_service.service;

import com.riskRadar.user_service.entity.User;
import com.riskRadar.user_service.exception.UserAlreadyExistsException;
import com.riskRadar.user_service.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    private UserService userService;

    @BeforeEach
    void setUp() {
        userService = new UserService(userRepository, passwordEncoder);
    }

    @Test
    void changeEmail_Success() {
        String username = "testuser";
        String newEmail = "new@example.com";
        User user = new User();
        user.setUsername(username);
        user.setEmail("old@example.com");

        when(userRepository.findByEmail(newEmail)).thenReturn(Optional.empty());
        when(userRepository.findByUsername(username)).thenReturn(Optional.of(user));

        userService.changeEmail(username, newEmail);

        assertEquals(newEmail, user.getEmail());
        verify(userRepository).save(user);
    }

    @Test
    void changeEmail_EmailAlreadyExists() {
        String username = "testuser";
        String newEmail = "existing@example.com";

        when(userRepository.findByEmail(newEmail)).thenReturn(Optional.of(new User()));

        assertThrows(UserAlreadyExistsException.class, () -> userService.changeEmail(username, newEmail));
        verify(userRepository, never()).save(any());
    }

    @Test
    void changeEmail_UserNotFound() {
        String username = "unknown";
        String newEmail = "new@example.com";

        when(userRepository.findByEmail(newEmail)).thenReturn(Optional.empty());
        when(userRepository.findByUsername(username)).thenReturn(Optional.empty());

        assertThrows(UsernameNotFoundException.class, () -> userService.changeEmail(username, newEmail));
        verify(userRepository, never()).save(any());
    }
}
