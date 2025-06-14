package com.riskRadar.user_service.security;

import com.google.common.net.HttpHeaders;
import com.riskRadar.user_service.service.CustomUserDetailsService;
import com.riskRadar.user_service.service.JwtService;
import com.riskRadar.user_service.service.TokenRedisService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class JwtTokenFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;
    private final TokenBloomFilter bloomFilter;
    private final TokenRedisService redisService;
    private static final Logger logger = LoggerFactory.getLogger(JwtTokenFilter.class);


    public JwtTokenFilter(@Lazy JwtService jwtService,
                          @Lazy CustomUserDetailsService userDetailsService,
                          TokenBloomFilter bloomFilter,
                          TokenRedisService redisService
                          ){
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.bloomFilter = bloomFilter;
        this.redisService = redisService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        final String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);
        logger.debug("Authorization header: {}", authHeader);

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            logger.debug("No Bearer token found, continuing filter chain");
            filterChain.doFilter(request, response);
            return;
        }

        final String token = authHeader.substring(7); // remove "Bearer "
        logger.debug("Extracted token: {}", token);
        System.out.println();
        if (!bloomFilter.mightContainToken(token)) {
            logger.warn("Token not recognized by Bloom filter: {}", token);
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Token not recognized (bloom filter)");
            return;
        }

        if (!redisService.isTokenValid(token)) {
            logger.warn("JWT token is missing or revoked in Redis: {}", token);
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Token is revoked");
            return;
        }

        String username;
        try {
            username = jwtService.extractUsername(token);
            logger.debug("Username extracted from token: {}", username);
        } catch (Exception e) {
            logger.warn("Exception extracting username from token: {}", e.getMessage());
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }

        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                boolean valid = jwtService.isTokenValid(token, userDetails.getUsername());
                logger.debug("Token validity against user details: {}", valid);

                if (valid) {
                    Claims claims = jwtService.extractAllClaims(token);
                    List<String> roles = claims.get("roles", List.class);
                    logger.debug("User roles from token claims: {}", roles);

                    Set<GrantedAuthority> authorities = roles.stream()
                            .map(role -> (GrantedAuthority) () -> role)
                            .collect(Collectors.toSet());

                    UsernamePasswordAuthenticationToken authToken =
                            new UsernamePasswordAuthenticationToken(userDetails, null, authorities);
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);

                    logger.debug("Authentication set in SecurityContextHolder");
                } else {
                    logger.warn("Token is invalid for user: {}", username);
                }
            } catch (Exception e) {
                logger.warn("Exception during user authentication: {}", e.getMessage());
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                return;
            }
        }
        filterChain.doFilter(request, response);
    }

}
