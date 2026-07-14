package com.collabcode.repository;

import com.collabcode.model.DocumentSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentSnapshotRepository extends JpaRepository<DocumentSnapshot, Long> {

    // Latest snapshot for a room (for loading into Yjs)
    Optional<DocumentSnapshot> findTopByRoomIdOrderByUpdatedAtDesc(Long roomId);

    // All snapshots ordered newest first (for history panel)
    List<DocumentSnapshot> findByRoomIdOrderByUpdatedAtDesc(Long roomId);

    // Count snapshots for a room (for pruning)
    long countByRoomId(Long roomId);

    // Delete all snapshots for a room
    void deleteByRoomId(Long roomId);

    // Find oldest snapshots beyond the 20 most recent (for pruning)
    List<DocumentSnapshot> findByRoomIdOrderByUpdatedAtAsc(Long roomId);
}
