package com.collabcode.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.Clock;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Per-user sliding-window rate limits for the expensive endpoints: code execution
 * (Wandbox) and the AI agent (Gemini quota). In-memory, which is fine for the single
 * Render instance this app runs on.
 */
@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    private static final long WINDOW_MS = 60_000;

    private final int executePerMinute;
    private final int agentPerMinute;
    private final Clock clock;
    private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    @Autowired
    public RateLimitInterceptor(@Value("${app.rate-limit.execute-per-minute:20}") int executePerMinute,
                                @Value("${app.rate-limit.agent-per-minute:6}") int agentPerMinute) {
        this(executePerMinute, agentPerMinute, Clock.systemUTC());
    }

    RateLimitInterceptor(int executePerMinute, int agentPerMinute, Clock clock) {
        this.executePerMinute = executePerMinute;
        this.agentPerMinute = agentPerMinute;
        this.clock = clock;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String path = request.getRequestURI();
        String bucket;
        int limit;
        if (path.startsWith("/api/agent/")) {
            bucket = "agent";
            limit = agentPerMinute;
        } else if (path.equals("/api/rooms/execute")) {
            bucket = "execute";
            limit = executePerMinute;
        } else {
            return true;
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String user = auth != null ? auth.getName() : request.getRemoteAddr();
        if (tryAcquire(bucket + ":" + user, limit)) return true;

        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader("Retry-After", "60");
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"Too many requests. Please wait a minute and try again.\"}");
        return false;
    }

    boolean tryAcquire(String key, int limit) {
        long now = clock.millis();
        Deque<Long> window = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (window) {
            while (!window.isEmpty() && now - window.peekFirst() >= WINDOW_MS) window.pollFirst();
            if (window.size() >= limit) return false;
            window.addLast(now);
            return true;
        }
    }
}
