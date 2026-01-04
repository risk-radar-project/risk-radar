package report_service.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import report_service.service.JwtService;

import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class JwtTokenFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");
        final String jwt;
        final String userEmail;

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        jwt = authHeader.substring(7);
        // Validate token check
        if (!jwtService.isAccessTokenValid(jwt)) {
            filterChain.doFilter(request, response);
            return;
        }

        userEmail = jwtService.extractAccessUsername(jwt);

        if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            Claims claims = jwtService.extractAllAccessClaims(jwt);

            // Extract roles and permissions
            List<String> permissions = claims.get("permissions", List.class);
            if (permissions == null)
                permissions = Collections.emptyList();

            // Map permissions to Authorities
            var authorities = permissions.stream()
                    .map(perm -> {
                        String permString = perm;
                        if (perm.equals("*:*")) {
                            permString = "PERM_*:*";
                        } else if (!perm.startsWith("PERM_")) {
                            permString = "PERM_" + perm.toUpperCase();
                        }
                        return new SimpleGrantedAuthority(permString);
                    })
                    .collect(Collectors.toList());

            // Add roles if needed
            List<String> roles = claims.get("roles", List.class);
            if (roles != null) {
                authorities.addAll(roles.stream()
                        .map(role -> new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()))
                        .collect(Collectors.toList()));
            }

            UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                    userEmail, // principal
                    null, // credentials
                    authorities);

            authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authToken);
        }

        filterChain.doFilter(request, response);
    }
}
