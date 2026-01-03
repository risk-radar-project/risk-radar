package com.riskRadar.user_service.security;

import com.google.common.net.HttpHeaders;
import com.riskRadar.user_service.service.JwtService;
import com.riskRadar.user_service.service.RedisService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.jetbrains.annotations.NotNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Component
public class JwtTokenFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final RedisService redisService;
    private static final Logger logger = LoggerFactory.getLogger(JwtTokenFilter.class);


    public JwtTokenFilter(@Lazy JwtService jwtService,
                          RedisService redisService
    ) {
        this.jwtService = jwtService;
        this.redisService = redisService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, @NotNull HttpServletResponse response, @NotNull FilterChain filterChain) throws ServletException, IOException {
        final String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);
        logger.debug("Authorization header: {}", authHeader);

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            logger.debug("No Bearer token found, continuing filter chain");
            filterChain.doFilter(request, response);
            return;
        }

        final String token = authHeader.substring(7); // remove "Bearer "
        logger.debug("Extracted token: {}", token);

        // Check Redis token validity
        if (!redisService.isTokenValid(token)) {
            logger.warn("JWT token is missing or revoked in Redis: {}", token);
            sendJsonError(response, "User logged out, please login again");
            return;
        }

        String username;
        try {
            username = jwtService.extractAccessUsername(token);
            logger.debug("Username extracted from token: {}", username);
        } catch (ExpiredJwtException e) {
            logger.warn("Token expired: {}", e.getMessage());
            sendJsonError(response, "Token has expired");
            return;
        } catch (Exception e) {
            logger.warn("Exception extracting username from token: {}", e.getMessage());
            sendJsonError(response, "Invalid token");
            return;
        }

        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {

            if (redisService.isUserBanned(username)) {
                sendJsonError(response, "User is banned");
                return;
            }

            Claims claims = jwtService.extractAllAccessClaims(token);
            List<String> roles = claims.get("roles", List.class);
            List<String> permissions = claims.get("permissions", List.class);

            List<String> safeRoles = roles != null ? roles : Collections.emptyList();
            List<String> safePermissions = permissions != null ? permissions : Collections.emptyList();

            Set<GrantedAuthority> authorities = Stream.concat(
                    safeRoles.stream().map(r -> {
                        String roleString = r.startsWith("ROLE_") ? r : "ROLE_" + r.toUpperCase();
                        return new SimpleGrantedAuthority(roleString);
                    }),
                    safePermissions.stream().map(p -> {
                        String permString = p.startsWith("PERM_") ? p : "PERM_" + p.toUpperCase();
                        return new SimpleGrantedAuthority(permString);
                    })
            ).collect(Collectors.toSet());

            logger.debug("Authorities for user {}: {}", username, authorities);

            UsernamePasswordAuthenticationToken authToken =
                    new UsernamePasswordAuthenticationToken(username, null, authorities);
            authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authToken);
        }

        filterChain.doFilter(request, response);
    }

    private void sendJsonError(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        String json = String.format("{\"error\": \"%s\"}", message);
        response.getWriter().write(json);
        response.getWriter().flush();
    }
}