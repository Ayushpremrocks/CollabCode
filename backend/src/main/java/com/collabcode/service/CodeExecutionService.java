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
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.Set;

/**
 * Executes code through Wandbox's public, keyless compile API.
 *
 * Status ids follow Judge0 conventions used by the frontend:
 * 3 Accepted, 5 Time Limit Exceeded, 6 Compilation Error, 11 Runtime Error, 0 not run.
 */
@Service
public class CodeExecutionService {

    private static final Logger log = LoggerFactory.getLogger(CodeExecutionService.class);

    public static final int STATUS_ACCEPTED = 3;
    public static final int STATUS_TIME_LIMIT = 5;
    public static final int STATUS_COMPILATION_ERROR = 6;
    public static final int STATUS_RUNTIME_ERROR = 11;
    public static final int STATUS_NOT_RUN = 0;

    private static final String WANDBOX_URL = "https://wandbox.org/api/compile.json";
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(45);

    /** Exact Wandbox compiler ids (verified against https://wandbox.org/api/list.json). */
    private static final Map<String, String> LANGUAGE_TO_WANDBOX_COMPILER = Map.ofEntries(
            Map.entry("javascript", "nodejs-20.17.0"),
            Map.entry("typescript", "typescript-5.6.2"),
            Map.entry("python", "cpython-3.13.8"),
            Map.entry("java", "openjdk-jdk-21+35"),
            Map.entry("cpp", "gcc-head"),
            Map.entry("c", "gcc-head-c"),
            Map.entry("csharp", "dotnetcore-8.0.402"),
            Map.entry("go", "go-1.23.2"),
            Map.entry("rust", "rust-1.82.0"),
            Map.entry("swift", "swift-6.0.1"),
            Map.entry("ruby", "ruby-3.4.9"),
            Map.entry("php", "php-8.3.12"),
            Map.entry("sql", "sqlite-3.46.1"),
            Map.entry("bash", "bash")
    );

    /** Exit status Wandbox reports when it kills a program (SIGKILL → 128 + 9). */
    private static final Set<String> KILLED_STATUSES = Set.of("137", "124");

    // Created lazily: on Render's 0.1-CPU free tier eagerly starting HttpClient's
    // selector thread during startup was observed to stall boot.
    private volatile HttpClient httpClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public static boolean isExecutable(String language) {
        return language != null && LANGUAGE_TO_WANDBOX_COMPILER.containsKey(language);
    }

    private HttpClient client() {
        if (httpClient == null) {
            synchronized (this) {
                if (httpClient == null) {
                    httpClient = HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).build();
                }
            }
        }
        return httpClient;
    }

    public ExecuteCodeResponse execute(ExecuteCodeRequest request) {
        String compilerId = LANGUAGE_TO_WANDBOX_COMPILER.get(request.getLanguage());
        if (compilerId == null) {
            return error("Not Supported",
                    "Running " + request.getLanguage() + " code is not supported.");
        }

        try {
            String body = objectMapper.writeValueAsString(Map.of(
                    "compiler", compilerId,
                    "code", request.getCode() != null ? request.getCode() : "",
                    "stdin", request.getStdin() != null ? request.getStdin() : ""));

            HttpRequest apiRequest = HttpRequest.newBuilder()
                    .uri(URI.create(WANDBOX_URL))
                    .timeout(REQUEST_TIMEOUT)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = client().send(apiRequest, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 400) {
                log.warn("Wandbox returned HTTP {}", response.statusCode());
                return error("API Error", "The execution server returned HTTP " + response.statusCode() + ". Try again shortly.");
            }
            return map(objectMapper.readValue(response.body(), WandboxResponse.class));

        } catch (HttpTimeoutException e) {
            return error("Timeout", "The execution server did not respond in time. Try again shortly.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return error("Internal Error", "Execution was interrupted.");
        } catch (Exception e) {
            log.error("Wandbox execution failed: {}", e.toString());
            return error("Internal Error", "Could not reach the execution server.");
        }
    }

    /**
     * Maps a Wandbox result. Compiler diagnostics arrive in {@code compiler_error}
     * ({@code compiler_output} is usually an empty string). The old code preferred the
     * empty {@code compiler_output}, so compile errors were reported as a
     * "Runtime Error" with no message — and the AI agent never saw the error.
     */
    static ExecuteCodeResponse map(WandboxResponse w) {
        String compilerText = firstNonBlank(w.compilerError, w.compilerOutput, w.compilerMessage);
        boolean programProducedOutput = notBlank(w.programOutput) || notBlank(w.programError);
        boolean success = "0".equals(w.status);
        boolean signalled = notBlank(w.signal);

        String status;
        int statusId;
        if (success) {
            status = "Accepted";
            statusId = STATUS_ACCEPTED;
        } else if (KILLED_STATUSES.contains(w.status) || (signalled && w.signal.toUpperCase().contains("KILL"))) {
            status = "Time Limit Exceeded";
            statusId = STATUS_TIME_LIMIT;
        } else if (compilerText != null && !programProducedOutput) {
            status = "Compilation Error";
            statusId = STATUS_COMPILATION_ERROR;
        } else {
            status = "Runtime Error";
            statusId = STATUS_RUNTIME_ERROR;
        }

        String stderr = emptyToNull(w.programError);
        if (signalled && stderr == null) stderr = "Terminated by signal " + w.signal;

        return ExecuteCodeResponse.builder()
                .stdout(emptyToNull(w.programOutput))
                .stderr(stderr)
                .compileOutput(compilerText)
                .status(status)
                .statusId(statusId)
                .build();
    }

    private static ExecuteCodeResponse error(String status, String message) {
        return ExecuteCodeResponse.builder().status(status).statusId(STATUS_NOT_RUN).stderr(message).build();
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static String emptyToNull(String s) {
        return notBlank(s) ? s : null;
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) if (notBlank(v)) return v;
        return null;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class WandboxResponse {
        public String status;
        public String signal;
        @JsonProperty("compiler_output") public String compilerOutput;
        @JsonProperty("compiler_error") public String compilerError;
        @JsonProperty("compiler_message") public String compilerMessage;
        @JsonProperty("program_output") public String programOutput;
        @JsonProperty("program_error") public String programError;
    }
}
