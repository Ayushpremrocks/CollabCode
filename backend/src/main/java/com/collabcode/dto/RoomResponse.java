package com.collabcode.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoomResponse {

    private Long id;
    private String roomCode;
    private String name;
    private String ownerUsername;
    private Long ownerId;
    private Instant createdAt;
    private Instant expiresAt;
    private List<String> participants;
    private String language;
}
