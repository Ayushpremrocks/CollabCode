package com.collabcode.websocket;

import com.collabcode.model.User;
import com.collabcode.security.ClerkJwtValidator;
import com.collabcode.service.RoomService;
import com.collabcode.service.UserProvisioningService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Authenticates STOMP CONNECT frames with a Clerk JWT and authorizes every
 * SUBSCRIBE / SEND: room destinations ({@code /topic/room/{code}/…},
 * {@code /app/room/{code}/…}) are only allowed for participants of that room.
 * Unauthorized frames are dropped (returning null) rather than throwing, so a
 * single bad subscription does not tear down the whole STOMP connection.
 */
@Component
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final Logger log = LoggerFactory.getLogger(StompAuthChannelInterceptor.class);

    static final Pattern ROOM_DESTINATION = Pattern.compile("^/(topic|app)/room/([A-Z0-9]{4,20})/[a-z-]+$");
    private static final String ALLOWED_ROOMS_ATTR = "collabcode.allowedRooms";

    private final ClerkJwtValidator clerkJwtValidator;
    private final UserProvisioningService userProvisioningService;
    private final RoomService roomService;

    public StompAuthChannelInterceptor(ClerkJwtValidator clerkJwtValidator,
                                       UserProvisioningService userProvisioningService,
                                       @Lazy RoomService roomService) {
        this.clerkJwtValidator = clerkJwtValidator;
        this.userProvisioningService = userProvisioningService;
        this.roomService = roomService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) return message;

        return switch (accessor.getCommand()) {
            case CONNECT -> authenticate(accessor, message);
            case SUBSCRIBE, SEND -> authorize(accessor, message);
            default -> message;
        };
    }

    private Message<?> authenticate(StompHeaderAccessor accessor, Message<?> message) {
        String authHeader = accessor.getFirstNativeHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new IllegalArgumentException("Missing authentication");
        }
        Jwt jwt;
        try {
            jwt = clerkJwtValidator.decode(authHeader.substring(7));
        } catch (Exception e) {
            log.info("[STOMP] Rejected CONNECT: {}", e.getMessage());
            throw new IllegalArgumentException("Invalid or expired Clerk session token");
        }
        User user = userProvisioningService.getOrCreateUser(
                jwt.getSubject(), jwt.getClaimAsString("username"), jwt.getClaimAsString("email"));

        StompPrincipal principal = new StompPrincipal(user.getId(), user.getUsername(), user.getClerkUserId());
        accessor.setUser(new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
        return message;
    }

    private Message<?> authorize(StompHeaderAccessor accessor, Message<?> message) {
        StompPrincipal principal = principalOf(accessor.getUser());
        String destination = accessor.getDestination();
        if (principal == null || destination == null) return null;

        Matcher m = ROOM_DESTINATION.matcher(destination);
        if (!m.matches()) {
            log.debug("[STOMP] Dropping {} to unsupported destination {}", accessor.getCommand(), destination);
            return null;
        }
        // Clients may only SEND to /app and SUBSCRIBE to /topic.
        boolean isApp = "app".equals(m.group(1));
        if ((accessor.getCommand() == StompCommand.SEND) != isApp) return null;

        String roomCode = m.group(2);
        Set<String> allowed = allowedRooms(accessor);
        if (allowed != null && allowed.contains(roomCode)) return message;

        RoomService.RoomAccess access = roomService.getAccess(roomCode, principal.userId());
        if (!access.canAccess()) {
            log.info("[STOMP] Denied {} {} for user {}", accessor.getCommand(), destination, principal.userId());
            return null;
        }
        if (allowed != null) allowed.add(roomCode);
        return message;
    }

    @SuppressWarnings("unchecked")
    private static Set<String> allowedRooms(StompHeaderAccessor accessor) {
        Map<String, Object> attrs = accessor.getSessionAttributes();
        if (attrs == null) return null;
        return (Set<String>) attrs.computeIfAbsent(ALLOWED_ROOMS_ATTR, k -> ConcurrentHashMap.newKeySet());
    }

    /** Extracts our principal from the STOMP session user (an Authentication wrapping it). */
    public static StompPrincipal principalOf(Principal user) {
        if (user instanceof StompPrincipal sp) return sp;
        if (user instanceof Authentication auth && auth.getPrincipal() instanceof StompPrincipal sp) return sp;
        return null;
    }
}
