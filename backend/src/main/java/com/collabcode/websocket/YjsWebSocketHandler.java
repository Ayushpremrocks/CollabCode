package com.collabcode.websocket;

import com.collabcode.model.DocumentSnapshot;
import com.collabcode.model.User;
import com.collabcode.security.ClerkJwtValidator;
import com.collabcode.service.DocumentService;
import com.collabcode.service.PresenceService;
import com.collabcode.service.UserProvisioningService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Handles raw binary WebSocket connections for Yjs document synchronization.
 *
 * Protocol:
 * - Message type 0: Yjs sync update (broadcast to other clients)
 * - Message type 1: Yjs awareness update (broadcast to other clients)
 * - Message type 2: Document snapshot (for persistence)
 *
 * The server acts as a relay — it does not maintain a full Yjs document in memory.
 * It broadcasts incoming updates to all other connected clients in the same room.
 */
@Component
public class YjsWebSocketHandler extends BinaryWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(YjsWebSocketHandler.class);

    // roomCode -> set of sessions
    private final Map<String, Set<WebSocketSession>> roomSessions = new ConcurrentHashMap<>();

    // sessionId -> roomCode
    private final Map<String, String> sessionRoomMap = new ConcurrentHashMap<>();

    // sessionId -> username
    private final Map<String, String> sessionUserMap = new ConcurrentHashMap<>();

    private final DocumentService documentService;
    private final PresenceService presenceService;
    private final ClerkJwtValidator clerkJwtValidator;
    private final UserProvisioningService userProvisioningService;

    public YjsWebSocketHandler(DocumentService documentService,
                                PresenceService presenceService,
                                ClerkJwtValidator clerkJwtValidator,
                                UserProvisioningService userProvisioningService) {
        this.documentService = documentService;
        this.presenceService = presenceService;
        this.clerkJwtValidator = clerkJwtValidator;
        this.userProvisioningService = userProvisioningService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String roomCode = extractRoomCode(session);
        String token = extractToken(session);

        if (token == null) {
            log.warn("Missing token for WebSocket connection");
            session.close(CloseStatus.POLICY_VIOLATION);
            return;
        }

        org.springframework.security.oauth2.jwt.Jwt jwt;
        try {
            jwt = clerkJwtValidator.decode(token);
        } catch (Exception e) {
            log.warn("Invalid Clerk JWT for WebSocket connection: {}", e.getMessage());
            session.close(CloseStatus.POLICY_VIOLATION);
            return;
        }

        String clerkUserId = jwt.getSubject();
        String claimUsername = jwt.getClaimAsString("username");
        String email = jwt.getClaimAsString("email");

        User user = userProvisioningService.getOrCreateUser(clerkUserId, claimUsername, email);
        String username = user.getUsername();

        if (roomCode == null) {
            log.warn("No room code in WebSocket URL");
            session.close(CloseStatus.POLICY_VIOLATION);
            return;
        }

        // Register session
        roomSessions.computeIfAbsent(roomCode, k -> ConcurrentHashMap.newKeySet()).add(session);
        sessionRoomMap.put(session.getId(), roomCode);
        sessionUserMap.put(session.getId(), username);

        // Track presence
        presenceService.addUser(roomCode, username, user.getId());

        log.info("User '{}' connected to room '{}' (session: {})", username, roomCode, session.getId());

        // Send existing document snapshot to the new client
        sendSnapshot(session, roomCode);
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) throws Exception {
        String roomCode = sessionRoomMap.get(session.getId());
        if (roomCode == null) return;

        ByteBuffer payload = message.getPayload();
        byte[] data = new byte[payload.remaining()];
        payload.get(data);

        // Check message type (first byte)
        if (data.length > 0) {
            int messageType = data[0] & 0xFF;

            if (messageType == 2) {
                // Snapshot message — persist the document
                byte[] snapshotData = new byte[data.length - 1];
                System.arraycopy(data, 1, snapshotData, 0, data.length - 1);
                documentService.saveSnapshot(roomCode, snapshotData);
                log.debug("Saved snapshot for room '{}' ({} bytes)", roomCode, snapshotData.length);
                return;
            }
        }

        // Broadcast to all other sessions in the room
        Set<WebSocketSession> sessions = roomSessions.get(roomCode);
        if (sessions != null) {
            BinaryMessage broadcastMessage = new BinaryMessage(data);
            for (WebSocketSession s : sessions) {
                if (s.isOpen() && !s.getId().equals(session.getId())) {
                    try {
                        synchronized (s) {
                            s.sendMessage(broadcastMessage);
                        }
                    } catch (IOException e) {
                        log.error("Failed to send message to session {}", s.getId(), e);
                    }
                }
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String roomCode = sessionRoomMap.remove(session.getId());
        String username = sessionUserMap.remove(session.getId());

        if (roomCode != null) {
            Set<WebSocketSession> sessions = roomSessions.get(roomCode);
            if (sessions != null) {
                sessions.remove(session);
                if (sessions.isEmpty()) {
                    roomSessions.remove(roomCode);
                }
            }

            if (username != null) {
                presenceService.removeUser(roomCode, username);
                log.info("User '{}' disconnected from room '{}' (status: {})", username, roomCode, status);
            }
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.error("Transport error for session {}: {}", session.getId(), exception.getMessage());
        afterConnectionClosed(session, CloseStatus.SERVER_ERROR);
    }

    private void sendSnapshot(WebSocketSession session, String roomCode) {
        try {
            Optional<DocumentSnapshot> snapshot = documentService.getSnapshot(roomCode);
            if (snapshot.isPresent() && snapshot.get().getDocumentData() != null) {
                byte[] docData = snapshot.get().getDocumentData();
                // Prefix with message type 3 (snapshot delivery)
                byte[] message = new byte[docData.length + 1];
                message[0] = 3;
                System.arraycopy(docData, 0, message, 1, docData.length);
                synchronized (session) {
                    session.sendMessage(new BinaryMessage(message));
                }
                log.debug("Sent snapshot to session {} ({} bytes)", session.getId(), docData.length);
            }
        } catch (IOException e) {
            log.error("Failed to send snapshot to session {}", session.getId(), e);
        }
    }

    private String extractRoomCode(WebSocketSession session) {
        String path = session.getUri() != null ? session.getUri().getPath() : "";
        // Path format: /ws/yjs/{roomCode}
        String[] parts = path.split("/");
        if (parts.length >= 4) {
            return parts[3];
        }
        return null;
    }

    private String extractToken(WebSocketSession session) {
        String query = session.getUri() != null ? session.getUri().getQuery() : null;
        if (query != null) {
            for (String param : query.split("&")) {
                String[] kv = param.split("=", 2);
                if (kv.length == 2 && "token".equals(kv[0])) {
                    return kv[1];
                }
            }
        }
        return null;
    }

    /**
     * Get the number of active sessions in a room (for monitoring).
     */
    public int getSessionCount(String roomCode) {
        Set<WebSocketSession> sessions = roomSessions.get(roomCode);
        return sessions != null ? sessions.size() : 0;
    }
}
