package com.collabcode.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request payload for the AI agent test endpoint.
 * The prompt is validated server-side before being forwarded to Gemini.
 */
public class AgentRequest {

    @NotBlank(message = "Prompt must not be blank")
    @Size(max = 8000, message = "Prompt must be at most 8000 characters")
    private String prompt;

    public AgentRequest() {}

    public AgentRequest(String prompt) {
        this.prompt = prompt;
    }

    public String getPrompt() {
        return prompt;
    }

    public void setPrompt(String prompt) {
        this.prompt = prompt;
    }
}
