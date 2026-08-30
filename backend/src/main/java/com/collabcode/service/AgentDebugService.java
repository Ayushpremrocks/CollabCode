package com.collabcode.service;

import com.collabcode.dto.AgentDebugRequest;
import com.collabcode.dto.AgentDebugResponse;
import com.collabcode.dto.ExecuteCodeRequest;
import com.collabcode.dto.ExecuteCodeResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * AgentDebugService — the core agentic debugging loop for CollabCode.
 *
 * Algorithm (up to MAX_ITERATIONS rounds):
 *
 *   1. Run the original code through the existing CodeExecutionService.
 *   2. Build a structured prompt containing the code, language, error output,
 *      and any user-supplied context hint.
 *   3. Ask GeminiService to produce a fix (reasoning + complete corrected code).
 *   4. Extract the corrected code from Gemini's markdown response.
 *   5. Run the proposed fix through CodeExecutionService to verify it works.
 *   6. If statusId == 3 (Accepted) → success, stop iterating.
 *   7. Otherwise update the error context with the new failure and retry.
 *   8. Return AgentDebugResponse with all details for human review.
 *
 * ⚠  This service NEVER modifies the shared Yjs document.
 *    The proposed fix is returned to the frontend where the user must
 *    click "Approve" before it is applied.
 *
 * Reuses the EXISTING CodeExecutionService — no second execution system.
 */
@Service
public class AgentDebugService {

    private static final Logger log = LoggerFactory.getLogger(AgentDebugService.class);

    /** Maximum Gemini → execute cycles before giving up. */
    private static final int MAX_ITERATIONS = 3;

    /**
     * Maximum characters of error output forwarded to Gemini per iteration.
     * Prevents runaway token usage on huge compiler dumps.
     */
    private static final int MAX_ERROR_CHARS = 2000;

    /**
     * Maximum characters of code forwarded to Gemini.
     * Gemini Flash supports 1M tokens; 12 000 chars ≈ safe budget.
     */
    private static final int MAX_CODE_CHARS = 12_000;

    // ── Code block extraction — matches ```lang\n...\n``` and ``` ... ``` ────
    private static final Pattern CODE_BLOCK_PATTERN = Pattern.compile(
            "```(?:[a-zA-Z+#]*)?\\s*\\n([\\s\\S]*?)```",
            Pattern.CASE_INSENSITIVE
    );

    private final GeminiService geminiService;
    private final CodeExecutionService codeExecutionService;

    public AgentDebugService(GeminiService geminiService,
                             CodeExecutionService codeExecutionService) {
        this.geminiService = geminiService;
        this.codeExecutionService = codeExecutionService;
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Runs the full agentic debugging loop for the given request.
     * This is a blocking call (Wandbox + Gemini network I/O); callers should
     * invoke it from a request thread (Spring's default) or a virtual thread.
     *
     * @param request validated debug request
     * @return full session result — always non-null
     */
    public AgentDebugResponse debug(AgentDebugRequest request) {
        String originalCode = request.getCode();
        String language     = request.getLanguage();
        String userHint     = request.getErrorContext();

        log.info("[AgentDebug] Starting session — language={}, codeLen={}", language, originalCode.length());

        // ── Step 1: Run original code to get actual error output ─────────────
        ExecuteCodeResponse initialResult = runCode(originalCode, language);
        log.info("[AgentDebug] Initial run status: {} (id={})",
                initialResult.getStatus(), initialResult.getStatusId());

        // Seed the error context for the first Gemini call
        String currentCode  = originalCode;
        String currentError = buildErrorSummary(initialResult);

        String proposedFix        = null;
        String reasoning          = null;
        ExecuteCodeResponse verificationResult = null;
        int iterations = 0;

        // ── Steps 2–7: Agentic loop ──────────────────────────────────────────
        try {
            for (int i = 0; i < MAX_ITERATIONS; i++) {
                iterations = i + 1;
                log.info("[AgentDebug] Iteration {} / {}", iterations, MAX_ITERATIONS);

                // 2. Build prompt
                String prompt = buildDebugPrompt(currentCode, language, currentError, userHint, i);

                // 3. Call Gemini
                String geminiRaw = geminiService.generate(prompt);
                log.debug("[AgentDebug] Gemini responded ({} chars)", geminiRaw.length());

                // 4. Parse reasoning + code from response
                reasoning   = extractReasoning(geminiRaw);
                proposedFix = extractCode(geminiRaw);

                if (proposedFix == null || proposedFix.isBlank()) {
                    log.warn("[AgentDebug] Could not extract code block from Gemini response on iteration {}", iterations);
                    // Keep best-effort reasoning but cannot verify; stop loop
                    break;
                }

                log.info("[AgentDebug] Proposed fix extracted ({} chars) — running verification",
                        proposedFix.length());

                // 5. Run proposed fix
                currentCode = proposedFix;
                verificationResult = runCode(proposedFix, language);

                log.info("[AgentDebug] Verification status: {} (id={})",
                        verificationResult.getStatus(), verificationResult.getStatusId());

                // 6. Check success (statusId 3 = Accepted)
                if (Integer.valueOf(3).equals(verificationResult.getStatusId())) {
                    log.info("[AgentDebug] ✓ Fix verified successfully on iteration {}", iterations);
                    break;
                }

                // 7. Not fixed — prepare next iteration with updated error
                currentError = buildErrorSummary(verificationResult);
                log.info("[AgentDebug] Fix still failing, preparing iteration {}", iterations + 1);
            }
        } catch (Exception e) {
            // Unexpected agent loop failure — return best partial result with error info
            log.error("[AgentDebug] Agent loop error: {}", e.getMessage(), e);
            return buildResponse(originalCode, proposedFix, reasoning,
                    initialResult, verificationResult, iterations, false,
                    "Agent encountered an error: " + e.getMessage());
        }

        boolean success = verificationResult != null
                && Integer.valueOf(3).equals(verificationResult.getStatusId());

        log.info("[AgentDebug] Session complete — success={}, iterations={}", success, iterations);
        return buildResponse(originalCode, proposedFix, reasoning,
                initialResult, verificationResult, iterations, success, null);
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /** Delegates to existing CodeExecutionService — no new execution system. */
    private ExecuteCodeResponse runCode(String code, String language) {
        ExecuteCodeRequest req = ExecuteCodeRequest.builder()
                .code(code)
                .language(language)
                .stdin("")
                .build();
        return codeExecutionService.execute(req);
    }

    /**
     * Builds the Gemini prompt.
     * On the first iteration we describe the error; on subsequent iterations
     * we note that the previous fix failed and show the new error.
     */
    private String buildDebugPrompt(String code, String language,
                                    String errorSummary, String userHint,
                                    int iterationIndex) {
        String truncatedCode = code.length() > MAX_CODE_CHARS
                ? code.substring(0, MAX_CODE_CHARS) + "\n// ... (truncated)"
                : code;

        StringBuilder sb = new StringBuilder(512);
        sb.append("You are an expert ").append(language).append(" debugger integrated into a collaborative code editor.\n\n");

        if (iterationIndex > 0) {
            sb.append("⚠ Your previous fix did not fully resolve the problem. Please analyze the new error carefully and propose a different approach.\n\n");
        }

        sb.append("## Code (").append(language).append(")\n\n");
        sb.append("```").append(language).append("\n");
        sb.append(truncatedCode).append("\n");
        sb.append("```\n\n");

        if (errorSummary != null && !errorSummary.isBlank()) {
            sb.append("## Execution Output\n\n```\n");
            sb.append(errorSummary, 0, Math.min(errorSummary.length(), MAX_ERROR_CHARS));
            sb.append("\n```\n\n");
        }

        if (userHint != null && !userHint.isBlank()) {
            sb.append("## User Context\n\n").append(userHint).append("\n\n");
        }

        sb.append("## Instructions\n\n");
        sb.append("1. Start your response with `REASONING:` followed by 2–4 sentences explaining what is wrong and how you will fix it.\n");
        sb.append("2. Then provide the **complete** corrected code in a single fenced code block (```").append(language).append(" ... ```).\n");
        sb.append("3. Do NOT omit or truncate any part of the original code.\n");
        sb.append("4. Do NOT add explanatory comments inside the code block unless they were already present.\n");
        sb.append("5. Output nothing after the closing code fence.\n");

        return sb.toString();
    }

    /**
     * Extracts the text before the first code fence as the reasoning.
     * Falls back to the full response if no fence is found.
     */
    private String extractReasoning(String geminiResponse) {
        int fenceIdx = geminiResponse.indexOf("```");
        String before = fenceIdx > 0
                ? geminiResponse.substring(0, fenceIdx).trim()
                : geminiResponse.trim();

        // Strip the leading "REASONING:" label if present
        if (before.startsWith("REASONING:")) {
            before = before.substring("REASONING:".length()).trim();
        }
        return before.isEmpty() ? null : before;
    }

    /**
     * Extracts code from the FIRST fenced code block in the response.
     * Handles both ``` and ```lang variants.
     */
    private String extractCode(String geminiResponse) {
        Matcher m = CODE_BLOCK_PATTERN.matcher(geminiResponse);
        if (m.find()) {
            return m.group(1).trim();
        }
        return null;
    }

    /**
     * Builds a concise error summary from an execution result to feed back
     * into the next Gemini iteration.
     */
    private String buildErrorSummary(ExecuteCodeResponse result) {
        StringBuilder sb = new StringBuilder();
        sb.append("Status: ").append(result.getStatus()).append("\n");

        if (result.getCompileOutput() != null && !result.getCompileOutput().isBlank()) {
            sb.append("Compiler output:\n").append(truncate(result.getCompileOutput())).append("\n");
        }
        if (result.getStderr() != null && !result.getStderr().isBlank()) {
            sb.append("Stderr:\n").append(truncate(result.getStderr())).append("\n");
        }
        if (result.getStdout() != null && !result.getStdout().isBlank()) {
            sb.append("Stdout:\n").append(truncate(result.getStdout())).append("\n");
        }
        return sb.toString();
    }

    private String truncate(String s) {
        return s.length() > MAX_ERROR_CHARS ? s.substring(0, MAX_ERROR_CHARS) + "..." : s;
    }

    /** Assembles the final AgentDebugResponse from all collected data. */
    private AgentDebugResponse buildResponse(String originalCode,
                                             String proposedFix,
                                             String reasoning,
                                             ExecuteCodeResponse initial,
                                             ExecuteCodeResponse verification,
                                             int iterations,
                                             boolean success,
                                             String agentError) {
        AgentDebugResponse.Builder b = AgentDebugResponse.builder()
                .originalCode(originalCode)
                .proposedFix(proposedFix)
                .reasoning(reasoning)
                .iterations(iterations)
                .success(success)
                .agentError(agentError);

        if (initial != null) {
            b.initialStatus(initial.getStatus())
             .initialStdout(initial.getStdout())
             .initialStderr(initial.getStderr())
             .initialCompileOutput(initial.getCompileOutput());
        }

        if (verification != null) {
            b.verificationStatus(verification.getStatus())
             .verificationStatusId(verification.getStatusId())
             .verificationStdout(verification.getStdout())
             .verificationStderr(verification.getStderr())
             .verificationCompileOutput(verification.getCompileOutput());
        }

        return b.build();
    }
}
