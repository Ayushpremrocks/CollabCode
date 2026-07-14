package com.collabcode.service;

import com.collabcode.dto.UserPresenceDTO;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PresenceService {

    // roomCode -> Set of usernames currently connected
    private final Map<String, Set<String>> roomPresence = new ConcurrentHashMap<>();

    // username -> userId mapping for presence DTOs
    private final Map<String, Long> userIdMap = new ConcurrentHashMap<>();

    public void addUser(String roomCode, String username, Long userId) {
        roomPresence.computeIfAbsent(roomCode, k -> ConcurrentHashMap.newKeySet())
                .add(username);
        userIdMap.put(username, userId);
    }

    public void removeUser(String roomCode, String username) {
        Set<String> users = roomPresence.get(roomCode);
        if (users != null) {
            users.remove(username);
            if (users.isEmpty()) {
                roomPresence.remove(roomCode);
            }
        }
    }

    public List<UserPresenceDTO> getActiveUsers(String roomCode) {
        Set<String> users = roomPresence.getOrDefault(roomCode, Set.of());
        List<UserPresenceDTO> presenceList = new ArrayList<>();
        for (String username : users) {
            presenceList.add(UserPresenceDTO.builder()
                    .userId(userIdMap.getOrDefault(username, 0L))
                    .username(username)
                    .online(true)
                    .build());
        }
        return presenceList;
    }

    public boolean isUserOnline(String roomCode, String username) {
        Set<String> users = roomPresence.get(roomCode);
        return users != null && users.contains(username);
    }

    public int getActiveUserCount(String roomCode) {
        Set<String> users = roomPresence.get(roomCode);
        return users != null ? users.size() : 0;
    }
}
