package com.collabcode.controller;

import com.collabcode.dto.*;
import com.collabcode.service.CodeExecutionService;
import com.collabcode.service.DocumentService;
import com.collabcode.service.RoomService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
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

    public RoomController(RoomService roomService,
                          DocumentService documentService,
                          CodeExecutionService codeExecutionService,
                          SimpMessagingTemplate messagingTemplate) {
        this.roomService = roomService;
        this.documentService = documentService;
        this.codeExecutionService = codeExecutionService;
        this.messagingTemplate = messagingTemplate;
    }

    @PostMapping
    public ResponseEntity<RoomResponse> createRoom(
            @Valid @RequestBody CreateRoomRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        RoomResponse room = roomService.createRoom(request, userDetails.getUsername());
        return ResponseEntity.ok(room);
    }

    @PostMapping("/join")
    public ResponseEntity<RoomResponse> joinRoom(
            @Valid @RequestBody JoinRoomRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        RoomResponse room = roomService.joinRoom(request.getRoomCode(), userDetails.getUsername());
        return ResponseEntity.ok(room);
    }

    @GetMapping("/{roomCode}")
    public ResponseEntity<RoomResponse> getRoom(@PathVariable String roomCode) {
        RoomResponse room = roomService.getRoomByCode(roomCode);
        return ResponseEntity.ok(room);
    }

    @GetMapping
    public ResponseEntity<List<RoomResponse>> getUserRooms(
            @AuthenticationPrincipal UserDetails userDetails) {
        List<RoomResponse> rooms = roomService.getUserRooms(userDetails.getUsername());
        return ResponseEntity.ok(rooms);
    }

    /**
     * Feature 2: Delete room (host only)
     */
    @DeleteMapping("/{roomCode}")
    public ResponseEntity<Void> deleteRoom(
            @PathVariable String roomCode,
            @AuthenticationPrincipal UserDetails userDetails) {
        // Notify users before deletion
        messagingTemplate.convertAndSend(
                "/topic/room/" + roomCode + "/room-deleted",
                Map.of("roomCode", roomCode, "deletedBy", userDetails.getUsername())
        );
        roomService.deleteRoom(roomCode, userDetails.getUsername());
        return ResponseEntity.noContent().build();
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
            @AuthenticationPrincipal UserDetails userDetails) {
        if (!roomService.isOwner(roomCode, userDetails.getUsername())) {
            return ResponseEntity.status(403).build();
        }
        documentService.restoreSnapshot(roomCode, snapshotId);
        return ResponseEntity.ok().build();
    }

    /**
     * Feature 5: Execute code via Judge0
     */
    @PostMapping("/execute")
    public ResponseEntity<ExecuteCodeResponse> executeCode(
            @RequestBody ExecuteCodeRequest request) {
        ExecuteCodeResponse result = codeExecutionService.execute(request);
        return ResponseEntity.ok(result);
    }
}
