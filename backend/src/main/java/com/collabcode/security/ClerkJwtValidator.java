package com.collabcode.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

/**
 * Validates and decodes Clerk-issued JWTs using Clerk's public JWKS endpoint.
 *
 * Used by the raw WebSocket (Yjs) and STOMP channel interceptor where Spring Security's
 * oauth2ResourceServer filter does not run automatically. The HTTP layer is handled
 * directly by SecurityConfig.securityFilterChain().
 */
@Component
public class ClerkJwtValidator {

    private static final Logger log = LoggerFactory.getLogger(ClerkJwtValidator.class);

    private final JwtDecoder jwtDecoder;

    public ClerkJwtValidator(@Value("${app.clerk.jwks-uri}") String jwksUri) {
        this.jwtDecoder = NimbusJwtDecoder.withJwkSetUri(jwksUri).build();
    }

    /**
     * Validates and decodes a Clerk session token.
     *
     * @throws JwtException if the token is invalid, expired, or has a bad signature
     */
    public Jwt decode(String token) {
        return jwtDecoder.decode(token);
    }

    /** Returns true if the token is valid; does not throw. */
    public boolean isValid(String token) {
        try {
            decode(token);
            return true;
        } catch (Exception e) {
            log.debug("JWT validation failed: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Extracts the Clerk user ID from the JWT {@code sub} claim.
     * Example value: {@code user_2abc1234XYZ}
     */
    public String extractClerkUserId(String token) {
        return decode(token).getSubject();
    }
}
