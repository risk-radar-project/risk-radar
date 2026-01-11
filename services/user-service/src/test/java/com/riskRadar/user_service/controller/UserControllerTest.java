package com.riskRadar.user_service.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.riskRadar.user_service.dto.ChangeEmailRequest;
import com.riskRadar.user_service.service.CustomUserDetailsService;
import com.riskRadar.user_service.service.RedisService;
import com.riskRadar.user_service.service.UserService;
import com.riskRadar.user_service.service.NotificationClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class UserControllerTest {

    private MockMvc mockMvc;
    private UserService userService;
    private CustomUserDetailsService userDetailsService;
    private RedisService redisService;
    private NotificationClient notificationClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setup() {
        userService = mock(UserService.class);
        userDetailsService = mock(CustomUserDetailsService.class);
        redisService = mock(RedisService.class);
        notificationClient = mock(NotificationClient.class);
        UserController userController = new UserController(userDetailsService, redisService, userService, notificationClient);
        mockMvc = MockMvcBuilders.standaloneSetup(userController).build();
    }

    @Test
    void changeEmail_success() throws Exception {
        // Mock SecurityContext
        Authentication authentication = mock(Authentication.class);
        SecurityContext securityContext = mock(SecurityContext.class);
        when(securityContext.getAuthentication()).thenReturn(authentication);
        when(authentication.getName()).thenReturn("testuser");
        SecurityContextHolder.setContext(securityContext);

        ChangeEmailRequest request = new ChangeEmailRequest("new@example.com");

        mockMvc.perform(post("/change-email")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        verify(userService).changeEmail("testuser", "new@example.com");
    }

    @Test
    void changeEmail_UserAlreadyExists() throws Exception {
        // Mock SecurityContext
        Authentication authentication = mock(Authentication.class);
        SecurityContext securityContext = mock(SecurityContext.class);
        when(securityContext.getAuthentication()).thenReturn(authentication);
        when(authentication.getName()).thenReturn("testuser");
        SecurityContextHolder.setContext(securityContext);

        ChangeEmailRequest request = new ChangeEmailRequest("existing@example.com");

        doThrow(new com.riskRadar.user_service.exception.UserAlreadyExistsException("Email already in use"))
                .when(userService).changeEmail("testuser", "existing@example.com");

        mockMvc.perform(post("/change-email")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }
}
