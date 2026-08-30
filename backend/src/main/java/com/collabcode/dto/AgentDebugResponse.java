package com.collabcode.dto;

/**
 * Full result of an agentic debugging session returned to the frontend.
 *
 * The frontend MUST display this to the user and require explicit approval
 * before applying proposedFix to the shared Yjs document.
 *
 * Fields are deliberately flat (no nested DTO) so the JSON is easy to
 * consume on the React side without extra type mapping.
 */
public class AgentDebugResponse {

    /** The original code submitted by the user — unchanged. */
    private String originalCode;

    /**
     * The complete corrected code extracted from Gemini's response.
     * Null if the agent could not extract a valid code block.
     */
    private String proposedFix;

    /** Gemini's explanation of what was wrong and how it was fixed. */
    private String reasoning;

    // ── Initial run (original code) ─────────────────────────────────────────

    private String initialStatus;
    private String initialStdout;
    private String initialStderr;
    private String initialCompileOutput;

    // ── Verification run (proposed fix) ─────────────────────────────────────

    private String verificationStatus;
    private Integer verificationStatusId;
    private String verificationStdout;
    private String verificationStderr;
    private String verificationCompileOutput;

    // ── Agent loop metadata ──────────────────────────────────────────────────

    /** Number of Gemini iterations used (1–3). */
    private int iterations;

    /**
     * True if the proposed fix compiled and ran successfully (statusId == 3).
     * The agent may still return a proposedFix even when success == false —
     * in that case it represents the best attempt after maxIterations.
     */
    private boolean success;

    /** Non-null only if the agent loop itself encountered an unexpected error. */
    private String agentError;

    // ── Builder ─────────────────────────────────────────────────────────────

    private AgentDebugResponse() {}

    public static Builder builder() { return new Builder(); }

    public static final class Builder {
        private final AgentDebugResponse r = new AgentDebugResponse();

        public Builder originalCode(String v)              { r.originalCode = v; return this; }
        public Builder proposedFix(String v)               { r.proposedFix = v; return this; }
        public Builder reasoning(String v)                 { r.reasoning = v; return this; }

        public Builder initialStatus(String v)             { r.initialStatus = v; return this; }
        public Builder initialStdout(String v)             { r.initialStdout = v; return this; }
        public Builder initialStderr(String v)             { r.initialStderr = v; return this; }
        public Builder initialCompileOutput(String v)      { r.initialCompileOutput = v; return this; }

        public Builder verificationStatus(String v)        { r.verificationStatus = v; return this; }
        public Builder verificationStatusId(Integer v)     { r.verificationStatusId = v; return this; }
        public Builder verificationStdout(String v)        { r.verificationStdout = v; return this; }
        public Builder verificationStderr(String v)        { r.verificationStderr = v; return this; }
        public Builder verificationCompileOutput(String v) { r.verificationCompileOutput = v; return this; }

        public Builder iterations(int v)                   { r.iterations = v; return this; }
        public Builder success(boolean v)                  { r.success = v; return this; }
        public Builder agentError(String v)                { r.agentError = v; return this; }

        public AgentDebugResponse build()                  { return r; }
    }

    // ── Getters (Jackson serialisation) ─────────────────────────────────────

    public String getOriginalCode()             { return originalCode; }
    public String getProposedFix()              { return proposedFix; }
    public String getReasoning()                { return reasoning; }

    public String getInitialStatus()            { return initialStatus; }
    public String getInitialStdout()            { return initialStdout; }
    public String getInitialStderr()            { return initialStderr; }
    public String getInitialCompileOutput()     { return initialCompileOutput; }

    public String  getVerificationStatus()      { return verificationStatus; }
    public Integer getVerificationStatusId()    { return verificationStatusId; }
    public String  getVerificationStdout()      { return verificationStdout; }
    public String  getVerificationStderr()      { return verificationStderr; }
    public String  getVerificationCompileOutput(){ return verificationCompileOutput; }

    public int     getIterations()              { return iterations; }
    public boolean isSuccess()                  { return success; }
    public String  getAgentError()              { return agentError; }
}
