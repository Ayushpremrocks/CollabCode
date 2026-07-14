package com.collabcode.websocket;

import com.collabcode.model.User;
import com.collabcode.security.ClerkJwtValidator;
import com.collabcode.service.UserProvisioningService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Validates Clerk JWTs on incoming STOMP CONNECT frames.
 *
 * Sets the STOMP principal to the local User's display username (not the raw Clerk user ID)
 * so that presence, chat, and room operations continue to work with human-readable names.
 */
@Component
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final Logger log = LoggerFactory.getLogger(StompAuthChannelInterceptor.class);

    private final ClerkJwtValidator clerkJwtValidator;
    private final UserProvisioningService userProvisioningService;

    public StompAuthChannelInterceptor(ClerkJwtValidator clerkJwtValidator,
                                        UserProvisioningService userProvisioningService) {
        this.clerkJwtValidator = clerkJwtValidator;
        this.userProvisioningService = userProvisioningService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            String authHeader = accessor.getFirstNativeHeader("Authorization");

            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);

                try {
                    Jwt jwt = clerkJwtValidator.decode(token);
                    String clerkUserId = jwt.getSubject();
                    String username = jwt.getClaimAsString("username");
                    String email = jwt.getClaimAsString("email");

                    // Get or create the local User record for this Clerk user
                    User user = userProvisioningService.getOrCreateUser(clerkUserId, username, email);

                    // Principal name = local display username (used by StompPresenceController)
                    UsernamePasswordAuthenticationToken auth =
                            new UsernamePasswordAuthenticationToken(
                                    user.getUsername(), null,
                                    List.of(new SimpleGrantedAuthority("ROLE_USER")));
                    accessor.setUser(auth);

                    log.debug("STOMP authenticated — Clerk ID: {}, local user: {}",
                            clerkUserId, user.getUsername());

                } catch (JwtException e) {
                    log.warn("Invalid Clerk JWT in STOMP CONNECT: {}", e.getMessage());
                    throw new IllegalArgumentException("Invalid Clerk session token");
                }
            } else {
                log.warn("Missing Authorization header in STOMP CONNECT frame");
                throw new IllegalArgumentException("Missing authentication");
            }
        }

        return message;
    }
}
