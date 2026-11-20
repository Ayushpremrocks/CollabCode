package com.collabcode.websocket;

import com.collabcode.model.User;
import com.collabcode.security.ClerkJwtValidator;
import com.collabcode.service.PresenceService;
import com.collabcode.service.RoomService;
import com.collabcode.service.UserProvisioningService;
import com.collabcode.websocket.yjs.YjsProtocol;
import com.collabcode.websocket.yjs.YjsRoomManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import java.net.URI;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class YjsWebSocketHandlerTest {

    private ClerkJwtValidator validator;
    private RoomService roomService;
    private YjsRoomManager manager;
    private PresenceService presence;
    private YjsWebSocketHandler handler;

    @BeforeEach
    void setUp() {
        validator = mock(ClerkJwtValidator.class);
        roomService = mock(RoomService.class);
        manager = mock(YjsRoomManager.class);
        presence = mock(PresenceService.class);
        UserProvisioningService provisioning = mock(UserProvisioningService.class);
        when(provisioning.getOrCreateUser(any(), any(), any()))
                .thenReturn(User.builder().id(5L).username("eve").clerkUserId("user_eve").build());
        when(validator.decode("good")).thenReturn(Jwt.withTokenValue("good").header("alg", "RS256")
                .subject("user_eve").issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build());
        when(validator.decode("expired")).thenThrow(new BadJwtException("Jwt expired"));
        handler = new YjsWebSocketHandler(manager, roomService, presence, validator, provisioning);
    }

    private WebSocketSession session(String url) {
        WebSocketSession s = mock(WebSocketSession.class);
        when(s.getUri()).thenReturn(URI.create(url));
        when(s.getId()).thenReturn("s1");
        when(s.isOpen()).thenReturn(true);
        return s;
    }

    private void assertClosedWith(WebSocketSession s, int code) throws Exception {
        verify(s).close(argThat((CloseStatus st) -> st.getCode() == code));
        verifyNoInteractions(manager, presence);
    }

    @Test
    void missingOrExpiredTokenClosesWith4401SoTheClientRetriesWithAFreshToken() throws Exception {
        WebSocketSession noToken = session("wss://x/ws/yjs/ROOM1234");
        handler.afterConnectionEstablished(noToken);
        assertClosedWith(noToken, YjsProtocol.CLOSE_UNAUTHORIZED);

        WebSocketSession expired = session("wss://x/ws/yjs/ROOM1234?token=expired");
        handler.afterConnectionEstablished(expired);
        assertClosedWith(expired, YjsProtocol.CLOSE_UNAUTHORIZED);
    }

    @Test
    void unknownRoomClosesWith4404() throws Exception {
        when(roomService.getAccess("ROOM1234", 5L)).thenReturn(RoomService.RoomAccess.NONE);
        WebSocketSession s = session("wss://x/ws/yjs/ROOM1234?token=good");
        handler.afterConnectionEstablished(s);
        assertClosedWith(s, YjsProtocol.CLOSE_NOT_FOUND);
    }

    @Test
    void nonParticipantClosesWith4403EvenIfTheyKnowTheRoomCode() throws Exception {
        when(roomService.getAccess("ROOM1234", 5L))
                .thenReturn(new RoomService.RoomAccess(true, false, false, false, false, true));
        WebSocketSession s = session("wss://x/ws/yjs/ROOM1234?token=good");
        handler.afterConnectionEstablished(s);
        assertClosedWith(s, YjsProtocol.CLOSE_FORBIDDEN);
    }

    @Test
    void participantJoinsTheRoomWithOwnerAndReadOnlyFlags() throws Exception {
        when(roomService.getAccess("ROOM1234", 5L))
                .thenReturn(new RoomService.RoomAccess(true, false, true, false, true, false));
        WebSocketSession s = session("wss://x/ws/yjs/room1234?token=good&name=Eve%20Smith&imageUrl=javascript%3Aalert(1)");
        handler.afterConnectionEstablished(s);

        verify(manager).join(eq("ROOM1234"), any(), eq(false), eq(true));
        // display name decoded; non-https image URL dropped
        verify(presence).addUser("ROOM1234", "eve", 5L, "Eve Smith", null);
        verify(s, never()).close(any());
    }

    @Test
    void roomCodeIsValidated() {
        assertThat(YjsWebSocketHandler.extractRoomCode(URI.create("ws://x/ws/yjs/abcd2345"))).isEqualTo("ABCD2345");
        assertThat(YjsWebSocketHandler.extractRoomCode(URI.create("ws://x/ws/yjs/..%2F..%2Fetc"))).isNull();
        assertThat(YjsWebSocketHandler.extractRoomCode(URI.create("ws://x/ws/yjs/"))).isNull();
        assertThat(YjsWebSocketHandler.sanitizeImageUrl("https://img.clerk.com/a.png")).isEqualTo("https://img.clerk.com/a.png");
        assertThat(YjsWebSocketHandler.sanitizeImageUrl("http://insecure")).isNull();
    }
}
