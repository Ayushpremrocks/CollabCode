package com.collabcode.dto;

/**
 * Response payload from the AI agent test endpoint.
 * Contains only the text content — never any credentials or internal details.
 */
public class AgentResponse {

    private final String response;

    public AgentResponse(String response) {
        this.response = response;
    }

    public String getResponse() {
        return response;
    }
}
