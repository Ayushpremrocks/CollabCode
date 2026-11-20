package e2e;

import com.collabcode.event.RoomEvents;
import com.collabcode.model.User;
import com.collabcode.security.ClerkJwtValidator;
import com.collabcode.service.DocumentService;
import com.collabcode.service.PresenceService;
import com.collabcode.service.RoomService;
import com.collabcode.service.UserProvisioningService;
import com.collabcode.websocket.YjsWebSocketHandler;
import com.collabcode.websocket.yjs.YjsRoom;
import com.collabcode.websocket.yjs.YjsRoomManager;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceTransactionManagerAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.boot.autoconfigure.security.oauth2.resource.servlet.OAuth2ResourceServerAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.SecurityFilterAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.autoconfigure.sql.init.SqlInitializationAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

import java.lang.reflect.Field;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Runs the REAL Yjs relay (YjsWebSocketHandler + YjsRoomManager + YjsRoom) on a
 * real port, with only auth/database collaborators stubbed:
 * <ul>
 *   <li>token "user_x" → user "user_x"; token "expired" → invalid; "user_outsider" is not a member;</li>
 *   <li>"user_host" owns every room; rooms are any code starting with E2E;</li>
 *   <li>documents are "persisted" in an in-memory map.</li>
 * </ul>
 * /test/* endpoints let the Node test toggle read-only mode and simulate a server restart.
 */
@SpringBootConfiguration
@EnableAutoConfiguration(exclude = {
        DataSourceAutoConfiguration.class, DataSourceTransactionManagerAutoConfiguration.class,
        HibernateJpaAutoConfiguration.class, SqlInitializationAutoConfiguration.class,
        SecurityAutoConfiguration.class, SecurityFilterAutoConfiguration.class,
        UserDetailsServiceAutoConfiguration.class, OAuth2ResourceServerAutoConfiguration.class})
@EnableWebSocket
@RestController
public class YjsRelayE2EServer implements WebSocketConfigurer {

    static final Map<String, byte[]> persisted = new ConcurrentHashMap<>();
    static final Map<String, Boolean> readOnly = new ConcurrentHashMap<>();
    private static final Map<String, Long> userIds = new ConcurrentHashMap<>();

    private final YjsRoomManager manager;
    private final YjsWebSocketHandler handler;

    public YjsRelayE2EServer() {
        DocumentService documents = mock(DocumentService.class);
        when(documents.getLatestDocument(anyString()))
                .thenAnswer(inv -> Optional.ofNullable(persisted.get(inv.<String>getArgument(0))));
        doAnswer(inv -> {
            persisted.put(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(documents).saveSnapshot(anyString(), any());

        ClerkJwtValidator validator = mock(ClerkJwtValidator.class);
        when(validator.decode(anyString())).thenAnswer(inv -> {
            String token = inv.getArgument(0);
            if (!token.startsWith("user_")) throw new BadJwtException("Jwt expired");
            return Jwt.withTokenValue(token).header("alg", "RS256").subject(token)
                    .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();
        });

        UserProvisioningService users = mock(UserProvisioningService.class);
        when(users.getOrCreateUser(anyString(), any(), any())).thenAnswer(inv -> {
            String sub = inv.getArgument(0);
            long id = userIds.computeIfAbsent(sub, k -> (long) (userIds.size() + 1));
            return User.builder().id(id).username(sub).clerkUserId(sub).build();
        });

        RoomService rooms = mock(RoomService.class);
        when(rooms.getAccess(anyString(), anyLong())).thenAnswer(inv -> {
            String code = inv.getArgument(0);
            long userId = inv.getArgument(1);
            if (!code.startsWith("E2E")) return RoomService.RoomAccess.NONE;
            boolean owner = userId == userIds.getOrDefault("user_host", -1L);
            boolean member = userId != userIds.getOrDefault("user_outsider", -1L);
            return new RoomService.RoomAccess(true, false, member, owner, readOnly.getOrDefault(code, false), false);
        });

        this.manager = new YjsRoomManager(documents);
        this.handler = new YjsWebSocketHandler(manager, rooms, mock(PresenceService.class), validator, users);
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/ws/yjs/*").setAllowedOriginPatterns("*");
    }

    @Bean
    ServletServerContainerFactoryBean createWebSocketContainer() {
        // Same limits as production RawWebSocketConfig.
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxBinaryMessageBufferSize(8 * 1024 * 1024);
        return container;
    }

    // ── Test control endpoints ──────────────────────────────────────────────

    @PostMapping("/test/readonly")
    public void setReadOnly(@RequestParam String room, @RequestParam boolean value) {
        readOnly.put(room, value);
        manager.onReadOnlyChanged(new RoomEvents.RoomReadOnlyChanged(room, value));
    }

    /** Simulates a backend restart: in-memory room state is lost and every socket drops (1012). */
    @PostMapping("/test/restart")
    public void restart(@RequestParam String room) throws Exception {
        Field field = YjsRoomManager.class.getDeclaredField("rooms");
        field.setAccessible(true);
        @SuppressWarnings("unchecked")
        Map<String, YjsRoom> live = (Map<String, YjsRoom>) field.get(manager);
        YjsRoom state = live.remove(room);
        if (state != null) state.closeAll(1012, "Service restart");
    }

    @PostMapping("/test/flush")
    public void flush() {
        manager.flushAll();
    }

    @GetMapping("/test/persisted")
    public Map<String, Integer> persistedSize(@RequestParam String room) {
        byte[] data = persisted.get(room);
        return Map.of("bytes", data == null ? 0 : data.length);
    }
}
