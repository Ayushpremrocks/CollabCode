package com.collabcode.service;

import com.collabcode.dto.CreateRoomRequest;
import com.collabcode.dto.RoomResponse;
import com.collabcode.event.RoomEvents;
import com.collabcode.exception.RoomNotFoundException;
import com.collabcode.model.Room;
import com.collabcode.model.RoomParticipant;
import com.collabcode.model.User;
import com.collabcode.repository.RoomParticipantRepository;
import com.collabcode.repository.RoomRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Room lifecycle + all room-level authorization decisions.
 *
 * Every ownership / membership check compares database IDs inside a transaction.
 * (The previous implementation compared usernames on a lazily-loaded owner proxy
 * outside a transaction, which threw LazyInitializationException and silently
 * broke the read-only toggle and snapshot restore.)
 */
@Service
public class RoomService {

    /** Rooms expire this long after their last activity. */
    public static final long ROOM_TTL_SECONDS = 48 * 3600;

    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 8;

    private final RoomRepository roomRepository;
    private final RoomParticipantRepository participantRepository;
    private final DocumentService documentService;
    private final UserProvisioningService userProvisioningService;
    private final ApplicationEventPublisher events;
    private final SecureRandom random = new SecureRandom();

    public RoomService(RoomRepository roomRepository,
                       RoomParticipantRepository participantRepository,
                       @Lazy DocumentService documentService,
                       UserProvisioningService userProvisioningService,
                       ApplicationEventPublisher events) {
        this.roomRepository = roomRepository;
        this.participantRepository = participantRepository;
        this.documentService = documentService;
        this.userProvisioningService = userProvisioningService;
        this.events = events;
    }

    /** Snapshot of what a given user may do in a given room. */
    public record RoomAccess(boolean exists, boolean expired, boolean member, boolean owner,
                             boolean readOnly, boolean locked) {
        public static final RoomAccess NONE = new RoomAccess(false, false, false, false, false, false);

        /** True when the user may connect to / read the room. */
        public boolean canAccess() {
            return exists && !expired && member;
        }
    }

    // ── Create / join / read ─────────────────────────────────────────────────

    @Transactional
    public RoomResponse createRoom(CreateRoomRequest request, String clerkUserId, String username, String email) {
        User owner = userProvisioningService.getOrCreateUser(clerkUserId, username, email);

        Room room = roomRepository.save(Room.builder()
                .roomCode(generateUniqueCode())
                .name(request.getName().trim())
                .owner(owner)
                .build());

        participantRepository.save(RoomParticipant.builder().room(room).user(owner).build());
        return toRoomResponse(room);
    }

    @Transactional
    public RoomResponse joinRoom(String roomCode, String clerkUserId, String username, String email) {
        User user = userProvisioningService.getOrCreateUser(clerkUserId, username, email);
        Room room = findRoom(roomCode);

        if (isExpired(room)) {
            throw new IllegalArgumentException("Room has expired");
        }

        boolean alreadyMember = participantRepository.existsByRoomIdAndUserId(room.getId(), user.getId());
        if (room.isLocked() && !alreadyMember && !room.getOwner().getId().equals(user.getId())) {
            throw new SecurityException("This room is locked by the host");
        }

        if (!alreadyMember) {
            participantRepository.save(RoomParticipant.builder().room(room).user(user).build());
        }
        return toRoomResponse(room);
    }

    /** Returns room details, but only to users who already joined the room. */
    @Transactional(readOnly = true)
    public RoomResponse getRoomForMember(String roomCode, Long userId) {
        Room room = requireMember(roomCode, userId);
        return toRoomResponse(room);
    }

    @Transactional(readOnly = true)
    public List<RoomResponse> getUserRooms(Long userId) {
        return participantRepository.findByUserId(userId).stream()
                .map(RoomParticipant::getRoom)
                .filter(room -> !isExpired(room))
                .map(this::toRoomResponse)
                .collect(Collectors.toList());
    }

    // ── Authorization helpers ────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public RoomAccess getAccess(String roomCode, Long userId) {
        Room room = roomRepository.findByRoomCode(roomCode).orElse(null);
        if (room == null) return RoomAccess.NONE;
        boolean owner = room.getOwner().getId().equals(userId);
        boolean member = owner || participantRepository.existsByRoomIdAndUserId(room.getId(), userId);
        return new RoomAccess(true, isExpired(room), member, owner, room.isReadOnly(), room.isLocked());
    }

    /** Throws 404 if the room does not exist and 403 if the user is not a participant. */
    @Transactional(readOnly = true)
    public Room requireMember(String roomCode, Long userId) {
        Room room = findRoom(roomCode);
        boolean member = room.getOwner().getId().equals(userId)
                || participantRepository.existsByRoomIdAndUserId(room.getId(), userId);
        if (!member) {
            throw new SecurityException("You are not a participant of this room");
        }
        return room;
    }

    @Transactional(readOnly = true)
    public boolean isOwner(String roomCode, Long userId) {
        return roomRepository.findByRoomCode(roomCode)
                .map(r -> r.getOwner().getId().equals(userId))
                .orElse(false);
    }

    // ── Host-only mutations ──────────────────────────────────────────────────

    /** Deletes the room. Only the owner may do this; the check happens BEFORE anything is broadcast. */
    @Transactional
    public void deleteRoom(String roomCode, Long userId) {
        Room room = requireOwner(roomCode, userId, "Only the room owner can delete this room");
        roomRepository.delete(room); // DB cascade removes participants + snapshots
        events.publishEvent(new RoomEvents.RoomDeleted(roomCode, "deleted"));
    }

    @Transactional
    public boolean setLocked(String roomCode, boolean locked, Long userId) {
        Room room = requireOwner(roomCode, userId, "Only the room owner can lock/unlock this room");
        room.setLocked(locked);
        roomRepository.save(room);
        return locked;
    }

    @Transactional
    public boolean setReadOnly(String roomCode, boolean readOnly, Long userId) {
        Room room = requireOwner(roomCode, userId, "Only the room owner can change edit permissions");
        room.setReadOnly(readOnly);
        roomRepository.save(room);
        events.publishEvent(new RoomEvents.RoomReadOnlyChanged(roomCode, readOnly));
        return readOnly;
    }

    // ── Activity / expiry ────────────────────────────────────────────────────

    /** Records activity and pushes the expiry 48h into the future. */
    @Transactional
    public void updateLastActive(String roomCode) {
        roomRepository.findByRoomCode(roomCode).ifPresent(room -> {
            Instant now = Instant.now();
            room.setLastActiveAt(now);
            room.setExpiresAt(now.plusSeconds(ROOM_TTL_SECONDS));
            roomRepository.save(room);
        });
    }

    /** Deletes all expired rooms and returns their codes. */
    @Transactional
    public List<String> deleteExpiredRooms() {
        List<Room> expired = roomRepository.findByExpiresAtBefore(Instant.now());
        List<String> codes = expired.stream().map(Room::getRoomCode).collect(Collectors.toList());
        roomRepository.deleteAll(expired);
        codes.forEach(code -> events.publishEvent(new RoomEvents.RoomDeleted(code, "expired")));
        return codes;
    }

    // ── Internals ────────────────────────────────────────────────────────────

    private Room findRoom(String roomCode) {
        return roomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new RoomNotFoundException(roomCode));
    }

    private Room requireOwner(String roomCode, Long userId, String message) {
        Room room = findRoom(roomCode);
        if (!room.getOwner().getId().equals(userId)) {
            throw new SecurityException(message);
        }
        return room;
    }

    private static boolean isExpired(Room room) {
        return room.getExpiresAt() != null && Instant.now().isAfter(room.getExpiresAt());
    }

    private RoomResponse toRoomResponse(Room room) {
        List<String> participantNames = participantRepository.findByRoomId(room.getId()).stream()
                .map(p -> p.getUser().getUsername())
                .collect(Collectors.toList());

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
                .readOnly(room.isReadOnly())
                .participants(participantNames)
                .language(documentService.getLanguage(room.getRoomCode()))
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
