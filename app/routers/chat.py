from fastapi import APIRouter, Depends, Request

from ..models import User
from ..schemas import ChatHealth, ChatReply, ChatRequest
from ..security import current_user
from ..services.chat import ChatService

router = APIRouter(prefix="/api/chat", tags=["chat"])


def get_chat_service(request: Request) -> ChatService:
    return request.app.state.chat_service


@router.get("/health", response_model=ChatHealth)
async def health(_: User = Depends(current_user), service: ChatService = Depends(get_chat_service)):
    return await service.health()


@router.post("/completions", response_model=ChatReply)
async def complete(body: ChatRequest, user: User = Depends(current_user),
                   service: ChatService = Depends(get_chat_service)):
    return await service.complete(body, user.id)
