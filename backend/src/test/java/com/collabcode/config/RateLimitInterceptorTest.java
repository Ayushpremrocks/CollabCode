package com.collabcode.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimitInterceptorTest {

    private final AtomicLong now = new AtomicLong(1_000_000);
    private final Clock clock = new Clock() {
        @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return Instant.ofEpochMilli(now.get()); }
        @Override public long millis() { return now.get(); }
    };

    @Test
    void limitsPerUserAndRecoversAfterTheWindow() {
        RateLimitInterceptor limiter = new RateLimitInterceptor(3, 1, clock);
        assertThat(limiter.tryAcquire("execute:alice", 3)).isTrue();
        assertThat(limiter.tryAcquire("execute:alice", 3)).isTrue();
        assertThat(limiter.tryAcquire("execute:alice", 3)).isTrue();
        assertThat(limiter.tryAcquire("execute:alice", 3)).isFalse();
        assertThat(limiter.tryAcquire("execute:bob", 3)).isTrue(); // independent per user

        now.addAndGet(60_000);
        assertThat(limiter.tryAcquire("execute:alice", 3)).isTrue();
    }

    @Test
    void agentRequestsGet429WithJsonBody() throws Exception {
        RateLimitInterceptor limiter = new RateLimitInterceptor(20, 1, clock);
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/agent/debug");
        req.setRemoteAddr("1.2.3.4");

        assertThat(limiter.preHandle(req, new MockHttpServletResponse(), null)).isTrue();
        MockHttpServletResponse blocked = new MockHttpServletResponse();
        assertThat(limiter.preHandle(req, blocked, null)).isFalse();
        assertThat(blocked.getStatus()).isEqualTo(429);
        assertThat(blocked.getContentAsString()).contains("Too many requests");
    }

    @Test
    void otherEndpointsAreNotLimited() throws Exception {
        RateLimitInterceptor limiter = new RateLimitInterceptor(0, 0, clock);
        assertThat(limiter.preHandle(new MockHttpServletRequest("GET", "/api/rooms"),
                new MockHttpServletResponse(), null)).isTrue();
    }

    @Test
    void originListIsTrimmed() {
        assertThat(SecurityConfig.parseOrigins(" https://a.app/ , http://localhost:5173,,"))
                .containsExactly("https://a.app", "http://localhost:5173");
    }
}
