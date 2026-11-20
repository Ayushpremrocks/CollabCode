package com.collabcode.websocket;

import com.collabcode.model.User;
import com.collabcode.security.ClerkJwtValidator;
import com.collabcode.service.PresenceService;
import com.collabcode.service.RoomService;
import com.collabcode.service.UserProvisioningService;
import com.collabcode.websocket.yjs.YjsProtocol;
import com.collabcode.websocket.yjs.YjsRoom;
import com.collabcode.websocket.yjs.YjsRoomManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.util.MultiValueMap;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * Binary WebSocket endpoint {@code /ws/yjs/{roomCode}?token=<Clerk JWT>} for Yjs sync.
 *
 * Connection checks (in order): valid token → room exists and is not expired →
 * user is a participant (joined via REST, so room locks are honoured). Edits are
 * relayed through {@link YjsRoom}, which also enforces read-only mode.
 * See {@link YjsProtocol} for the frame format.
 */
@Component
public class YjsWebSocketHandler extends BinaryWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(YjsWebSocketHandler.class);
    private static final Pattern ROOM_CODE = Pattern.compile("[A-Z0-9]{4,20}");
    private static final int SEND_TIME_LIMIT_MS = 10_000;
    private static final int SEND_BUFFER_LIMIT_BYTES = 16 * 1024 * 1024;
    private static final int MAX_NAME_LENGTH = 80;
    private static final int MAX_URL_LENGTH = 500;

    private record Connection(String roomCode, String username, YjsRoom room) {}

    private final Map<String, Connection> connections = new ConcurrentHashMap<>();

    private final YjsRoomManager roomManager;
    private final RoomService roomService;
    private final PresenceService presenceService;
    private final ClerkJwtValidator clerkJwtValidator;
    private final UserProvisioningService userProvisioningService;

    public YjsWebSocketHandler(YjsRoomManager roomManager,
                               RoomService roomService,
                               PresenceService presenceService,
                               ClerkJwtValidator clerkJwtValidator,
                               UserProvisioningService userProvisioningService) {
        this.roomManager = roomManager;
        this.roomService = roomService;
        this.presenceService = presenceService;
        this.clerkJwtValidator = clerkJwtValidator;
        this.userProvisioningService = userProvisioningService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        URI uri = session.getUri();
        String roomCode = extractRoomCode(uri);
        MultiValueMap<String, String> params = queryParams(uri);

        if (roomCode == null) {
            session.close(new CloseStatus(YjsProtocol.CLOSE_NOT_FOUND, "Invalid room code"));
            return;
        }

        String token = params.getFirst("token");
        Jwt jwt;
        try {
            if (token == null || token.isBlank()) throw new IllegalArgumentException("missing token");
            jwt = clerkJwtValidator.decode(token);
        } catch (Exception e) {
            log.info("[Yjs] Rejected connection to room {}: {}", roomCode, e.getMessage());
            session.close(new CloseStatus(YjsProtocol.CLOSE_UNAUTHORIZED, "Invalid or expired session token"));
            return;
        }

        User user = userProvisioningService.getOrCreateUser(
                jwt.getSubject(), jwt.getClaimAsString("username"), jwt.getClaimAsString("email"));

        RoomService.RoomAccess access = roomService.getAccess(roomCode, user.getId());
        if (!access.exists() || access.expired()) {
            session.close(new CloseStatus(YjsProtocol.CLOSE_NOT_FOUND, "Room not found or expired"));
            return;
        }
        if (!access.member()) {
            session.close(new CloseStatus(YjsProtocol.CLOSE_FORBIDDEN, "Join the room first"));
            return;
        }

        WebSocketSession safe = new ConcurrentWebSocketSessionDecorator(
                session, SEND_TIME_LIMIT_MS, SEND_BUFFER_LIMIT_BYTES);
        YjsRoom.Peer peer = new SessionPeer(safe);

        presenceService.addUser(roomCode, user.getUsername(), user.getId(),
                sanitize(params.getFirst("name"), MAX_NAME_LENGTH),
                sanitizeImageUrl(params.getFirst("imageUrl")));

        YjsRoom room = roomManager.join(roomCode, peer, access.owner(), access.readOnly());
        connections.put(session.getId(), new Connection(roomCode, user.getUsername(), room));
        log.info("[Yjs] User '{}' connected to room {} (owner={})", user.getUsername(), roomCode, access.owner());
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) {
        Connection conn = connections.get(session.getId());
        if (conn == null) return;

        ByteBuffer payload = message.getPayload();
        byte[] data = new byte[payload.remaining()];
        payload.get(data);
        if (data.length == 0) return;

        byte[] body = Arrays.copyOfRange(data, 1, data.length);
        switch (data[0] & 0xFF) {
            case YjsProtocol.MSG_UPDATE -> conn.room().applyUpdate(session.getId(), body);
            case YjsProtocol.MSG_AWARENESS -> conn.room().applyAwareness(session.getId(), body);
            case YjsProtocol.MSG_SNAPSHOT -> {
                if (body.length < 4) return;
                long ack = ByteBuffer.wrap(body, 0, 4).getInt() & 0xFFFFFFFFL;
                conn.room().applySnapshot(session.getId(), ack, Arrays.copyOfRange(body, 4, body.length));
            }
            default -> log.debug("[Yjs] Unknown message type {} from {}", data[0] & 0xFF, session.getId());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Connection conn = connections.remove(session.getId());
        if (conn == null) return;
        roomManager.leave(conn.roomCode(), session.getId());
        presenceService.removeUser(conn.roomCode(), conn.username());
        log.info("[Yjs] User '{}' disconnected from room {} ({})", conn.username(), conn.roomCode(), status);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.warn("[Yjs] Transport error for session {}: {}", session.getId(), exception.getMessage());
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    static String extractRoomCode(URI uri) {
        if (uri == null) return null;
        String[] parts = uri.getPath().split("/");
        // /ws/yjs/{roomCode}
        if (parts.length < 4) return null;
        String code = parts[3].toUpperCase();
        return ROOM_CODE.matcher(code).matches() ? code : null;
    }

    private static MultiValueMap<String, String> queryParams(URI uri) {
        MultiValueMap<String, String> raw = UriComponentsBuilder.fromUri(uri).build().getQueryParams();
        MultiValueMap<String, String> decoded = new org.springframework.util.LinkedMultiValueMap<>();
        raw.forEach((k, values) -> values.forEach(v ->
                decoded.add(k, v == null ? null : URLDecoder.decode(v, StandardCharsets.UTF_8))));
        return decoded;
    }

    private static String sanitize(String value, int max) {
        if (value == null) return null;
        String trimmed = value.strip();
        if (trimmed.isEmpty()) return null;
        return trimmed.length() > max ? trimmed.substring(0, max) : trimmed;
    }

    /** Only https image URLs (Clerk avatars) are accepted. */
    static String sanitizeImageUrl(String value) {
        String url = sanitize(value, MAX_URL_LENGTH);
        return url != null && url.startsWith("https://") ? url : null;
    }

    /** Adapts a (thread-safe, decorated) WebSocket session to {@link YjsRoom.Peer}. */
    private record SessionPeer(WebSocketSession session) implements YjsRoom.Peer {
        @Override public String id() { return session.getId(); }

        @Override public void send(byte[] frame) throws Exception {
            if (session.isOpen()) session.sendMessage(new BinaryMessage(frame));
        }

        @Override public void close(int code, String reason) {
            try {
                if (session.isOpen()) session.close(new CloseStatus(code, reason));
            } catch (Exception ignored) {
                // already closed
            }
        }
    }
}
