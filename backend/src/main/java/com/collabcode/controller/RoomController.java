package com.collabcode.controller;

import com.collabcode.dto.*;
import com.collabcode.model.User;
import com.collabcode.service.ChatHistoryService;
import com.collabcode.service.CodeExecutionService;
import com.collabcode.service.DocumentService;
import com.collabcode.service.RoomService;
import com.collabcode.service.UserProvisioningService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Base64;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomService roomService;
    private final DocumentService documentService;
    private final CodeExecutionService codeExecutionService;
    private final ChatHistoryService chatHistoryService;
    private final SimpMessagingTemplate messagingTemplate;
    private final UserProvisioningService userProvisioningService;

    public RoomController(RoomService roomService,
                          DocumentService documentService,
                          CodeExecutionService codeExecutionService,
                          ChatHistoryService chatHistoryService,
                          SimpMessagingTemplate messagingTemplate,
                          UserProvisioningService userProvisioningService) {
        this.roomService = roomService;
        this.documentService = documentService;
        this.codeExecutionService = codeExecutionService;
        this.chatHistoryService = chatHistoryService;
        this.messagingTemplate = messagingTemplate;
        this.userProvisioningService = userProvisioningService;
    }

    @PostMapping
    public RoomResponse createRoom(@Valid @RequestBody CreateRoomRequest request, @AuthenticationPrincipal Jwt jwt) {
        return roomService.createRoom(request, jwt.getSubject(),
                jwt.getClaimAsString("username"), jwt.getClaimAsString("email"));
    }

    @PostMapping("/join")
    public RoomResponse joinRoom(@Valid @RequestBody JoinRoomRequest request, @AuthenticationPrincipal Jwt jwt) {
        return roomService.joinRoom(request.getRoomCode().trim().toUpperCase(), jwt.getSubject(),
                jwt.getClaimAsString("username"), jwt.getClaimAsString("email"));
    }

    @GetMapping("/{roomCode}")
    public RoomResponse getRoom(@PathVariable String roomCode, @AuthenticationPrincipal Jwt jwt) {
        return roomService.getRoomForMember(roomCode, currentUser(jwt).getId());
    }

    @GetMapping
    public List<RoomResponse> getUserRooms(@AuthenticationPrincipal Jwt jwt) {
        return roomService.getUserRooms(currentUser(jwt).getId());
    }

    /** Host only. Ownership is verified before anyone is notified. */
    @DeleteMapping("/{roomCode}")
    public ResponseEntity<Void> deleteRoom(@PathVariable String roomCode, @AuthenticationPrincipal Jwt jwt) {
        User user = currentUser(jwt);
        roomService.deleteRoom(roomCode, user.getId());
        messagingTemplate.convertAndSend("/topic/room/" + roomCode + "/room-deleted",
                Map.of("roomCode", roomCode, "deletedBy", user.getUsername(), "reason", "deleted"));
        return ResponseEntity.noContent().build();
    }

    /** Host only: when locked, users who have never joined cannot join. */
    @PatchMapping("/{roomCode}/lock")
    public Map<String, Boolean> setLocked(@PathVariable String roomCode,
                                          @RequestBody Map<String, Boolean> request,
                                          @AuthenticationPrincipal Jwt jwt) {
        User user = currentUser(jwt);
        boolean locked = roomService.setLocked(roomCode, Boolean.TRUE.equals(request.get("locked")), user.getId());
        messagingTemplate.convertAndSend("/topic/room/" + roomCode + "/lock",
                Map.of("locked", locked, "toggledBy", user.getUsername()));
        return Map.of("locked", locked);
    }

    /** Host only: when read-only, the server rejects edits from everyone except the host. */
    @PatchMapping("/{roomCode}/read-only")
    public Map<String, Boolean> setReadOnly(@PathVariable String roomCode,
                                            @RequestBody Map<String, Boolean> request,
                                            @AuthenticationPrincipal Jwt jwt) {
        User user = currentUser(jwt);
        boolean readOnly = roomService.setReadOnly(roomCode, Boolean.TRUE.equals(request.get("readOnly")), user.getId());
        messagingTemplate.convertAndSend("/topic/room/" + roomCode + "/readonly",
                Map.of("readOnly", readOnly, "toggledBy", user.getUsername()));
        return Map.of("readOnly", readOnly);
    }

    @GetMapping("/{roomCode}/snapshots")
    public List<SnapshotDTO> getSnapshots(@PathVariable String roomCode, @AuthenticationPrincipal Jwt jwt) {
        roomService.requireMember(roomCode, currentUser(jwt).getId());
        return documentService.getSnapshotHistory(roomCode);
    }

    /** Snapshot bytes (Base64) for preview/restore — only for members, only snapshots of this room. */
    @GetMapping("/{roomCode}/snapshots/{snapshotId}")
    public ResponseEntity<Map<String, String>> getSnapshotData(@PathVariable String roomCode,
                                                               @PathVariable Long snapshotId,
                                                               @AuthenticationPrincipal Jwt jwt) {
        roomService.requireMember(roomCode, currentUser(jwt).getId());
        return documentService.getSnapshotForRoom(roomCode, snapshotId)
                .map(s -> ResponseEntity.ok(Map.of(
                        "data", s.getDocumentData() != null ? Base64.getEncoder().encodeToString(s.getDocumentData()) : "",
                        "language", s.getLanguage() != null ? s.getLanguage() : "javascript")))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{roomCode}/chat")
    public List<ChatMessageDTO> getChatHistory(@PathVariable String roomCode, @AuthenticationPrincipal Jwt jwt) {
        roomService.requireMember(roomCode, currentUser(jwt).getId());
        return chatHistoryService.recent(roomCode);
    }

    /** Runs code through Wandbox. Rate-limited per user (see RateLimitInterceptor). */
    @PostMapping("/execute")
    public ExecuteCodeResponse executeCode(@Valid @RequestBody ExecuteCodeRequest request) {
        return codeExecutionService.execute(request);
    }

    private User currentUser(Jwt jwt) {
        return userProvisioningService.getOrCreateUser(jwt.getSubject(),
                jwt.getClaimAsString("username"), jwt.getClaimAsString("email"));
    }
}
