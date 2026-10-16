# MakeMyChat -- Pre-Configured Local AI Chat Website

**MakeMyChat** is a complete full-stack AI chat web application -- a **React + Vite** frontend and a **Python FastAPI** backend -- that connects your laptop browser to a **LiteLLM + Ollama** server running on your **RTX PC** on your local network. It ships pre-configured with your details:

- **Pre-Loaded LiteLLM API Key**: `sk-L1GxiYsyRuDOK-7nUs0j8g` (inside `backend/.env`)
- **Pre-Loaded AI Model**: `ollama/qwen3.5:4b` (inside `backend/.env`)
- **Auto-Discovery**: Scans your Wi-Fi / LAN (`arp -a` + local subnet) to find the RTX PC on port `4000` and connect itself automatically.

> **Security note:** This repository intentionally contains the real API key in `backend/.env` and `backend/.env.example`. Treat this key as public. Never expose port `4000` to the public internet without authentication -- use a private network or Tailscale.

---

## Table of Contents

1. [Features](#1-features)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Repository Structure](#4-repository-structure)
5. [How It Works](#5-how-it-works)
6. [API Reference](#6-api-reference)
7. [Configuration (.env)](#7-configuration-env)
8. [Quick Start](#8-quick-start)
9. [RTX PC LAN Setup](#9-rtx-pc-lan-setup)
10. [Same PC vs Another Laptop](#10-same-pc-vs-another-laptop)
11. [Using the App](#11-using-the-app)
12. [Verify Everything](#12-verify-everything)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Features

**Chat experience**
- Streaming AI responses (Server-Sent Events) with a live typing cursor, or single-shot responses.
- Full Markdown rendering (GFM, tables, lists) with syntax-labelled code blocks and per-block **Copy code** buttons.
- Collapsible "Thought process" blocks for models that emit ` thinking...</think>` reasoning.
- Adjustable **temperature** (0.0 - 1.5) and a custom **system prompt**.
- Stop generation mid-stream, retry failed requests, and copy any message.
- Auto-generated conversation titles from the first message, editable inline.

**Conversation management (persisted in browser `localStorage`)**
- Multiple conversations, sidebar search across titles and message contents, rename, delete, and clear-all.
- Everything (conversations, active chat, preferences) survives a page refresh.

**UX / theming**
- Light / Dark / System theme with a quick toggle.
- Responsive layout: collapsible sidebar, mobile-friendly, auto-scroll with a "Latest" jump button.
- Accessibility: ARIA labels, roles, `aria-live` regions, keyboard support (Enter to send, Shift+Enter for newline, Escape to close dialogs).

**Connection intelligence**
- One-click **Auto-Find RTX PC on Wi-Fi** discovery, or manually enter the RTX PC IP.
- Automatic O/0 API-key typo recovery (see [How It Works](#5-how-it-works)).
- Live backend + AI-provider status badges throughout the UI.

---

## 2. Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite 6, `lucide-react` (icons), `marked` (Markdown), `dompurify` (sanitization) |
| Backend | Python, FastAPI, Uvicorn, Pydantic, `openai` (AsyncOpenAI SDK), `httpx`, `python-dotenv` |
| AI Provider | LiteLLM proxy (OpenAI-compatible) in front of Ollama running `qwen3.5:4b` |
| Networking | `arp -a` LAN discovery, Tailscale/Wi-Fi, Docker port-proxy on the RTX PC |
| Storage | Browser `localStorage` (no database) |

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  YOUR LAPTOP (browser + local servers)                           │
│                                                                  │
│   ┌─────────────────┐        ┌──────────────────────────────┐    │
│   │  React + Vite   │  /api  │   FastAPI backend            │    │
│   │  (port 5173)    │ ─────► │   (uvicorn, port 8000)       │    │
│   │                 │ proxy  │                              │    │
│   │  - Sidebar      │        │  - /api/chat  (stream)       │    │
│   │  - ChatArea     │        │  - /api/health               │    │
│   │  - Composer     │        │  - /api/config               │    │
│   │  - Settings     │        │  - /api/discover             │    │
│   └─────────────────┘        │                              │    │
│          │                   │  ai_client.py  (OpenAI SDK)  │    │
│          │ localStorage      │  config.py     (env + LAN)   │    │
│          ▼                   │  schemas.py    (Pydantic)    │    │
│    conversations             └──────────────┬───────────────┘    │
│    settings                                 │                    │
└─────────────────────────────────────────────┼────────────────────┘
                                               │  HTTP
                          http://<RTX_PC_IP>:4000/v1
                                               │
┌──────────────────────────────────────────────▼───────────────────┐
│  YOUR RTX PC                                                     │
│                                                                  │
│   ┌────────────────────┐     ┌──────────────────────────────┐    │
│   │  Docker:           │     │  Ollama                      │    │
│   │  litellm-proxy     │ ──► │  qwen3.5:4b  (GPU / CUDA)     │    │
│   │  (port 4000)       │     │                              │    │
│   └────────────────────┘     └──────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

**Request path:** browser → Vite dev server (`/api` proxy) → FastAPI (`:8000`) → LiteLLM (`:4000/v1`) → Ollama → Qwen model → streamed back as SSE.

> The frontend dev server proxies any `/api/*` request to `http://127.0.0.1:8000` (see `frontend/vite.config.js`), so the browser never needs CORS. The backend also enables permissive CORS for direct access.

---

## 4. Repository Structure

```
makemychat/
├── backend/                     # FastAPI backend
│   ├── main.py                  # App, routes, exception handlers
│   ├── ai_client.py             # LiteLLM/Ollama client, streaming, key retry, ARP discovery
│   ├── config.py                # Settings loading, .env persistence, RTX PC auto-discovery
│   ├── schemas.py               # Pydantic request/response models (v1 & v2 compatible)
│   ├── requirements.txt         # Python dependencies
│   ├── .env                     # Active config (real key) -- loaded at runtime
│   └── .env.example             # Template copied to .env on first run
│
├── frontend/                    # React + Vite frontend
│   ├── index.html
│   ├── vite.config.js           # Dev server + /api proxy to :8000
│   ├── package.json
│   └── src/
│       ├── main.jsx             # React entry point
│       ├── App.jsx              # Layout + top-level state wiring
│       ├── api.js               # Backend HTTP + SSE client
│       ├── styles.css           # All styles / theming
│       ├── hooks/
│       │   ├── useChat.js       # Conversations, sending, streaming, status
│       │   └── useTheme.js      # Light/Dark/System resolution
│       ├── utils/
│       │   └── storage.js       # localStorage persistence + settings defaults
│       └── components/
│           ├── Sidebar.jsx      # Conversation list, search, rename/delete
│           ├── Header.jsx       # Title, status, new chat, theme, settings
│           ├── ChatArea.jsx     # Messages, welcome screen, connect card, errors
│           ├── Composer.jsx     # Input box, send/stop, char counter
│           ├── MessageBubble.jsx# User/assistant bubbles, copy buttons
│           ├── MarkdownRenderer.jsx # marked + DOMPurify, code copy, reasoning blocks
│           └── SettingsModal.jsx# Theme, RTX connection, preferences, clear history
│
├── start.bat / start.ps1        # One-command launcher (frees ports, sets up, runs both)
├── stop.bat                     # Kills processes on ports 8000 and 5173
├── check-ai.bat / check-ai.ps1  # Diagnostic checker (Docker, Ollama, key, API, backend)
├── enable-rtx-lan.bat           # Run once on the RTX PC to open port 4000 over LAN
├── package-lock.json            # Root lockfile from a root-level npm context
└── README.md
```

> **Note:** there is also a nested `makemychat/` folder committed inside this repository. It is a duplicate copy of the same project layout and is not required to run the app. Use the top-level `backend/` and `frontend/` folders.

---

## 5. How It Works

### 5.1 Frontend state (`useChat` + `storage.js`)
- On load, `storage.js` reads conversations, the active conversation id, and preferences from `localStorage`.
- `useChat` owns all chat state: the conversation list, the active conversation, streaming content, generation flag, error state, and backend status.
- Sending a message:
  1. The user message is appended to the conversation (creating a new one with a generated title if needed).
  2. The last 24 non-error messages (each capped at 16,000 chars) are sent as `history`.
  3. The reply is appended as an assistant message; streaming updates a temporary bubble live.
  4. Conversation changes are written back to `localStorage` automatically.

### 5.2 Backend message assembly (`ai_client.build_messages_payload`)
- Prepends a `system` message (custom prompt or a sensible default).
- Keeps only the most recent `MAX_HISTORY_MESSAGES` (24) history items.
- Trims history to fit within `MAX_TOTAL_CONTEXT_CHARS` (48,000) by dropping the oldest messages first.
- Rejects messages longer than `MAX_MESSAGE_LENGTH` (16,000) with HTTP 400.

### 5.3 Streaming (Server-Sent Events)
- With `stream: true`, the backend returns `text/event-stream`. Each token is emitted as a JSON `data:` frame:
  - `{"type":"delta","delta":"...","model":"..."}` -- incremental text
  - `{"type":"done","finish_reason":"stop","model":"..."}` -- completion
  - `{"type":"error","detail":"...","error_code":"...","retryable":true}` -- mid-stream failure
  - `data: [DONE]` -- end of stream
- `frontend/src/api.js` reads the stream via `ReadableStream` and calls `onStreamDelta(accumulatedText)` so the UI updates as tokens arrive. An `AbortController` powers the **Stop Generating** button, preserving any partial reply.

### 5.4 API-key O/0 auto-recovery
Because the key contains visually ambiguous characters (`DOK`, `0j8g`), `ai_client._key_variants` generates every spelling where `O` and `0` are swapped. If LiteLLM answers **HTTP 401**, the backend silently retries each variant and persists whichever key succeeds to `backend/.env`. This lets a single O/0 typo self-heal.

### 5.5 RTX PC auto-discovery
Two paths find the RTX PC on `port 4000`:
1. **Fast path** (`_quick_arp_auto_discover`, ~0.8s): used automatically when the configured URL is `localhost:4000` but fails. Parses `arp -a`, probes up to 25 neighbors for `/v1/models`, and updates `.env` with the first responder.
2. **Full scan** (`POST /api/discover`): enumerates the ARP table plus the entire local `/24` subnet, probes in batches of 40, and returns the first IP with LiteLLM listening on port 4000.

On startup, `refreshBackendStatus` calls `/api/health` to report backend and provider status. The health check itself also falls back to fast ARP discovery if `localhost:4000` is unreachable.

### 5.6 URL normalization
Whatever you enter (an IP like `192.168.1.5`, an `IP:4000`, or a full URL) is normalized to a valid `http://<host>:4000/v1` base URL by `config.py`.

### 5.7 Markdown & safety
`MarkdownRenderer.jsx` renders the model output with `marked`, then sanitizes it with **DOMPurify** (allowing only the extra tags/attributes the app needs). Links open in a new tab with `rel="noopener noreferrer"`. `<details>`/`<summary>` blocks wrap model "thinking" output.

---

## 6. API Reference

Base URL: `http://127.0.0.1:8000` (all endpoints are under `/api`).

### `GET /api/health` -- System
Returns backend + AI-provider status.
```json
{
  "status": "ok",
  "backend_running": true,
  "api_key_configured": true,
  "ai_provider_reachable": true,
  "ai_provider_status": "connected",
  "ai_provider_message": "Connected to AI Server at http://192.168.1.5:4000/v1 (ollama/qwen3.5:4b)",
  "base_url": "http://192.168.1.5:4000/v1",
  "model": "ollama/qwen3.5:4b"
}
```

### `POST /api/discover` -- System
Scans the LAN/Tailscale neighbors for LiteLLM on port 4000 and, if found, updates `backend/.env`. Returns the same shape as `/api/health`.

### `GET /api/config` -- System
Returns the current non-secret configuration.
```json
{
  "app_name": "MakeMyChat",
  "model": "ollama/qwen3.5:4b",
  "base_url": "http://localhost:4000/v1",
  "api_key_configured": true,
  "max_message_length": 16000,
  "max_history_messages": 24,
  "streaming_supported": true
}
```

### `POST /api/config` -- System
Persists connection settings to `backend/.env` and re-tests the connection.
```json
{ "base_url": "192.168.1.5", "api_key": "sk-...", "model": "ollama/qwen3.5:4b" }
```

### `POST /api/chat` -- Chat
```json
{
  "message": "Hello!",
  "history": [{ "role": "user", "content": "hi" }],
  "system_prompt": "optional",
  "temperature": 0.7,
  "stream": false
}
```
- `stream: false` → JSON `ChatResponse`: `{ "reply", "model", "finish_reason", "usage" }`
- `stream: true` → `text/event-stream` SSE frames (see [5.3](#53-streaming-server-sent-events)).

**Error format** (all failures return the same envelope):
```json
{ "detail": "LiteLLM rejected the API key at ... (HTTP 401).", "error_code": "authentication_error", "retryable": false }
```
Common `error_code` values: `authentication_error`, `model_not_found`, `upstream_timeout`, `connection_error`, `message_too_long`, `validation_error`, `internal_server_error`.

Interactive docs (Swagger UI) are available at `http://127.0.0.1:8000/docs` when the backend is running.

---

## 7. Configuration (.env)

Configuration lives in **`backend/.env`** (created from `.env.example` on first run). It is loaded on every request and can be edited live via the Settings modal or `POST /api/config`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_BASE_URL` | `http://localhost:4000/v1` | LiteLLM/Ollama endpoint (RTX PC) |
| `OPENAI_API_KEY` | `sk-L1GxiYsyRuDOK-7nUs0j8g` | LiteLLM virtual key |
| `AI_MODEL` | `ollama/qwen3.5:4b` | Model identifier sent to LiteLLM |
| `HOST` | `127.0.0.1` | Backend bind host |
| `PORT` | `8000` | Backend bind port |
| `MAX_MESSAGE_LENGTH` | `16000` | Max characters per user message |
| `MAX_HISTORY_MESSAGES` | `24` | Max prior messages sent as context |
| `MAX_TOTAL_CONTEXT_CHARS` | `48000` | Context budget across system + history + message |
| `REQUEST_TIMEOUT_SECONDS` | `120` | Upstream request timeout (model cold-starts can be slow) |

**Key fallback:** if `OPENAI_API_KEY` is empty, a placeholder, or `ollama`, the backend reads `%USERPROFILE%\.litellm\api_key.txt` (your saved LiteLLM key) automatically.

**Frontend preferences** (stored in `localStorage`, not `.env`):
`theme` (`system`|`light`|`dark`), `streamResponses` (bool), `temperature` (number), `systemPrompt` (string), `customBackendUrl` (optional absolute backend URL).

---

## 8. Quick Start

**Prerequisites (laptop):** Python 3, Node.js + npm. The AI server must be reachable (see [RTX PC LAN Setup](#9-rtx-pc-lan-setup)).

### Option A -- Single command (Windows)
```powershell
.\start.bat
```
`start.ps1` frees ports `8000`/`5173` if occupied, creates `backend/.env` from the example if missing, creates the Python venv and installs requirements (tracked by a hash stamp), runs `npm install` if `node_modules` is missing, then launches backend + frontend together and cleans up on exit.

### Option B -- Two terminals (any OS)

**Terminal 1 -- Backend:**
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1      # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

**Terminal 2 -- Frontend:**
```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser. Stop everything with `.\stop.bat`.

**Production build (frontend):**
```powershell
cd frontend
npm run build      # outputs to frontend/dist
npm run preview    # serves the build on port 4173
```

---

## 9. RTX PC LAN Setup

Docker on the RTX PC often maps LiteLLM to `127.0.0.1:4000`, which is not reachable from other devices. Run the following **once as Administrator on the RTX PC** (or double-click `enable-rtx-lan.bat` there) to expose port 4000 and open the firewall:

```powershell
docker start litellm-proxy
netsh interface portproxy add v4tov4 listenport=4000 listenaddress=0.0.0.0 connectport=4000 connectaddress=127.0.0.1
New-NetFirewallRule -DisplayName "LiteLLM Port 4000" -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow
```

`enable-rtx-lan.bat` does exactly this and then prints the RTX PC's IPv4 address for you to copy into MakeMyChat.

After that, on your laptop either click **Auto-Find RTX PC on Wi-Fi** or type the RTX PC's IP in the top connection bar. MakeMyChat will then use `http://<RTX_PC_IP>:4000/v1` with the pre-loaded key and model.

---

## 10. Same PC vs Another Laptop

`http://localhost:4000/v1` only works on the machine actually running **LiteLLM + Ollama**.

| Where the project runs | What `OPENAI_BASE_URL` must be |
| --- | --- |
| **On the main/RTX PC** (same box as LiteLLM/Ollama) | `http://localhost:4000/v1` (default) |
| **On another laptop** | `http://<MAIN_PC_IP>:4000/v1` (e.g. `http://192.168.1.5:4000/v1`) |

- On the **main PC**, your saved key lives at `%USERPROFILE%\.litellm\api_key.txt`; the backend reads it automatically when `.env` has none.
- On **another laptop**, `localhost` means *that laptop* -- use the main PC's LAN IP or the Auto-Find button. Never expose port 4000 publicly without auth; prefer Tailscale/a private network.

---

## 11. Using the App

- **New chat** -- the "+" in the header or the sidebar's **New Chat** button.
- **Send** -- type in the box and press `Enter`; `Shift+Enter` adds a newline. A character counter appears near the limit.
- **Stop** -- the **Stop Generating** button aborts the stream and keeps any partial reply.
- **Retry** -- after an error, use the **Retry** button in the error banner.
- **Search / rename / delete** -- in the sidebar. **Clear all** wipes every saved conversation.
- **Theme** -- the sun/moon toggle in the header, or Light/Dark/System in Settings.
- **Settings** (gear icon) -- theme, RTX PC URL / API key / model (saved to `backend/.env` and tested), stream toggle, temperature slider, and clear-history.

---

## 12. Verify Everything

Run the built-in checker any time (safe -- it never prints your raw key):

```powershell
.\check-ai.bat
```

It reports, in order:
1. The `litellm-proxy` Docker container state.
2. Installed Ollama models.
3. The resolved API key source and last 4 characters.
4. A live `POST /v1/chat/completions` to LiteLLM.
5. The MakeMyChat backend `/api/health` endpoint (if running).

---

## 13. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| "Backend Offline" badge | FastAPI isn't running. Start it with `start.bat` or Terminal 1. |
| "Cannot connect to AI server" | RTX PC unreachable. Run `enable-rtx-lan.bat` on the RTX PC, then Auto-Find or enter its IP. |
| HTTP 401 / "key rejected" | Wrong key. The backend auto-retries O/0 variants; if it still fails, re-enter the key in Settings. |
| HTTP 404 / "model not found" | `AI_MODEL` isn't running in Ollama/LiteLLM. Check with `ollama list` on the RTX PC. |
| Request timed out | The model may still be loading into GPU memory. Click **Retry**; raise `REQUEST_TIMEOUT_SECONDS`. |
| Ports stuck in use | Run `.\stop.bat`, or `start.ps1` frees ports automatically. |
| No conversations after refresh | Browser `localStorage` was cleared or blocked (private mode / storage quota). |
| Empty AI response | The model returned nothing. Retry; verify the model works via `check-ai.bat`. |
