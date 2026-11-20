package com.collabcode.service;

import com.google.genai.Client;
import com.google.genai.types.GenerateContentResponse;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Thin wrapper around the Google Gen AI SDK.
 *
 * One shared {@link Client} is created lazily and closed on shutdown (the SDK
 * client is AutoCloseable; the previous version built — and leaked — a new one
 * per request). GEMINI_API_KEY never leaves the backend.
 */
@Service
public class GeminiService {

    private static final Logger log = LoggerFactory.getLogger(GeminiService.class);

    private final String apiKey;
    private final String model;
    private volatile Client client;

    public GeminiService(@Value("${app.gemini.api-key:}") String apiKey,
                         @Value("${app.gemini.model:gemini-3.6-flash}") String model) {
        this.apiKey = apiKey;
        this.model = model;
    }

    /**
     * @throws IllegalStateException if the API key is not configured
     * @throws RuntimeException      with a user-safe message if the API call fails
     */
    public String generate(String prompt) {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("[Gemini] GEMINI_API_KEY is not configured");
            throw new IllegalStateException("The AI assistant is not configured on the server.");
        }
        try {
            GenerateContentResponse response = client().models.generateContent(model, prompt, null);
            String text = response.text();
            return text != null ? text : "";
        } catch (Exception e) {
            log.error("[Gemini] Call to model {} failed: {}: {}", model, e.getClass().getSimpleName(), e.getMessage());
            throw new RuntimeException("AI service is temporarily unavailable. Please try again later.", e);
        }
    }

    private Client client() {
        if (client == null) {
            synchronized (this) {
                if (client == null) {
                    client = Client.builder().apiKey(apiKey).build();
                }
            }
        }
        return client;
    }

    @PreDestroy
    void close() {
        if (client != null) {
            try {
                client.close();
            } catch (Exception e) {
                log.debug("[Gemini] Error closing client: {}", e.getMessage());
            }
        }
    }
}
