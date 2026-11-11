"""Cầu nối bất đồng bộ tới dịch vụ chat; không truy cập dữ liệu kỳ thi."""
from __future__ import annotations

import asyncio
import re
import time

import httpx
from fastapi import HTTPException

from .. import config
from ..schemas import ChatHealth, ChatReply, ChatRequest


class ChatService:
    def __init__(self, client: httpx.AsyncClient | None = None):
        headers = {"Accept": "application/json", "ngrok-skip-browser-warning": "true"}
        if config.CHAT_API_KEY:
            headers["Authorization"] = f"Bearer {config.CHAT_API_KEY}"
        self.client = client or httpx.AsyncClient(
            headers=headers, timeout=httpx.Timeout(config.CHAT_TIMEOUT, connect=10),
            follow_redirects=False,
        )
        self.active_users: set[int] = set()
        self.health_cache: tuple[float, ChatHealth] | None = None
        self.health_lock = asyncio.Lock()

    async def close(self):
        await self.client.aclose()

    async def health(self) -> ChatHealth:
        async with self.health_lock:
            if self.health_cache and time.monotonic() < self.health_cache[0]:
                return self.health_cache[1]
            try:
                response = await self.client.get(config.CHAT_HEALTH_URL, timeout=config.CHAT_HEALTH_TIMEOUT)
                response.raise_for_status()
                data = response.json()
                if not isinstance(data, dict) or not data:
                    raise ValueError("Invalid health response")
                unhealthy = (data.get("ok") is False or data.get("healthy") is False
                             or str(data.get("status", "")).lower() in {"error", "offline", "unhealthy", "down"})
                result = ChatHealth(available=not unhealthy, message=(
                    "Dịch vụ AI tạm chưa sẵn sàng" if unhealthy else "Dịch vụ AI đang kết nối"))
            except (httpx.HTTPError, ValueError):
                result = ChatHealth(available=False, message="Chưa kết nối được dịch vụ AI. Bạn có thể thử gửi lại.")
            self.health_cache = (time.monotonic() + 30, result)
            return result

    async def complete(self, body: ChatRequest, user_id: int) -> ChatReply:
        # Các phép kiểm tra và thêm vào set không có await nên nguyên tử trong event loop.
        if user_id in self.active_users:
            raise HTTPException(429, "Bạn đang có một câu hỏi được xử lý. Vui lòng chờ.")
        if len(self.active_users) >= config.CHAT_MAX_CONCURRENT:
            raise HTTPException(429, "Trợ lý AI đang bận. Vui lòng thử lại sau ít giây.")
        self.active_users.add(user_id)
        try:
            response = await self.client.post(config.CHAT_COMPLETIONS_URL, json={
                # QtedEdu tự cấu hình model và system prompt trên server Kaggle.
                "messages": [m.model_dump() for m in body.messages],
                "max_tokens": config.CHAT_MAX_TOKENS,
                "temperature": 0.3,
            })
            response.raise_for_status()
            try:
                content = response.json()["response"]
                if not isinstance(content, str):
                    raise ValueError("Invalid message")
                content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
                if not content or "<think>" in content or len(content) > 16000:
                    raise ValueError("Empty, incomplete or oversized answer")
                self.health_cache = (time.monotonic() + 30, ChatHealth(available=True, message="Dịch vụ AI đang kết nối"))
                return ChatReply(content=content)
            except (ValueError, TypeError, KeyError):
                raise HTTPException(502, "Dịch vụ AI trả về nội dung không hợp lệ. Vui lòng thử lại.") from None
        except httpx.TimeoutException:
            raise HTTPException(504, "Trợ lý AI phản hồi quá lâu. Vui lòng thử lại.") from None
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429:
                raise HTTPException(429, "Dịch vụ AI đang quá tải. Vui lòng thử lại sau.") from None
            if exc.response.status_code in (401, 403):
                raise HTTPException(502, "Dịch vụ AI chưa được cấu hình quyền truy cập. Vui lòng liên hệ quản trị viên.") from None
            raise HTTPException(502, "Dịch vụ AI tạm không khả dụng. Vui lòng thử lại sau.") from None
        except httpx.RequestError:
            raise HTTPException(503, "Không kết nối được dịch vụ AI. Vui lòng thử lại sau.") from None
        finally:
            self.active_users.discard(user_id)
