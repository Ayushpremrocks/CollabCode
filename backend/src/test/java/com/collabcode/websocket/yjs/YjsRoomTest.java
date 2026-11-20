package com.collabcode.websocket.yjs;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.nio.ByteBuffer;
import java.util.*;

import static com.collabcode.websocket.yjs.YjsProtocol.*;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests the relay's log / replay / compaction logic with a byte-level model:
 * every "update" is an 8-byte unique id, and a "document state" is the
 * concatenation of the ids it contains. Merging is set union, which mirrors the
 * Yjs property the relay relies on (applying updates is idempotent and order-independent).
 */
class YjsRoomTest {

    // ── Model helpers ────────────────────────────────────────────────────────

    static byte[] id(long value) {
        return ByteBuffer.allocate(8).putLong(value).array();
    }

    static Set<Long> ids(byte[] state) {
        Set<Long> result = new HashSet<>();
        ByteBuffer buf = ByteBuffer.wrap(state);
        while (buf.remaining() >= 8) result.add(buf.getLong());
        return result;
    }

    static byte[] encode(Set<Long> ids) {
        ByteBuffer buf = ByteBuffer.allocate(ids.size() * 8);
        ids.stream().sorted().forEach(buf::putLong);
        return buf.array();
    }

    /** A fake client: an inbox the server writes to, and a document (set of ids). */
    static final class FakeClient implements YjsRoom.Peer {
        final String id;
        final Deque<byte[]> inbox = new ArrayDeque<>();
        final Set<Long> doc = new HashSet<>();
        final List<byte[]> awareness = new ArrayList<>();
        long received = 0; // BASE + UPDATE frames processed (the ack)
        boolean closed = false;

        FakeClient(String id) { this.id = id; }

        @Override public String id() { return id; }
        @Override public void send(byte[] frame) { inbox.addLast(frame); }
        @Override public void close(int code, String reason) { closed = true; }

        /** Process one pending frame (what the browser does in onmessage). */
        boolean processOne() {
            byte[] frame = inbox.pollFirst();
            if (frame == null) return false;
            byte[] body = Arrays.copyOfRange(frame, 1, frame.length);
            switch (frame[0]) {
                case MSG_BASE, MSG_UPDATE -> { doc.addAll(ids(body)); received++; }
                case MSG_AWARENESS -> awareness.add(body);
                default -> throw new AssertionError("unexpected frame " + frame[0]);
            }
            return true;
        }

        void drain() { while (processOne()) { /* keep going */ } }

        byte[] snapshotFrameBody() { return encode(doc); }
    }

    static FakeClient join(YjsRoom room, String id, boolean owner) {
        FakeClient c = new FakeClient(id);
        assertThat(room.join(c, owner)).isTrue();
        return c;
    }

    /** Everything a brand-new client would end up with right now. */
    static Set<Long> whatAJoinerSees(YjsRoom room) {
        FakeClient probe = join(room, "probe-" + UUID.randomUUID(), false);
        probe.drain();
        room.leave(probe.id);
        return probe.doc;
    }

    // ── Targeted scenarios ───────────────────────────────────────────────────

    @Test
    void joinerReceivesPersistedBaseThenEveryLoggedUpdateInOrder() {
        YjsRoom room = new YjsRoom("ROOM1", encode(Set.of(1L)), false);
        FakeClient a = join(room, "a", true);
        room.applyUpdate("a", id(2));
        room.applyUpdate("a", id(3));

        FakeClient b = join(room, "b", false);
        assertThat(b.inbox).extracting(f -> (int) f[0]).containsExactly(MSG_BASE, MSG_UPDATE, MSG_UPDATE);
        b.drain();
        assertThat(b.doc).containsExactlyInAnyOrder(1L, 2L, 3L);
        assertThat(a.inbox).hasSize(1); // only its own BASE; never echoes its own updates
    }

    @Test
    void emptyRoomStillSendsAnEmptyBaseSoAckCountingStaysAligned() {
        YjsRoom room = new YjsRoom("ROOM1", null, false);
        FakeClient a = join(room, "a", true);
        assertThat(a.inbox).hasSize(1);
        assertThat(a.inbox.peekFirst()).containsExactly(MSG_BASE);
    }

    @Test
    void updatesAreRelayedToEveryOtherPeerButNotTheSender() {
        YjsRoom room = new YjsRoom("ROOM1", null, false);
        FakeClient a = join(room, "a", true);
        FakeClient b = join(room, "b", false);
        FakeClient c = join(room, "c", false);
        a.drain(); b.drain(); c.drain();

        room.applyUpdate("b", id(42));

        assertThat(a.inbox).hasSize(1);
        assertThat(c.inbox).hasSize(1);
        assertThat(b.inbox).isEmpty();
    }

    @Test
    void snapshotCompactsOnlyEntriesTheClientHasAcknowledged() {
        YjsRoom room = new YjsRoom("ROOM1", null, false);
        FakeClient a = join(room, "a", true);
        FakeClient b = join(room, "b", false);
        a.drain(); b.drain();

        room.applyUpdate("a", id(1));
        room.applyUpdate("a", id(2));
        b.processOne(); // b has seen update 1 only; update 2 is still "in flight"
        room.applyUpdate("a", id(3));

        assertThat(room.applySnapshot("b", b.received, b.snapshotFrameBody())).isTrue();
        assertThat(room.logSize()).isEqualTo(2); // 2 and 3 must survive compaction
        assertThat(whatAJoinerSees(room)).containsExactlyInAnyOrder(1L, 2L, 3L);
    }

    @Test
    void soloEditorSnapshotsCompactTheirOwnUpdates() {
        YjsRoom room = new YjsRoom("ROOM1", null, false);
        FakeClient a = join(room, "a", true);
        a.drain();
        for (long i = 1; i <= 50; i++) {
            room.applyUpdate("a", id(i));
            a.doc.add(i); // the client applied its own edit locally
        }
        assertThat(room.applySnapshot("a", a.received, a.snapshotFrameBody())).isTrue();
        assertThat(room.logSize()).isZero();
        assertThat(room.takeDirtyBase()).isNotNull();
        assertThat(whatAJoinerSees(room)).hasSize(50);
    }

    @Test
    void ownEntriesAfterAnUnseenForeignEntryAreNotCompacted() {
        YjsRoom room = new YjsRoom("ROOM1", null, false);
        FakeClient a = join(room, "a", true);
        FakeClient b = join(room, "b", false);
        a.drain(); b.drain();

        room.applyUpdate("b", id(10)); // a has NOT processed this yet
        room.applyUpdate("a", id(11));
        a.doc.add(11L);

        // a's state lacks 10, so the base must not claim to cover seq of 10
        room.applySnapshot("a", a.received, a.snapshotFrameBody());
        assertThat(whatAJoinerSees(room)).contains(10L, 11L);
    }

    @Test
    void staleOrOutOfRangeAcksAreIgnored() {
        YjsRoom room = new YjsRoom("ROOM1", null, false);
        FakeClient a = join(room, "a", true);
        a.drain();
        assertThat(room.applySnapshot("a", 0, id(1))).isFalse();
        assertThat(room.applySnapshot("a", 99, id(1))).isFalse();
        assertThat(room.applySnapshot("unknown", 1, id(1))).isFalse();
    }

    @Test
    void olderSnapshotNeverReplacesNewerBase() {
        YjsRoom room = new YjsRoom("ROOM1", null, false);
        FakeClient a = join(room, "a", true);
        FakeClient b = join(room, "b", false);
        a.drain(); b.drain();
        room.applyUpdate("a", id(1));
        a.doc.add(1L);
        room.applyUpdate("a", id(2));
        a.doc.add(2L);
        b.drain(); // b saw 1 and 2

        assertThat(room.applySnapshot("b", b.received, b.snapshotFrameBody())).isTrue();
        long baseSeq = room.baseSeq();
        // a's first frame (BASE) acknowledgement is older than the current base
        assertThat(room.applySnapshot("a", 1, encode(Set.of(1L, 2L)))).isFalse();
        assertThat(room.baseSeq()).isEqualTo(baseSeq);
    }

    // ── Read-only enforcement ────────────────────────────────────────────────

    @Test
    void readOnlyRejectsNonHostUpdatesAndSnapshotsButAllowsTheHost() {
        YjsRoom room = new YjsRoom("ROOM1", null, true);
        FakeClient host = join(room, "host", true);
        FakeClient guest = join(room, "guest", false);
        host.drain(); guest.drain();

        assertThat(room.applyUpdate("guest", id(1))).isFalse();
        assertThat(host.inbox).isEmpty();
        assertThat(room.applySnapshot("guest", guest.received, encode(Set.of(1L)))).isFalse();

        assertThat(room.applyUpdate("host", id(2))).isTrue();
        assertThat(guest.inbox).hasSize(1);

        room.setReadOnly(false);
        assertThat(room.applyUpdate("guest", id(3))).isTrue();
    }

    // ── Awareness ────────────────────────────────────────────────────────────

    static byte[] awareness(long clientId, long clock, String json) {
        var out = new java.io.ByteArrayOutputStream();
        writeVarUint(out, 1);
        writeVarUint(out, clientId);
        writeVarUint(out, clock);
        writeVarString(out, json);
        return out.toByteArray();
    }

    @Test
    void awarenessIsRelayedReplayedToJoinersAndRemovedOnLeave() {
        YjsRoom room = new YjsRoom("ROOM1", null, false);
        FakeClient a = join(room, "a", true);
        FakeClient b = join(room, "b", false);
        a.drain(); b.drain();

        room.applyAwareness("a", awareness(123456789L, 7, "{\"user\":{\"name\":\"A\"}}"));
        b.drain();
        assertThat(b.awareness).hasSize(1);

        FakeClient c = join(room, "c", false);
        c.drain();
        assertThat(c.awareness).hasSize(1); // late joiner sees a's cursor immediately

        room.leave("a");
        b.drain();
        byte[] removal = b.awareness.get(1);
        Map<Long, Long> parsed = parseAwarenessClocks(removal);
        assertThat(parsed).containsEntry(123456789L, -1L); // state "null" ⇒ offline
        // and the clock was bumped so y-protocols accepts it
        var d = new Decoder(removal);
        d.readVarUint();
        assertThat(d.readVarUint()).isEqualTo(123456789L);
        assertThat(d.readVarUint()).isEqualTo(8L);
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────

    @Test
    void roomIsOnlyEvictableWhenEmptyPersistedAndLogFree() {
        YjsRoom room = new YjsRoom("ROOM1", null, false);
        FakeClient a = join(room, "a", true);
        a.drain();
        room.applyUpdate("a", id(1));
        a.doc.add(1L);
        room.leave("a");
        assertThat(room.closeIfIdle()).isFalse(); // un-compacted edit would be lost

        FakeClient b = join(room, "b", true);
        b.drain();
        room.applySnapshot("b", b.received, b.snapshotFrameBody());
        room.leave("b");
        assertThat(room.closeIfIdle()).isFalse(); // dirty, not yet persisted
        room.takeDirtyBase();
        assertThat(room.closeIfIdle()).isTrue();
        assertThat(room.join(new FakeClient("late"), false)).isFalse();
    }

    @Test
    void closeAllDisconnectsEveryone() {
        YjsRoom room = new YjsRoom("ROOM1", null, false);
        FakeClient a = join(room, "a", true);
        FakeClient b = join(room, "b", false);
        room.closeAll(CLOSE_NOT_FOUND, "deleted");
        assertThat(a.closed).isTrue();
        assertThat(b.closed).isTrue();
        assertThat(room.peerCount()).isZero();
    }

    // ── Randomized convergence test ─────────────────────────────────────────

    /**
     * Random interleavings of edits, in-flight delivery, snapshots, joins and leaves.
     * Invariant checked after every step: a new joiner receives every edit ever made,
     * and every connected client converges once its inbox is drained.
     */
    @ParameterizedTest
    @ValueSource(longs = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20})
    void randomizedNoEditIsEverLost(long seed) {
        Random rnd = new Random(seed);
        YjsRoom room = new YjsRoom("FUZZ", encode(Set.of(0L)), false);
        Set<Long> allEdits = new HashSet<>(Set.of(0L));
        Map<String, FakeClient> clients = new LinkedHashMap<>();
        long nextEdit = 1;
        int nextClient = 0;

        for (int step = 0; step < 3000; step++) {
            int action = rnd.nextInt(100);
            List<FakeClient> live = new ArrayList<>(clients.values());

            if (live.isEmpty() || action < 5) {
                String cid = "c" + nextClient++;
                clients.put(cid, join(room, cid, rnd.nextBoolean()));
            } else if (action < 45) {
                FakeClient c = live.get(rnd.nextInt(live.size()));
                long edit = nextEdit++;
                c.doc.add(edit);
                allEdits.add(edit);
                room.applyUpdate(c.id, id(edit));
            } else if (action < 80) {
                live.get(rnd.nextInt(live.size())).processOne();
            } else if (action < 95) {
                FakeClient c = live.get(rnd.nextInt(live.size()));
                room.applySnapshot(c.id, c.received, c.snapshotFrameBody());
                if (rnd.nextInt(4) == 0) room.takeDirtyBase(); // simulated persistence
            } else if (live.size() > 1) {
                FakeClient c = live.get(rnd.nextInt(live.size()));
                room.leave(c.id);
                clients.remove(c.id);
            }

            if (step % 50 == 0) {
                assertThat(whatAJoinerSees(room)).as("seed %d step %d", seed, step).containsAll(allEdits);
            }
        }

        for (FakeClient c : clients.values()) {
            c.drain();
            assertThat(c.doc).as("client %s converged", c.id).containsAll(allEdits);
        }
        assertThat(whatAJoinerSees(room)).containsAll(allEdits);
    }
}
