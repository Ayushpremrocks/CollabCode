package com.collabcode.service;

import com.collabcode.event.RoomEvents;
import com.collabcode.exception.RoomNotFoundException;
import com.collabcode.model.Room;
import com.collabcode.model.RoomParticipant;
import com.collabcode.model.User;
import com.collabcode.repository.RoomParticipantRepository;
import com.collabcode.repository.RoomRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class RoomServiceTest {

    private RoomRepository rooms;
    private RoomParticipantRepository participants;
    private ApplicationEventPublisher events;
    private UserProvisioningService provisioning;
    private RoomService service;

    private final User owner = User.builder().id(1L).username("host").clerkUserId("user_host").build();
    private final User guest = User.builder().id(2L).username("guest").clerkUserId("user_guest").build();
    private final User stranger = User.builder().id(3L).username("stranger").clerkUserId("user_x").build();
    private Room room;

    @BeforeEach
    void setUp() {
        rooms = mock(RoomRepository.class);
        participants = mock(RoomParticipantRepository.class);
        events = mock(ApplicationEventPublisher.class);
        provisioning = mock(UserProvisioningService.class);
        DocumentService documents = mock(DocumentService.class);
        when(documents.getLanguage(anyString())).thenReturn("python");
        service = new RoomService(rooms, participants, documents, provisioning, events);

        room = Room.builder().id(10L).roomCode("ABCD2345").name("Demo").owner(owner)
                .expiresAt(Instant.now().plusSeconds(3600)).build();
        when(rooms.findByRoomCode("ABCD2345")).thenReturn(Optional.of(room));
        when(participants.existsByRoomIdAndUserId(10L, 2L)).thenReturn(true);
        when(participants.findByRoomId(10L)).thenReturn(List.of());
    }

    @Test
    void nonOwnerCannotDeleteAndNothingIsPublished() {
        assertThatThrownBy(() -> service.deleteRoom("ABCD2345", guest.getId()))
                .isInstanceOf(SecurityException.class);
        verify(rooms, never()).delete(any());
        verifyNoInteractions(events);
    }

    @Test
    void ownerDeletePublishesRoomDeletedEvent() {
        service.deleteRoom("ABCD2345", owner.getId());
        verify(rooms).delete(room);
        verify(events).publishEvent(new RoomEvents.RoomDeleted("ABCD2345", "deleted"));
    }

    @Test
    void readOnlyIsHostOnlyPersistedAndAnnounced() {
        assertThatThrownBy(() -> service.setReadOnly("ABCD2345", true, guest.getId()))
                .isInstanceOf(SecurityException.class);
        assertThat(room.isReadOnly()).isFalse();

        assertThat(service.setReadOnly("ABCD2345", true, owner.getId())).isTrue();
        assertThat(room.isReadOnly()).isTrue();
        verify(rooms).save(room);
        verify(events).publishEvent(new RoomEvents.RoomReadOnlyChanged("ABCD2345", true));
    }

    @Test
    void accessReflectsMembershipOwnershipAndExpiry() {
        assertThat(service.getAccess("ABCD2345", owner.getId()).owner()).isTrue();
        assertThat(service.getAccess("ABCD2345", guest.getId()).canAccess()).isTrue();
        assertThat(service.getAccess("ABCD2345", stranger.getId()).canAccess()).isFalse();
        assertThat(service.getAccess("NOPE0000", owner.getId()).exists()).isFalse();

        room.setExpiresAt(Instant.now().minusSeconds(1));
        assertThat(service.getAccess("ABCD2345", owner.getId()).canAccess()).isFalse();
    }

    @Test
    void nonMembersCannotReadRoomDetails() {
        assertThatThrownBy(() -> service.getRoomForMember("ABCD2345", stranger.getId()))
                .isInstanceOf(SecurityException.class);
        assertThatThrownBy(() -> service.getRoomForMember("NOPE0000", owner.getId()))
                .isInstanceOf(RoomNotFoundException.class);
        assertThat(service.getRoomForMember("ABCD2345", guest.getId()).getRoomCode()).isEqualTo("ABCD2345");
    }

    @Test
    void lockedRoomRejectsNewcomersButLetsExistingParticipantsBackIn() {
        room.setLocked(true);
        when(provisioning.getOrCreateUser(eq("user_x"), any(), any())).thenReturn(stranger);
        when(provisioning.getOrCreateUser(eq("user_guest"), any(), any())).thenReturn(guest);

        assertThatThrownBy(() -> service.joinRoom("ABCD2345", "user_x", null, null))
                .isInstanceOf(SecurityException.class);
        assertThat(service.joinRoom("ABCD2345", "user_guest", null, null).getRoomCode()).isEqualTo("ABCD2345");
        verify(participants, never()).save(any(RoomParticipant.class));
    }

    @Test
    void ownershipIsComparedByIdNotUsername() {
        // A different user who happens to have the host's username is not the owner.
        User impostor = User.builder().id(99L).username("host").build();
        assertThat(service.isOwner("ABCD2345", impostor.getId())).isFalse();
        assertThat(service.isOwner("ABCD2345", owner.getId())).isTrue();
    }

    private static String eq(String s) {
        return org.mockito.ArgumentMatchers.eq(s);
    }
}
