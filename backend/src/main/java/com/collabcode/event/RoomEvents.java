package com.collabcode.event;

/**
 * Application events describing room lifecycle changes.
 *
 * They are published inside RoomService transactions and consumed with
 * {@code @TransactionalEventListener(AFTER_COMMIT)} so listeners (the Yjs relay,
 * chat history) only react to changes that were actually committed.
 */
public final class RoomEvents {

    private RoomEvents() {}

    /** A room was deleted (by its host or by the expiry scheduler). */
    public record RoomDeleted(String roomCode, String reason) {}

    /** The host toggled "only the host can edit" mode. */
    public record RoomReadOnlyChanged(String roomCode, boolean readOnly) {}
}
