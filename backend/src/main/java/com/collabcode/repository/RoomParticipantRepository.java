package com.collabcode.repository;

import com.collabcode.model.RoomParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface RoomParticipantRepository extends JpaRepository<RoomParticipant, Long> {

    List<RoomParticipant> findByRoomId(Long roomId);

    List<RoomParticipant> findByUserId(Long userId);

    boolean existsByRoomIdAndUserId(Long roomId, Long userId);

    void deleteByRoomIdAndUserId(Long roomId, Long userId);
}
