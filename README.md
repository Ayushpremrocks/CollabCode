# CollabCode — Real-Time Collaborative Code Editor

<div align="center">

[![Java](https://img.shields.io/badge/Java-21-ED8B00?style=flat-square&logo=openjdk&logoColor=white)](https://openjdk.org/projects/jdk/21/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3.5-6DB33F?style=flat-square&logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Yjs](https://img.shields.io/badge/Yjs-CRDTs-7C3AED?style=flat-square)](https://yjs.dev/)

**A full-stack, production-grade collaborative code editor powered by Yjs CRDTs, dual WebSocket channels, and Monaco Editor.**

[Features](#-features) · [Architecture](#-architecture) · [Tech Stack](#-tech-stack) · [Getting Started](#-getting-started) · [API Reference](#-api-reference) · [Project Structure](#-project-structure)

</div>

---

## ✨ Features

CollabCode implements **13 distinct features** across the full stack:

| # | Feature | Description |
|---|---------|-------------|
| 1 | **CRDT Real-Time Editing** | Yjs conflict-free replicated data types — edits from multiple users never conflict, even on poor connections |
| 2 | **Room Management** | Create named rooms, share 8-character codes, host can delete rooms with real-time notification to all clients |
| 3 | **JWT Authentication** | Secure stateless auth with BCrypt password hashing; JWT passed via HTTP headers and WS query params |
| 4 | **Live Presence** | See exactly who is online per room; per-user colored avatars and gutter authorship indicators in the editor |
| 5 | **Code Execution** | Run code in 14 languages via the Wandbox API; see stdout, stderr, compile errors, and runtime status |
| 6 | **Read-Only Mode** | Host can lock the editor for all participants; real-time toggle via STOMP broadcast |
| 7 | **Live Chat** | Built-in chat panel powered by STOMP; unread badge counter when panel is collapsed |
| 8 | **Snapshot History** | Auto-save every 30 seconds; up to 20 snapshots per room with labels; host can restore any snapshot |
| 9 | **Room Expiry** | Rooms auto-expire after 48 hours of inactivity; hourly cleanup scheduler; 1-hour expiry warning banner |
| 10 | **Code Download** | Download the current editor content as a file with the correct extension for the selected language |
| 11 | **20 Languages** | JavaScript, TypeScript, Python, Java, C++, C, C#, Go, Rust, Kotlin, Swift, Ruby, PHP, HTML, CSS, JSON, SQL, Markdown, YAML, Bash |
| 12 | **Dark / Light Theme** | System-wide theme toggle persisted in context |
| 13 | **Font Size Control** | Per-user font size preference, persisted to `localStorage` |

---

## 🏗 Architecture

CollabCode uses a **dual WebSocket architecture** — two purpose-built channels running in parallel on the same Spring Boot server:

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser Client                         │
│         React 19 + Monaco Editor + Yjs + STOMP.js           │
└─────────────────┬──────────────────────┬────────────────────┘
                  │                      │
    Binary WS     │                      │   STOMP over WS
  /ws/yjs/{code} │                      │   /ws/stomp
  Yjs CRDT sync  │                      │   Presence, Chat,
  (byte arrays)  │                      │   Language, Read-only
                  │                      │   Room events
                  ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Spring Boot 3.3.5 (Java 21)               │
│                                                             │
│  ┌──────────────────┐    ┌──────────────────────────────┐  │
│  │ YjsWebSocket     │    │ StompPresenceController      │  │
│  │ Handler          │    │ + StompAuthChannelInterceptor│  │
│  │ (BinaryWS relay) │    │ (STOMP messaging)            │  │
│  └──────────┬───────┘    └──────────────┬───────────────┘  │
│             │                           │                   │
│  ┌──────────▼───────────────────────────▼───────────────┐  │
│  │     Service Layer                                     │  │
│  │  RoomService · DocumentService · CodeExecutionService│  │
│  │  AuthService · PresenceService · RoomExpiryScheduler │  │
│  └──────────────────────────┬────────────────────────────┘  │
│                             │ JPA                           │
│  ┌──────────────────────────▼────────────────────────────┐  │
│  │               PostgreSQL Database                     │  │
│  │  users · rooms · room_participants · document_snapshots│  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │   Wandbox API (wandbox.org) │
              │   External code execution  │
              └─────────────────────────────┘
```

### WebSocket Channel Details

| Channel | URL | Protocol | Purpose |
|---------|-----|----------|---------|
| **Yjs Sync** | `ws://localhost:8080/ws/yjs/{roomCode}?token=...` | Raw Binary | Document CRDT updates and snapshot persistence |
| **STOMP** | `ws://localhost:8080/ws/stomp` | STOMP over WS | Presence, chat, language change, read-only toggle, room events |

#### Yjs Binary Protocol (message type in byte 0)

| Byte 0 | Direction | Meaning |
|--------|-----------|---------|
| `0` | Client → Server → Others | Yjs sync update (broadcast relay) |
| `1` | Client → Server → Others | Awareness update (broadcast relay) |
| `2` | Client → Server | Snapshot save (persist to DB) |
| `3` | Server → Client | Snapshot load (deliver existing doc on join) |

#### STOMP Topics

| Topic | Direction | Event |
|-------|-----------|-------|
| `/app/room/{code}/join` | Client → Server | User announces join |
| `/app/room/{code}/leave` | Client → Server | User announces leave |
| `/app/room/{code}/language` | Client → Server | Language change request |
| `/app/room/{code}/readonly` | Client → Server | Toggle read-only (host only) |
| `/app/room/{code}/chat` | Client → Server | Send chat message |
| `/topic/room/{code}/presence` | Server → All | Updated active user list |
| `/topic/room/{code}/room-state` | Server → All | Current room state (language) |
| `/topic/room/{code}/user-joined` | Server → All | New user joined event |
| `/topic/room/{code}/language` | Server → All | Language changed broadcast |
| `/topic/room/{code}/readonly` | Server → All | Read-only mode changed |
| `/topic/room/{code}/chat` | Server → All | Chat message broadcast |
| `/topic/room/{code}/room-deleted` | Server → All | Room was deleted/expired |

---

## 🛠 Tech Stack

### Backend

| Technology | Version | Role |
|------------|---------|------|
| **Java** | 21 | Runtime |
| **Spring Boot** | 3.3.5 | Application framework |
| **Spring WebSocket** | (included) | Raw WS + STOMP support |
| **Spring Security** | (included) | JWT auth, CORS, stateless sessions |
| **Spring Data JPA** | (included) | ORM layer |
| **PostgreSQL** | 16+ | Primary database |
| **JJWT** | 0.12.6 | JWT token creation and validation |
| **Lombok** | 1.18.42 | Boilerplate reduction |
| **Wandbox API** | (external) | Code execution (no API key needed) |

### Frontend

| Technology | Version | Role |
|------------|---------|------|
| **React** | 19.2.6 | UI framework |
| **TypeScript** | 6.0.2 | Type safety |
| **Vite** | 8.0.12 | Build tool and dev server |
| **Monaco Editor** | 0.55.1 | VS Code-grade code editor |
| **@monaco-editor/react** | 4.7.0 | React bindings for Monaco |
| **Yjs** | 13.6.31 | CRDT document model |
| **y-monaco** | 0.1.6 | Yjs ↔ Monaco binding |
| **@stomp/stompjs** | 7.3.0 | STOMP WebSocket client |
| **React Router DOM** | 7.17.0 | Client-side routing |
| **Axios** | 1.17.0 | HTTP REST client |
| **Tailwind CSS** | 4.3.0 | Utility-first styling |

---

## 📁 Project Structure

```
CollabCode/
├── backend/
│   ├── DockerFile                    # Multi-stage Docker build
│   ├── pom.xml                       # Maven dependencies
│   └── src/main/
│       ├── java/com/collabcode/
│       │   ├── CollabCodeApplication.java
│       │   ├── config/
│       │   │   ├── SecurityConfig.java        # JWT filter, CORS, stateless
│       │   │   ├── StompWebSocketConfig.java  # STOMP broker config
│       │   │   └── RawWebSocketConfig.java    # Raw WS: /ws/yjs/{roomCode}
│       │   ├── controller/
│       │   │   ├── AuthController.java        # POST /api/auth/register & /login
│       │   │   ├── RoomController.java        # Room CRUD, execute, snapshots
│       │   │   └── GlobalExceptionHandler.java
│       │   ├── dto/                           # 13 request/response POJOs
│       │   ├── model/                         # 4 JPA entities
│       │   │   ├── User.java
│       │   │   ├── Room.java
│       │   │   ├── RoomParticipant.java
│       │   │   └── DocumentSnapshot.java      # Stores Yjs binary state (BYTEA)
│       │   ├── repository/                    # Spring Data JPA repositories
│       │   ├── security/
│       │   │   ├── JwtUtil.java
│       │   │   ├── JwtAuthFilter.java
│       │   │   └── CustomUserDetailsService.java
│       │   ├── service/
│       │   │   ├── AuthService.java
│       │   │   ├── RoomService.java           # Room CRUD, code gen, expiry
│       │   │   ├── DocumentService.java       # Snapshots, language, pruning (max 20)
│       │   │   ├── CodeExecutionService.java  # Wandbox API integration
│       │   │   ├── PresenceService.java       # In-memory per-room user tracking
│       │   │   └── RoomExpiryScheduler.java   # Hourly @Scheduled cleanup
│       │   └── websocket/
│       │       ├── YjsWebSocketHandler.java   # Binary WS relay + snapshot on join
│       │       ├── StompPresenceController.java # @MessageMapping STOMP handlers
│       │       └── StompAuthChannelInterceptor.java # JWT for STOMP CONNECT
│       └── resources/
│           ├── application.yml.example        # Config template
│           └── schema.sql                     # DDL (idempotent, safe migrations)
│
└── frontend/
    ├── index.html
    ├── vite.config.ts
    ├── package.json
    ├── vercel.json                   # SPA rewrite rule
    └── src/
        ├── main.tsx
        ├── App.tsx                   # Router + Provider tree
        ├── index.css                 # Global styles + animations
        ├── types/index.ts            # All TS interfaces + LANGUAGE_CONFIG
        ├── contexts/
        │   ├── AuthContext.tsx
        │   ├── WebSocketContext.tsx  # STOMP singleton + publish helper
        │   └── ThemeContext.tsx
        ├── services/
        │   ├── api.ts               # Axios with JWT interceptor
        │   ├── authService.ts
        │   ├── roomService.ts
        │   ├── executionService.ts
        │   └── collaborationService.ts  # Raw WS + Yjs protocol
        ├── hooks/
        │   ├── useCollaboration.ts  # Y.Doc + provider lifecycle
        │   └── usePresence.ts       # STOMP presence subscription
        ├── pages/
        │   ├── LandingPage.tsx      # Public marketing page
        │   ├── LoginPage.tsx
        │   ├── RegisterPage.tsx
        │   ├── DashboardPage.tsx    # Room cards, create/join
        │   └── EditorPage.tsx       # Main editor — orchestrates all features
        ├── components/
        │   ├── CollaborativeEditor.tsx  # Monaco + y-monaco + gutter authorship
        │   ├── ActiveUsersPanel.tsx
        │   ├── ChatPanel.tsx
        │   ├── RoomControls.tsx
        │   ├── OutputPanel.tsx
        │   ├── HistoryModal.tsx
        │   ├── Navbar.tsx
        │   └── ProtectedRoute.tsx
        └── utils/
            └── downloadFile.ts
```

---

## 🗄 Database Schema

Four tables managed by `schema.sql` (run on every boot via `spring.sql.init.mode: always`):

```sql
-- Users
users (id BIGSERIAL PK, username UNIQUE, email UNIQUE, password_hash, created_at)

-- Rooms
rooms (id BIGSERIAL PK, room_code UNIQUE, name, owner_id → users,
       created_at, last_active_at, expires_at = NOW() + 48h)

-- Participants (many-to-many; owner is auto-joined on room create)
room_participants (id, room_id → rooms, user_id → users, joined_at)
  UNIQUE(room_id, user_id)

-- Snapshots (Yjs binary state, max 20 per room, oldest auto-pruned)
document_snapshots (id, room_id → rooms, document_data BYTEA,
                    language VARCHAR(30), snapshot_label, updated_at)
```

> All DDL uses `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for safe re-runs on existing databases.

---

## 🚀 Getting Started

### Prerequisites

| Tool | Minimum Version |
|------|----------------|
| Java JDK | 21 |
| Maven | 3.9+ |
| Node.js | 18+ |
| npm | 9+ |
| PostgreSQL | 14+ |

---

### Step 1 — Set up PostgreSQL

```sql
CREATE DATABASE collabeditor;
-- Optionally create a dedicated user:
CREATE USER postgres WITH PASSWORD 'Ayush123#';
GRANT ALL PRIVILEGES ON DATABASE collabeditor TO postgres;
```

The schema tables are auto-created on first boot from `schema.sql`.

---

### Step 2 — Configure the Backend

```powershell
# Copy the example config
Copy-Item backend\src\main\resources\application.yml.example `
           backend\src\main\resources\application.yml
```

Edit `application.yml` — update `password`, and optionally the JWT `secret`:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/collabeditor
    username: postgres
    password: YOUR_PASSWORD_HERE   # ← change this

app:
  jwt:
    secret: NctPtKzPaj2/XVGtKikBJZpPgzOP0qTekSglQVpxfsQ=  # use your own in production
  cors:
    allowed-origins: http://localhost:5173
```

> Generate a secure JWT secret: `openssl rand -base64 32`

---

### Step 3 — Run the Backend

```powershell
cd backend
mvn spring-boot:run
```

The API server starts at **http://localhost:8080**.

---

### Step 4 — Run the Frontend

```powershell
cd frontend
npm install
npm run dev
```

The app starts at **http://localhost:5173**.

---

### Step 5 — Use the App

1. Open **http://localhost:5173**
2. Register → Log in → Dashboard
3. **Create a room** → enter the editor
4. Share the 8-character room code
5. Collaborators join via **Join Room** on the dashboard

---

## 🌐 API Reference

All REST endpoints are under `/api`. Protected routes require `Authorization: Bearer <token>`.

### Auth

| Method | Endpoint | Auth | Body |
|--------|----------|------|------|
| `POST` | `/api/auth/register` | ❌ | `{ username, email, password }` |
| `POST` | `/api/auth/login` | ❌ | `{ username, password }` |

Both return `{ token, username, email, userId }`.

### Rooms

| Method | Endpoint | Auth | Notes |
|--------|----------|------|-------|
| `POST` | `/api/rooms` | ✅ | Create room `{ name }` |
| `POST` | `/api/rooms/join` | ✅ | Join room `{ roomCode }` |
| `GET` | `/api/rooms` | ✅ | List user's rooms |
| `GET` | `/api/rooms/{roomCode}` | ✅ | Get room details |
| `DELETE` | `/api/rooms/{roomCode}` | ✅ | Host only; notifies via STOMP first |

### Snapshots

| Method | Endpoint | Auth | Notes |
|--------|----------|------|-------|
| `GET` | `/api/rooms/{roomCode}/snapshots` | ✅ | Metadata list |
| `GET` | `/api/rooms/{roomCode}/snapshots/{id}` | ✅ | Base64 Yjs data + language |
| `POST` | `/api/rooms/{roomCode}/snapshots/{id}/restore` | ✅ | Host only |

### Code Execution

```
POST /api/rooms/execute
Body: { "code": "...", "language": "python", "stdin": "" }
Response: { "stdout", "stderr", "compileOutput", "status", "statusId" }
```

---

## 🌍 Supported Languages for Execution

| Language | Compiler |
|----------|----------|
| JavaScript | Node.js 20.17.0 |
| TypeScript | TypeScript 5.6.2 |
| Python | CPython 3.13.8 |
| Java | OpenJDK 21 |
| C++ | GCC (latest) |
| C | GCC C mode (latest) |
| C# | .NET Core 8.0 |
| Go | Go 1.23.2 |
| Rust | Rust 1.82.0 |
| Swift | Swift 6.0.1 |
| Ruby | Ruby 3.4.9 |
| PHP | PHP 8.3.12 |
| SQL | SQLite 3.46.1 |
| Bash | Bash |

> HTML, CSS, JSON, Markdown, YAML, Kotlin — editor/highlighting only (no remote execution).

---

## 🔒 Security Model

| Layer | Mechanism |
|-------|-----------|
| Passwords | BCrypt via Spring Security |
| REST API | JWT Bearer token in `Authorization` header |
| Yjs WebSocket | JWT in `?token=` query param |
| STOMP WebSocket | JWT in CONNECT `Authorization` header; `StompAuthChannelInterceptor` validates |
| CORS | Configurable `app.cors.allowed-origins` |
| Sessions | Stateless (no server-side sessions) |
| Room ownership | Delete + read-only guarded by `isOwner()` on server |

---

## ⏰ Room Lifecycle

```
Room Created ──► expires_at = NOW() + 48h
                     │
    Any snapshot save ──► expires_at = NOW() + 48h  (rolling window)
                     │
    Hourly @Scheduled ──► DELETE expired rooms ──► STOMP /room-deleted
                     │
    Host DELETE API ──► STOMP /room-deleted ──► DB cascade delete
```

---

## 🐳 Docker (Backend)

```powershell
cd backend
docker build -t collabcode-backend .

docker run -p 8080:8080 `
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5432/collabeditor `
  -e SPRING_DATASOURCE_USERNAME=postgres `
  -e SPRING_DATASOURCE_PASSWORD=yourpassword `
  -e APP_JWT_SECRET=yourbase64secret `
  collabcode-backend
```

---

## 🧑‍💻 Development Commands

### Backend

```powershell
cd backend

# Run dev server
mvn spring-boot:run

# Run tests
mvn test

# Build production JAR
mvn clean package -DskipTests

# Check dependency updates
mvn versions:display-dependency-updates
```

### Frontend

```powershell
cd frontend

# Install dependencies
npm install

# Start dev server with HMR at http://localhost:5173
npm run dev

# Type-check only (no emit)
npx tsc --noEmit

# Lint
npm run lint

# Production build → dist/
npm run build

# Preview production build locally
npm run preview
```

---

## ⚙️ Configuration Reference

| Property | Default | Description |
|----------|---------|-------------|
| `server.port` | `8080` | Backend port |
| `spring.datasource.url` | `jdbc:postgresql://localhost:5432/collabeditor` | DB URL |
| `spring.datasource.username` | `postgres` | DB user |
| `spring.datasource.password` | *(required)* | DB password |
| `spring.jpa.hibernate.ddl-auto` | `validate` | `validate` in prod; schema handled by `schema.sql` |
| `spring.sql.init.mode` | `always` | Runs idempotent `schema.sql` on every boot |
| `app.jwt.secret` | *(Base64 key)* | JWT signing key — **change in production** |
| `app.jwt.expiration-ms` | `86400000` | JWT lifetime (24 hours) |
| `app.cors.allowed-origins` | `http://localhost:5173` | Comma-separated frontend origins |

### Frontend URLs to Update for Production

- `collaborationService.ts` → `WS_BASE_URL` (Yjs WebSocket)
- `WebSocketContext.tsx` → `brokerURL` (STOMP WebSocket)
- `api.ts` → Axios `baseURL` (REST API)

---

## 🚢 Deployment

### Frontend (Vercel / Netlify)

```powershell
cd frontend
npm run build
# Upload dist/ to Vercel or Netlify
```

The included `vercel.json` handles SPA routing.

### Backend (Railway / Render / EC2)

1. Set environment variables for DB and JWT
2. `mvn clean package -DskipTests`
3. Deploy `target/collab-code-editor-1.0.0.jar`

---

<div align="center">
Made with ☕ and Yjs CRDTs
</div>
