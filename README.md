# CollabCode

> A modern, real-time collaborative code editor featuring conflict-free synchronization, live presence, in-editor chat, and multi-language code execution.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.3.5-6DB33F?logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Java](https://img.shields.io/badge/Java-21-ED8B00?logo=openjdk&logoColor=white)](https://openjdk.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)](https://neon.tech/)
[![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF?logo=clerk&logoColor=white)](https://clerk.com/)

---

## 🌐 Live Demo

- **Web Application:** [https://collab-code-application.vercel.app](https://collab-code-application.vercel.app/) *(Hosted on Vercel)*
- **API & WebSocket Server:** [https://collabcode-lsor.onrender.com](https://collabcode-lsor.onrender.com) *(Hosted on Render)*

> **Note on Free-Tier Hosting:** The backend service is hosted on Render's free tier. If the instance has been idle for more than 15 minutes, the initial request or room connection may take 50–70 seconds while the container spins up. Subsequent interactions will be instantaneous.

---

## 📸 Preview

```
+-----------------------------------------------------------------------------------+
|  CollabCode | Room: algorithm-lab (#X9K2PL8M)            [Python 3]  [ Run Code ] |
+-----------------------+-------------------------------------------+---------------+
| ACTIVE USERS (3)      | 1  def quicksort(arr):                     | OUTPUT        |
| * Ayush Prem (Host)   | 2      if len(arr) <= 1:                  | > [1, 2, 5, 9]|
| * Sarah Jenkins       | 3          return arr                     |               |
| * Alex Chen           | 4      pivot = arr[len(arr) // 2]         | Execution:    |
+-----------------------+ 5      left = [x for x in arr if x < ...  | Status: OK    |
| LIVE CHAT             | 6      middle = [x for x in arr if ...    | Time: 120ms   |
| Alex: Checking line 5 | 7      right = [x for x in arr if ...     |               |
| Sarah: Looks good!    | 8      return quicksort(left) + middle ...|               |
+-----------------------+-------------------------------------------+---------------+
```
*(Add an animated GIF or application screenshot here: `assets/demo-preview.gif`)*

---

## ✨ Features

- **Conflict-Free Real-Time Collaboration:** Powered by **Yjs CRDTs** over binary WebSockets. Multiple users can concurrently type, format, and edit the exact same document without race conditions or merge conflicts.
- **Dual-Channel WebSocket Architecture:**
  - **Raw Binary Channel (`/ws/yjs/{roomCode}`):** High-throughput relay for serialized Yjs CRDT update vectors.
  - **STOMP Messaging Channel (`/ws/stomp`):** Pub/sub event streaming for presence, cursor awareness, language switches, room locking, and live chat.
- **Visual Gutter Authorship & Cursors:** Identifies collaborators with unique, deterministic color badges, gutter markers, and real-time cursor tracking.
- **Multi-Language Remote Code Execution:** Integrated with the **Wandbox compiler engine**, enabling developers to execute code directly from the editor across 14 supported languages with output inspection (`stdout`, `stderr`, compile errors).
- **Comprehensive Language Support:** Monaco editor syntax highlighting, bracket matching, and auto-indentation across **20 languages** (JavaScript, TypeScript, Python, Java, C++, C, C#, Go, Rust, Kotlin, Swift, Ruby, PHP, SQL, HTML, CSS, JSON, Markdown, YAML, Bash).
- **Robust Host Room Controls:**
  - **Room Locking:** Prevents new participants from joining an in-progress session.
  - **Read-Only Mode:** Host can temporarily lock participant edits during presentations or instructions.
  - **Session Termination:** Hosts can cleanly delete rooms and disconnect participants with live notification broadcasts.
- **Document Snapshot History & Rollback:** Server auto-persists document snapshots periodically. Room hosts can inspect revision history and roll back to any past state with a single click.
- **Secure Authentication with Clerk:** Frictionless Google OAuth and email authentication. Session tokens are securely verified on the backend via Clerk JWKS public keys.
- **In-Editor Team Chat:** Real-time text messaging with user avatars and timestamps, letting teams discuss code changes without leaving the workflow.
- **Code Download & Customization:** One-click source code export with language-accurate file extensions, along with interactive editor font-size controls.
- **Room Lifecycle Management:** Rooms are assigned unique 8-character codes, persist across disconnects, and auto-expire after 48 hours of inactivity via an automated background cleaner.

---

## 🛠️ Tech Stack

### Frontend
- **Framework & Language:** React 19, TypeScript
- **Bundler & Build Tool:** Vite 6
- **Styling:** Tailwind CSS v4
- **Editor Engine:** Monaco Editor (`@monaco-editor/react`, `monaco-editor`)
- **CRDT Synchronization:** Yjs, `y-monaco`, `y-protocols`, `lib0`
- **Real-Time Client:** `@stomp/stompjs`
- **Authentication Client:** `@clerk/clerk-react`
- **HTTP Client:** Axios (configured with automated Clerk Bearer token interceptor)
- **Routing:** React Router DOM v7

### Backend
- **Platform & Language:** Spring Boot 3.3.5, Java 21
- **Security:** Spring Security 6 (OAuth2 Resource Server validating Clerk JWTs via JWKS)
- **Real-Time Communication:** Spring WebSocket, Spring Messaging (STOMP subprotocol)
- **Data Access & ORM:** Spring Data JPA, Hibernate 6
- **Database Driver:** PostgreSQL JDBC Driver
- **Utilities:** Project Lombok
- **Compilation & Execution Runner:** Wandbox API

### Infrastructure & Services
- **Database:** Neon Serverless PostgreSQL
- **User Management & Identity:** Clerk
- **Frontend Hosting:** Vercel
- **Backend Hosting:** Render (Containerized Docker deployment)

---

## 🏗️ Architecture Overview

CollabCode separates document editing traffic from application state management through a dual-protocol WebSocket architecture:

```mermaid
flowchart TD
    User([User Browser])
    
    subgraph Frontend["Vercel (React 19 + Vite)"]
        Monaco[Monaco Editor]
        YjsDoc[Yjs CRDT Document]
        StompClient[STOMP.js Client]
        ClerkSDK[Clerk Auth SDK]
        AxiosClient[Axios REST Client]
    end

    subgraph AuthProvider["Authentication"]
        Clerk[Clerk Identity Platform]
    end

    subgraph Backend["Render (Spring Boot 3.3 / Java 21)"]
        Security[Spring Security / JWKS Validator]
        YjsHandler[YjsWebSocketHandler\n/ws/yjs/{roomCode}]
        StompBroker[STOMP Message Broker\n/ws/stomp]
        RoomCtrl[Room REST Controller\n/api/rooms]
        ExecService[CodeExecutionService]
    end

    subgraph External["Third-Party Services"]
        Wandbox[Wandbox Compiler API]
        NeonDB[(Neon PostgreSQL)]
    end

    User --> Frontend
    ClerkSDK <-->|OAuth / JWT| Clerk
    
    %% REST
    AxiosClient -->|HTTP REST + Bearer Token| RoomCtrl
    RoomCtrl --> Security
    Security -.->|Verify JWKS| Clerk
    RoomCtrl --> NeonDB
    RoomCtrl --> ExecService
    ExecService -->|Compile & Run| Wandbox
    
    %% WebSockets
    Monaco <--> YjsDoc
    YjsDoc <-->|Raw Binary WS\nCRDT Updates| YjsHandler
    YjsHandler <-->|Relay to peers| Frontend
    YjsHandler -->|Persist Snapshots| NeonDB
    
    StompClient <-->|STOMP over WS\nChat / Presence / Locks| StompBroker
    StompBroker --> Security
```

### How Real-Time Collaboration Works

1. **Authentication:** The user logs in via Clerk on the frontend. The resulting session JWT is attached as a `Bearer` token to HTTP calls and passed into WebSocket connection handshakes.
2. **Document CRDT Sync (`/ws/yjs/{roomCode}`):**
   - The editor binds Monaco directly to a local Yjs text type (`y-monaco`).
   - Every keystroke produces a binary diff encoded using Yjs protocols.
   - The diff is transmitted over a raw binary WebSocket to `YjsWebSocketHandler`.
   - The server acts as a low-latency relay, broadcasting update frames to other clients in the room without decrypting or recalculating text offsets.
   - Because Yjs uses Conflict-free Replicated Data Types, concurrent edits converge identically across all connected clients.
3. **Application Events (`/ws/stomp`):**
   - STOMP manages high-level features including active presence tracking, user join/leave announcements, language switching, chat messages, and host lock state.
   - The `StompAuthChannelInterceptor` intercepts incoming `CONNECT` frames to validate the Clerk JWT, injecting an authenticated principal into the session.
4. **Snapshot Persistence:**
   - Active document states are captured and persisted to the PostgreSQL database as binary snapshots (`BYTEA`), enabling document recovery across browser restarts and revision rollbacks.

---

## 📁 Repository Structure

```text
CollabCode/
├── backend/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/collabcode/
│   │   │   │   ├── config/          # Spring Security, CORS, and WebSocket configuration
│   │   │   │   ├── controller/      # REST API endpoints (Rooms, Snapshots, Execution)
│   │   │   │   ├── dto/             # Request/response data transfer objects
│   │   │   │   ├── model/           # JPA entities (User, Room, Snapshot, Participant)
│   │   │   │   ├── repository/      # Spring Data JPA interfaces
│   │   │   │   ├── security/        # Clerk JWT validation and JWKS decoding
│   │   │   │   ├── service/         # Core business logic (Execution, Rooms, Documents, Presence)
│   │   │   │   └── websocket/       # Yjs binary WS relay and STOMP message controller
│   │   │   └── resources/
│   │   │       ├── application.yml  # Application properties (environment variable driven)
│   │   │       └── schema.sql       # PostgreSQL DDL migrations & indexes
│   ├── .env.example                 # Safe template for local backend environment variables
│   ├── DockerFile                   # Production container build definition
│   └── pom.xml                      # Maven dependencies & build lifecycle
├── frontend/
│   ├── src/
│   │   ├── components/              # Editor, Chat, Controls, HistoryModal, ActiveUsers
│   │   ├── contexts/                # AuthContext (Clerk), WebSocketContext (STOMP)
│   │   ├── pages/                   # Landing, Dashboard, Editor, Login, Register
│   │   ├── services/                # Axios API instance and Yjs connection service
│   │   ├── types/                   # TypeScript interfaces and language definitions
│   │   └── App.tsx                  # Client router and route protection
│   ├── .env.development            # Local development environment configuration
│   ├── .env.production             # Production environment configuration
│   ├── package.json                 # Node dependencies and build scripts
│   ├── vite.config.ts               # Vite configuration with Tailwind CSS v4
│   └── vercel.json                  # Single-Page Application rewrites for Vercel
├── .gitignore                       # Multi-layer repository exclusion rules
└── README.md                        # Project documentation
```

---

## 🚀 Local Development Setup

### Prerequisites
- **Java:** JDK 21+
- **Maven:** Apache Maven 3.9+
- **Node.js:** Node 18+ and npm
- **Database:** A PostgreSQL instance (local or hosted on [Neon](https://neon.tech/))
- **Clerk Account:** A free [Clerk](https://clerk.com/) application for authentication

---

### 1. Clone the Repository

```bash
git clone https://github.com/Ayushpremrocks/CollabCode.git
cd CollabCode
```

---

### 2. Backend Setup

Spring Boot is configured to read local environment variables from `backend/.env` automatically during development using Spring's native `spring.config.import: "optional:file:.env[.properties]"` feature.

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Copy the sample environment file:
   ```bash
   cp .env.example .env
   ```
3. Open `backend/.env` and supply your development credentials:

   ```env
   # PostgreSQL Connection (Neon or local)
   SPRING_DATASOURCE_URL=jdbc:postgresql://your-neon-host.neon.tech/neondb?sslmode=require
   SPRING_DATASOURCE_USERNAME=your_database_username
   SPRING_DATASOURCE_PASSWORD=your_database_password

   # Clerk JWT Validation (From Clerk Dashboard -> API Keys -> JWKS URL)
   CLERK_JWKS_URI=https://your-clerk-frontend-api.clerk.accounts.dev/.well-known/jwks.json

   # Internal JWT Secret (Minimum 32-character random string)
   JWT_SECRET=your_long_random_alphanumeric_jwt_secret_value

   # Allowed CORS origins
   ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174

   # SQL Schema Initialization (use 'always' on first run, 'never' afterwards)
   SPRING_SQL_INIT_MODE=always
   ```

4. Start the backend server:
   ```bash
   mvn spring-boot:run
   ```
   The backend will start at `http://localhost:8080`. The database tables from `schema.sql` will be verified or created automatically.

---

### 3. Frontend Setup

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Verify your `frontend/.env.development` file contains your Clerk publishable key and local endpoint references:
   ```env
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
   VITE_API_BASE_URL=http://localhost:8080/api
   VITE_WS_BASE_URL=ws://localhost:8080
   ```
4. Start the Vite development server:
   ```bash
   npm run dev
   ```
5. Open your browser and navigate to `http://localhost:5173`.

---

## 🔐 Environment Variables

| Variable Name | Environment | Description |
|---|---|---|
| `SPRING_DATASOURCE_URL` | Backend | PostgreSQL JDBC connection URL |
| `SPRING_DATASOURCE_USERNAME` | Backend | PostgreSQL database username |
| `SPRING_DATASOURCE_PASSWORD` | Backend | PostgreSQL database password |
| `CLERK_JWKS_URI` | Backend | Clerk `.well-known/jwks.json` endpoint URL |
| `JWT_SECRET` | Backend | Application secret key for internal token management |
| `ALLOWED_ORIGINS` | Backend | Comma-separated list of allowed CORS client origins |
| `SPRING_SQL_INIT_MODE` | Backend | Database initialization mode (`always` or `never`) |
| `PORT` | Backend | HTTP server port (automatically assigned by hosting platforms) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Frontend | Public Clerk API key for frontend authentication |
| `VITE_API_BASE_URL` | Frontend | Base URL for REST API endpoints |
| `VITE_WS_BASE_URL` | Frontend | Base URL for WebSocket connections (`ws://` or `wss://`) |

> **Security Notice:**
> - `backend/.env` contains sensitive database and service secrets and **must never be committed to Git**.
> - Both root and subfolder `.gitignore` files enforce exclusions for `.env` and `.env.*` files.
> - `backend/.env.example` serves as a safe, secret-free template for tracking required environment variable keys.
> - Frontend `VITE_*` variables are bundled into client-side JavaScript at build time. Never place private keys or backend database credentials in frontend environment files.

---

## 📡 REST API Reference

All room-specific API requests require a valid Clerk session token passed via the `Authorization: Bearer <token>` header.

| Method | Endpoint | Description | Auth Required |
|---|---|---|:---:|
| `POST` | `/api/rooms` | Create a new collaborative room | Yes |
| `POST` | `/api/rooms/join` | Join an existing room via room code | Yes |
| `GET` | `/api/rooms/{roomCode}` | Fetch room details, settings, and participant list | Yes |
| `GET` | `/api/rooms` | List all rooms created or joined by current user | Yes |
| `DELETE`| `/api/rooms/{roomCode}` | Permanently delete room (Host only) | Yes |
| `PATCH` | `/api/rooms/{roomCode}/lock` | Toggle room join lock status (Host only) | Yes |
| `GET` | `/api/rooms/{roomCode}/snapshots` | Retrieve snapshot revision history for a room | Yes |
| `GET` | `/api/rooms/{roomCode}/snapshots/{id}` | Retrieve Base64 snapshot content for preview | Yes |
| `POST` | `/api/rooms/{roomCode}/snapshots/{id}/restore` | Revert room document to a past snapshot (Host only) | Yes |
| `POST` | `/api/rooms/execute` | Submit code for remote execution via Wandbox | Yes |

---

## ⚡ WebSocket Protocols & Channels

| Path | Protocol | Purpose | Authentication |
|---|---|---|---|
| `/ws/yjs/{roomCode}` | Raw Binary WebSocket | High-speed binary Yjs CRDT document synchronization and snapshot persistence | Query param `?token=<jwt>` |
| `/ws/stomp` | STOMP over WebSocket | Presence notifications, live chat, language switches, room locking | `CONNECT` frame header `Authorization: Bearer <jwt>` |

### STOMP Messaging Topics & Destinations

- **Client Send Destinations:**
  - `/app/room/{roomCode}/join` — Register presence and fetch latest state
  - `/app/room/{roomCode}/leave` — Announce departure from room
  - `/app/room/{roomCode}/language` — Synchronize code language changes across all peers
  - `/app/room/{roomCode}/readonly` — Toggle participant editing permissions (Host only)
  - `/app/room/{roomCode}/chat` — Broadcast a chat message to the room
- **Subscription Topics:**
  - `/topic/room/{roomCode}/room-state` — Global room metadata updates
  - `/topic/room/{roomCode}/user-joined` — Peer connection announcements
  - `/topic/room/{roomCode}/language` — Broadcast language updates
  - `/topic/room/{roomCode}/readonly` — Broadcast read-only state changes
  - `/topic/room/{roomCode}/lock` — Broadcast room locked/unlocked alerts
  - `/topic/room/{roomCode}/chat` — Real-time chat message stream
  - `/topic/room/{roomCode}/room-deleted` — Host room deletion notification

---

## 🌐 Production Deployment

### Frontend (Vercel)
1. Import the `frontend` folder into Vercel.
2. In the project settings, configure the following **Environment Variables**:
   - `VITE_CLERK_PUBLISHABLE_KEY`: Your production Clerk publishable key
   - `VITE_API_BASE_URL`: `https://collabcode-lsor.onrender.com/api`
   - `VITE_WS_BASE_URL`: `wss://collabcode-lsor.onrender.com`
3. Build command: `npm run build`
4. Output directory: `dist`
5. The included `vercel.json` ensures all SPA routes route cleanly to `index.html`.

### Backend (Render)
1. Deploy the repository as a **Web Service** on Render using the included `backend/DockerFile`.
2. Set the Root Directory to `backend` (or build from root referencing the Dockerfile).
3. Under **Environment Variables**, configure:
   - `SPRING_DATASOURCE_URL`: Production Neon database connection string
   - `SPRING_DATASOURCE_USERNAME`: Production database username
   - `SPRING_DATASOURCE_PASSWORD`: Production database password
   - `CLERK_JWKS_URI`: `https://<your-clerk-domain>/.well-known/jwks.json`
   - `JWT_SECRET`: Random 32+ character secret
   - `ALLOWED_ORIGINS`: `https://collab-code-application.vercel.app`
   - `SPRING_SQL_INIT_MODE`: `never` (since schema is already provisioned)
4. Render automatically injects the `PORT` variable; Spring Boot binds to `${PORT:8080}`.

---

## ⚠️ Known Limitations

- **Single-Node In-Memory Broker:** WebSocket sessions and presence tracking rely on Spring's in-memory message broker and concurrent collections. Horizontal scaling across multiple server instances requires a shared pub/sub relay (such as Redis or RabbitMQ).
- **Public Compilation Service:** Remote code execution is powered by Wandbox's public compiler service, which imposes execution time limits and does not support persistent file I/O or multi-file project compilation.
- **Render Free Tier Spin-Down:** On free-tier plans, services sleep after 15 minutes of zero traffic. Waking the instance introduces an initial cold-start latency.

---

## 🔮 Future Improvements

- [ ] **Interactive Terminal:** Support interactive `stdin` streaming for console-driven applications.
- [ ] **Multi-File Project Trees:** Expand from single-file rooms to full directory trees with file creation and deletion.
- [ ] **Redis Pub/Sub Layer:** Enable clustering and horizontal scalability for WebSocket rooms across multiple backend nodes.
- [ ] **Audio/Video Collaboration:** WebRTC-powered voice or video channels within active coding rooms.
- [ ] **Git Repository Import:** One-click repository cloning directly into an active collaborative workspace.

---

## 👤 Author

**Ayush Prem**
- GitHub: [@Ayushpremrocks](https://github.com/Ayushpremrocks)
