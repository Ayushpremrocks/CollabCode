package com.collabcode.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request to start an agentic debugging session.
 *
 * The agent will:
 *  1. Run the original code using the existing CodeExecutionService.
 *  2. Ask Gemini to propose a fix based on the error output.
 *  3. Run the proposed fix and verify the result.
 *  4. Iterate up to maxIterations times if still failing.
 *  5. Return the proposed fix + full reasoning for human approval.
 *
 * NO code is applied to the shared editor without explicit user approval.
 */
public class AgentDebugRequest {

    @NotBlank(message = "Code must not be blank")
    @Size(max = 16000, message = "Code must be at most 16000 characters")
    private String code;

    @NotBlank(message = "Language must not be blank")
    private String language;

    /** Optional free-text hint from the user about what is wrong. */
    @Size(max = 1000, message = "Error context must be at most 1000 characters")
    private String errorContext;

    public AgentDebugRequest() {}

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public String getErrorContext() { return errorContext; }
    public void setErrorContext(String errorContext) { this.errorContext = errorContext; }
}
