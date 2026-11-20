package com.collabcode.service;

import com.collabcode.dto.UserPresenceDTO;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tracks which users are connected to each room (driven by Yjs socket connect /
 * disconnect) and broadcasts the list on {@code /topic/room/{code}/presence}.
 * A user with several tabs open counts once. All methods are synchronized — the
 * previous check-then-act sequences on separate concurrent maps could race.
 */
@Service
public class PresenceService {

    private record UserInfo(Long userId, String name, String imageUrl) {}

    private final SimpMessagingTemplate messagingTemplate;

    // roomCode -> (username -> number of open connections), insertion ordered
    private final Map<String, Map<String, Integer>> roomPresence = new HashMap<>();
    private final Map<String, UserInfo> userInfo = new HashMap<>();

    public PresenceService(@Lazy SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void addUser(String roomCode, String username, Long userId, String name, String imageUrl) {
        boolean changed;
        synchronized (this) {
            UserInfo previous = userInfo.get(username);
            userInfo.put(username, new UserInfo(userId,
                    name != null ? name : previous != null ? previous.name() : null,
                    imageUrl != null ? imageUrl : previous != null ? previous.imageUrl() : null));
            int count = roomPresence.computeIfAbsent(roomCode, k -> new LinkedHashMap<>())
                    .merge(username, 1, Integer::sum);
            changed = count == 1;
        }
        if (changed) broadcastPresence(roomCode);
    }

    public void removeUser(String roomCode, String username) {
        boolean changed = false;
        synchronized (this) {
            Map<String, Integer> counts = roomPresence.get(roomCode);
            if (counts != null && counts.containsKey(username)) {
                int remaining = counts.get(username) - 1;
                if (remaining > 0) {
                    counts.put(username, remaining);
                } else {
                    counts.remove(username);
                    changed = true;
                    if (counts.isEmpty()) roomPresence.remove(roomCode);
                }
            }
        }
        if (changed) broadcastPresence(roomCode);
    }

    public synchronized List<UserPresenceDTO> getActiveUsers(String roomCode) {
        List<UserPresenceDTO> result = new ArrayList<>();
        for (String username : roomPresence.getOrDefault(roomCode, Map.of()).keySet()) {
            UserInfo info = userInfo.get(username);
            result.add(UserPresenceDTO.builder()
                    .userId(info != null ? info.userId() : 0L)
                    .username(username)
                    .name(info != null ? info.name() : null)
                    .imageUrl(info != null ? info.imageUrl() : null)
                    .online(true)
                    .build());
        }
        return result;
    }

    public synchronized boolean isUserOnline(String roomCode, String username) {
        return roomPresence.getOrDefault(roomCode, Map.of()).containsKey(username);
    }

    public void broadcastPresence(String roomCode) {
        messagingTemplate.convertAndSend("/topic/room/" + roomCode + "/presence", getActiveUsers(roomCode));
    }
}
