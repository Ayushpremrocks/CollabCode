package com.collabcode.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * Spring Security configuration using Clerk for authentication.
 *
 * - REST: validated by oauth2ResourceServer().jwt() against Clerk's JWKS.
 * - WebSockets: the upgrade is permitted at HTTP level; YjsWebSocketHandler and
 *   StompAuthChannelInterceptor validate the token with the same JwtDecoder.
 * - /api/health is public so the frontend can wake the Render free-tier instance
 *   while the user is still signing in.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    @Value("${app.clerk.jwks-uri}")
    private String clerkJwksUri;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/ws/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/health").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .anyRequest().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.decoder(jwtDecoder())));
        return http.build();
    }

    /**
     * Shared decoder backed by Clerk's public JWKS (signature + exp/nbf with the
     * default 60 s clock skew). Issuer is not pinned so custom JWT templates work.
     */
    @Bean
    public JwtDecoder jwtDecoder() {
        if (clerkJwksUri == null || clerkJwksUri.isBlank()) {
            throw new IllegalStateException("CLERK_JWKS_URI is not configured");
        }
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(clerkJwksUri).build();
        decoder.setJwtValidator(JwtValidators.createDefault());
        log.info("[Security] Clerk JWT decoder configured for {}", clerkJwksUri.replaceAll("^(https?://[^/]+).*", "$1"));
        return decoder;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(parseOrigins(allowedOrigins)));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    /** Splits a comma-separated origin list, trimming whitespace and trailing slashes. */
    public static String[] parseOrigins(String csv) {
        if (csv == null) return new String[0];
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .map(o -> o.endsWith("/") ? o.substring(0, o.length() - 1) : o)
                .filter(o -> !o.isEmpty())
                .toArray(String[]::new);
    }
}
