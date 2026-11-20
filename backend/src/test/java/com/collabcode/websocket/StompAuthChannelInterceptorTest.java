package com.collabcode.websocket;

import com.collabcode.model.User;
import com.collabcode.security.ClerkJwtValidator;
import com.collabcode.service.RoomService;
import com.collabcode.service.UserProvisioningService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class StompAuthChannelInterceptorTest {

    private ClerkJwtValidator validator;
    private RoomService roomService;
    private StompAuthChannelInterceptor interceptor;
    private final MessageChannel channel = mock(MessageChannel.class);
    private final StompPrincipal alice = new StompPrincipal(2L, "alice", "user_alice");

    @BeforeEach
    void setUp() {
        validator = mock(ClerkJwtValidator.class);
        roomService = mock(RoomService.class);
        UserProvisioningService provisioning = mock(UserProvisioningService.class);
        when(provisioning.getOrCreateUser(any(), any(), any()))
                .thenReturn(User.builder().id(2L).username("alice").clerkUserId("user_alice").build());
        interceptor = new StompAuthChannelInterceptor(validator, provisioning, roomService);

        when(roomService.getAccess(any(), any())).thenReturn(RoomService.RoomAccess.NONE);
        when(roomService.getAccess("MYROOM12", 2L))
                .thenReturn(new RoomService.RoomAccess(true, false, true, false, false, false));
    }

    private Message<byte[]> frame(StompCommand command, String destination, String authHeader) {
        StompHeaderAccessor acc = StompHeaderAccessor.create(command);
        if (destination != null) acc.setDestination(destination);
        if (authHeader != null) acc.addNativeHeader("Authorization", authHeader);
        if (command != StompCommand.CONNECT) {
            acc.setUser(new UsernamePasswordAuthenticationToken(alice, null, List.of()));
        }
        acc.setSessionAttributes(new HashMap<>());
        acc.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], acc.getMessageHeaders());
    }

    @Test
    void connectWithoutTokenIsRejected() {
        assertThatThrownBy(() -> interceptor.preSend(frame(StompCommand.CONNECT, null, null), channel))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void connectWithExpiredTokenIsRejected() {
        when(validator.decode("expired")).thenThrow(new BadJwtException("Jwt expired"));
        assertThatThrownBy(() -> interceptor.preSend(frame(StompCommand.CONNECT, null, "Bearer expired"), channel))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("expired");
    }

    @Test
    void connectWithValidTokenAttachesPrincipalWithUserId() {
        when(validator.decode("good")).thenReturn(Jwt.withTokenValue("good").header("alg", "RS256")
                .subject("user_alice").issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build());
        Message<?> out = interceptor.preSend(frame(StompCommand.CONNECT, null, "Bearer good"), channel);
        StompPrincipal p = StompAuthChannelInterceptor.principalOf(StompHeaderAccessor.wrap(out).getUser());
        assertThat(p).isNotNull();
        assertThat(p.userId()).isEqualTo(2L);
    }

    @Test
    void membersMaySubscribeAndSendToTheirRoom() {
        assertThat(interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/topic/room/MYROOM12/chat", null), channel)).isNotNull();
        assertThat(interceptor.preSend(frame(StompCommand.SEND, "/app/room/MYROOM12/chat", null), channel)).isNotNull();
    }

    @Test
    void nonMembersAreDroppedSilently() {
        assertThat(interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/topic/room/OTHER123/chat", null), channel)).isNull();
        assertThat(interceptor.preSend(frame(StompCommand.SEND, "/app/room/OTHER123/chat", null), channel)).isNull();
    }

    @Test
    void clientsCannotPublishDirectlyToTopicsOrSubscribeToAppDestinations() {
        assertThat(interceptor.preSend(frame(StompCommand.SEND, "/topic/room/MYROOM12/room-deleted", null), channel)).isNull();
        assertThat(interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/app/room/MYROOM12/chat", null), channel)).isNull();
        assertThat(interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/topic/anything", null), channel)).isNull();
    }
}
