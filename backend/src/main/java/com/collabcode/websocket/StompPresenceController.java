package com.collabcode.websocket;

import com.collabcode.dto.ChatMessageDTO;
import com.collabcode.dto.RoomStateDTO;
import com.collabcode.dto.UserJoinedEventDTO;
import com.collabcode.service.ChatHistoryService;
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
import java.util.Map;

/**
 * STOMP handlers for room events. Membership is already enforced by
 * {@link StompAuthChannelInterceptor} before any of these methods run.
 */
@Controller
public class StompPresenceController {

    private static final Logger log = LoggerFactory.getLogger(StompPresenceController.class);
    static final int MAX_CHAT_LENGTH = 1000;
    private static final int MAX_NAME_LENGTH = 80;

    private final PresenceService presenceService;
    private final DocumentService documentService;
    private final RoomService roomService;
    private final ChatHistoryService chatHistoryService;
    private final SimpMessagingTemplate messagingTemplate;

    public StompPresenceController(PresenceService presenceService,
                                   DocumentService documentService,
                                   RoomService roomService,
                                   ChatHistoryService chatHistoryService,
                                   SimpMessagingTemplate messagingTemplate) {
        this.presenceService = presenceService;
        this.documentService = documentService;
        this.roomService = roomService;
        this.chatHistoryService = chatHistoryService;
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/room/{roomCode}/join")
    public void handleJoin(@DestinationVariable String roomCode, Principal principal) {
        StompPrincipal user = StompAuthChannelInterceptor.principalOf(principal);
        if (user == null) return;

        String language = documentService.getLanguage(roomCode);
        messagingTemplate.convertAndSend("/topic/room/" + roomCode + "/room-state",
                RoomStateDTO.builder().roomCode(roomCode).language(language).build());
        messagingTemplate.convertAndSend("/topic/room/" + roomCode + "/user-joined",
                UserJoinedEventDTO.builder().username(user.username()).language(language).build());
        // Re-broadcast presence: the subscriber may have missed the broadcast that
        // happened when its Yjs socket connected (the two sockets race).
        presenceService.broadcastPresence(roomCode);
    }

    @MessageMapping("/room/{roomCode}/language")
    public void handleLanguageChange(@DestinationVariable String roomCode,
                                     @Payload Map<String, String> payload,
                                     Principal principal) {
        StompPrincipal user = StompAuthChannelInterceptor.principalOf(principal);
        String language = payload.get("language");
        if (user == null || !documentService.isSupportedLanguage(language)) return;

        RoomService.RoomAccess access = roomService.getAccess(roomCode, user.userId());
        if (access.readOnly() && !access.owner()) {
            log.info("[STOMP] Language change by '{}' ignored: room {} is read-only", user.username(), roomCode);
            return;
        }

        documentService.updateLanguage(roomCode, language);
        messagingTemplate.convertAndSend("/topic/room/" + roomCode + "/language",
                Map.of("language", language, "changedBy", user.username()));
        messagingTemplate.convertAndSend("/topic/room/" + roomCode + "/room-state",
                RoomStateDTO.builder().roomCode(roomCode).language(language).build());
    }

    @MessageMapping("/room/{roomCode}/chat")
    public void handleChat(@DestinationVariable String roomCode,
                           @Payload Map<String, String> payload,
                           Principal principal) {
        StompPrincipal user = StompAuthChannelInterceptor.principalOf(principal);
        if (user == null) return;

        String message = payload.get("message");
        if (message == null || message.isBlank()) return;
        message = message.strip();
        if (message.length() > MAX_CHAT_LENGTH) message = message.substring(0, MAX_CHAT_LENGTH);

        String name = payload.get("name");
        if (name != null && name.length() > MAX_NAME_LENGTH) name = name.substring(0, MAX_NAME_LENGTH);
        String imageUrl = payload.get("imageUrl");
        if (imageUrl != null && !imageUrl.startsWith("https://")) imageUrl = null;

        ChatMessageDTO chatMsg = ChatMessageDTO.builder()
                .username(user.username())
                .name(name)
                .imageUrl(imageUrl)
                .message(message)
                .timestamp(Instant.now().toString())
                .build();

        chatHistoryService.add(roomCode, chatMsg);
        messagingTemplate.convertAndSend("/topic/room/" + roomCode + "/chat", chatMsg);
    }
}
