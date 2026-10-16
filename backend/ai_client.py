"""
LiteLLM & Ollama AI Client for MakeMyChat.
Uses the official OpenAI Python SDK (AsyncOpenAI) pre-configured with the user's
LiteLLM virtual key (sk-L1GxiYsyRuDOK-7nUs0j8g) and Qwen model (ollama/qwen3.5:4b).
"""

import asyncio
import json
import re
import subprocess
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple
import httpx
import openai
from openai import AsyncOpenAI

from config import Settings, get_settings, update_env_settings
from schemas import ChatResponse, HistoryMessage, UsageInfo

DEFAULT_SYSTEM_PROMPT = (
    "You are a helpful, accurate, and thoughtful AI assistant inside MakeMyChat. "
    "Format responses clearly using Markdown where helpful, including language-tagged "
    "code blocks for code snippets."
)


class AIClientError(Exception):
    def __init__(
        self,
        message: str,
        status_code: int = 502,
        error_code: str = "ai_provider_error",
        retryable: bool = True,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.retryable = retryable


def build_messages_payload(
    user_message: str,
    history: List[HistoryMessage],
    settings: Settings,
    system_prompt: Optional[str] = None,
) -> List[Dict[str, str]]:
    if len(user_message) > settings.max_message_length:
        raise AIClientError(
            message=f"Message exceeds maximum length of {settings.max_message_length:,} characters.",
            status_code=400,
            error_code="message_too_long",
            retryable=False,
        )

    effective_system = (system_prompt or DEFAULT_SYSTEM_PROMPT).strip()
    messages: List[Dict[str, str]] = [{"role": "system", "content": effective_system}]

    recent_history = (
        history[-settings.max_history_messages :]
        if settings.max_history_messages > 0
        else []
    )

    budget = settings.max_total_context_chars - len(effective_system) - len(user_message)
    selected_history: List[Dict[str, str]] = []

    for item in reversed(recent_history):
        if item.role == "system":
            continue
        content = item.content[: settings.max_message_length]
        if budget - len(content) < 0 and selected_history:
            break
        budget -= len(content)
        selected_history.append({"role": item.role, "content": content})

    selected_history.reverse()
    messages.extend(selected_history)
    messages.append({"role": "user", "content": user_message})
    return messages


def _create_openai_client(settings: Settings, api_key: Optional[str] = None) -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=api_key or settings.openai_api_key,
        base_url=settings.normalized_base_url,
        timeout=httpx.Timeout(settings.request_timeout_seconds, connect=10.0),
        max_retries=1,
    )


def _key_variants(api_key: str) -> List[str]:
    """
    Generate alternate spellings of the API key that swap letter 'O' with
    digit '0' at every ambiguous position (e.g. 'DOK' vs 'D0K', '0j8g' vs 'Oj8g').
    Used to auto-recover from a single O/0 typo when LiteLLM answers HTTP 401.
    """
    ambiguous = [i for i, ch in enumerate(api_key) if ch in ("O", "0")]
    if not ambiguous or len(ambiguous) > 10:
        return []
    variants = set()
    for mask in range(1, 1 << len(ambiguous)):
        chars = list(api_key)
        for bit, idx in enumerate(ambiguous):
            if mask & (1 << bit):
                chars[idx] = "0" if api_key[idx] == "O" else "O"
        variants.add("".join(chars))
    return sorted(variants)


async def _create_completion_with_key_retry(
    settings: Settings,
    messages: List[Dict[str, str]],
    temperature: float,
    stream: bool,
) -> Tuple[AsyncOpenAI, Any]:
    """
    Call {OPENAI_BASE_URL}/chat/completions. If LiteLLM rejects the key with
    HTTP 401, retry automatically with O/0 variants of the configured key and
    persist whichever key succeeds to backend/.env. Returns (client, result);
    the caller owns closing the client.
    """
    keys = [settings.openai_api_key]
    keys.extend(k for k in _key_variants(settings.openai_api_key) if k not in keys)

    last_auth_error: Optional[openai.AuthenticationError] = None
    for key in keys:
        client = _create_openai_client(settings, api_key=key)
        try:
            result = await client.chat.completions.create(
                model=settings.ai_model,
                messages=messages,
                temperature=temperature,
                stream=stream,
            )
        except openai.AuthenticationError as exc:
            last_auth_error = exc
            await client.close()
            continue
        except Exception:
            await client.close()
            raise
        if key != settings.openai_api_key:
            update_env_settings(api_key=key)
        return client, result
    raise last_auth_error  # every key variant was rejected


async def _quick_arp_auto_discover(settings: Settings) -> Optional[str]:
    """
    Fast (<0.8s) check of active ARP table neighbors on port 4000 when localhost:4000
    is not running on the laptop. Automatically finds the RTX PC on the same network.
    """
    try:
        output = subprocess.check_output(["arp", "-a"], text=True, timeout=1.5)
        ips = []
        seen = set()
        for ip in re.findall(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", output):
            if (
                ip.endswith(".255")
                or ip.startswith("224.")
                or ip.startswith("239.")
                or ip in ("127.0.0.1", "255.255.255.255")
            ):
                continue
            if ip not in seen:
                seen.add(ip)
                ips.append(ip)

        if not ips:
            return None

        headers = {"Authorization": f"Bearer {settings.openai_api_key}"}

        async def probe(ip_addr: str) -> Optional[str]:
            try:
                async with httpx.AsyncClient(timeout=0.6) as client:
                    r = await client.get(f"http://{ip_addr}:4000/v1/models", headers=headers)
                    if r.status_code == 200:
                        return f"http://{ip_addr}:4000/v1"
            except Exception:
                return None
            return None

        results = await asyncio.gather(*(probe(ip) for ip in ips[:25]))
        for url in results:
            if url:
                update_env_settings(base_url=url)
                return url
    except Exception:
        pass
    return None


async def check_provider_health(settings: Settings) -> Tuple[bool, str, str]:
    """
    Check if LiteLLM / Ollama is reachable at the configured URL.
    If localhost:4000 fails on the laptop, automatically checks ARP neighbors for the RTX PC.
    """
    models_url = f"{settings.normalized_base_url}/models"
    headers = {"Authorization": f"Bearer {settings.openai_api_key}"}

    try:
        async with httpx.AsyncClient(timeout=3.0) as http_client:
            response = await http_client.get(models_url, headers=headers)

        if response.status_code == 200:
            return (
                True,
                "connected",
                f"Connected to AI Server at {settings.normalized_base_url} ({settings.ai_model})",
            )
        if response.status_code in (401, 403):
            return (
                False,
                "auth_error",
                f"Reached {settings.normalized_base_url}, but the API key was rejected (HTTP {response.status_code}).",
            )
        return (
            False,
            "error",
            f"AI Server responded with HTTP {response.status_code} at {models_url}.",
        )
    except Exception:
        # If currently pointing to localhost:4000 on the laptop, try fast ARP discovery of RTX PC
        if "localhost:4000" in settings.normalized_base_url or "127.0.0.1:4000" in settings.normalized_base_url:
            discovered_url = await _quick_arp_auto_discover(settings)
            if discovered_url:
                return (
                    True,
                    "connected",
                    f"Auto-connected to your RTX PC at {discovered_url} ({settings.ai_model})",
                )

        return (
            False,
            "unreachable",
            (
                f"Cannot reach {settings.normalized_base_url} yet. "
                "If your RTX PC is on the same Wi-Fi/LAN, run 'enable-rtx-lan.bat' once on your RTX PC "
                "and enter your RTX PC's IP address in the top bar (or click 'Auto-Find RTX PC')."
            ),
        )


def _translate_openai_exception(exc: Exception, settings: Settings) -> AIClientError:
    base_url = settings.normalized_base_url
    model = settings.ai_model

    if isinstance(exc, AIClientError):
        return exc

    if isinstance(exc, openai.AuthenticationError):
        return AIClientError(
            message=f"LiteLLM rejected the API key at {base_url} (HTTP 401).",
            status_code=401,
            error_code="authentication_error",
            retryable=False,
        )

    if isinstance(exc, openai.NotFoundError):
        return AIClientError(
            message=(
                f"Model '{model}' or endpoint not found at {base_url} (HTTP 404). "
                f"Check that '{model}' is running in Ollama/LiteLLM."
            ),
            status_code=404,
            error_code="model_not_found",
            retryable=False,
        )

    if isinstance(exc, openai.APITimeoutError):
        return AIClientError(
            message=(
                f"Request to {base_url} timed out. Your RTX PC may still be loading '{model}' "
                "into GPU memory -- click Retry."
            ),
            status_code=504,
            error_code="upstream_timeout",
            retryable=True,
        )

    if isinstance(exc, openai.APIConnectionError):
        return AIClientError(
            message=(
                f"Cannot connect to AI server at {base_url}. "
                "Enter your RTX PC's IP address in the top connection bar (e.g. 192.168.1.x) "
                "and ensure 'enable-rtx-lan.bat' was run on the RTX PC."
            ),
            status_code=502,
            error_code="connection_error",
            retryable=True,
        )

    return AIClientError(
        message=f"Error communicating with AI server at {base_url} for model '{model}'.",
        status_code=502,
        error_code="provider_error",
        retryable=True,
    )


async def generate_chat_completion(
    user_message: str,
    history: List[HistoryMessage],
    settings: Settings,
    system_prompt: Optional[str] = None,
    temperature: float = 0.7,
) -> ChatResponse:
    messages = build_messages_payload(
        user_message=user_message,
        history=history,
        settings=settings,
        system_prompt=system_prompt,
    )

    client: Optional[AsyncOpenAI] = None
    try:
        try:
            client, completion = await _create_completion_with_key_retry(
                settings, messages, temperature, stream=False
            )
        except openai.APIConnectionError as exc:
            # If localhost:4000 is not up on this machine, try quick ARP
            # discovery of the RTX PC LiteLLM server on port 4000 (one retry).
            if "localhost:4000" in settings.normalized_base_url or "127.0.0.1:4000" in settings.normalized_base_url:
                discovered = await _quick_arp_auto_discover(settings)
                if not discovered:
                    raise _translate_openai_exception(exc, settings) from exc
                updated_settings = get_settings()
                client, completion = await _create_completion_with_key_retry(
                    updated_settings, messages, temperature, stream=False
                )
            else:
                raise _translate_openai_exception(exc, settings) from exc
    except AIClientError:
        raise
    except Exception as exc:
        raise _translate_openai_exception(exc, settings) from exc
    finally:
        if client is not None:
            await client.close()

    if not completion or not getattr(completion, "choices", None):
        raise AIClientError(
            message="Received an empty completion response from the AI server.",
            status_code=502,
            error_code="malformed_response",
            retryable=True,
        )

    first_choice = completion.choices[0]
    message_obj = getattr(first_choice, "message", None)
    content = getattr(message_obj, "content", None) if message_obj else None

    if content is None or not str(content).strip():
        raise AIClientError(
            message=f"Model '{settings.ai_model}' returned an empty response.",
            status_code=502,
            error_code="empty_model_response",
            retryable=True,
        )

    usage_info = None
    if getattr(completion, "usage", None):
        usage_info = UsageInfo(
            prompt_tokens=getattr(completion.usage, "prompt_tokens", None),
            completion_tokens=getattr(completion.usage, "completion_tokens", None),
            total_tokens=getattr(completion.usage, "total_tokens", None),
        )

    return ChatResponse(
        reply=str(content),
        model=getattr(completion, "model", None) or settings.ai_model,
        finish_reason=getattr(first_choice, "finish_reason", "stop"),
        usage=usage_info,
    )


async def stream_chat_completion(
    user_message: str,
    history: List[HistoryMessage],
    settings: Settings,
    system_prompt: Optional[str] = None,
    temperature: float = 0.7,
) -> AsyncGenerator[str, None]:
    messages = build_messages_payload(
        user_message=user_message,
        history=history,
        settings=settings,
        system_prompt=system_prompt,
    )

    client: Optional[AsyncOpenAI] = None
    try:
        try:
            client, stream_obj = await _create_completion_with_key_retry(
                settings, messages, temperature, stream=True
            )
        except openai.APIConnectionError as exc:
            # If localhost:4000 is not up on this machine, try quick ARP
            # discovery of the RTX PC LiteLLM server on port 4000 (one retry).
            if "localhost:4000" in settings.normalized_base_url or "127.0.0.1:4000" in settings.normalized_base_url:
                discovered = await _quick_arp_auto_discover(settings)
                if not discovered:
                    raise _translate_openai_exception(exc, settings) from exc
                updated_settings = get_settings()
                client, stream_obj = await _create_completion_with_key_retry(
                    updated_settings, messages, temperature, stream=True
                )
            else:
                raise _translate_openai_exception(exc, settings) from exc

        async for chunk in stream_obj:
            if not getattr(chunk, "choices", None):
                continue
            choice = chunk.choices[0]
            delta = getattr(choice, "delta", None)
            token = getattr(delta, "content", None) if delta else None
            finish_reason = getattr(choice, "finish_reason", None)
            if token:
                payload = json.dumps(
                    {
                        "type": "delta",
                        "delta": token,
                        "model": getattr(chunk, "model", None) or settings.ai_model,
                    }
                )
                yield f"data: {payload}\n\n"
            if finish_reason:
                done_payload = json.dumps(
                    {
                        "type": "done",
                        "finish_reason": finish_reason,
                        "model": getattr(chunk, "model", None) or settings.ai_model,
                    }
                )
                yield f"data: {done_payload}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as exc:
        err = _translate_openai_exception(exc, settings)
        error_payload = json.dumps(
            {
                "type": "error",
                "detail": err.message,
                "error_code": err.error_code,
                "retryable": err.retryable,
            }
        )
        yield f"data: {error_payload}\n\n"
    finally:
        if client is not None:
            await client.close()
