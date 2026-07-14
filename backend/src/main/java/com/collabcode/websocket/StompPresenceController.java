package com.collabcode.websocket;

import com.collabcode.dto.ChatMessageDTO;
import com.collabcode.dto.RoomStateDTO;
import com.collabcode.dto.UserJoinedEventDTO;
import com.collabcode.dto.UserPresenceDTO;
import com.collabcode.service.DocumentService;
import com.collabcode.service.PresenceService;
import com.collabcode.service.RoomService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Controller
public class StompPresenceController {

    private static final Logger log = LoggerFactory.getLogger(StompPresenceController.class);

    private final PresenceService presenceService;
    private final DocumentService documentService;
    private final RoomService roomService;
    private final SimpMessagingTemplate messagingTemplate;

    public StompPresenceController(PresenceService presenceService,
                                    DocumentService documentService,
                                    RoomService roomService,
                                    SimpMessagingTemplate messagingTemplate) {
        this.presenceService = presenceService;
        this.documentService = documentService;
        this.roomService = roomService;
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/room/{roomCode}/join")
    public void handleJoin(@DestinationVariable String roomCode, Principal principal) {
        if (principal == null) return;

        String username = principal.getName();
        String language = documentService.getLanguage(roomCode);
        log.info("STOMP user-joined: user='{}' room='{}' language='{}'", username, roomCode, language);

        List<UserPresenceDTO> activeUsers = presenceService.getActiveUsers(roomCode);
        messagingTemplate.convertAndSend(
                "/topic/room/" + roomCode + "/presence", activeUsers);

        RoomStateDTO roomState = RoomStateDTO.builder()
                .roomCode(roomCode)
                .language(language)
                .build();
        messagingTemplate.convertAndSend(
                "/topic/room/" + roomCode + "/room-state", roomState);
        log.info("STOMP room-state sent on join: room='{}' language='{}'", roomCode, language);

        UserJoinedEventDTO userJoined = UserJoinedEventDTO.builder()
                .username(username)
                .language(language)
                .build();
        messagingTemplate.convertAndSend(
                "/topic/room/" + roomCode + "/user-joined", userJoined);
    }

    @MessageMapping("/room/{roomCode}/leave")
    public void handleLeave(@DestinationVariable String roomCode, Principal principal) {
        if (principal == null) return;

        String username = principal.getName();
        log.info("STOMP: User '{}' left room '{}'", username, roomCode);

        List<UserPresenceDTO> activeUsers = presenceService.getActiveUsers(roomCode);
        messagingTemplate.convertAndSend(
                "/topic/room/" + roomCode + "/presence", activeUsers);
    }

    @MessageMapping("/room/{roomCode}/language")
    public void handleLanguageChange(
            @DestinationVariable String roomCode,
            @Payload Map<String, String> payload,
            Principal principal) {
        if (principal == null) return;

        String language = payload.get("language");
        if (language == null) {
            log.warn("STOMP language-change ignored: missing language in room '{}'", roomCode);
            return;
        }

        if (!documentService.isSupportedLanguage(language)) {
            log.warn("STOMP language-change ignored: unsupported language '{}' in room '{}'",
                    language, roomCode);
            return;
        }

        String username = principal.getName();
        log.info("STOMP language-change: user='{}' language='{}' room='{}'", username, language, roomCode);

        documentService.updateLanguage(roomCode, language);
        log.info("Language stored in room '{}': '{}'", roomCode, language);

        messagingTemplate.convertAndSend(
                "/topic/room/" + roomCode + "/language",
                Map.of("language", language, "changedBy", username));

        RoomStateDTO roomState = RoomStateDTO.builder()
                .roomCode(roomCode)
                .language(language)
                .build();
        messagingTemplate.convertAndSend(
                "/topic/room/" + roomCode + "/room-state", roomState);
    }

    /**
     * Feature 6: Read-only mode toggle (host only)
     */
    @MessageMapping("/room/{roomCode}/readonly")
    public void handleReadOnlyToggle(
            @DestinationVariable String roomCode,
            @Payload Map<String, Object> payload,
            Principal principal) {
        if (principal == null) return;

        String username = principal.getName();

        if (!roomService.isOwner(roomCode, username)) {
            log.warn("STOMP readonly-toggle: non-owner '{}' attempted to toggle in room '{}'", username, roomCode);
            return;
        }

        boolean readOnly = Boolean.TRUE.equals(payload.get("readOnly"));
        log.info("STOMP readonly-toggle: room='{}' readOnly={} by='{}'", roomCode, readOnly, username);

        messagingTemplate.convertAndSend(
                "/topic/room/" + roomCode + "/readonly",
                Map.of("readOnly", readOnly, "toggledBy", username));
    }

    /**
     * Feature 7: Chat messages
     */
    @MessageMapping("/room/{roomCode}/chat")
    public void handleChat(
            @DestinationVariable String roomCode,
            @Payload Map<String, String> payload,
            Principal principal) {
        if (principal == null) return;

        String username = principal.getName();
        String message = payload.get("message");

        if (message == null || message.isBlank()) return;

        // Trim to reasonable length
        if (message.length() > 1000) {
            message = message.substring(0, 1000);
        }

        log.debug("STOMP chat: user='{}' room='{}' msg='{}'", username, roomCode,
                message.substring(0, Math.min(50, message.length())));

        ChatMessageDTO chatMsg = ChatMessageDTO.builder()
                .username(username)
                .message(message)
                .timestamp(Instant.now().toString())
                .build();

        messagingTemplate.convertAndSend(
                "/topic/room/" + roomCode + "/chat", chatMsg);
    }
}
