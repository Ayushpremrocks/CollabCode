package com.collabcode.service;

import com.collabcode.dto.CreateRoomRequest;
import com.collabcode.dto.RoomResponse;
import com.collabcode.model.Room;
import com.collabcode.model.RoomParticipant;
import com.collabcode.model.User;
import com.collabcode.repository.RoomParticipantRepository;
import com.collabcode.repository.RoomRepository;
import com.collabcode.repository.UserRepository;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class RoomService {

    private final RoomRepository roomRepository;
    private final RoomParticipantRepository participantRepository;
    private final UserRepository userRepository;
    private final DocumentService documentService;
    private final UserProvisioningService userProvisioningService;

    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 8;
    private final SecureRandom random = new SecureRandom();

    public RoomService(RoomRepository roomRepository,
                       RoomParticipantRepository participantRepository,
                       UserRepository userRepository,
                       @Lazy DocumentService documentService,
                       UserProvisioningService userProvisioningService) {
        this.roomRepository = roomRepository;
        this.participantRepository = participantRepository;
        this.userRepository = userRepository;
        this.documentService = documentService;
        this.userProvisioningService = userProvisioningService;
    }

    @Transactional
    public RoomResponse createRoom(CreateRoomRequest request, String clerkUserId, String username, String email) {
        User owner = userProvisioningService.getOrCreateUser(clerkUserId, username, email);

        String roomCode = generateUniqueCode();

        Room room = Room.builder()
                .roomCode(roomCode)
                .name(request.getName())
                .owner(owner)
                .build();

        room = roomRepository.save(room);

        // Owner is automatically a participant
        RoomParticipant participant = RoomParticipant.builder()
                .room(room)
                .user(owner)
                .build();
        participantRepository.save(participant);

        return toRoomResponse(room);
    }

    @Transactional
    public RoomResponse joinRoom(String roomCode, String clerkUserId, String username, String email) {
        User user = userProvisioningService.getOrCreateUser(clerkUserId, username, email);

        Room room = roomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));

        if (room.getExpiresAt() != null && Instant.now().isAfter(room.getExpiresAt())) {
            throw new IllegalArgumentException("Room has expired");
        }

        if (room.isLocked() && !room.getOwner().getId().equals(user.getId()) && !participantRepository.existsByRoomIdAndUserId(room.getId(), user.getId())) {
            throw new SecurityException("This room is locked by the host");
        }

        if (!participantRepository.existsByRoomIdAndUserId(room.getId(), user.getId())) {
            RoomParticipant participant = RoomParticipant.builder()
                    .room(room)
                    .user(user)
                    .build();
            participantRepository.save(participant);
        }

        return toRoomResponse(room);
    }

    public RoomResponse getRoomByCode(String roomCode) {
        Room room = roomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));
        return toRoomResponse(room);
    }

    public List<RoomResponse> getUserRooms(String clerkUserId, String username, String email) {
        User user = userProvisioningService.getOrCreateUser(clerkUserId, username, email);

        List<RoomParticipant> participations = participantRepository.findByUserId(user.getId());

        return participations.stream()
                .map(p -> toRoomResponse(p.getRoom()))
                .collect(Collectors.toList());
    }

    public boolean isUserInRoom(String roomCode, String username) {
        Room room = roomRepository.findByRoomCode(roomCode).orElse(null);
        if (room == null) return false;

        // Look up by local username (set by STOMP interceptor / WS handler)
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) return false;

        return participantRepository.existsByRoomIdAndUserId(room.getId(), user.getId());
    }

    /**
     * Delete a room — only the owner can do this.
     * Returns the room name for notification purposes.
     */
    @Transactional
    public String deleteRoom(String roomCode, String clerkUserId, String username, String email) {
        User user = userProvisioningService.getOrCreateUser(clerkUserId, username, email);

        Room room = roomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));

        if (!room.getOwner().getId().equals(user.getId())) {
            throw new SecurityException("Only the room owner can delete this room");
        }

        String roomName = room.getName();

        // Cascade handles participants + snapshots
        roomRepository.delete(room);

        return roomName;
    }

    @Transactional
    public boolean toggleLock(String roomCode, boolean locked, String clerkUserId, String username, String email) {
        User user = userProvisioningService.getOrCreateUser(clerkUserId, username, email);

        Room room = roomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));

        if (!room.getOwner().getId().equals(user.getId())) {
            throw new SecurityException("Only the room owner can lock/unlock this room");
        }

        room.setLocked(locked);
        roomRepository.save(room);
        
        return locked;
    }

    /**
     * Update the room's last active time (called on each snapshot save).
     * Also extends expiry by 48h from now.
     */
    @Transactional
    public void updateLastActive(String roomCode) {
        roomRepository.findByRoomCode(roomCode).ifPresent(room -> {
            room.setLastActiveAt(Instant.now());
            room.setExpiresAt(Instant.now().plusSeconds(48 * 3600));
            roomRepository.save(room);
        });
    }

    /**
     * Delete all expired rooms. Returns list of deleted room codes for STOMP notification.
     */
    @Transactional
    public List<String> deleteExpiredRooms() {
        List<Room> expired = roomRepository.findByExpiresAtBefore(Instant.now());
        List<String> deletedCodes = expired.stream().map(Room::getRoomCode).collect(Collectors.toList());
        for (Room room : expired) {
            roomRepository.delete(room);
        }
        return deletedCodes;
    }

    /**
     * Check if a user is the owner of a room.
     */
    public boolean isOwner(String roomCode, String username) {
        return roomRepository.findByRoomCode(roomCode)
                .map(r -> r.getOwner().getUsername().equals(username))
                .orElse(false);
    }

    private RoomResponse toRoomResponse(Room room) {
        List<String> participantNames = participantRepository.findByRoomId(room.getId())
                .stream()
                .map(p -> p.getUser().getUsername())
                .collect(Collectors.toList());

        String language = documentService.getLanguage(room.getRoomCode());

        return RoomResponse.builder()
                .id(room.getId())
                .roomCode(room.getRoomCode())
                .name(room.getName())
                .ownerUsername(room.getOwner().getUsername())
                .ownerId(room.getOwner().getId())
                .ownerClerkId(room.getOwner().getClerkUserId())
                .createdAt(room.getCreatedAt())
                .expiresAt(room.getExpiresAt())
                .isLocked(room.isLocked())
                .participants(participantNames)
                .language(language)
                .build();
    }

    private String generateUniqueCode() {
        String code;
        do {
            StringBuilder sb = new StringBuilder(CODE_LENGTH);
            for (int i = 0; i < CODE_LENGTH; i++) {
                sb.append(CODE_CHARS.charAt(random.nextInt(CODE_CHARS.length())));
            }
            code = sb.toString();
        } while (roomRepository.existsByRoomCode(code));
        return code;
    }
}
