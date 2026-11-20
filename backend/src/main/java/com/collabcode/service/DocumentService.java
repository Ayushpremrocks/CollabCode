package com.collabcode.service;

import com.collabcode.dto.SnapshotDTO;
import com.collabcode.model.DocumentSnapshot;
import com.collabcode.model.Room;
import com.collabcode.repository.DocumentSnapshotRepository;
import com.collabcode.repository.RoomRepository;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Persists Yjs document snapshots and the room language.
 *
 * Snapshots are written by the Yjs relay (YjsRoomManager), which throttles writes
 * and only persists when the document actually changed. "Restore" is performed by
 * the host's browser as a normal collaborative edit, so every connected user sees
 * it immediately; this service therefore only reads history.
 */
@Service
public class DocumentService {

    static final int MAX_SNAPSHOTS = 30;

    public static final Set<String> SUPPORTED_LANGUAGES = Set.of(
            "javascript", "typescript", "python", "java", "cpp", "c", "csharp",
            "go", "rust", "kotlin", "swift", "ruby", "php", "html", "css",
            "json", "sql", "markdown", "yaml", "bash"
    );

    private final DocumentSnapshotRepository snapshotRepository;
    private final RoomRepository roomRepository;
    private final RoomService roomService;

    public DocumentService(DocumentSnapshotRepository snapshotRepository,
                           RoomRepository roomRepository,
                           @Lazy RoomService roomService) {
        this.snapshotRepository = snapshotRepository;
        this.roomRepository = roomRepository;
        this.roomService = roomService;
    }

    /** Latest persisted document state for a room (used to seed the Yjs relay). */
    @Transactional(readOnly = true)
    public Optional<byte[]> getLatestDocument(String roomCode) {
        return roomRepository.findByRoomCode(roomCode)
                .flatMap(room -> snapshotRepository.findTopByRoomIdOrderByUpdatedAtDesc(room.getId()))
                .map(DocumentSnapshot::getDocumentData);
    }

    /** A snapshot by id, but only if it belongs to the given room (prevents cross-room reads). */
    @Transactional(readOnly = true)
    public Optional<DocumentSnapshot> getSnapshotForRoom(String roomCode, Long snapshotId) {
        Room room = roomRepository.findByRoomCode(roomCode).orElse(null);
        if (room == null) return Optional.empty();
        return snapshotRepository.findById(snapshotId)
                .filter(s -> s.getRoom().getId().equals(room.getId()));
    }

    /** Saves a new snapshot entry and prunes beyond MAX_SNAPSHOTS. */
    @Transactional
    public void saveSnapshot(String roomCode, byte[] documentData) {
        Room room = roomRepository.findByRoomCode(roomCode).orElse(null);
        if (room == null) return; // room was deleted while the relay still held it

        String language = snapshotRepository.findTopByRoomIdOrderByUpdatedAtDesc(room.getId())
                .map(DocumentSnapshot::getLanguage)
                .orElse("javascript");

        snapshotRepository.save(DocumentSnapshot.builder()
                .room(room)
                .documentData(documentData)
                .language(language)
                .snapshotLabel("Auto-saved")
                .build());

        roomService.updateLastActive(roomCode);
        pruneSnapshots(room.getId());
    }

    private void pruneSnapshots(Long roomId) {
        long count = snapshotRepository.countByRoomId(roomId);
        if (count > MAX_SNAPSHOTS) {
            List<DocumentSnapshot> oldestFirst = snapshotRepository.findByRoomIdOrderByUpdatedAtAsc(roomId);
            snapshotRepository.deleteAll(oldestFirst.subList(0, (int) (count - MAX_SNAPSHOTS)));
        }
    }

    public boolean isSupportedLanguage(String language) {
        return language != null && SUPPORTED_LANGUAGES.contains(language);
    }

    @Transactional
    public void updateLanguage(String roomCode, String language) {
        if (!isSupportedLanguage(language)) {
            throw new IllegalArgumentException("Unsupported language: " + language);
        }
        Room room = roomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new IllegalArgumentException("Room not found: " + roomCode));

        Optional<DocumentSnapshot> latest = snapshotRepository.findTopByRoomIdOrderByUpdatedAtDesc(room.getId());
        if (latest.isPresent()) {
            latest.get().setLanguage(language);
            snapshotRepository.save(latest.get());
        } else {
            snapshotRepository.save(DocumentSnapshot.builder()
                    .room(room)
                    .language(language)
                    .snapshotLabel("Initial")
                    .build());
        }
    }

    @Transactional(readOnly = true)
    public String getLanguage(String roomCode) {
        return roomRepository.findByRoomCode(roomCode)
                .flatMap(room -> snapshotRepository.findTopByRoomIdOrderByUpdatedAtDesc(room.getId()))
                .map(DocumentSnapshot::getLanguage)
                .filter(this::isSupportedLanguage)
                .orElse("javascript");
    }

    /** Snapshot metadata (no document bytes) for the history panel, newest first. */
    @Transactional(readOnly = true)
    public List<SnapshotDTO> getSnapshotHistory(String roomCode) {
        Room room = roomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new IllegalArgumentException("Room not found: " + roomCode));

        return snapshotRepository.findByRoomIdOrderByUpdatedAtDesc(room.getId()).stream()
                .filter(s -> s.getDocumentData() != null && s.getDocumentData().length > 0)
                .map(s -> SnapshotDTO.builder()
                        .id(s.getId())
                        .updatedAt(s.getUpdatedAt() != null ? s.getUpdatedAt() : Instant.EPOCH)
                        .language(s.getLanguage())
                        .snapshotLabel(s.getSnapshotLabel() != null ? s.getSnapshotLabel() : "Snapshot")
                        .build())
                .toList();
    }
}
