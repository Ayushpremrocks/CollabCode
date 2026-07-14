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
import java.util.stream.Collectors;

@Service
public class DocumentService {

    private static final int MAX_SNAPSHOTS = 20;

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

    /** Returns the latest snapshot for a room (for Yjs load) */
    public Optional<DocumentSnapshot> getSnapshot(String roomCode) {
        Room room = roomRepository.findByRoomCode(roomCode).orElse(null);
        if (room == null) return Optional.empty();
        return snapshotRepository.findTopByRoomIdOrderByUpdatedAtDesc(room.getId());
    }

    /** Get a specific snapshot by ID (for history preview) */
    public Optional<DocumentSnapshot> getSnapshotById(Long snapshotId) {
        return snapshotRepository.findById(snapshotId);
    }

    /** Saves a new snapshot entry and prunes beyond MAX_SNAPSHOTS */
    @Transactional
    public void saveSnapshot(String roomCode, byte[] documentData) {
        Room room = roomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new IllegalArgumentException("Room not found: " + roomCode));

        // Get current language
        String language = snapshotRepository
                .findTopByRoomIdOrderByUpdatedAtDesc(room.getId())
                .map(DocumentSnapshot::getLanguage)
                .orElse("javascript");

        DocumentSnapshot snapshot = DocumentSnapshot.builder()
                .room(room)
                .documentData(documentData)
                .language(language)
                .snapshotLabel("Auto-saved at " + Instant.now().toString().substring(0, 19).replace("T", " "))
                .build();
        snapshotRepository.save(snapshot);

        // Update room's last active time
        roomService.updateLastActive(roomCode);

        // Prune to MAX_SNAPSHOTS
        pruneSnapshots(room.getId());
    }

    /** Prune oldest snapshots beyond MAX_SNAPSHOTS */
    private void pruneSnapshots(Long roomId) {
        long count = snapshotRepository.countByRoomId(roomId);
        if (count > MAX_SNAPSHOTS) {
            List<DocumentSnapshot> ordered = snapshotRepository.findByRoomIdOrderByUpdatedAtAsc(roomId);
            long toDelete = count - MAX_SNAPSHOTS;
            for (int i = 0; i < toDelete && i < ordered.size(); i++) {
                snapshotRepository.delete(ordered.get(i));
            }
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

        // Update language on the latest snapshot, or create a minimal one
        Optional<DocumentSnapshot> latest = snapshotRepository.findTopByRoomIdOrderByUpdatedAtDesc(room.getId());

        if (latest.isPresent()) {
            DocumentSnapshot snapshot = latest.get();
            snapshot.setLanguage(language);
            snapshotRepository.save(snapshot);
        } else {
            DocumentSnapshot snapshot = DocumentSnapshot.builder()
                    .room(room)
                    .language(language)
                    .snapshotLabel("Initial")
                    .build();
            snapshotRepository.save(snapshot);
        }
    }

    public String getLanguage(String roomCode) {
        return getSnapshot(roomCode)
                .map(DocumentSnapshot::getLanguage)
                .filter(this::isSupportedLanguage)
                .orElse("javascript");
    }

    /** Get all snapshot metadata (no document data) for the history panel */
    public List<SnapshotDTO> getSnapshotHistory(String roomCode) {
        Room room = roomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new IllegalArgumentException("Room not found: " + roomCode));

        return snapshotRepository.findByRoomIdOrderByUpdatedAtDesc(room.getId())
                .stream()
                .map(s -> SnapshotDTO.builder()
                        .id(s.getId())
                        .updatedAt(s.getUpdatedAt())
                        .language(s.getLanguage())
                        .snapshotLabel(s.getSnapshotLabel() != null ? s.getSnapshotLabel() : "Snapshot")
                        .build())
                .collect(Collectors.toList());
    }

    /** Restore a snapshot: create a new "current" snapshot copying the selected one's data */
    @Transactional
    public void restoreSnapshot(String roomCode, Long snapshotId) {
        Room room = roomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new IllegalArgumentException("Room not found: " + roomCode));

        DocumentSnapshot target = snapshotRepository.findById(snapshotId)
                .orElseThrow(() -> new IllegalArgumentException("Snapshot not found: " + snapshotId));

        if (!target.getRoom().getId().equals(room.getId())) {
            throw new IllegalArgumentException("Snapshot does not belong to this room");
        }

        DocumentSnapshot restored = DocumentSnapshot.builder()
                .room(room)
                .documentData(target.getDocumentData())
                .language(target.getLanguage())
                .snapshotLabel("Restored from " + target.getUpdatedAt().toString().substring(0, 10))
                .build();
        snapshotRepository.save(restored);

        pruneSnapshots(room.getId());
    }
}
