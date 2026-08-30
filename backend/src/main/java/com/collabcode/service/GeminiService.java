package com.collabcode.service;

import com.google.genai.Client;
import com.google.genai.types.GenerateContentResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * GeminiService — the reasoning layer for the CollabCode AI agent.
 *
 * Phase 1: Simple prompt → response wrapper around the Google Gen AI SDK.
 * Future phases will extend this with tool/function calling, multi-turn
 * conversation memory, and autonomous debugging loop support.
 *
 * Security: GEMINI_API_KEY is backend-only. It is never logged, never
 * returned in responses, and has no frontend equivalent (no VITE_* var).
 */
@Service
public class GeminiService {

    private static final Logger log = LoggerFactory.getLogger(GeminiService.class);

    /**
     * Model to use. gemini-2.0-flash is fast, cost-efficient, and supports
     * function calling — ideal for the future agentic debugging loop.
     */
    private static final String MODEL = "gemini-2.0-flash";

    @Value("${app.gemini.api-key:}")
    private String apiKey;

    /**
     * Sends a plain text prompt to Gemini and returns the text response.
     *
     * @param prompt the user/agent prompt (must not be null or blank)
     * @return the model's text output
     * @throws IllegalStateException if the API key is not configured
     * @throws RuntimeException      if the Gemini API call fails
     */
    public String generate(String prompt) {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("[GeminiService] GEMINI_API_KEY is not configured. " +
                      "Add it to backend/.env (local) or Render environment variables (production).");
            throw new IllegalStateException(
                "Gemini API key is not configured. Contact the administrator.");
        }

        log.debug("[GeminiService] Sending prompt to Gemini ({} chars)", prompt.length());

        try {
            // Build a per-request client — lightweight, uses the API key directly.
            // Future: share a singleton client once production load warrants it.
            Client client = Client.builder().apiKey(apiKey).build();

            GenerateContentResponse response = client
                    .models
                    .generateContent(MODEL, prompt, null);

            String text = response.text();
            log.debug("[GeminiService] Received response ({} chars)", text != null ? text.length() : 0);
            return text != null ? text : "";

        } catch (IllegalStateException e) {
            // Re-throw config errors as-is
            throw e;
        } catch (Exception e) {
            // Wrap Gemini API/network errors — never expose raw exception to the client
            log.error("[GeminiService] Gemini API call failed: {} — {}", e.getClass().getSimpleName(), e.getMessage());
            throw new RuntimeException("AI service is temporarily unavailable. Please try again later.", e);
        }
    }
}
