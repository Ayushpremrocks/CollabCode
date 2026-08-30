package com.collabcode.controller;

import com.collabcode.dto.AgentDebugRequest;
import com.collabcode.dto.AgentDebugResponse;
import com.collabcode.dto.AgentRequest;
import com.collabcode.dto.AgentResponse;
import com.collabcode.service.AgentDebugService;
import com.collabcode.service.GeminiService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * AgentController — Phase 1 REST controller for the CollabCode AI agent.
 *
 * Currently exposes a single test endpoint to validate the
 * Frontend → Spring Boot → Gemini API → Spring Boot → Frontend flow.
 *
 * Future phases will add:
 *   - /api/agent/debug  (agentic: inspect code, run it, propose fix, verify, await approval)
 *   - /api/agent/apply  (apply an approved agent patch to the Yjs document)
 *
 * Security: all endpoints require a valid Clerk JWT (enforced by SecurityConfig).
 * The GEMINI_API_KEY is never included in any response.
 */
@RestController
@RequestMapping("/api/agent")
public class AgentController {

    private static final Logger log = LoggerFactory.getLogger(AgentController.class);

    private final GeminiService geminiService;
    private final AgentDebugService agentDebugService;

    public AgentController(GeminiService geminiService,
                           AgentDebugService agentDebugService) {
        this.geminiService = geminiService;
        this.agentDebugService = agentDebugService;
    }

    /**
     * Phase 1 integration test endpoint.
     *
     * POST /api/agent/test
     * Authorization: Bearer <Clerk JWT>
     * Content-Type: application/json
     *
     * Request:  { "prompt": "Explain what a null pointer exception is." }
     * Response: { "response": "..." }
     */
    @PostMapping("/test")
    public ResponseEntity<?> testGemini(@Valid @RequestBody AgentRequest request) {
        log.info("[AgentController] /api/agent/test called (prompt length: {} chars)",
                request.getPrompt().length());

        try {
            String geminiResponse = geminiService.generate(request.getPrompt());
            log.info("[AgentController] Gemini responded successfully ({} chars)", geminiResponse.length());
            return ResponseEntity.ok(new AgentResponse(geminiResponse));

        } catch (IllegalStateException e) {
            log.warn("[AgentController] Gemini not configured: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", e.getMessage()));

        } catch (Exception e) {
            log.error("[AgentController] Gemini call failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Phase 2 — agentic debugging endpoint.
     *
     * POST /api/agent/debug
     * Authorization: Bearer <Clerk JWT>
     * Content-Type: application/json
     *
     * Request:  { "code": "...", "language": "python", "errorContext": "optional hint" }
     * Response: AgentDebugResponse — proposedFix requires human approval before application
     *
     * The response always includes the proposedFix as plain text.
     * The frontend is responsible for showing a diff and requiring the user to click Approve.
     * This endpoint NEVER touches the Yjs shared document.
     */
    @PostMapping("/debug")
    public ResponseEntity<?> debugCode(@Valid @RequestBody AgentDebugRequest request) {
        log.info("[AgentController] /api/agent/debug called — language={}, codeLen={}",
                request.getLanguage(), request.getCode().length());

        try {
            AgentDebugResponse result = agentDebugService.debug(request);
            log.info("[AgentController] Debug session complete — success={}, iterations={}",
                    result.isSuccess(), result.getIterations());
            return ResponseEntity.ok(result);

        } catch (IllegalStateException e) {
            log.warn("[AgentController] Gemini not configured: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", e.getMessage()));

        } catch (Exception e) {
            log.error("[AgentController] Debug session failed: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Debug session failed: " + e.getMessage()));
        }
    }
}
