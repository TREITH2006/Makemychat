"""
Pydantic schemas for MakeMyChat backend API (compatible with Pydantic v1 and v2).
"""

from typing import List, Literal, Optional
import pydantic
from pydantic import BaseModel, Field

PYDANTIC_V2 = int(pydantic.__version__.split(".")[0]) >= 2

if PYDANTIC_V2:
    from pydantic import field_validator as _validator_decorator

    def field_check(field_name: str):
        return _validator_decorator(field_name)
else:
    from pydantic import validator as _validator_decorator

    def field_check(field_name: str):
        return _validator_decorator(field_name)


class HistoryMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str

    @field_check("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        cleaned = str(value or "").strip()
        if not cleaned:
            raise ValueError("Message content cannot be empty.")
        return cleaned[:32000]


class ChatRequest(BaseModel):
    message: str
    history: List[HistoryMessage] = Field(default_factory=list)
    system_prompt: Optional[str] = None
    temperature: Optional[float] = Field(default=0.7, ge=0.0, le=2.0)
    stream: bool = False

    @field_check("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        cleaned = str(value or "").strip()
        if not cleaned:
            raise ValueError("Message cannot be empty.")
        return cleaned


class UsageInfo(BaseModel):
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None


class ChatResponse(BaseModel):
    reply: str
    model: str
    finish_reason: Optional[str] = None
    usage: Optional[UsageInfo] = None


class HealthResponse(BaseModel):
    status: str
    backend_running: bool = True
    api_key_configured: bool
    ai_provider_reachable: bool
    ai_provider_status: str
    ai_provider_message: str
    base_url: str
    model: str


class ConfigResponse(BaseModel):
    app_name: str
    model: str
    base_url: str
    api_key_configured: bool
    max_message_length: int
    max_history_messages: int
    streaming_supported: bool = True


class UpdateConfigRequest(BaseModel):
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
