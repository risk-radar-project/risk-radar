package com.riskRadar.user_service.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.riskRadar.user_service.controller.AuthController;
import com.riskRadar.user_service.dto.*;
import com.riskRadar.user_service.entity.CustomUserDetails;
import com.riskRadar.user_service.entity.User;
import com.riskRadar.user_service.exception.UserAlreadyExistsException;
import com.riskRadar.user_service.exception.GlobalExceptionHandler;
import com.riskRadar.user_service.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.UUID;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthControllerTest {

    private MockMvc mockMvc;
    private CustomUserDetailsService userDetailsService;
    private JwtService jwtService;
    private UserService userService;
    private RedisService redisService;
    private AuthzClient authzClient;
    private AuthenticationManager authenticationManager;
    private AuditLogClient auditLogClient;
    private PasswordResetService passwordResetService;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private User testUser;

    @BeforeEach
    void setup() {
        userDetailsService = mock(CustomUserDetailsService.class);
        jwtService = mock(JwtService.class);
        userService = mock(UserService.class);
        redisService = mock(RedisService.class);
        authzClient = mock(AuthzClient.class);
        authenticationManager = mock(AuthenticationManager.class);
        auditLogClient = mock(AuditLogClient.class);
        passwordResetService = mock(PasswordResetService.class);



        AuthController controller = new AuthController(
                userDetailsService,
                userService,
                jwtService,
                authenticationManager,
                redisService,
                authzClient,
                auditLogClient,
                passwordResetService
        );

        mockMvc = MockMvcBuilders.standaloneSetup(controller)
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();

        testUser = new User();
        testUser.setId(UUID.randomUUID());
        testUser.setUsername("testuser");
        testUser.setEmail("test@example.com");
        testUser.setPassword("encodedPassword");
        testUser.setBanned(false);
    }

    @Test
    void register_success() throws Exception {
        RegisterRequest request = new RegisterRequest("newuser", "password", "new@example.com");
        doNothing().when(userDetailsService).createUser(request.username(), request.password(), request.email());

        mockMvc.perform(post("/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.message").value("User registered successfully"));
    }

    @Test
    void register_userAlreadyExists() throws Exception {
        RegisterRequest request = new RegisterRequest("existinguser", "password", "exist@example.com");
        doThrow(new UserAlreadyExistsException("User exists"))
                .when(userDetailsService).createUser(request.username(), request.password(), request.email());

        mockMvc.perform(post("/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("Username or email already exists"));
    }

    @Test
    void login_success() throws Exception {
        LoginRequest request = new LoginRequest("testuser", "password", null);
        Authentication auth = mock(Authentication.class);
        CustomUserDetails userDetails = mock(CustomUserDetails.class);

        when(authenticationManager.authenticate(ArgumentMatchers.any())).thenReturn(auth);
        when(auth.getPrincipal()).thenReturn(userDetails);
        when(userDetails.getUser()).thenReturn(testUser);
        when(redisService.isUserBanned(testUser.getUsername())).thenReturn(false);
        when(authzClient.getRolesByUserId(testUser.getId())).thenReturn(new Role[0]);
        when(authzClient.getPermissionsByUserId(testUser.getId())).thenReturn(new Permission[0]);
        when(jwtService.generateAccessToken(anyString(), anyMap())).thenReturn("access-token");
        when(jwtService.generateRefreshToken(anyString(), anyBoolean())).thenReturn("refresh-token");

        mockMvc.perform(post("/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("access-token"))
                .andExpect(jsonPath("$.refreshToken").value("refresh-token"));

    }

    @Test
    void login_badCredentials() throws Exception {
        LoginRequest request = new LoginRequest("testuser", "wrongpassword", null);
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("Bad credentials"));

        mockMvc.perform(post("/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Invalid username or password"));
    }

    @Test
    void logout_success() throws Exception {
        String token = "valid-token";
        when(jwtService.isAccessTokenValid(token)).thenReturn(true);
        when(jwtService.extractAccessUsername(token)).thenReturn(testUser.getUsername());

        mockMvc.perform(post("/logout")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Logout successful"));

        verify(redisService).saveTokenToBlacklist(token);
        verify(redisService).revokeRefreshToken(testUser.getUsername());
    }

    @Test
    void refresh_success() throws Exception {
        RefreshRequest request = new RefreshRequest("refresh-token");

        when(jwtService.extractRefreshUsername(request.refreshToken())).thenReturn(testUser.getUsername());
        when(jwtService.isRefreshTokenValid(request.refreshToken())).thenReturn(true);
        when(redisService.isRefreshTokenValid(testUser.getUsername(), request.refreshToken())).thenReturn(true);
        when(redisService.isUserBanned(testUser.getUsername())).thenReturn(false);
        when(userService.getUserByUsernameOrEmail(testUser.getUsername())).thenReturn(testUser);
        when(authzClient.getRolesByUserId(testUser.getId())).thenReturn(new Role[0]);
        when(authzClient.getPermissionsByUserId(testUser.getId())).thenReturn(new Permission[0]);
        when(jwtService.generateAccessToken(anyString(), anyMap())).thenReturn("new-access");
        when(jwtService.generateRefreshToken(anyString(), anyBoolean())).thenReturn("new-refresh");

        mockMvc.perform(post("/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("new-access"))
                .andExpect(jsonPath("$.refreshToken").value("new-refresh"));

    }
}
