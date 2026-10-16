"""
FastAPI backend for MakeMyChat.
Pre-configured with the user's LiteLLM API key and Qwen model, plus automatic
RTX PC network discovery.
"""

import uvicorn
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from ai_client import (
    AIClientError,
    check_provider_health,
    generate_chat_completion,
    stream_chat_completion,
)
from config import auto_discover_rtx_pc, get_settings, update_env_settings
from schemas import (
    ChatRequest,
    ChatResponse,
    ConfigResponse,
    HealthResponse,
    UpdateConfigRequest,
)

app = FastAPI(
    title="MakeMyChat API",
    description="Local FastAPI backend connecting MakeMyChat on your laptop to your RTX PC LiteLLM + Qwen server.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(AIClientError)
async def ai_client_error_handler(_request: Request, exc: AIClientError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.message,
            "error_code": exc.error_code,
            "retryable": exc.retryable,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = exc.errors()
    first_msg = "Invalid request payload."
    if errors:
        loc = " -> ".join(str(part) for part in errors[0].get("loc", []) if part != "body")
        msg = errors[0].get("msg", "Invalid value")
        first_msg = f"{loc}: {msg}" if loc else msg
    return JSONResponse(
        status_code=422,
        content={
            "detail": first_msg,
            "error_code": "validation_error",
            "retryable": False,
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, _exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An internal server error occurred in the MakeMyChat backend.",
            "error_code": "internal_server_error",
            "retryable": True,
        },
    )


@app.get("/api/health", response_model=HealthResponse, tags=["System"])
async def get_health() -> HealthResponse:
    settings = get_settings()
    reachable, provider_status, provider_message = await check_provider_health(settings)
    # Reload settings in case check_provider_health auto-discovered the RTX PC IP
    latest = get_settings()
    return HealthResponse(
        status="ok",
        backend_running=True,
        api_key_configured=latest.is_api_key_configured,
        ai_provider_reachable=reachable,
        ai_provider_status=provider_status,
        ai_provider_message=provider_message,
        base_url=latest.normalized_base_url,
        model=latest.ai_model,
    )


@app.post("/api/discover", response_model=HealthResponse, tags=["System"])
async def post_discover() -> HealthResponse:
    """Scan local Wi-Fi/LAN and Tailscale neighbors to automatically find the RTX PC on port 4000."""
    found, url, message = await auto_discover_rtx_pc()
    latest = get_settings()
    if found:
        return HealthResponse(
            status="ok",
            backend_running=True,
            api_key_configured=latest.is_api_key_configured,
            ai_provider_reachable=True,
            ai_provider_status="connected",
            ai_provider_message=message,
            base_url=url,
            model=latest.ai_model,
        )
    reachable, provider_status, _ = await check_provider_health(latest)
    return HealthResponse(
        status="ok",
        backend_running=True,
        api_key_configured=latest.is_api_key_configured,
        ai_provider_reachable=reachable,
        ai_provider_status=provider_status,
        ai_provider_message=message,
        base_url=latest.normalized_base_url,
        model=latest.ai_model,
    )


@app.get("/api/config", response_model=ConfigResponse, tags=["System"])
async def get_config() -> ConfigResponse:
    settings = get_settings()
    return ConfigResponse(
        app_name=settings.app_name,
        model=settings.ai_model,
        base_url=settings.normalized_base_url,
        api_key_configured=settings.is_api_key_configured,
        max_message_length=settings.max_message_length,
        max_history_messages=settings.max_history_messages,
        streaming_supported=True,
    )


@app.post("/api/config", response_model=HealthResponse, tags=["System"])
async def post_config(payload: UpdateConfigRequest) -> HealthResponse:
    settings = update_env_settings(
        base_url=payload.base_url,
        api_key=payload.api_key,
        model=payload.model,
    )
    reachable, provider_status, provider_message = await check_provider_health(settings)
    return HealthResponse(
        status="ok",
        backend_running=True,
        api_key_configured=settings.is_api_key_configured,
        ai_provider_reachable=reachable,
        ai_provider_status=provider_status,
        ai_provider_message=provider_message,
        base_url=settings.normalized_base_url,
        model=settings.ai_model,
    )


@app.post("/api/chat", response_model=ChatResponse, tags=["Chat"])
async def post_chat(payload: ChatRequest):
    settings = get_settings()

    if payload.stream:
        generator = stream_chat_completion(
            user_message=payload.message,
            history=payload.history,
            settings=settings,
            system_prompt=payload.system_prompt,
            temperature=payload.temperature if payload.temperature is not None else 0.7,
        )
        return StreamingResponse(
            generator,
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    return await generate_chat_completion(
        user_message=payload.message,
        history=payload.history,
        settings=settings,
        system_prompt=payload.system_prompt,
        temperature=payload.temperature if payload.temperature is not None else 0.7,
    )


if __name__ == "__main__":
    cfg = get_settings()
    uvicorn.run("main:app", host=cfg.host, port=cfg.port, reload=False)
