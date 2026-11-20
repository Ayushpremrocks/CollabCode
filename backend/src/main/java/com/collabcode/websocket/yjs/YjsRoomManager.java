package com.collabcode.websocket.yjs;

import com.collabcode.event.RoomEvents;
import com.collabcode.service.DocumentService;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Owns all live {@link YjsRoom}s and their persistence.
 *
 * Persistence is throttled: a room's document is written to the database only
 * when it changed, at most once per flush interval (60 s), immediately when the
 * last user leaves, and on shutdown. Previously every connected client wrote a
 * snapshot every 30 s, so with 3 users the 20-entry history covered ~3 minutes.
 */
@Component
public class YjsRoomManager {

    private static final Logger log = LoggerFactory.getLogger(YjsRoomManager.class);

    private final Map<String, YjsRoom> rooms = new ConcurrentHashMap<>();
    private final DocumentService documentService;

    public YjsRoomManager(DocumentService documentService) {
        this.documentService = documentService;
    }

    /** Joins (creating/loading the room if needed) and replays the document to the peer. */
    public YjsRoom join(String roomCode, YjsRoom.Peer peer, boolean owner, boolean readOnly) {
        while (true) {
            YjsRoom room = rooms.computeIfAbsent(roomCode, code ->
                    new YjsRoom(code, documentService.getLatestDocument(code).orElse(null), readOnly));
            if (room.join(peer, owner)) {
                return room;
            }
            rooms.remove(roomCode, room); // raced with eviction — retry with a fresh room
        }
    }

    public YjsRoom get(String roomCode) {
        return rooms.get(roomCode);
    }

    public void leave(String roomCode, String peerId) {
        YjsRoom room = rooms.get(roomCode);
        if (room == null) return;
        room.leave(peerId);
        if (room.peerCount() == 0) {
            flush(room);
            evictIfIdle(room);
        }
    }

    /** Periodically persists changed documents and evicts idle rooms. */
    @Scheduled(fixedDelayString = "${app.yjs.flush-interval-ms:60000}")
    public void flushAll() {
        for (YjsRoom room : rooms.values()) {
            flush(room);
            evictIfIdle(room);
        }
    }

    @PreDestroy
    public void flushOnShutdown() {
        log.info("[Yjs] Shutting down — flushing {} room(s)", rooms.size());
        rooms.values().forEach(this::flush);
    }

    void flush(YjsRoom room) {
        byte[] state = room.takeDirtyBase();
        if (state == null) return;
        try {
            documentService.saveSnapshot(room.roomCode(), state);
            log.debug("[Yjs] Persisted room {} ({} bytes)", room.roomCode(), state.length);
        } catch (Exception e) {
            log.error("[Yjs] Failed to persist room {}: {}", room.roomCode(), e.getMessage());
            room.markDirty(); // retry on the next flush
        }
    }

    private void evictIfIdle(YjsRoom room) {
        if (room.closeIfIdle()) {
            rooms.remove(room.roomCode(), room);
        }
    }

    // ── Room events ──────────────────────────────────────────────────────────

    @TransactionalEventListener
    public void onRoomDeleted(RoomEvents.RoomDeleted event) {
        YjsRoom room = rooms.remove(event.roomCode());
        if (room != null) {
            room.closeAll(YjsProtocol.CLOSE_NOT_FOUND, "Room " + event.reason());
        }
    }

    @TransactionalEventListener
    public void onReadOnlyChanged(RoomEvents.RoomReadOnlyChanged event) {
        YjsRoom room = rooms.get(event.roomCode());
        if (room != null) {
            room.setReadOnly(event.readOnly());
        }
    }

    int roomCount() {
        return rooms.size();
    }
}
