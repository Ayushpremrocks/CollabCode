# CollabCode

> A production-grade, real-time collaborative code editor — built with Yjs CRDTs, Spring Boot 3, and Clerk authentication.

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.3-6DB33F?logo=springboot)](https://spring.io/projects/spring-boot)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF?logo=clerk)](https://clerk.dev)

---

## What It Is

CollabCode lets multiple developers edit the same file simultaneously — with zero conflicts, real-time presence, live chat, and instant code execution — all inside a Monaco-powered code editor, secured by Google sign-in via Clerk.

---

## Features

| Feature | Details |
|---|---|
| **Real-Time Collaboration** | Yjs CRDT sync over raw binary WebSocket — edits propagate in milliseconds, conflict-free |
| **Google Sign-In** | Clerk OAuth — sign in with Google, no passwords |
| **Active Users Panel** | Live presence with Clerk profile pictures, display names, and per-user colored cursors |
| **Live Chat** | In-editor chat panel with sender avatars; messages broadcast via STOMP |
| **Code Execution** | Run code via Wandbox API — supports 14 languages, shows stdout/stderr/compile errors |
| **Room Host Controls** | Lock room (block new joins), toggle read-only mode for guests, delete room |
| **Snapshot History** | Auto-saves Yjs state every 30 seconds; host can browse and restore any snapshot |
| **20 Languages** | JS, TS, Python, Java, C++, C, C#, Go, Rust, Kotlin, Swift, Ruby, PHP, SQL, Bash + more |
| **Shareable Rooms** | 8-character room codes; rooms expire after 48 hours of inactivity |
| **Dual WebSocket Architecture** | Separate channels for binary CRDT sync (`/ws/yjs`) and app events (`/ws/stomp`) |

---

## Tech Stack

### Backend
| Technology | Role |
|---|---|
| Spring Boot 3.3 / Java 21 | REST API, WebSocket servers |
| Spring Security (OAuth2 Resource Server) | JWT validation via Clerk JWKS |
| PostgreSQL (Neon serverless) | Persistent storage for users, rooms, snapshots |
| Spring Data JPA / Hibernate | ORM for all DB entities |
| STOMP over WebSocket | Presence, chat, language-change, lock events |
| Wandbox API | Remote code execution (14 languages, no API key required) |

### Frontend
| Technology | Role |
|---|---|
| React 18 + TypeScript | UI framework |
| Vite | Build tool / dev server |
| Clerk React SDK | Google sign-in, session tokens, user metadata |
| Yjs | CRDT document model |
| y-monaco | Binds Yjs document to Monaco editor |
| Monaco Editor (`@monaco-editor/react`) | Code editor with syntax highlighting |
| STOMP.js | WebSocket client for app events |
| Axios | HTTP client with automatic Bearer token injection |

---

## Architecture Overview

CollabCode uses a **dual WebSocket architecture**:

1. **`/ws/yjs/{roomCode}`** — a raw binary WebSocket handled by `YjsWebSocketHandler`. Each Yjs update is broadcast as a binary frame to all other connected clients in the room. The server acts as a relay, not a full CRDT participant. Documents are periodically serialized and persisted to PostgreSQL.

2. **`/ws/stomp`** — a STOMP WebSocket handled by `StompPresenceController`. Used for application-level events: presence joins/leaves, chat messages, language changes, read-only toggle, and room lock events. All STOMP frames are authenticated via `StompAuthChannelInterceptor` using Clerk JWTs.

REST endpoints (`/api/rooms/**`, `/api/execute`) are secured by Spring Security's `oauth2ResourceServer` filter, which validates Clerk JWTs against Clerk's JWKS endpoint on every request.

```text
┌─────────────────────┐        /ws/yjs/{code}          ┌──────────────────────┐
│                     │ ──── Binary Yjs CRDT frames ──▶ │  YjsWebSocketHandler │
│  Browser            │                                │  (relay + persist)   │
│  React + Monaco     │        /ws/stomp               ├──────────────────────┤
│  Yjs + STOMP.js     │ ──── Presence/Chat/Events ───▶ │ StompPresenceCtrl    │
│  Clerk SDK          │                                ├──────────────────────┤
│                     │        /api/**                 │ REST Controllers     │
│                     │ ──── Bearer JWT ─────────────▶ │ Spring Security      │
└─────────────────────┘                                └──────────┬───────────┘
                                                                  │
                                                          PostgreSQL (Neon)
```

---

## Prerequisites

- Java 21+
- Maven 3.9+
- Node.js 18+ and npm
- A [Clerk](https://clerk.com) account (free tier is enough)
- A PostgreSQL database (the project uses [Neon](https://neon.tech) — free tier works)

---

## Environment Setup

### Backend — `backend/src/main/resources/application.yml`

```yaml
spring:
  datasource:
    url: jdbc:postgresql://<your-neon-host>/neondb?sslmode=require
    username: <db-username>
    password: <db-password>

app:
  clerk:
    jwks-uri: https://<your-clerk-frontend-api>/.well-known/jwks.json
    issuer: https://<your-clerk-frontend-api>
  cors:
    allowed-origins: http://localhost:5173
```

Get your Clerk values from: **Clerk Dashboard → API Keys → Show JWT Public Key**. Your Frontend API URL looks like `https://upbeat-ant-42.clerk.accounts.dev`.

### Frontend — `frontend/.env`

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_<your-clerk-publishable-key>
VITE_API_BASE_URL=http://localhost:8080/api
```

Get your publishable key from: **Clerk Dashboard → API Keys**.

---

## Running Locally

### 1. Clone the repo
```bash
git clone https://github.com/your-username/collabcode.git
cd collabcode
```

### 2. Start the backend
```bash
cd backend
mvn spring-boot:run
```
Backend runs on `http://localhost:8080`. On first start, `schema.sql` runs automatically and creates all tables.

### 3. Start the frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173`.

### 4. Open the app
Navigate to `http://localhost:5173`, sign in with Google, create a room, and share the room code with a collaborator.

---

## Database Schema

| Table | Purpose |
|---|---|
| `users` | Local user records keyed on `clerk_user_id` |
| `rooms` | Room metadata: code, name, owner, expiry, `is_locked` |
| `room_participants` | Many-to-many: which users have joined which rooms |
| `document_snapshots` | Serialized Yjs state + language per room (multiple snapshots per room) |

---

## Screenshots

> *Screenshots coming soon — contributions welcome!*

---

## License

MIT
