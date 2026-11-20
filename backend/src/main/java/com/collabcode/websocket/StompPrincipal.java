package com.collabcode.websocket;

import java.security.Principal;

/**
 * Identity attached to a STOMP session after its CONNECT frame was authenticated.
 * {@link #getName()} returns the local display username (used in chat/presence payloads),
 * while authorization decisions use {@link #userId()}.
 */
public record StompPrincipal(Long userId, String username, String clerkUserId) implements Principal {
    @Override
    public String getName() {
        return username;
    }
}
