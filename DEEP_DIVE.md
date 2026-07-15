# CollabCode: Architecture & Deep Dive

This document serves as an in-depth technical explainer of the CollabCode project. It covers the system architecture, authentication flow, real-time collaboration mechanism, presence system, and code execution flow, detailing the design decisions and trade-offs. It also includes a section of likely interview questions and answers.

---

## 1. System Architecture

CollabCode follows a **client-server architecture** with a heavy emphasis on real-time communication.

### Core Components
- **Frontend (React/Vite)**: Manages the UI, Editor (Monaco), Clerk Authentication, and local document state.
- **Backend (Spring Boot)**: Acts as the central authority for room management, authentication validation, and a relay server for real-time events.
- **Database (PostgreSQL via Neon)**: Stores persistent data (Users, Rooms, Document Snapshots).
- **Code Execution API (Wandbox)**: Third-party service used to compile and execute user code in a sandboxed environment.

### Dual WebSocket Architecture
CollabCode employs two distinct WebSocket connections for performance and separation of concerns:
1. **Yjs WebSocket (`/ws/yjs/{roomCode}`)**: A raw, binary WebSocket used exclusively for synchronizing the Yjs CRDT (Conflict-free Replicated Data Type) document state.
2. **STOMP WebSocket (`/ws/stomp`)**: A text-based, pub/sub WebSocket used for application-level events (Presence, Chat, Language changes, Room Locking).

**Why Dual WebSockets?**
- *Performance*: Yjs updates are binary and highly frequent (emitted on every keystroke). Using a dedicated raw WebSocket avoids the parsing overhead of STOMP.
- *Separation of Concerns*: STOMP provides built-in routing (`/topic/room/{code}`) and message formatting (JSON), which is ideal for chat and presence but unnecessary for raw CRDT sync.

---

## 2. Real-Time Collaboration (Yjs + WebSockets)

CollabCode ensures multiple users can edit the same document simultaneously without merge conflicts using **Yjs (a CRDT implementation)**.

### How it Works (End-to-End Flow)
1. **Local Update**: When User A types in the Monaco editor, the `y-monaco` binding intercepts the change and applies it to the local Yjs document (`Y.Doc`).
2. **Serialization**: Yjs computes the minimal binary delta (update) representing this change.
3. **Transmission**: The `CollaborationProvider` sends this binary delta over the `/ws/yjs/{roomCode}` WebSocket.
4. **Server Relay**: The Spring Boot backend (`YjsWebSocketHandler`) receives the binary message. It does *not* parse or apply the CRDT logic. Instead, it acts as a dumb relay, broadcasting the exact binary payload to all other connected sessions in that room.
5. **Remote Application**: User B's browser receives the binary message. Yjs merges the remote update into User B's local `Y.Doc`. The CRDT algorithm mathematically guarantees that both users will end up with the exact same document state, regardless of the order updates arrive.

### Snapshot Persistence
To persist documents, the frontend periodically (e.g., every 30 seconds) serializes the entire `Y.Doc` state into a binary blob and sends it to the server. The backend saves this in the `document_snapshots` table as a `BYTEA` column. When a new user joins an empty room, the server sends the latest snapshot to initialize their editor.

**Trade-off (Server as Relay vs. Server as Client)**: We chose to make the server a "dumb relay" for Yjs updates rather than a full Yjs client (like y-websocket on Node.js).
- *Pros*: Saves CPU on the Java backend; simplifies backend architecture (no complex Java CRDT libraries needed).
- *Cons*: The server relies on clients to periodically push full snapshots for persistence, meaning the very last few seconds of edits might be lost if all clients disconnect abruptly.

---

## 3. Authentication & User Provisioning (Clerk)

CollabCode offloads identity management to **Clerk** (specifically Google Sign-In) to ensure secure, passwordless authentication.

### Authentication Flow
1. **Frontend Auth**: The user authenticates via Clerk's React SDK. Clerk issues a short-lived JWT (session token).
2. **API Requests**: For REST calls (e.g., `POST /api/rooms`), the frontend attaches the JWT as a `Bearer` token.
3. **Backend Validation**: Spring Security's `oauth2ResourceServer` intercepts the request. It fetches Clerk's public keys (JWKS) from the configured endpoint and cryptographically verifies the JWT's signature and expiration.
4. **WebSocket Auth**: WebSockets cannot easily send custom HTTP headers during the initial upgrade request. Therefore, the token is passed either as a URL parameter (for the Yjs WS) or in the STOMP `CONNECT` frame header. The backend validates these tokens using a custom `ClerkJwtValidator` before accepting the connection.

### Auto-Provisioning (Just-In-Time)
The system uses a "lazy" database provisioning model. When a valid Clerk JWT is processed, the backend extracts the `clerk_user_id`, `email`, and `username`. The `UserProvisioningService` checks the local PostgreSQL database. If the user doesn't exist, they are inserted. This guarantees that local foreign keys (e.g., `rooms.owner_id`) always have a valid local `User` record to reference, without needing complex webhook synchronizations with Clerk.

---

## 4. Real-Time Presence System

The presence system shows who is currently viewing the room, along with their avatars.

### How it Works
1. **Join Event**: Upon successful WebSocket connection, the client publishes a message to `/app/room/{code}/join`.
2. **State Tracking**: The `PresenceService` maintains a thread-safe `ConcurrentHashMap` tracking active connections per user per room. It stores the user's Clerk ID, display name, and avatar URL.
3. **Broadcasting**: Whenever the count of active connections for a user goes from 0 to 1 (joined) or 1 to 0 (left), the server broadcasts the updated list of users to `/topic/room/{code}/presence`.
4. **Disconnection Handling**: If a WebSocket abruptly closes, the STOMP lifecycle event listeners (e.g., `SessionDisconnectEvent`) trigger the `PresenceService` to decrement the user's connection count and broadcast the updated state.

---

## 5. Room Locking & Host Controls

The user who creates a room is designated as the **Host** (`owner_id` in the database). 

### Features
- **Delete Room**: Permanently removes the room and its snapshots.
- **Lock Room**: Prevents any new users from joining the room.
- **Read-Only Mode**: The host can disable editing for all guests.

### Implementation Details
- **Verification**: The frontend uses `room.ownerClerkId === clerkUser.id` to conditionally render host controls.
- **API Security**: The backend `RoomService` verifies that the `principal.getName()` (the Clerk ID extracted from the JWT) matches the room's owner before allowing lock/delete operations.
- **Real-Time Enforcement**: When the room is locked, an API updates the `is_locked` column in the database, and a STOMP message is broadcast to all clients. The frontend then dynamically updates the Monaco editor's `readOnly` prop based on `isReadOnly || (isRoomLocked && !isHost)`.

---

## 6. Code Execution (Judge0 / Wandbox)

CollabCode allows users to compile and run code in 14+ languages directly from the browser.

### Execution Flow
1. **Request**: The frontend gathers the current code from Monaco, the selected language, and any STDIN input, and posts it to `/api/execute`.
2. **Translation**: The backend `CodeExecutionService` maps our generic language names (e.g., "python") to the specific compiler versions required by the execution engine (e.g., "cpython-3.13.8").
3. **Execution**: The backend makes a synchronous HTTP POST request to the remote execution API (Wandbox). 
4. **Response Mapping**: The raw stdout, stderr, and compilation errors are parsed and mapped into a standardized `ExecuteCodeResponse` DTO, which the frontend displays in a collapsible output panel.

---

## 7. Interview Q&A Cheatsheet

### Q: How does real-time collaboration work without merge conflicts?
**A:** We use Yjs, which implements CRDTs (Conflict-free Replicated Data Types). Instead of trying to lock the document or perform complex operational transforms on the server, every character typed is assigned a unique, mathematical identifier. When users edit concurrently, the CRDT algorithm guarantees that applying these character updates in any order across different clients will always result in the exact same final document state.

### Q: Why use two separate WebSockets for your app?
**A:** Separation of concerns and performance. We use a raw binary WebSocket for Yjs document synchronization because CRDT updates are frequent and binary; avoiding JSON parsing overhead keeps typing latency extremely low. For application features like Chat and Presence, we use a separate STOMP WebSocket, which provides built-in pub/sub routing and JSON messaging, making feature development much easier.

### Q: How do you handle authentication in WebSockets?
**A:** Standard HTTP headers don't work well with the WebSocket handshake in browser APIs. For the raw Yjs WebSocket, the frontend passes the Clerk JWT as a URL query parameter, which the backend validates during the handshake interceptor. For STOMP, we pass the JWT inside the STOMP `CONNECT` frame headers. Both methods intercept the connection, validate the token against Clerk's JWKS, and set the Spring Security Principal before allowing the connection to establish.

### Q: What happens if two users edit the same exact line at the exact same time?
**A:** Yjs handles this seamlessly. Because it's a sequence CRDT, every insertion is tracked relative to the characters around it. If User A types "X" and User B types "Y" at index 5, Yjs uses logical timestamps (Lamport clocks) and client IDs to deterministically order the insertions. Both clients will end up with either "XY" or "YX" at that position without any data loss or application crashes.

### Q: How do you persist the collaborative document?
**A:** The Java backend acts as a relay for real-time edits, but the frontend clients are responsible for periodically generating a full binary snapshot of the Yjs document state. Every 30 seconds, a client sends this snapshot to the backend, which stores it as a `BYTEA` blob in PostgreSQL. When a new user joins, the backend serves the most recent snapshot so their editor can initialize the state.

### Q: How is user data synchronized between Clerk and your local database?
**A:** We use a "Just-In-Time" (lazy) provisioning approach. We don't rely on complex Clerk webhooks that can fail or get out of sync. Instead, on every authenticated request, a Spring Security interceptor inspects the JWT. If it's a valid token, our `UserProvisioningService` checks if the user's Clerk ID exists in our PostgreSQL database. If not, it creates a local record on the fly. This ensures our local foreign keys (like Room Owners) always have valid references.
