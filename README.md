# CollabCode

> A real-time collaborative code editor with an AI debugging agent that **runs your code, fixes it with Google Gemini, and verifies the fix before you approve it.**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.3.5-6DB33F?logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Java](https://img.shields.io/badge/Java-21-ED8B00?logo=openjdk&logoColor=white)](https://openjdk.org/)
[![Google Gemini](https://img.shields.io/badge/AI-Google_Gemini-8E75B2?logo=googlegemini&logoColor=white)](https://ai.google.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)](https://neon.tech/)
[![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF?logo=clerk&logoColor=white)](https://clerk.com/)

## 🌐 Live Demo

| | |
|---|---|
| **App** | [collab-code-application.vercel.app](https://collab-code-application.vercel.app/) (Vercel) |
| **API & WebSockets** | [collabcode-lsor.onrender.com](https://collabcode-lsor.onrender.com) (Render) |

> **First visit may be slow.** The backend runs on Render's free tier, which sleeps after ~15 minutes without traffic and can take **up to 2 minutes** to wake. The app starts waking it as soon as the page loads and shows a "server is waking up" notice; after that everything is instant.

---

## Why CollabCode?

When code breaks during pair programming, people usually copy it into a chatbot, paste the answer back, and hope it compiles. Chatbots never see the real error and never test their answer.

CollabCode puts everything in one room:

1. **Real-time collaborative editing** — conflict-free (CRDT) syncing, named cursors, and line authorship.
2. **Code execution** for 14 languages, right in the editor.
3. **An AI debug agent** that works from the *actual* compiler/runtime error and re-runs its fix to prove it works.
4. **Human approval** — the AI never changes shared code until someone clicks Approve.

---

## Features

### Collaborate
- **Rooms with shareable codes** — create a room, share its 8-character code, and edit the same file together. Rooms expire after 48 hours without activity.
- **Live cursors** — every collaborator's cursor and selection is shown with their name and colour.
- **Line authorship** — a coloured bar beside each line shows who wrote it; hover for the author (and each contributor's share), or turn on **Line authors** to label every block. Authorship is part of the shared document, so it syncs live and survives reloads.
- **Chat** — built into the room; recent messages are kept, so a refresh or late joiner still sees the conversation.
- **Version history** — snapshots are saved automatically when the code changes. Restoring one updates the code for everyone instantly.

### Host controls
- **Host-only editing** — collaborators can watch but not type (enforced by the server, not just the UI). Useful for interviews and demos.
- **Room lock** — stops new people from joining; people already in the room can still come back.
- **Delete room** — disconnects everyone and removes all history.

### Run code
Runs via [Wandbox](https://wandbox.org)'s sandboxed compilers, with your own program input (stdin) and clear output, compiler and error sections.

| Runnable (14) | Editor only |
|---|---|
| JavaScript, TypeScript, Python, Java, C++, C, C#, Go, Rust, Swift, Ruby, PHP, SQL (SQLite), Bash | Kotlin, HTML, CSS, JSON, Markdown, YAML |

### AI
- **Ask AI** — ask Gemini about your code (explain it, find bugs, write tests) with one click to attach the current file.
- **Debug agent** — the flagship feature; see below.

---

## The AI Debug Agent

Instead of guessing, the agent runs a closed loop against the real compiler:

```
Debug ─► Run code ─► Read the real error ─► Gemini proposes a full fix
                                                     │
              ┌──────── still failing? retry (max 3) ┤
              ▼                                      ▼
        new error fed back                 Run the fix in the sandbox
                                                     │
                                                passes ✓
                                                     ▼
                         Show reasoning, both runs and Original/Fix views
                                                     │
                                     Approve ──► applied for everyone
                                     Reject  ──► code untouched
```

- **It observes reality** — the prompt contains the actual compiler output, stderr and exit status.
- **It tests its own work** — every proposed fix is executed before you see it; results are marked *Fix verified* or *Best attempt*.
- **It iterates** — if a fix still fails, the new error is fed back (up to 3 rounds).
- **It knows when to stop** — code that already runs cleanly isn't "fixed" unless you describe what's wrong, and languages that can't run are refused up front.
- **You stay in control** — on approval only the changed region is replaced, so collaborators' edits elsewhere are kept. If the code changed while the agent was working, you're warned before applying.

---

## Architecture

```text
Browser — React 19 · Monaco · Yjs                        (Vercel)
  │
  ├─ Binary WebSocket  /ws/yjs/{room}  ─► YjsWebSocketHandler ─► YjsRoom (update log + replay)
  │                                                                  └─► PostgreSQL snapshots
  ├─ STOMP WebSocket   /ws/stomp       ─► chat · presence · language · room events
  │
  └─ REST  /api/*  (Clerk JWT)         ─► Spring Boot 3 · Java 21            (Render, Docker)
                                           ├─ Clerk JWKS (token validation)
                                           ├─ PostgreSQL / Neon (users, rooms, snapshots)
                                           ├─ GeminiService ─► Google Gemini
                                           └─ CodeExecutionService ─► Wandbox
```

### How real-time sync works

The server can't merge Yjs documents itself (there's no maintained Java Yjs), so each room keeps an in-memory **base state + log of every update** (`YjsRoom`):

1. **Joining** — a client receives the base and then every logged update, so it always has the complete, up-to-date document.
2. **Compaction** — clients periodically send their full state with an *ack* (how many updates they had applied). The server knows exactly which log entries that state contains and drops only those, so no edit is ever lost.
3. **Reconnecting** — a client re-sends its full state, recovering edits made while offline or lost in a server restart.
4. **Saving** — changed documents are written to PostgreSQL at most once a minute, when the last person leaves, and on shutdown.
5. **Host-only mode** — the server rejects updates from anyone but the host while it's on.

Cursors and names travel over the same socket using Yjs *awareness*. The frame format is documented in [`YjsProtocol.java`](backend/src/main/java/com/collabcode/websocket/yjs/YjsProtocol.java) and [`collaborationService.ts`](frontend/src/services/collaborationService.ts). A deeper write-up is in [DEEP_DIVE.md](DEEP_DIVE.md).

### REST API

All endpoints except `/api/health` require `Authorization: Bearer <Clerk session token>`.

| Method & path | Purpose |
|---|---|
| `GET /api/health` | Public liveness check (used to wake the server) |
| `GET /api/users/me` | The signed-in user's profile |
| `POST /api/rooms` · `POST /api/rooms/join` | Create a room · join by code |
| `GET /api/rooms` · `GET /api/rooms/{code}` | Your rooms · one room (members only) |
| `DELETE /api/rooms/{code}` | Delete (host only) |
| `PATCH /api/rooms/{code}/lock` · `PATCH /api/rooms/{code}/read-only` | Lock room · host-only editing (host only) |
| `GET /api/rooms/{code}/snapshots[/{id}]` | Version history (members only) |
| `GET /api/rooms/{code}/chat` | Recent chat messages (members only) |
| `POST /api/rooms/execute` | Run code (rate-limited) |
| `POST /api/agent/test` · `POST /api/agent/debug` | Ask AI · debug agent (rate-limited) |

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Monaco Editor, Yjs (`y-monaco`, `y-protocols`), `@stomp/stompjs`, Clerk React, Axios, React Router 7 |
| **Backend** | Spring Boot 3.3, Java 21, Spring Security (OAuth2 resource server), Spring WebSocket (binary + STOMP), Spring Data JPA, Google Gen AI SDK |
| **Data & services** | PostgreSQL (Neon), Clerk (auth), Google Gemini (AI), Wandbox (code execution) |
| **Testing** | JUnit 5, Mockito, Spring MockMvc, Vitest |
| **Hosting** | Vercel (frontend), Render with Docker (backend), Neon (database) |

---

## Project Structure

```text
backend/src/main/java/com/collabcode/
├── config/          Security, CORS, WebSocket endpoints, rate limiting
├── controller/      REST controllers + global error handling
├── service/         Rooms, documents, users, presence, chat, Gemini, code execution, debug agent
├── websocket/       Yjs socket handler, STOMP auth & handlers
│   └── yjs/         YjsRoom (update log + compaction), YjsRoomManager, wire protocol
├── model/ · repository/ · dto/ · event/ · exception/
backend/src/main/resources/   application.yml, schema.sql

frontend/src/
├── pages/           Landing, Login/Register, Dashboard, Editor
├── components/      Editor, toolbar, side panels (people, chat, AI, debug), history, UI kit
├── collab/          Yjs session, line authorship, text edits, Monaco setup
├── services/        REST client, Yjs sync provider, room/agent/execution APIs
├── contexts/ · hooks/ · types/ · utils/
frontend/e2e/        Cross-stack tests against the real Java relay
```

---

## Running Locally

### Prerequisites
- **JDK 21** and **Maven 3.9+**
- **Node.js 22+** and npm
- A **PostgreSQL** database (local or a free [Neon](https://neon.tech) project)
- A **[Clerk](https://clerk.com)** application (publishable key + JWKS URL)
- A **[Google AI Studio](https://aistudio.google.com/app/apikey)** API key

### 1. Backend

```bash
cd backend
cp .env.example .env      # then fill in the values below
mvn spring-boot:run       # → http://localhost:8080
```

```env
SPRING_DATASOURCE_URL=jdbc:postgresql://your-host/neondb?sslmode=require
SPRING_DATASOURCE_USERNAME=your_db_user
SPRING_DATASOURCE_PASSWORD=your_db_password
CLERK_JWKS_URI=https://your-app.clerk.accounts.dev/.well-known/jwks.json
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
SPRING_SQL_INIT_MODE=always
GEMINI_API_KEY=your_gemini_api_key
```

The database schema is created and migrated automatically on startup (`schema.sql`).

### 2. Frontend

Create `frontend/.env.development` (it is git-ignored):

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key
VITE_API_BASE_URL=http://localhost:8080/api
VITE_WS_BASE_URL=ws://localhost:8080
```

```bash
cd frontend
npm install
npm run dev               # → http://localhost:5173
```

---

## Environment Variables

### Frontend (`frontend/.env.development` / `.env.production`, or Vercel settings)

| Variable | Description |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `VITE_API_BASE_URL` | REST base URL, e.g. `https://your-backend/api` |
| `VITE_WS_BASE_URL` | WebSocket base URL, e.g. `wss://your-backend` |

### Backend (`backend/.env`, or Render settings)

| Variable | Required | Description |
|---|---|---|
| `SPRING_DATASOURCE_URL` | ✓ | PostgreSQL JDBC URL |
| `SPRING_DATASOURCE_USERNAME` | ✓ | Database user |
| `SPRING_DATASOURCE_PASSWORD` | ✓ | Database password |
| `CLERK_JWKS_URI` | ✓ | Clerk JWKS URL — must be the **same Clerk instance** as the frontend key |
| `ALLOWED_ORIGINS` | ✓ | Comma-separated frontend origins (CORS and both WebSockets) |
| `GEMINI_API_KEY` | ✓ for AI | Gemini key — backend only, never sent to the browser |
| `SPRING_SQL_INIT_MODE` | | `always` (default) runs `schema.sql` on startup |
| `GEMINI_MODEL` | | Gemini model id (default `gemini-3.6-flash`) |
| `YJS_FLUSH_INTERVAL_MS` | | How often changed documents are saved (default `60000`) |
| `RATE_LIMIT_EXECUTE_PER_MINUTE` | | Code runs per user per minute (default `20`) |
| `RATE_LIMIT_AGENT_PER_MINUTE` | | AI requests per user per minute (default `6`) |

---

## Testing

```bash
# Backend: unit, controller and full-application tests (no database or network needed)
cd backend && mvn test

# End-to-end: starts the real Java sync server and drives it with the
# frontend's real sync client (needs Node 22+ and frontend dependencies installed)
cd backend && mvn test -Dtest=YjsRelayE2ETest -De2e=true

# Frontend: unit tests, type-check, lint
cd frontend && npm test && npx tsc -b && npm run lint
```

The end-to-end suite covers simultaneous edits on different lines (including line shifts and a late joiner), offline edits, a server restart, host-only mode, expired-token retry, non-members, large documents, cursor cleanup and persistence. The sync engine also has a randomized stress test that replays thousands of interleaved edits, joins and disconnects.

---

## Deployment Notes (Vercel + Render + Clerk)

- **Use the same Clerk instance on both sides.** The instance in `VITE_CLERK_PUBLISHABLE_KEY` (Vercel) must match `CLERK_JWKS_URI` (Render), or every API call returns 401.
- **`ALLOWED_ORIGINS`** on Render must contain your exact Vercel URL (no trailing slash).
- **Vercel variables are baked in at build time** — redeploy after changing them.
- **Clerk development keys** (`pk_test_…`) work on `*.vercel.app` but show a "development mode" badge and have user limits. A Clerk production instance needs a custom domain.
- **Readable usernames (optional):** in Clerk Dashboard → Sessions → *Customize session token*, add `{"username": "{{user.username}}", "email": "{{user.primary_email_address}}"}`. The app always displays people's real names either way.
- **Render free tier** sleeps when idle; the app wakes it on page load and retries requests whose sign-in token expired while it was starting.

---

## Security

- **Secrets stay on the server** — the Gemini key and database credentials are backend-only environment variables; `backend/.env` is git-ignored.
- **Every request is authenticated** — Clerk JWTs are verified against Clerk's public keys (JWKS) for REST and both WebSockets.
- **Room membership is enforced everywhere** — room details, history, chat, the sync socket and every chat/presence subscription require having joined the room. Host actions are checked before anything is broadcast.
- **Host-only editing is server-side** — edits from non-hosts are rejected by the sync server.
- **Abuse limits** — code execution and AI endpoints are rate-limited per user.
- **Safe AI changes** — fixes are applied only after human approval, as one minimal edit.

---

## Demo Walkthrough

1. **Sign in** (Google or email) and click **Create** on the dashboard.
2. **Invite someone** — copy the room code from the toolbar, or open the room in a second browser window. You'll see each other's named cursors.
3. **Pick C++** from the language menu in the toolbar.
4. **Paste broken code:**
   ```cpp
   #include <iostream>

   int main() {
       std::cout << "Hello, World!" << std::endl
       return 0;
   }
   ```
5. **Click Run.** The Output tab shows a *Compilation Error*: `expected ';' before 'return'`.
6. **Open the Debug tab** in the sidebar and click **Debug with AI Agent**.
7. **Review the result** — Gemini's reasoning, the failing run, the verified run of the fix (*Accepted*, output `Hello, World!`), and the Original/Fix views.
8. **Click Approve & Apply.** The semicolon appears in everyone's editor at once.
9. **Toggle line authors** (tag icon in the toolbar) to see who wrote each line.

---

## Limitations

- **Single file per room** — no multi-file projects or persistent disk.
- **Execution limits** — code runs on Wandbox's public compilers (14 languages, time-limited).
- **Agent rounds** — at most 3 fix attempts per run, to bound time and API quota.
- **Gemini availability** — response times and quotas depend on your Google AI plan.
- **Single backend instance** — live room state (sync log, presence, chat, rate limits) lives in memory, so the backend runs as one instance, and chat history resets when it restarts.

---

## Positioning

> "CollabCode uses an execution-feedback loop where an AI agent observes real program failures, proposes fixes, executes those fixes, evaluates the result, and iterates before presenting a verified change for human approval."

Agentic AI is different from code generation: by closing the loop between reasoning and real execution — while keeping a human in control — CollabCode makes an AI pair programmer you can actually trust in a shared codebase.

---

## 👤 Author

**Ayush Prem** — GitHub: [@Ayushpremrocks](https://github.com/Ayushpremrocks)
