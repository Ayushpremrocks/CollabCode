package com.collabcode.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExecuteCodeRequest {
    @NotNull(message = "Code is required")
    @Size(max = 64_000, message = "Code must be at most 64000 characters")
    private String code;

    @NotBlank(message = "Language is required")
    private String language;

    @Size(max = 64_000, message = "Input must be at most 64000 characters")
    private String stdin;
}
