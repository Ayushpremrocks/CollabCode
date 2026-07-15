package com.collabcode.service;

import com.collabcode.dto.UserPresenceDTO;
import lombok.AllArgsConstructor;
import lombok.Data;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PresenceService {

    private final SimpMessagingTemplate messagingTemplate;

    // roomCode -> (username -> count of active connections)
    private final Map<String, Map<String, Integer>> roomPresence = new ConcurrentHashMap<>();

    // username -> UserInfo (stores rich profile data)
    private final Map<String, UserInfo> userInfoMap = new ConcurrentHashMap<>();

    @Data
    @AllArgsConstructor
    private static class UserInfo {
        private Long userId;
        private String name;
        private String imageUrl;
    }

    public PresenceService(@Lazy SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void addUser(String roomCode, String username, Long userId, String name, String imageUrl) {
        userInfoMap.put(username, new UserInfo(userId, name, imageUrl));

        Map<String, Integer> userCounts = roomPresence.computeIfAbsent(roomCode, k -> new ConcurrentHashMap<>());
        int count = userCounts.merge(username, 1, Integer::sum);
        
        // Only broadcast if this is the first connection for this user in this room
        if (count == 1) {
            broadcastPresence(roomCode);
        }
    }

    // Overloaded method for backward compatibility
    public void addUser(String roomCode, String username, Long userId) {
        addUser(roomCode, username, userId, null, null);
    }

    public void removeUser(String roomCode, String username) {
        Map<String, Integer> userCounts = roomPresence.get(roomCode);
        if (userCounts != null) {
            Integer count = userCounts.computeIfPresent(username, (k, v) -> v > 1 ? v - 1 : null);
            
            // If count becomes null, the user has closed all tabs for this room
            if (count == null) {
                if (userCounts.isEmpty()) {
                    roomPresence.remove(roomCode);
                }
                broadcastPresence(roomCode);
            }
        }
    }

    public List<UserPresenceDTO> getActiveUsers(String roomCode) {
        Map<String, Integer> userCounts = roomPresence.getOrDefault(roomCode, Map.of());
        List<UserPresenceDTO> presenceList = new ArrayList<>();
        for (String username : userCounts.keySet()) {
            UserInfo info = userInfoMap.get(username);
            presenceList.add(UserPresenceDTO.builder()
                    .userId(info != null ? info.getUserId() : 0L)
                    .username(username)
                    .name(info != null ? info.getName() : null)
                    .imageUrl(info != null ? info.getImageUrl() : null)
                    .online(true)
                    .build());
        }
        return presenceList;
    }

    public boolean isUserOnline(String roomCode, String username) {
        Map<String, Integer> userCounts = roomPresence.get(roomCode);
        return userCounts != null && userCounts.containsKey(username);
    }

    public int getActiveUserCount(String roomCode) {
        Map<String, Integer> userCounts = roomPresence.get(roomCode);
        return userCounts != null ? userCounts.size() : 0;
    }

    private void broadcastPresence(String roomCode) {
        List<UserPresenceDTO> activeUsers = getActiveUsers(roomCode);
        messagingTemplate.convertAndSend("/topic/room/" + roomCode + "/presence", activeUsers);
    }
}
