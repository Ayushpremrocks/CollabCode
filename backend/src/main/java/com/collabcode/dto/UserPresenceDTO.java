package com.collabcode.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserPresenceDTO {

    private Long userId;
    private String username;
    private String name;
    private String imageUrl;
    private boolean online;
}
