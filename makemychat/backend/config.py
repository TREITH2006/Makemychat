"""
Configuration and automatic RTX PC discovery for MakeMyChat.
Pre-configured with the user's LiteLLM API key (sk-L1GxiYsyRuDOK-7nUs0j8g)
and Qwen model (ollama/qwen3.5:4b).
"""

import asyncio
import os
import re
import socket
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple
import httpx
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent
ENV_FILE_PATH = BACKEND_DIR / ".env"
DEFAULT_LITELLM_KEY_FILE = Path.home() / ".litellm" / "api_key.txt"

DEFAULT_API_KEY = "sk-L1GxiYsyRuDOK-7nUs0j8g"
DEFAULT_MODEL = "ollama/qwen3.5:4b"
DEFAULT_BASE_URL = "http://localhost:4000/v1"


@dataclass
class Settings:
    app_name: str
    openai_base_url: str
    openai_api_key: str
    ai_model: str
    host: str
    port: int
    max_message_length: int
    max_history_messages: int
    max_total_context_chars: int
    request_timeout_seconds: float

    @property
    def is_api_key_configured(self) -> bool:
        key = (self.openai_api_key or "").strip()
        return bool(key and not key.lower().startswith("replace_with_"))

    @property
    def normalized_base_url(self) -> str:
        url = (self.openai_base_url or DEFAULT_BASE_URL).strip().rstrip("/")
        if not url.startswith("http://") and not url.startswith("https://"):
            url = f"http://{url}"
        if not url.endswith("/v1"):
            # If user entered just IP or IP:4000, normalize to :4000/v1
            if re.match(r"^https?://[^/:]+$", url):
                url = f"{url}:4000/v1"
            elif re.match(r"^https?://[^/]+:\d+$", url):
                url = f"{url}/v1"
        return url


def get_settings() -> Settings:
    """Load settings from backend/.env (pre-populated with user's key and model)."""
    if ENV_FILE_PATH.exists():
        load_dotenv(dotenv_path=ENV_FILE_PATH, override=True)
    else:
        load_dotenv(override=False)

    raw_port = os.getenv("PORT", "8000").strip()
    try:
        port = int(raw_port)
    except ValueError:
        port = 8000

    api_key = os.getenv("OPENAI_API_KEY", DEFAULT_API_KEY).strip() or DEFAULT_API_KEY
    if api_key.startswith("replace_with_") and DEFAULT_LITELLM_KEY_FILE.exists():
        try:
            saved = DEFAULT_LITELLM_KEY_FILE.read_text(encoding="utf-8").strip()
            if saved:
                api_key = saved
        except OSError:
            pass

    return Settings(
        app_name="MakeMyChat",
        openai_base_url=os.getenv("OPENAI_BASE_URL", DEFAULT_BASE_URL).strip()
        or DEFAULT_BASE_URL,
        openai_api_key=api_key,
        ai_model=os.getenv("AI_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL,
        host=os.getenv("HOST", "127.0.0.1").strip() or "127.0.0.1",
        port=port,
        max_message_length=int(os.getenv("MAX_MESSAGE_LENGTH", "16000")),
        max_history_messages=int(os.getenv("MAX_HISTORY_MESSAGES", "24")),
        max_total_context_chars=int(os.getenv("MAX_TOTAL_CONTEXT_CHARS", "48000")),
        request_timeout_seconds=float(os.getenv("REQUEST_TIMEOUT_SECONDS", "120.0")),
    )


def update_env_settings(
    base_url: Optional[str] = None,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
) -> Settings:
    """Persist updated connection settings to backend/.env."""
    current = get_settings()
    next_base_url = (base_url or "").strip() or current.openai_base_url
    # Normalize if user typed just an IP like 192.168.1.10
    if not next_base_url.startswith("http://") and not next_base_url.startswith("https://"):
        next_base_url = f"http://{next_base_url}"
    if re.match(r"^https?://[^/:]+$", next_base_url):
        next_base_url = f"{next_base_url}:4000/v1"
    elif re.match(r"^https?://[^/]+:\d+$", next_base_url):
        next_base_url = f"{next_base_url}/v1"

    next_model = (model or "").strip() or current.ai_model
    next_api_key = (
        api_key.strip()
        if api_key is not None and api_key.strip() != ""
        else current.openai_api_key
    )

    lines = [
        f"OPENAI_BASE_URL={next_base_url}",
        f"OPENAI_API_KEY={next_api_key}",
        f"AI_MODEL={next_model}",
        f"HOST={current.host}",
        f"PORT={current.port}",
    ]
    ENV_FILE_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    os.environ["OPENAI_BASE_URL"] = next_base_url
    os.environ["OPENAI_API_KEY"] = next_api_key
    os.environ["AI_MODEL"] = next_model
    return get_settings()


def _get_candidate_ips() -> List[str]:
    """
    Gather candidate IPv4 addresses on the local LAN and Tailscale network
    from the ARP table (`arp -a`) and local network interfaces.
    """
    candidates: List[str] = ["127.0.0.1"]
    seen = {"127.0.0.1"}

    # 1. Inspect ARP table (fastest way to find the RTX PC on Wi-Fi/LAN or Tailscale)
    try:
        output = subprocess.check_output(["arp", "-a"], text=True, timeout=2.0)
        for ip in re.findall(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", output):
            if ip.endswith(".255") or ip.startswith("224.") or ip.startswith("239.") or ip == "255.255.255.255":
                continue
            if ip not in seen:
                seen.add(ip)
                candidates.append(ip)
    except Exception:
        pass

    # 2. Also add the local /24 subnet around this laptop's primary LAN IP
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
        parts = local_ip.split(".")
        if len(parts) == 4 and parts[0] in ("192", "10", "172"):
            prefix = ".".join(parts[:3])
            for host_id in range(1, 255):
                ip = f"{prefix}.{host_id}"
                if ip != local_ip and ip not in seen:
                    seen.add(ip)
                    candidates.append(ip)
    except Exception:
        pass

    return candidates


async def _probe_litellm_ip(ip: str, api_key: str, port: int = 4000) -> Optional[str]:
    """Quickly check if a given IP has LiteLLM listening on port 4000."""
    url = f"http://{ip}:{port}/v1/models"
    headers = {"Authorization": f"Bearer {api_key}"}
    try:
        async with httpx.AsyncClient(timeout=0.75) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code in (200, 401, 403):
                return f"http://{ip}:{port}/v1"
    except Exception:
        return None
    return None


async def auto_discover_rtx_pc() -> Tuple[bool, str, str]:
    """
    Scan known LAN/Tailscale neighbors for the RTX PC running LiteLLM on port 4000.
    If found, automatically updates backend/.env and returns (True, url, message).
    """
    settings = get_settings()
    candidates = _get_candidate_ips()

    # Probe in batches of 40 for fast discovery (< 2 seconds total)
    batch_size = 40
    for i in range(0, len(candidates), batch_size):
        batch = candidates[i : i + batch_size]
        tasks = [_probe_litellm_ip(ip, settings.openai_api_key, 4000) for ip in batch]
        results = await asyncio.gather(*tasks)
        for found_url in results:
            if found_url:
                update_env_settings(
                    base_url=found_url,
                    api_key=settings.openai_api_key,
                    model=DEFAULT_MODEL,
                )
                return (
                    True,
                    found_url,
                    f"Automatically discovered RTX PC LiteLLM at {found_url}!",
                )

    return (
        False,
        settings.normalized_base_url,
        (
            "Could not auto-detect port 4000 on your Wi-Fi/LAN. "
            "Make sure LiteLLM is running on your RTX PC and run 'enable-rtx-lan.bat' "
            "on the RTX PC (since Docker maps 127.0.0.1:4000 by default), then enter the RTX PC IP."
        ),
    )
