package com.riskRadar.user_service.service;

import com.riskRadar.user_service.dto.Role;
import com.riskRadar.user_service.dto.RoleAndPermissionResponse;
import com.riskRadar.user_service.entity.User;
import com.riskRadar.user_service.event.UserCreatedEvent;
import com.riskRadar.user_service.exception.UserAlreadyExistsException;
import com.riskRadar.user_service.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.*;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CustomUserDetailsServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private AuthzClient authzClient;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private CustomUserDetailsService service;

    private User testUser;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);

        testUser = new User();
        testUser.setId(UUID.randomUUID());
        testUser.setUsername("user");
        testUser.setEmail("user@test.com");
        testUser.setPassword("encoded");
        testUser.setBanned(false);
    }

    @Test
    void loadUserByUsername_existingUser_returnsCustomUserDetails() {
        when(userRepository.findByUsernameOrEmail("user", "user")).thenReturn(Optional.of(testUser));

        var userDetails = service.loadUserByUsername("user");

        assertNotNull(userDetails);
        assertEquals("user", userDetails.getUsername());
        assertEquals(testUser.getPassword(), userDetails.getPassword());
    }

    @Test
    void loadUserByUsername_notFound_throwsException() {
        when(userRepository.findByUsernameOrEmail("user", "user")).thenReturn(Optional.empty());

        assertThrows(UsernameNotFoundException.class,
                () -> service.loadUserByUsername("user"));
    }

    @Test
    void createUser_success() {
        when(userRepository.findByUsernameOrEmail("user", "user@test.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("pass")).thenReturn("encoded");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            u.setId(UUID.randomUUID());
            return u;
        });

        service.createUser("user", "pass", "user@test.com");

        verify(userRepository).save(any(User.class));
        verify(eventPublisher).publishEvent(any(UserCreatedEvent.class));
    }

    @Test
    void createUser_userAlreadyExists_throwsException() {
        when(userRepository.findByUsernameOrEmail("user", "user@test.com")).thenReturn(Optional.of(testUser));

        assertThrows(UserAlreadyExistsException.class,
                () -> service.createUser("user", "pass", "user@test.com"));
    }

    @Test
    void handleUserCreated_assignsUserRole() {
        Role userRole = new Role(UUID.randomUUID(), "user");

        RoleAndPermissionResponse response = mock(RoleAndPermissionResponse.class);
        when(response.role()).thenReturn(userRole);
        when(authzClient.getAllRoles()).thenReturn(new RoleAndPermissionResponse[] { response });

        service.handleUserCreated(new UserCreatedEvent(UUID.randomUUID()));

        verify(authzClient).assignRole(any(UUID.class), eq(userRole.id().toString()));
    }

    @Test
    void isUserBanned_trueAndFalse() {
        when(userRepository.findByUsername("user")).thenReturn(Optional.of(testUser));
        assertFalse(service.isUserBanned("user"));

        testUser.setBanned(true);
        assertTrue(service.isUserBanned("user"));
    }

    @Test
    void banUser_success() {
        when(userRepository.findByUsername("user")).thenReturn(Optional.of(testUser));

        service.banUser("user");

        assertTrue(testUser.isBanned());
        verify(userRepository).save(testUser);
    }

    @Test
    void banUser_userNotFound_throwsException() {
        when(userRepository.findByUsername("user")).thenReturn(Optional.empty());

        assertThrows(UsernameNotFoundException.class,
                () -> service.banUser("user"));
    }
}
