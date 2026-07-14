package com.collabcode.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SnapshotDTO {
    private Long id;
    private Instant updatedAt;
    private String language;
    private String snapshotLabel;
}
