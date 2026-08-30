package com.collabcode.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class RoomExpiryScheduler {

    private static final Logger log = LoggerFactory.getLogger(RoomExpiryScheduler.class);

    private final RoomService roomService;
    private final SimpMessagingTemplate messagingTemplate;

    public RoomExpiryScheduler(RoomService roomService, SimpMessagingTemplate messagingTemplate) {
        this.roomService = roomService;
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Runs every hour. Notifies active users before deleting expired rooms.
     */
    @Scheduled(cron = "0 0 * * * *")
    public void cleanupExpiredRooms() {
        log.info("[Scheduler] Running room expiry cleanup...");
        try {
            List<String> deletedCodes = roomService.deleteExpiredRooms();
            for (String roomCode : deletedCodes) {
                log.info("[Scheduler] Deleted expired room: {}", roomCode);
                // Notify any connected clients that this room was deleted
                messagingTemplate.convertAndSend(
                        "/topic/room/" + roomCode + "/room-deleted",
                        Map.of("roomCode", roomCode, "reason", "expired")
                );
            }
            if (deletedCodes.isEmpty()) {
                log.info("[Scheduler] No expired rooms found.");
            } else {
                log.info("[Scheduler] Deleted {} expired room(s).", deletedCodes.size());
            }
        } catch (Exception e) {
            log.error("[Scheduler] Error during room expiry cleanup", e);
        }
    }
}
