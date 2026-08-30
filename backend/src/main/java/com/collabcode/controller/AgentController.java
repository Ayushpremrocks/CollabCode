package com.collabcode.controller;

import com.collabcode.dto.AgentRequest;
import com.collabcode.dto.AgentResponse;
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

    public AgentController(GeminiService geminiService) {
        this.geminiService = geminiService;
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
            // API key not configured — return 503 Service Unavailable
            log.warn("[AgentController] Gemini not configured: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", e.getMessage()));

        } catch (Exception e) {
            // Gemini API failure — return 502 Bad Gateway
            log.error("[AgentController] Gemini call failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", e.getMessage()));
        }
    }
}
