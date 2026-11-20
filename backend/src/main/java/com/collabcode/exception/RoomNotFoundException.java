package com.collabcode.exception;

/** Thrown when a room code does not exist (or the room has been deleted). Mapped to HTTP 404. */
public class RoomNotFoundException extends RuntimeException {
    public RoomNotFoundException(String roomCode) {
        super("Room not found: " + roomCode);
    }
}
