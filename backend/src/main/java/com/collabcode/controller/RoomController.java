package com.collabcode.controller;

import com.collabcode.dto.*;
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
    private final SimpMessagingTemplate messagingTemplate;
    private final UserProvisioningService userProvisioningService;

    public RoomController(RoomService roomService,
                          DocumentService documentService,
                          CodeExecutionService codeExecutionService,
                          SimpMessagingTemplate messagingTemplate,
                          UserProvisioningService userProvisioningService) {
        this.roomService = roomService;
        this.documentService = documentService;
        this.codeExecutionService = codeExecutionService;
        this.messagingTemplate = messagingTemplate;
        this.userProvisioningService = userProvisioningService;
    }

    @PostMapping
    public ResponseEntity<RoomResponse> createRoom(
            @Valid @RequestBody CreateRoomRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        RoomResponse room = roomService.createRoom(request,
                jwt.getSubject(),
                jwt.getClaimAsString("username"),
                jwt.getClaimAsString("email"));
        return ResponseEntity.ok(room);
    }

    @PostMapping("/join")
    public ResponseEntity<RoomResponse> joinRoom(
            @Valid @RequestBody JoinRoomRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        RoomResponse room = roomService.joinRoom(request.getRoomCode(),
                jwt.getSubject(),
                jwt.getClaimAsString("username"),
                jwt.getClaimAsString("email"));
        return ResponseEntity.ok(room);
    }

    @GetMapping("/{roomCode}")
    public ResponseEntity<RoomResponse> getRoom(@PathVariable String roomCode) {
        RoomResponse room = roomService.getRoomByCode(roomCode);
        return ResponseEntity.ok(room);
    }

    @GetMapping
    public ResponseEntity<List<RoomResponse>> getUserRooms(
            @AuthenticationPrincipal Jwt jwt) {
        System.out.println("[RoomController] getUserRooms called!");
        if (jwt == null) {
            System.out.println("[RoomController] JWT is null!");
            throw new IllegalStateException("Authentication token is missing");
        } else {
            System.out.println("[RoomController] JWT Subject: " + jwt.getSubject());
            System.out.println("[RoomController] JWT Claims: " + jwt.getClaims());
        }
        try {
            List<RoomResponse> rooms = roomService.getUserRooms(
                    jwt.getSubject(),
                    jwt.getClaimAsString("username"),
                    jwt.getClaimAsString("email"));
            System.out.println("[RoomController] getUserRooms returning " + rooms.size() + " rooms.");
            return ResponseEntity.ok(rooms);
        } catch (Exception e) {
            System.err.println("[RoomController] Exception in getUserRooms:");
            e.printStackTrace();
            throw e;
        }
    }

    /**
     * Feature 2: Delete room (host only)
     */
    @DeleteMapping("/{roomCode}")
    public ResponseEntity<Void> deleteRoom(
            @PathVariable String roomCode,
            @AuthenticationPrincipal Jwt jwt) {
        String clerkUserId = jwt.getSubject();
        String username = jwt.getClaimAsString("username");
        String email = jwt.getClaimAsString("email");

        // Resolve local username for the STOMP notification payload
        String localUsername = userProvisioningService
                .getOrCreateUser(clerkUserId, username, email)
                .getUsername();

        // Notify users before deletion
        messagingTemplate.convertAndSend(
                "/topic/room/" + roomCode + "/room-deleted",
                Map.of("roomCode", roomCode, "deletedBy", localUsername)
        );
        roomService.deleteRoom(roomCode, clerkUserId, username, email);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{roomCode}/lock")
    public ResponseEntity<Map<String, Boolean>> toggleLock(
            @PathVariable String roomCode,
            @RequestBody Map<String, Boolean> request,
            @AuthenticationPrincipal Jwt jwt) {
        String clerkUserId = jwt.getSubject();
        String username = jwt.getClaimAsString("username");
        String email = jwt.getClaimAsString("email");

        boolean locked = request.getOrDefault("locked", false);

        boolean newLockState = roomService.toggleLock(roomCode, locked, clerkUserId, username, email);

        // Resolve local username for STOMP broadcast
        String localUsername = userProvisioningService
                .getOrCreateUser(clerkUserId, username, email)
                .getUsername();

        messagingTemplate.convertAndSend(
                "/topic/room/" + roomCode + "/lock",
                Map.of("locked", newLockState, "toggledBy", localUsername)
        );

        return ResponseEntity.ok(Map.of("locked", newLockState));
    }

    /**
     * Feature 8: Get snapshot history for a room
     */
    @GetMapping("/{roomCode}/snapshots")
    public ResponseEntity<List<SnapshotDTO>> getSnapshots(@PathVariable String roomCode) {
        List<SnapshotDTO> snapshots = documentService.getSnapshotHistory(roomCode);
        return ResponseEntity.ok(snapshots);
    }

    /**
     * Feature 8: Get a specific snapshot's document data (Base64 encoded for preview)
     */
    @GetMapping("/{roomCode}/snapshots/{snapshotId}")
    public ResponseEntity<Map<String, String>> getSnapshotData(
            @PathVariable String roomCode,
            @PathVariable Long snapshotId) {
        return documentService.getSnapshotById(snapshotId)
                .map(s -> {
                    String encoded = s.getDocumentData() != null
                            ? Base64.getEncoder().encodeToString(s.getDocumentData())
                            : "";
                    return ResponseEntity.ok(Map.of(
                            "data", encoded,
                            "language", s.getLanguage() != null ? s.getLanguage() : "javascript"
                    ));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Feature 8: Restore a snapshot (host only)
     */
    @PostMapping("/{roomCode}/snapshots/{snapshotId}/restore")
    public ResponseEntity<Void> restoreSnapshot(
            @PathVariable String roomCode,
            @PathVariable Long snapshotId,
            @AuthenticationPrincipal Jwt jwt) {
        // Resolve local username to check ownership (isOwner uses local username)
        String localUsername = userProvisioningService
                .getOrCreateUser(
                        jwt.getSubject(),
                        jwt.getClaimAsString("username"),
                        jwt.getClaimAsString("email"))
                .getUsername();
        if (!roomService.isOwner(roomCode, localUsername)) {
            return ResponseEntity.status(403).build();
        }
        documentService.restoreSnapshot(roomCode, snapshotId);
        return ResponseEntity.ok().build();
    }

    /**
     * Feature 5: Execute code via Wandbox
     */
    @PostMapping("/execute")
    public ResponseEntity<ExecuteCodeResponse> executeCode(
            @RequestBody ExecuteCodeRequest request) {
        ExecuteCodeResponse result = codeExecutionService.execute(request);
        return ResponseEntity.ok(result);
    }
}
