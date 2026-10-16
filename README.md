# MakeMyChat -- Pre-Configured Local AI Chat Website

**MakeMyChat** is a complete full-stack AI chat web application (**React + Vite** frontend and **Python FastAPI** backend) pre-configured with all your exact details from your RTX PC setup:

- **Pre-Loaded LiteLLM API Key**: `sk-L1GxiYsyRuDOK-7nUs0j8g` (already inserted inside `backend/.env`)
- **Pre-Loaded AI Model**: `ollama/qwen3.5:4b` (already inserted inside `backend/.env`)
- **Auto-Discovery**: Automatically scans your Wi-Fi / LAN (`arp -a` & local subnet) to find your RTX PC on port `4000` and connect itself!

---

## 1. Quick Start in VS Code Terminal (On Your Laptop)

Extract `makemychat.zip`, open the **`makemychat`** folder in **VS Code**, and run either the 1-command launcher or 2 terminals:

### Option A: Single Command in VS Code Terminal
```powershell
.\start.bat
```

### Option B: Run Backend and Frontend in 2 VS Code Terminals

**Terminal 1 (Backend):**
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

**Terminal 2 (Frontend):**
```powershell
cd frontend
npm install
npm run dev
```

Then open **[http://localhost:5173](http://localhost:5173)** in your browser!

---

## 2. How Laptop -> RTX PC Auto-Connection Works

1. Your API key (`sk-L1GxiYsyRuDOK-7nUs0j8g`) and model (`ollama/qwen3.5:4b`) are **already pre-inserted** in `backend/.env`.
2. Because Docker on your RTX PC originally mapped `127.0.0.1:4000->4000/tcp` (which blocks other laptops on Wi-Fi from reaching port 4000), run these **2 commands once as Administrator on your RTX PC** (or double-click `enable-rtx-lan.bat` on your RTX PC):
   ```powershell
   docker start litellm-proxy
   netsh interface portproxy add v4tov4 listenport=4000 listenaddress=0.0.0.0 connectport=4000 connectaddress=127.0.0.1
   New-NetFirewallRule -DisplayName "LiteLLM Port 4000" -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow
   ```
3. Once port `4000` is open on your RTX PC, **MakeMyChat on your laptop will automatically find your RTX PC IP on your Wi-Fi** (or you can click **"Auto-Find RTX PC on Wi-Fi"** or type your RTX PC's IP in the top bar at `http://localhost:5173`).
4. MakeMyChat uses **only** your RTX PC LiteLLM server (`OPENAI_BASE_URL=http://<RTX_PC_IP>:4000/v1`, `AI_MODEL=ollama/qwen3.5:4b`). If LiteLLM answers HTTP 401, the backend automatically retries with the letter-O vs digit-0 spelling of your API key and saves whichever one works.

---

## 3. Same PC vs Another Laptop (Important)

`http://localhost:4000/v1` only works on the machine that is actually running **LiteLLM + Ollama**.

| Where the project runs | What `OPENAI_BASE_URL` must be |
| --- | --- |
| **On the main/RTX PC** (same box as LiteLLM/Ollama) | `http://localhost:4000/v1` (default in `backend/.env`) |
| **On another laptop** | `http://<MAIN_PC_IP>:4000/v1` (e.g. `http://192.168.1.5:4000/v1`) |

- On the **main PC**, your saved key lives at `%USERPROFILE%\.litellm\api_key.txt`. The backend also reads this file automatically when `OPENAI_API_KEY` in `.env` is empty or a placeholder.
- On **another laptop**, `localhost` points to *that laptop*, not your main PC. Use the main PC's LAN IP, or click **"Auto-Find RTX PC on Wi-Fi"** in the app. Never expose port 4000 to the public internet without authentication (use Tailscale/a private network).

## 4. Verify Everything Any Time

Run the built-in checker (safe, never prints your raw key):

```powershell
.\check-ai.bat
```

It reports, step by step: the `litellm-proxy` container, installed Ollama models, your resolved API key, a live `POST /v1/chat/completions` to LiteLLM, and the MakeMyChat backend `/api/health`.

