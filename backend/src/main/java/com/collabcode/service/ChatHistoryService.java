package com.collabcode.service;

import com.collabcode.dto.ChatMessageDTO;
import com.collabcode.event.RoomEvents;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Keeps the most recent chat messages per room in memory so users who refresh
 * or join late see the conversation. Not durable across server restarts — chat
 * is ephemeral by design (rooms themselves expire after 48 h of inactivity).
 */
@Service
public class ChatHistoryService {

    static final int MAX_MESSAGES_PER_ROOM = 100;

    private final Map<String, Deque<ChatMessageDTO>> history = new ConcurrentHashMap<>();

    public void add(String roomCode, ChatMessageDTO message) {
        Deque<ChatMessageDTO> messages = history.computeIfAbsent(roomCode, k -> new ArrayDeque<>());
        synchronized (messages) {
            messages.addLast(message);
            while (messages.size() > MAX_MESSAGES_PER_ROOM) messages.removeFirst();
        }
    }

    public List<ChatMessageDTO> recent(String roomCode) {
        Deque<ChatMessageDTO> messages = history.get(roomCode);
        if (messages == null) return List.of();
        synchronized (messages) {
            return new ArrayList<>(messages);
        }
    }

    @TransactionalEventListener
    public void onRoomDeleted(RoomEvents.RoomDeleted event) {
        history.remove(event.roomCode());
    }
}
