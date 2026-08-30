package com.collabcode.repository;

import com.collabcode.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {

    Optional<Room> findByRoomCode(String roomCode);

    List<Room> findByOwnerId(Long ownerId);

    boolean existsByRoomCode(String roomCode);

    // For expiry scheduler — find all rooms past their expiry time
    List<Room> findByExpiresAtBefore(Instant now);
}
