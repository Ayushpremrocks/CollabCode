# CollabCode

> Real-time collaborative code editor with an integrated autonomous AI debugging agent powered by Google Gemini and execution-feedback verification.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.3.5-6DB33F?logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Java](https://img.shields.io/badge/Java-21-ED8B00?logo=openjdk&logoColor=white)](https://openjdk.org/)
[![Google Gemini](https://img.shields.io/badge/AI-Google_Gemini_3.6_Flash-8E75B2?logo=googlegemini&logoColor=white)](https://ai.google.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)](https://neon.tech/)
[![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF?logo=clerk&logoColor=white)](https://clerk.com/)

---

## 🌐 Live Deployments

- **Web Application (Frontend):** [https://collab-code-application.vercel.app](https://collab-code-application.vercel.app/) *(Hosted on Vercel)*
- **API & WebSocket Server (Backend):** [https://collabcode-lsor.onrender.com](https://collabcode-lsor.onrender.com) *(Hosted on Render)*

> **Note on Free-Tier Hosting:** The backend is deployed on Render's free tier. If the service has been idle for more than 15 minutes, initial spin-up may take 50–70 seconds. Subsequent requests and WebSocket sessions are instantaneous.

---

## Overview

Modern software development is inherently collaborative, yet debugging collaboratively remains fragmented. When a program fails during a pair-programming session, developers typically switch between external AI chatbots, local terminal outputs, and manual code pasting. Chatbots frequently generate plausible-looking code that fails to compile or introduces regressions because they operate without real execution context.

**CollabCode** solves this by unifying:
1. **Real-time collaborative code editing** with conflict-free replication (CRDTs).
2. **AI assistance** directly in the editor workspace.
3. **Autonomous debugging** with a closed-loop execution feedback cycle.
4. **Verified execution** before suggestions are presented to developers.
5. **Human approval** as an uncompromised safety gate before shared code is modified.

---

## Features

### Collaborative Editor
- **Real-Time Multi-User Editing:** Powered by **Yjs** CRDTs (`y-monaco`, `y-protocols`). Multiple developers can concurrently edit the same document with zero merge conflicts or lost keystrokes.
- **Room-Based Collaboration:** Instant 8-character shareable room codes. Rooms persist across disconnects and support up to 48 hours of activity.
- **Visual Presence & Authorship:** Live participant avatars, display names, deterministic per-user cursor colors, and line-level gutter authorship markers.
- **In-Editor Chat & Host Controls:** Built-in messaging panel, room locking (prevent new joins), read-only mode (for presentations), and safe room deletion.

### AI Agent
- **In-Context Q&A:** Ask questions about your code, explain complex algorithms, and analyze logic errors directly in the editor.
- **Editor Context Injection:** One-click pre-fill inserts active editor code and language into the prompt buffer.
- **Authenticated Backend Routing:** All prompts pass through `/api/agent/test` on the Spring Boot backend authenticated via Clerk JWTs. The Gemini API key is never exposed to the client.

### AI Debug Agent
The flagship agentic capability of CollabCode. Rather than offering static code completions, the AI Debug Agent executes an autonomous, multi-step diagnostic and repair loop:

1. **Execute Original Code:** Submits the current editor buffer to `CodeExecutionService` (via Wandbox) to capture real runtime behavior.
2. **Observe Compiler / Runtime Failure:** Collects actual `stderr`, compile errors, and exit codes.
3. **Send Code + Failure Diagnostics to Gemini:** Constructs a structured diagnostic prompt containing the exact failure output, source code, language, and optional user hints.
4. **Generate Proposed Fix:** Gemini (`gemini-3.6-flash`) reasons about the root cause and generates a complete, corrected code implementation.
5. **Execute the Proposed Fix:** The agent submits the proposed fix to the execution sandbox to run it against the compiler/runtime.
6. **Inspect Verification Result:** Analyzes execution status (checks for `Accepted` statusId 3).
7. **Iterate When Necessary:** If the fix still fails, updates the error context with the new compiler diagnostics and retries (up to the configured maximum of 3 iterations).
8. **Present Verified Result to User:** Displays the agent's step-by-step reasoning, initial failure logs, verification output, and a side-by-side original vs. proposed fix comparison.
9. **Apply Change Only After Human Approval:** The patch is **never** applied automatically. The user reviews the verified diff and clicks **Approve & Apply** to atomically update the shared Yjs document, or **Reject** to keep the editor untouched.

### Code Execution
- Integrated via `CodeExecutionService` using Wandbox's keyless compilation engine.
- Supports 14 programming languages with output inspection (`stdout`, `stderr`, compiler logs, and status mapping).

### Authentication
- Seamless authentication via **Clerk** (supporting Google OAuth and email sign-in).
- Backend requests are secured with Spring Security OAuth2 Resource Server, decoding and validating Clerk JWTs against Clerk's remote JWKS endpoint (`CLERK_JWKS_URI`).

### Persistence
- Hosted on **Neon Serverless PostgreSQL**.
- Manages users, room metadata, participant presence, and periodic binary document snapshots (`BYTEA`) for rollback and session restoration.

### AI Reasoning Engine
- Powered by **Google Gemini** using the official `com.google.genai:google-genai:1.68.0` SDK.
- Configured with verified model **`gemini-3.6-flash`** for low-latency reasoning and robust code generation.
- The `GEMINI_API_KEY` is strictly managed backend-only and never logged or leaked.

---

## Architecture

```text
Browser Client (React 19 + Monaco + Yjs)
  │
  ├──► Raw Binary WebSocket (/ws/yjs/{roomCode}) ──► YjsWebSocketHandler (Binary CRDT Relay)
  │                                                        │
  │                                                        ▼
  │                                                   Neon PostgreSQL (Snapshots)
  │
  ├──► STOMP over WebSocket (/ws/stomp) ───────────► StompWebSocketConfig (Chat & Presence)
  │
  └──► HTTPS REST API (/api/*) ────────────────────► Spring Boot Backend
                                                           │
                                                           ├──► Clerk JWKS (Token Validation)
                                                           │
                                                           ├──► Neon PostgreSQL (JPA Entities)
                                                           │
                                                           ├──► GeminiService (gemini-3.6-flash)
                                                           │
                                                           └──► CodeExecutionService
                                                                      │
                                                                      ▼
                                                                 Wandbox API (Sandbox Execution)
```

---

## Agentic Debugging Workflow

```
[ User clicks "Debug with AI Agent" ]
                 │
                 ▼
      [ Step 1: Run Original Code ]
                 │
                 ▼
      [ Step 2: Observe Failure ] ──► (Compiler error / Runtime exception)
                 │
                 ▼
      [ Step 3: Prompt Gemini ] ────► (Code + Compiler diagnostics + User hint)
                 │
                 ▼
      [ Step 4: Extract Proposed Fix ]
                 │
                 ▼
      [ Step 5: Execute Proposed Fix in Sandbox ]
                 │
                 ▼
      [ Step 6: Verify Execution Result ]
           /                   \
      (Still Failing)      (Status: Accepted)
         │                         │
         ▼                         ▼
   [ Step 7: Iterate ]     [ Step 8: Present Verified Result ]
   (Up to 3 rounds)                │
                                   ▼
                       [ Step 9: Human Approval Gate ]
                                /             \
                       [ User Approves ]    [ User Rejects ]
                              │                    │
                              ▼                    ▼
                      Atomically update       Keep original
                      shared Yjs document     code unchanged
```

### Why This is Genuinely Agentic

Unlike simple AI chatbots or autocomplete extensions:
- **It observes reality:** The agent inspects actual compiler errors and program exit codes produced by the Wandbox runtime, not assumptions.
- **It tests its own work:** Before presenting a solution to the user, the agent executes the proposed code in an isolated sandbox.
- **It iterates autonomously:** If iteration 1 fails to resolve the compiler error, the agent incorporates the new error output and attempts an alternative approach.
- **Human in the loop:** Autonomy is bounded by human authority. Shared collaborative code is only modified when a developer explicitly reviews and approves the verified patch.

---

## Tech Stack

### Frontend
- **Framework & Language:** React 19, TypeScript
- **Bundler:** Vite 6
- **Styling:** Tailwind CSS v4
- **Editor:** Monaco Editor (`@monaco-editor/react`)
- **CRDT Synchronization:** Yjs, `y-monaco`, `y-protocols`, `lib0`
- **Real-Time Messaging:** `@stomp/stompjs`
- **Authentication Client:** `@clerk/clerk-react`
- **HTTP Client:** Axios (with Clerk token interceptor)
- **Routing:** React Router DOM v7

### Backend
- **Platform & Language:** Spring Boot 3.3.5, Java 21
- **Security:** Spring Security 6 (OAuth2 Resource Server validating Clerk JWTs via JWKS)
- **AI SDK:** `com.google.genai:google-genai:1.68.0`
- **AI Model:** `gemini-3.6-flash`
- **Real-Time Communication:** Spring WebSocket (Binary Handler + STOMP Broker)
- **Data Access:** Spring Data JPA, Hibernate 6
- **Database:** PostgreSQL (Neon Serverless)
- **Code Execution:** Wandbox REST API

### Hosting & Infrastructure
- **Frontend SPA:** Vercel
- **Backend Container:** Render (Docker containerized)
- **Database:** Neon

---

## Local Development

### Prerequisites
- JDK 21+
- Apache Maven 3.9+
- Node.js 18+ and npm
- PostgreSQL database (local or Neon)
- Clerk account with publishable key & JWKS URI
- Google AI Studio API key (Gemini)

---

### Backend Setup

1. Navigate to `backend`:
   ```bash
   cd backend
   ```
2. Copy the environment template:
   ```bash
   cp .env.example .env
   ```
3. Populate `backend/.env` with your credentials:
   ```env
   SPRING_DATASOURCE_URL=jdbc:postgresql://your-neon-host.neon.tech/neondb?sslmode=require
   SPRING_DATASOURCE_USERNAME=your_db_username
   SPRING_DATASOURCE_PASSWORD=your_db_password
   CLERK_JWKS_URI=https://your-clerk-app.clerk.accounts.dev/.well-known/jwks.json
   JWT_SECRET=your_minimum_32_character_jwt_secret
   ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
   SPRING_SQL_INIT_MODE=always
   GEMINI_API_KEY=your_gemini_api_key
   ```
4. Run the Spring Boot application:
   ```powershell
   # Windows PowerShell
   .\mvnw.cmd spring-boot:run

   # Linux / macOS
   ./mvnw spring-boot:run

   # Or standard Maven
   mvn spring-boot:run
   ```
   The backend will start at `http://localhost:8080`.

---

### Frontend Setup

1. Navigate to `frontend`:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Verify `frontend/.env.development`:
   ```env
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key
   VITE_API_BASE_URL=http://localhost:8080/api
   VITE_WS_BASE_URL=ws://localhost:8080
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:5173` in your browser.

---

## Environment Variables

### Frontend (`frontend/.env.*`)

| Variable | Description |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk public publishable key for user authentication |
| `VITE_API_BASE_URL` | Base URL for REST API endpoints |
| `VITE_WS_BASE_URL` | Base URL for WebSocket connections (`ws://` or `wss://`) |

### Backend (`backend/.env` / Render Config)

| Variable | Description |
|---|---|
| `SPRING_DATASOURCE_URL` | PostgreSQL JDBC connection URL |
| `SPRING_DATASOURCE_USERNAME` | Database username |
| `SPRING_DATASOURCE_PASSWORD` | Database password |
| `CLERK_JWKS_URI` | Clerk `.well-known/jwks.json` endpoint for JWT validation |
| `GEMINI_API_KEY` | Google Gemini API key (backend-only, never logged or committed) |
| `JWT_SECRET` | Secret key for internal token management |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins |
| `SPRING_SQL_INIT_MODE` | SQL schema initialization mode (`always` or `never`) |

---

## Security

- **Backend-Only AI Secrets:** The `GEMINI_API_KEY` is loaded exclusively by Spring Boot via environment variables. It has no frontend equivalent (`no VITE_* var`), is never sent to the browser, and is excluded from logs.
- **Git-Ignored Secrets:** `backend/.env` is tracked in `.gitignore` and never committed to version control. `backend/.env.example` provides a sanitized template.
- **Authenticated Endpoints:** All `/api/agent/*` and `/api/rooms/*` endpoints require a valid Clerk JWT verified via cryptographic JWKS public keys.
- **Atomic Document Updates:** Patches applied from the agent occur through transactional Yjs operations (`yText.doc.transact`), preventing race conditions.

---

## Demo Walkthrough

Follow these steps to observe the end-to-end agentic workflow:

1. **Sign In & Create Room:** Log in using Google via Clerk and create a new collaborative room from the dashboard.
2. **Invite a Collaborator:** Open the room URL in a second browser window or share the 8-character code to observe real-time dual-cursor sync.
3. **Select Language:** Switch language to **C++** using the language selector.
4. **Introduce a Bug:** Paste the following syntax-broken code into the editor:
   ```cpp
   #include <iostream>

   int main() {
       std::cout << "Hello, World!" << std::endl
       return 0;
   }
   ```
5. **Run Code:** Click **Run Code** in Room Controls. Observe the output panel report a compilation error: `expected ';' before 'return'`.
6. **Trigger AI Debug Agent:** In the right sidebar, expand the **AI Debug Agent** panel. Click **Debug with AI Agent**.
7. **Observe Agent Execution:** The agent runs the code, captures the error, consults Gemini, extracts the patch, and re-executes the corrected code in Wandbox.
8. **Inspect Verified Result:** Review the agent's explanation, the initial failure report, the verified sandbox execution (`Accepted`, exit code 0, output: `"Hello, World!"`), and toggle between Original and Fix views.
9. **Approve the Fix:** Click **Approve & Apply**.
10. **Observe Real-Time Sync:** The missing semicolon is applied atomically to the editor, immediately propagating to all collaborators via Yjs.

---

## Limitations

- **Language Execution Constraints:** Code execution is powered by Wandbox's public compiler runner, supporting 14 languages without persistent disk storage or multi-file project trees.
- **Quota & Availability:** Gemini API response times depend on Google AI service availability and API tier quotas.
- **Bounded Iteration Limit:** The agent loop is constrained to a maximum of 3 iterations (`MAX_ITERATIONS = 3`) to prevent infinite execution cycles and conserve API quota.
- **Single Document Buffer:** Collaboration currently operates on a single Monaco editor buffer per room.

---

## Hackathon Positioning

> "CollabCode uses an execution-feedback loop where an AI agent observes real program failures, proposes fixes, executes those fixes, evaluates the result, and iterates before presenting a verified change for human approval."

CollabCode demonstrates that agentic AI is fundamentally different from code generation. By closing the loop between reasoning and real-world execution feedback while keeping the human firmly in control, CollabCode provides a reliable, trustworthy AI pair programmer for collaborative teams.

---

## 👤 Author

**Ayush Prem**
- GitHub: [@Ayushpremrocks](https://github.com/Ayushpremrocks)
