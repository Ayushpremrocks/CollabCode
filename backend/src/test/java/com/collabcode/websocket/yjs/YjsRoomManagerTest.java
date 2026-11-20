package com.collabcode.websocket.yjs;

import com.collabcode.event.RoomEvents;
import com.collabcode.service.DocumentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.Set;

import static com.collabcode.websocket.yjs.YjsRoomTest.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class YjsRoomManagerTest {

    private DocumentService documents;
    private YjsRoomManager manager;

    @BeforeEach
    void setUp() {
        documents = mock(DocumentService.class);
        when(documents.getLatestDocument(anyString())).thenReturn(Optional.empty());
        manager = new YjsRoomManager(documents);
    }

    @Test
    void persistsOnlyChangedDocumentsAndOnlyOncePerChange() {
        FakeClient a = new FakeClient("a");
        YjsRoom room = manager.join("ROOM1", a, true, false);
        a.drain();
        room.applyUpdate("a", id(1));
        a.doc.add(1L);

        manager.flushAll();
        verify(documents, never()).saveSnapshot(anyString(), any()); // nothing compacted yet

        room.applySnapshot("a", a.received, a.snapshotFrameBody());
        manager.flushAll();
        manager.flushAll(); // second flush: unchanged → no second write
        verify(documents, times(1)).saveSnapshot(eq("ROOM1"), any());
    }

    @Test
    void lastUserLeavingFlushesImmediatelyAndEvictsTheRoom() {
        FakeClient a = new FakeClient("a");
        YjsRoom room = manager.join("ROOM1", a, true, false);
        a.drain();
        room.applyUpdate("a", id(1));
        a.doc.add(1L);
        room.applySnapshot("a", a.received, a.snapshotFrameBody()); // final snapshot on unload

        manager.leave("ROOM1", "a");
        verify(documents).saveSnapshot(eq("ROOM1"), any());
        assertThat(manager.roomCount()).isZero();
    }

    @Test
    void roomWithUnpersistedEditsIsKeptInMemoryAfterAnAbruptDisconnect() {
        FakeClient a = new FakeClient("a");
        YjsRoom room = manager.join("ROOM1", a, true, false);
        a.drain();
        room.applyUpdate("a", id(1)); // no snapshot follows (tab crashed)
        manager.leave("ROOM1", "a");
        assertThat(manager.roomCount()).isEqualTo(1);

        FakeClient b = new FakeClient("b");
        manager.join("ROOM1", b, false, false);
        b.drain();
        assertThat(b.doc).contains(1L); // the edit survived
    }

    @Test
    void failedPersistenceIsRetried() {
        FakeClient a = new FakeClient("a");
        YjsRoom room = manager.join("ROOM1", a, true, false);
        a.drain();
        room.applyUpdate("a", id(1));
        a.doc.add(1L);
        room.applySnapshot("a", a.received, a.snapshotFrameBody());
        doThrow(new RuntimeException("db down")).doNothing().when(documents).saveSnapshot(anyString(), any());

        manager.flushAll();
        manager.flushAll();
        verify(documents, times(2)).saveSnapshot(eq("ROOM1"), any());
    }

    @Test
    void loadsPersistedDocumentForTheFirstJoiner() {
        when(documents.getLatestDocument("ROOM2")).thenReturn(Optional.of(encode(Set.of(5L, 6L))));
        FakeClient a = new FakeClient("a");
        manager.join("ROOM2", a, true, false);
        a.drain();
        assertThat(a.doc).containsExactlyInAnyOrder(5L, 6L);
    }

    @Test
    void deletedRoomDisconnectsEveryoneAndReadOnlyChangesApplyLive() {
        FakeClient a = new FakeClient("a");
        FakeClient b = new FakeClient("b");
        YjsRoom room = manager.join("ROOM1", a, true, false);
        manager.join("ROOM1", b, false, false);

        manager.onReadOnlyChanged(new RoomEvents.RoomReadOnlyChanged("ROOM1", true));
        assertThat(room.applyUpdate("b", id(9))).isFalse();

        manager.onRoomDeleted(new RoomEvents.RoomDeleted("ROOM1", "deleted"));
        assertThat(a.closed).isTrue();
        assertThat(b.closed).isTrue();
        assertThat(manager.get("ROOM1")).isNull();
    }

    private static String eq(String s) {
        return org.mockito.ArgumentMatchers.eq(s);
    }
}
