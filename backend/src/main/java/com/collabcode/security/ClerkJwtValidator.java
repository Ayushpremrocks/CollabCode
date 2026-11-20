package com.collabcode.security;

import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Component;

/**
 * Validates Clerk-issued JWTs for the WebSocket endpoints, where Spring Security's
 * resource-server filter does not run. Uses the same {@link JwtDecoder} bean as the
 * REST layer so both paths apply identical signature and expiry rules.
 */
@Component
public class ClerkJwtValidator {

    private final JwtDecoder jwtDecoder;

    public ClerkJwtValidator(JwtDecoder jwtDecoder) {
        this.jwtDecoder = jwtDecoder;
    }

    /** @throws JwtException if the token is invalid, expired, or has a bad signature */
    public Jwt decode(String token) {
        return jwtDecoder.decode(token);
    }
}
