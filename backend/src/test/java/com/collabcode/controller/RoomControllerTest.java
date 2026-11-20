package com.collabcode.controller;

import com.collabcode.model.DocumentSnapshot;
import com.collabcode.model.Room;
import com.collabcode.model.User;
import com.collabcode.service.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class RoomControllerTest {

    private RoomService roomService;
    private DocumentService documentService;
    private SimpMessagingTemplate messaging;
    private MockMvc mvc;

    private final User host = User.builder().id(1L).username("host").clerkUserId("user_host").build();
    private final User stranger = User.builder().id(3L).username("stranger").clerkUserId("user_x").build();

    @BeforeEach
    void setUp() {
        roomService = mock(RoomService.class);
        documentService = mock(DocumentService.class);
        messaging = mock(SimpMessagingTemplate.class);
        UserProvisioningService provisioning = mock(UserProvisioningService.class);
        when(provisioning.getOrCreateUser(eq("user_host"), any(), any())).thenReturn(host);
        when(provisioning.getOrCreateUser(eq("user_x"), any(), any())).thenReturn(stranger);

        RoomController controller = new RoomController(roomService, documentService,
                mock(CodeExecutionService.class), new ChatHistoryService(), messaging, provisioning);
        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .build();
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private void signInAs(String clerkUserId) {
        Jwt jwt = Jwt.withTokenValue("t").header("alg", "RS256").subject(clerkUserId)
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }

    @Test
    void strangerCannotDeleteARoomAndNoOneIsKickedOut() throws Exception {
        signInAs("user_x");
        doThrow(new SecurityException("Only the room owner can delete this room"))
                .when(roomService).deleteRoom("ABCD2345", 3L);

        mvc.perform(delete("/api/rooms/ABCD2345"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Only the room owner can delete this room"));

        verifyNoInteractions(messaging); // the room-deleted broadcast must NOT happen
    }

    @Test
    void ownerDeleteNotifiesParticipantsAfterDeleting() throws Exception {
        signInAs("user_host");
        mvc.perform(delete("/api/rooms/ABCD2345")).andExpect(status().isNoContent());

        var order = inOrder(roomService, messaging);
        order.verify(roomService).deleteRoom("ABCD2345", 1L);
        order.verify(messaging).convertAndSend(eq("/topic/room/ABCD2345/room-deleted"), any(Object.class));
    }

    @Test
    void snapshotFromAnotherRoomIsNotFound() throws Exception {
        signInAs("user_host");
        when(documentService.getSnapshotForRoom("ABCD2345", 77L)).thenReturn(Optional.empty());
        mvc.perform(get("/api/rooms/ABCD2345/snapshots/77")).andExpect(status().isNotFound());
    }

    @Test
    void nonMembersCannotReadSnapshots() throws Exception {
        signInAs("user_x");
        when(roomService.requireMember("ABCD2345", 3L)).thenThrow(new SecurityException("You are not a participant of this room"));

        mvc.perform(get("/api/rooms/ABCD2345/snapshots/5")).andExpect(status().isForbidden());
        mvc.perform(get("/api/rooms/ABCD2345/snapshots")).andExpect(status().isForbidden());
        mvc.perform(get("/api/rooms/ABCD2345/chat")).andExpect(status().isForbidden());
        verify(documentService, never()).getSnapshotForRoom(any(), any());
    }

    @Test
    void memberCanReadSnapshotBytes() throws Exception {
        signInAs("user_host");
        when(roomService.requireMember("ABCD2345", 1L)).thenReturn(new Room());
        DocumentSnapshot s = DocumentSnapshot.builder().id(5L).documentData(new byte[]{1, 2, 3}).language("cpp").build();
        when(documentService.getSnapshotForRoom("ABCD2345", 5L)).thenReturn(Optional.of(s));

        mvc.perform(get("/api/rooms/ABCD2345/snapshots/5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value("AQID"))
                .andExpect(jsonPath("$.language").value("cpp"));
    }

    @Test
    void readOnlyToggleIsBroadcastOnlyWhenTheServiceAllowsIt() throws Exception {
        signInAs("user_host");
        when(roomService.setReadOnly("ABCD2345", true, 1L)).thenReturn(true);
        mvc.perform(patch("/api/rooms/ABCD2345/read-only").contentType(MediaType.APPLICATION_JSON).content("{\"readOnly\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.readOnly").value(true));
        verify(messaging).convertAndSend(eq("/topic/room/ABCD2345/readonly"), any(Object.class));

        signInAs("user_x");
        when(roomService.setReadOnly("ABCD2345", true, 3L)).thenThrow(new SecurityException("nope"));
        mvc.perform(patch("/api/rooms/ABCD2345/read-only").contentType(MediaType.APPLICATION_JSON).content("{\"readOnly\":true}"))
                .andExpect(status().isForbidden());
        verifyNoMoreInteractions(messaging);
    }

    @Test
    void executeValidatesItsInput() throws Exception {
        signInAs("user_host");
        mvc.perform(post("/api/rooms/execute").contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"x\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.language").exists());
    }

    @Test
    void unexpectedErrorsDoNotLeakInternals() throws Exception {
        signInAs("user_host");
        when(roomService.getUserRooms(1L)).thenThrow(new RuntimeException("password=hunter2 at db.internal:5432"));
        mvc.perform(get("/api/rooms"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value("An unexpected error occurred. Please try again."));
    }
}
