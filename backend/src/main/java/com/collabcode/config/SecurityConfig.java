package com.collabcode.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Spring Security configuration using Clerk for authentication.
 *
 * - REST requests: validated automatically by oauth2ResourceServer().jwt()
 *   against Clerk's JWKS endpoint. The JWT sub claim becomes the principal name.
 * - WebSocket (Yjs raw WS + STOMP): authentication happens at the application layer
 *   via ClerkJwtValidator + StompAuthChannelInterceptor. The /ws/** path is
 *   permitted at the HTTP level so the WebSocket upgrade handshake succeeds.
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
        log.info("[SecurityConfig] securityFilterChain bean initialization started.");

        log.info("[SecurityConfig] Configuring CORS, CSRF, session management...");
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // WebSocket upgrade requests are permitted at HTTP level;
                        // actual auth happens inside the WS handlers
                        .requestMatchers("/ws/**").permitAll()
                        .anyRequest().authenticated()
                );
        log.info("[SecurityConfig] CORS/CSRF/session/authz configured.");

        log.info("[SecurityConfig] Configuring oauth2ResourceServer (will call jwtDecoder())...");
        http.oauth2ResourceServer(oauth2 ->
                oauth2.jwt(jwt -> jwt.decoder(jwtDecoder()))
        );
        log.info("[SecurityConfig] oauth2ResourceServer configured.");

        log.info("[SecurityConfig] Calling http.build()...");
        SecurityFilterChain chain = http.build();
        log.info("[SecurityConfig] http.build() completed. SecurityFilterChain ready.");
        return chain;
    }

    /**
     * Shared JwtDecoder bean backed by Clerk's public JWKS.
     * Used both by oauth2ResourceServer (HTTP) and ClerkJwtValidator (WS).
     */
    @Bean
    public JwtDecoder jwtDecoder() {
        log.info("[SecurityConfig] jwtDecoder() called. CLERK_JWKS_URI is {}.",
                (clerkJwksUri != null && !clerkJwksUri.isBlank()) ? "present" : "MISSING or blank");

        NimbusJwtDecoder decoder;
        try {
            log.info("[SecurityConfig] Calling NimbusJwtDecoder.withJwkSetUri(...).build() — this may make a network call...");
            decoder = NimbusJwtDecoder.withJwkSetUri(clerkJwksUri).build();
            log.info("[SecurityConfig] NimbusJwtDecoder.build() completed successfully.");
        } catch (Exception e) {
            log.error("[SecurityConfig] NimbusJwtDecoder.build() FAILED.");
            log.error("[SecurityConfig] Exception class   : {}", e.getClass().getName());
            log.error("[SecurityConfig] Exception message : {}", e.getMessage());
            log.error("[SecurityConfig] Full stack trace  :", e);
            throw e;
        }

        // Use only expiry validation — Clerk signs with RS256 via JWKS (signature already proven).
        // Skip issuer validation so both standard Clerk session tokens and custom JWT templates
        // (which may have a different issuer format) are accepted without extra configuration.
        log.info("[SecurityConfig] Setting JWT validator (expiry-only, no issuer check)...");
        OAuth2TokenValidator<Jwt> expiryValidator = JwtValidators.createDefault();
        decoder.setJwtValidator(expiryValidator);
        log.info("[SecurityConfig] jwtDecoder() bean fully initialized.");
        return decoder;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        log.info("[SecurityConfig] corsConfigurationSource() initializing. Allowed origins count: {}.",
                allowedOrigins != null ? allowedOrigins.split(",").length : 0);
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(allowedOrigins.split(",")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        log.info("[SecurityConfig] corsConfigurationSource() ready.");
        return source;
    }
}
