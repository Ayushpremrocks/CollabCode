package com.collabcode.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExecuteCodeResponse {
    private String stdout;
    private String stderr;
    private String compileOutput;
    private String status;
    private Integer statusId;
    private String time;
    private Long memory;
}
