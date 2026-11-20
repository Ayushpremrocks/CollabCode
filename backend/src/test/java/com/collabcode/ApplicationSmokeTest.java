package com.collabcode;

import com.collabcode.repository.DocumentSnapshotRepository;
import com.collabcode.repository.RoomParticipantRepository;
import com.collabcode.repository.RoomRepository;
import com.collabcode.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Boots the REAL application context (all controllers, security chain, both
 * WebSocket configurations, schedulers, event listeners) with only the database
 * layer mocked, and checks the externally visible behaviour the frontend relies on.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.config.import=optional:file:does-not-exist.env",
        "spring.autoconfigure.exclude="
                + "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,"
                + "org.springframework.boot.autoconfigure.jdbc.DataSourceTransactionManagerAutoConfiguration,"
                + "org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,"
                + "org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration,"
                + "org.springframework.boot.autoconfigure.sql.init.SqlInitializationAutoConfiguration",
        "CLERK_JWKS_URI=https://example.invalid/.well-known/jwks.json",
        "ALLOWED_ORIGINS=https://collab-code-application.vercel.app",
        "SPRING_DATASOURCE_URL=jdbc:postgresql://unused/db",
        "SPRING_DATASOURCE_USERNAME=unused",
        "SPRING_DATASOURCE_PASSWORD=unused",
})
class ApplicationSmokeTest {

    @MockBean UserRepository users;
    @MockBean RoomRepository rooms;
    @MockBean RoomParticipantRepository participants;
    @MockBean DocumentSnapshotRepository snapshots;
    @MockBean PlatformTransactionManager transactionManager;

    @LocalServerPort int port;
    @Autowired org.springframework.context.ApplicationContext context;

    private final HttpClient http = HttpClient.newHttpClient();

    private HttpResponse<String> send(HttpRequest.Builder request) throws Exception {
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    @Test
    void contextStartsWithEveryWebSocketAndSecurityComponentWired() {
        assertThat(context.getBean(com.collabcode.websocket.YjsWebSocketHandler.class)).isNotNull();
        assertThat(context.getBean(com.collabcode.websocket.yjs.YjsRoomManager.class)).isNotNull();
        assertThat(context.getBean(com.collabcode.websocket.StompAuthChannelInterceptor.class)).isNotNull();
        assertThat(context.getBean(com.collabcode.config.RateLimitInterceptor.class)).isNotNull();
    }

    @Test
    void healthIsPublicSoTheFrontendCanWakeRender() throws Exception {
        HttpResponse<String> res = send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/health")));
        assertThat(res.statusCode()).isEqualTo(200);
        assertThat(res.body()).contains("ok");
    }

    @Test
    void apiRequiresAToken() throws Exception {
        HttpResponse<String> res = send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/rooms")));
        assertThat(res.statusCode()).isEqualTo(401);
        assertThat(res.headers().firstValue("WWW-Authenticate")).isPresent();
    }

    @Test
    void corsPreflightAllowsTheConfiguredFrontendOnly() throws Exception {
        HttpResponse<String> ok = send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/rooms"))
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody())
                .header("Origin", "https://collab-code-application.vercel.app")
                .header("Access-Control-Request-Method", "GET")
                .header("Access-Control-Request-Headers", "authorization"));
        assertThat(ok.statusCode()).isEqualTo(200);
        assertThat(ok.headers().firstValue("Access-Control-Allow-Origin")).hasValue("https://collab-code-application.vercel.app");

        HttpResponse<String> denied = send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/rooms"))
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody())
                .header("Origin", "https://evil.example")
                .header("Access-Control-Request-Method", "GET"));
        assertThat(denied.statusCode()).isEqualTo(403);
    }

    @Test
    void yjsSocketWithoutValidTokenIsClosedWith4401() throws Exception {
        CompletableFuture<CloseStatus> closed = new CompletableFuture<>();
        WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
        headers.setOrigin("https://collab-code-application.vercel.app");
        new StandardWebSocketClient().execute(new BinaryWebSocketHandler() {
            @Override
            public void afterConnectionClosed(WebSocketSession s, CloseStatus status) {
                closed.complete(status);
            }

            @Override
            protected void handleBinaryMessage(WebSocketSession s, BinaryMessage m) {
                // not expected
            }
        }, headers, URI.create("ws://localhost:" + port + "/ws/yjs/ABCD2345?token=not-a-jwt")).get(10, TimeUnit.SECONDS);

        assertThat(closed.get(10, TimeUnit.SECONDS).getCode()).isEqualTo(4401);
    }
}
