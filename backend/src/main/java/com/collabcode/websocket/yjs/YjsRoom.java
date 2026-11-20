package com.collabcode.websocket.yjs;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static com.collabcode.websocket.yjs.YjsProtocol.*;

/**
 * Authoritative in-memory state of one collaborative document.
 *
 * <h3>Why this exists</h3>
 * The server cannot merge Yjs updates itself (there is no maintained Java Yjs
 * implementation), so it keeps:
 * <ul>
 *   <li>{@code base} — a full document state produced by some client, covering
 *       every log entry with seq ≤ {@code baseSeq};</li>
 *   <li>{@code log} — every update received after that, in arrival order.</li>
 * </ul>
 * A joining client receives base + the whole log, so it always ends up with
 * <em>every</em> edit the server has seen. (Previously joiners only received a
 * 30-second-old DB snapshot; later edits that depended on missing ones stayed
 * "pending" forever in Yjs, so lines landed in the wrong place or vanished.)
 *
 * <h3>Compaction</h3>
 * The log is compacted when a client sends its full state together with
 * {@code ack} = how many BASE/UPDATE frames it had processed. The server
 * records, per peer, the seq of every frame it sent, so it knows the snapshot
 * contains every entry up to that seq (frames are sent in seq order under this
 * object's lock, and a peer's own updates are always in its own state).
 *
 * All public methods are synchronized; peers' sends happen under the lock so
 * frame order always matches seq order.
 */
public class YjsRoom {

    private static final Logger log = LoggerFactory.getLogger(YjsRoom.class);

    /** Abstraction over a WebSocket session (lets unit tests use fakes). */
    public interface Peer {
        String id();
        void send(byte[] frame) throws Exception;
        void close(int code, String reason);
    }

    private record Entry(long seq, String authorId, byte[] data) {}

    private static final class PeerState {
        final Peer peer;
        final boolean owner;
        /** seq of each BASE/UPDATE frame sent to this peer, minus the first {@code trimmed}. */
        final ArrayList<Long> sentSeqs = new ArrayList<>();
        long trimmed = 0;
        byte[] lastAwareness;
        final Map<Long, Long> awarenessClocks = new HashMap<>();

        PeerState(Peer peer, boolean owner) {
            this.peer = peer;
            this.owner = owner;
        }
    }

    private final String roomCode;
    private byte[] base;
    private long baseSeq = 0;
    private long nextSeq = 1;
    private final ArrayDeque<Entry> updates = new ArrayDeque<>();
    private long logBytes = 0;
    private final Map<String, PeerState> peers = new LinkedHashMap<>();
    private boolean readOnly;
    private boolean dirty = false;
    private boolean closed = false;

    public YjsRoom(String roomCode, byte[] persistedState, boolean readOnly) {
        this.roomCode = roomCode;
        this.base = persistedState;
        this.readOnly = readOnly;
    }

    // ── Membership ───────────────────────────────────────────────────────────

    /**
     * Adds a peer and sends it the full document (base + log) plus everyone's awareness.
     * @return false if this room object was already evicted (caller must retry with a fresh room)
     */
    public synchronized boolean join(Peer peer, boolean owner) {
        if (closed) return false;
        PeerState ps = new PeerState(peer, owner);
        peers.put(peer.id(), ps);

        sendTracked(ps, MSG_BASE, base != null ? base : new byte[0], baseSeq);
        for (Entry e : updates) {
            sendTracked(ps, MSG_UPDATE, e.data(), e.seq());
        }
        for (PeerState other : peers.values()) {
            if (other != ps && other.lastAwareness != null) {
                sendRaw(ps, frame(MSG_AWARENESS, other.lastAwareness));
            }
        }
        return true;
    }

    /** Removes a peer and tells the others its cursor is gone. */
    public synchronized void leave(String peerId) {
        PeerState ps = peers.remove(peerId);
        if (ps == null || ps.awarenessClocks.isEmpty()) return;
        Map<Long, Long> live = new LinkedHashMap<>();
        ps.awarenessClocks.forEach((client, clock) -> { if (clock >= 0) live.put(client, clock); });
        if (live.isEmpty()) return;
        byte[] removal = frame(MSG_AWARENESS, encodeAwarenessRemoval(live));
        for (PeerState other : peers.values()) sendRaw(other, removal);
    }

    // ── Messages ─────────────────────────────────────────────────────────────

    /** @return false when the update was rejected (read-only mode and sender is not the host). */
    public synchronized boolean applyUpdate(String peerId, byte[] update) {
        PeerState sender = peers.get(peerId);
        if (sender == null || update.length == 0) return false;
        if (readOnly && !sender.owner) return false;

        Entry entry = new Entry(nextSeq++, peerId, update);
        updates.addLast(entry);
        logBytes += update.length;

        byte[] msg = frame(MSG_UPDATE, update);
        for (PeerState ps : peers.values()) {
            if (ps != sender) sendTracked(ps, msg, entry.seq());
        }
        return true;
    }

    public synchronized void applyAwareness(String peerId, byte[] update) {
        PeerState sender = peers.get(peerId);
        if (sender == null) return;
        try {
            parseAwarenessClocks(update).forEach((client, clock) -> {
                if (clock < 0) sender.awarenessClocks.remove(client);
                else sender.awarenessClocks.merge(client, clock, Math::max);
            });
        } catch (IllegalArgumentException e) {
            log.debug("[Yjs] Ignoring malformed awareness update in room {}", roomCode);
            return;
        }
        sender.lastAwareness = update;
        byte[] msg = frame(MSG_AWARENESS, update);
        for (PeerState ps : peers.values()) {
            if (ps != sender) sendRaw(ps, msg);
        }
    }

    /**
     * Compacts the log using a full client state.
     * @return true if the base was replaced (i.e. there is something new to persist)
     */
    public synchronized boolean applySnapshot(String peerId, long ack, byte[] state) {
        PeerState ps = peers.get(peerId);
        if (ps == null || state.length == 0 || ack <= 0) return false;
        // A non-host's state could contain edits the server rejected in read-only mode.
        if (readOnly && !ps.owner) return false;

        long index = ack - 1 - ps.trimmed;
        if (index < 0 || index >= ps.sentSeqs.size()) {
            log.debug("[Yjs] Ignoring snapshot with out-of-range ack {} in room {}", ack, roomCode);
            return false;
        }
        long coveredSeq = ps.sentSeqs.get((int) index);
        // Frames before the acked one are never needed again for this peer.
        ps.sentSeqs.subList(0, (int) index).clear();
        ps.trimmed += index;

        // The log always holds the contiguous range (baseSeq, nextSeq). If the client's
        // coverage is behind the base we cannot reason about the gap, so give up.
        if (coveredSeq < baseSeq) {
            return false;
        }
        // The sender never receives its own updates, but they are in its state.
        // Extend coverage through the run of the sender's own entries that directly
        // follows coveredSeq (a solo editor's snapshots would otherwise never compact).
        for (Entry e : updates) {
            if (e.seq() <= coveredSeq) continue;
            if (e.seq() == coveredSeq + 1 && e.authorId().equals(peerId)) {
                coveredSeq = e.seq();
            } else {
                break;
            }
        }

        // Only accept strictly newer coverage. Invariant: base ∪ log contains every edit.
        // The new state holds every entry with seq <= coveredSeq (and the previous base,
        // which the client received when it joined). Entries after coveredSeq stay in the
        // log, including the sender's own later ones; replaying a duplicate is a no-op in Yjs.
        if (coveredSeq <= baseSeq) {
            return false;
        }

        base = state;
        baseSeq = coveredSeq;
        Iterator<Entry> it = updates.iterator();
        while (it.hasNext()) {
            Entry e = it.next();
            if (e.seq() > coveredSeq) break; // log is in seq order
            logBytes -= e.data().length;
            it.remove();
        }
        dirty = true;
        return true;
    }

    // ── Host settings ────────────────────────────────────────────────────────

    public synchronized void setReadOnly(boolean readOnly) {
        this.readOnly = readOnly;
    }

    public synchronized boolean isReadOnly() {
        return readOnly;
    }

    // ── Persistence / lifecycle (used by YjsRoomManager) ────────────────────

    /** Returns the base if it changed since the last call, otherwise null. */
    public synchronized byte[] takeDirtyBase() {
        if (!dirty) return null;
        dirty = false;
        return base;
    }

    public synchronized void markDirty() {
        dirty = true;
    }

    /** Evicts the room if nobody is connected and nothing is left to persist. */
    public synchronized boolean closeIfIdle() {
        if (!peers.isEmpty() || dirty || !updates.isEmpty()) return false;
        closed = true;
        return true;
    }

    /** Disconnects everyone (room deleted) and makes this object unusable. */
    public synchronized void closeAll(int code, String reason) {
        closed = true;
        for (PeerState ps : peers.values()) {
            try {
                ps.peer.close(code, reason);
            } catch (Exception ignored) {
                // already closed
            }
        }
        peers.clear();
        updates.clear();
    }

    public synchronized int peerCount() { return peers.size(); }
    public synchronized int logSize() { return updates.size(); }
    public synchronized long logBytes() { return logBytes; }
    public synchronized long baseSeq() { return baseSeq; }
    public synchronized byte[] base() { return base; }
    public String roomCode() { return roomCode; }

    /** Peer ids, for sessions that should be asked to resync after an error. */
    public synchronized List<String> peerIds() { return new ArrayList<>(peers.keySet()); }

    // ── Sending ──────────────────────────────────────────────────────────────

    private void sendTracked(PeerState ps, int type, byte[] payload, long seq) {
        sendTracked(ps, frame(type, payload), seq);
    }

    private void sendTracked(PeerState ps, byte[] frame, long seq) {
        // Track even if the send fails: the peer will be closed and the counter discarded.
        ps.sentSeqs.add(seq);
        sendRaw(ps, frame);
    }

    private void sendRaw(PeerState ps, byte[] frame) {
        try {
            ps.peer.send(frame);
        } catch (Exception e) {
            log.warn("[Yjs] Send to peer {} in room {} failed: {}", ps.peer.id(), roomCode, e.getMessage());
            try {
                ps.peer.close(1011, "send failed");
            } catch (Exception ignored) {
                // already closed
            }
        }
    }
}
