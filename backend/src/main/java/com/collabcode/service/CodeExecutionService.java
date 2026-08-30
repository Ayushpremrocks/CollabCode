package com.collabcode.service;

import com.collabcode.dto.ExecuteCodeRequest;
import com.collabcode.dto.ExecuteCodeResponse;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@Service
public class CodeExecutionService {

    private static final Logger log = LoggerFactory.getLogger(CodeExecutionService.class);

    private static final String WANDBOX_URL = "https://wandbox.org/api/compile.json";

    // Mapping our languages to exact Wandbox compiler IDs
    private static final Map<String, String> LANGUAGE_TO_WANDBOX_COMPILER = Map.ofEntries(
            Map.entry("javascript", "nodejs-20.17.0"),
            Map.entry("typescript", "typescript-5.6.2"),
            Map.entry("python",     "cpython-3.13.8"),
            Map.entry("java",       "openjdk-jdk-21+35"),
            Map.entry("cpp",        "gcc-head"),
            Map.entry("c",          "gcc-head-c"),
            Map.entry("csharp",     "dotnetcore-8.0.402"),
            Map.entry("go",         "go-1.23.2"),
            Map.entry("rust",       "rust-1.82.0"),
            Map.entry("swift",      "swift-6.0.1"),
            Map.entry("ruby",       "ruby-3.4.9"),
            Map.entry("php",        "php-8.3.12"),
            Map.entry("sql",        "sqlite-3.46.1"),
            Map.entry("bash",       "bash")
    );

    // Lazily initialized to avoid blocking startup.
    // HttpClient.newHttpClient() spawns a SelectorManager thread; on Render's free-tier
    // sandbox (0.1 CPU) that thread never gets scheduled during startup, causing a hang.
    private volatile HttpClient httpClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private HttpClient getHttpClient() {
        if (httpClient == null) {
            synchronized (this) {
                if (httpClient == null) {
                    httpClient = HttpClient.newHttpClient();
                }
            }
        }
        return httpClient;
    }

    public ExecuteCodeResponse execute(ExecuteCodeRequest request) {
        String compilerId = LANGUAGE_TO_WANDBOX_COMPILER.get(request.getLanguage());

        if (compilerId == null) {
            return ExecuteCodeResponse.builder()
                    .status("Not Supported")
                    .statusId(0)
                    .stderr("Language '" + request.getLanguage() + "' does not support execution via keyless runner.")
                    .build();
        }

        try {
            // Build Wandbox payload
            Map<String, Object> payload = Map.of(
                    "compiler", compilerId,
                    "code", request.getCode(),
                    "stdin", request.getStdin() != null ? request.getStdin() : ""
            );

            String body = objectMapper.writeValueAsString(payload);

            HttpRequest apiRequest = HttpRequest.newBuilder()
                    .uri(URI.create(WANDBOX_URL))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();

            log.info("Sending compile request to Wandbox for compiler: {}", compilerId);
            HttpResponse<String> response = getHttpClient().send(apiRequest, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 400) {
                log.error("Wandbox API error: {}", response.body());
                return ExecuteCodeResponse.builder()
                        .status("API Error")
                        .statusId(0)
                        .stderr("Wandbox execution server returned status " + response.statusCode())
                        .build();
            }

            WandboxResponse wandbox = objectMapper.readValue(response.body(), WandboxResponse.class);

            // Map status
            String status = "Accepted";
            int statusId = 3;

            // Check if there was compilation output that signifies an error
            if (wandbox.compilerOutput != null && !wandbox.compilerOutput.isBlank() && 
                    (wandbox.programOutput == null || wandbox.programOutput.isBlank()) && 
                    !"0".equals(wandbox.status)) {
                status = "Compilation Error";
                statusId = 6;
            } else if (!"0".equals(wandbox.status)) {
                status = "Runtime Error";
                statusId = 11;
            }

            return ExecuteCodeResponse.builder()
                    .stdout(wandbox.programOutput)
                    .stderr(wandbox.programError)
                    .compileOutput(wandbox.compilerOutput != null ? wandbox.compilerOutput : wandbox.compilerError)
                    .status(status)
                    .statusId(statusId)
                    .time(null) // Wandbox public API doesn't report time directly in execution metadata
                    .memory(null)
                    .build();

        } catch (Exception e) {
            log.error("Wandbox execution failed", e);
            return ExecuteCodeResponse.builder()
                    .status("Internal Error")
                    .statusId(0)
                    .stderr("Execution failed: " + e.getMessage())
                    .build();
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class WandboxResponse {
        public String status;
        @JsonProperty("compiler_output")
        public String compilerOutput;
        @JsonProperty("compiler_error")
        public String compilerError;
        @JsonProperty("program_output")
        public String programOutput;
        @JsonProperty("program_error")
        public String programError;
    }
}
