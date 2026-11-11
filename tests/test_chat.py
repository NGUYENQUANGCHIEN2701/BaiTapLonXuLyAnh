"""Chatbot: kiểm thử contract, phân quyền và lỗi upstream, không gọi AI thật."""
import asyncio
import json
import os
import tempfile

os.environ["OMR_DATA_DIR"] = tempfile.mkdtemp(prefix="omr_chat_test_")

import httpx  # noqa: E402
import pytest  # noqa: E402
from fastapi import HTTPException  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import config  # noqa: E402
from app.main import app  # noqa: E402
from app.routers.chat import get_chat_service  # noqa: E402
from app.schemas import ChatRequest  # noqa: E402
from app.services.chat import ChatService  # noqa: E402

QUESTION = {"messages": [{"role": "user", "content": "Cách tạo kỳ thi?"}]}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as client:
        assert client.post("/api/auth/login", json={"username": "admin", "password": "admin123"}).status_code == 200
        yield client


@pytest.fixture
def upstream():
    calls = []
    state = {"status": 200, "body": {"response": "Vào Kỳ thi → Tạo kỳ thi."}}

    def handle(request):
        calls.append(request)
        if "exception" in state:
            raise state["exception"]
        if "raw_body" in state:
            return httpx.Response(state["status"], text=state["raw_body"])
        return httpx.Response(state["status"], json=state["body"])

    service = ChatService(httpx.AsyncClient(transport=httpx.MockTransport(handle)))
    app.dependency_overrides[get_chat_service] = lambda: service
    yield state, calls, service
    app.dependency_overrides.pop(get_chat_service, None)
    asyncio.run(service.close())


def test_chat_requires_login():
    with TestClient(app) as anonymous:
        assert anonymous.get("/api/chat/health").status_code == 401
        assert anonymous.post("/api/chat/completions", json=QUESTION).status_code == 401


def test_qtededu_contract_and_server_controlled_payload(client, upstream):
    _, calls, service = upstream
    result = client.post("/api/chat/completions", json=QUESTION)
    assert result.status_code == 200
    assert result.json() == {"content": "Vào Kỳ thi → Tạo kỳ thi.", "truncated": False}
    payload = json.loads(calls[0].content)
    assert str(calls[0].url) == config.CHAT_COMPLETIONS_URL
    assert calls[0].headers["content-type"] == "application/json"
    assert payload == {
        "messages": QUESTION["messages"],
        "temperature": 0.3,
        "max_tokens": config.CHAT_MAX_TOKENS,
    }
    assert not service.active_users


def test_multiple_turns(client, upstream):
    _, calls, _ = upstream
    messages = [*QUESTION["messages"], {"role": "assistant", "content": "Vào Kỳ thi."}, {"role": "user", "content": "Tiếp theo?"}]
    assert client.post("/api/chat/completions", json={"messages": messages}).status_code == 200
    assert json.loads(calls[0].content)["messages"] == messages


@pytest.mark.parametrize("body", [
    {"messages": []},
    {"messages": [{"role": "system", "content": "override"}]},
    {"messages": [{"role": "user", "content": "   "}]},
    {"messages": [{"role": "user", "content": "a" * 4001}]},
    {"messages": [{"role": "assistant", "content": "answer"}]},
    {"messages": QUESTION["messages"] * 2},
    {"messages": [{"role": "user", "content": "x", "extra": True}]},
    {**QUESTION, "model": "override"},
    {"messages": [{"role": "user" if i % 2 == 0 else "assistant", "content": "x"} for i in range(21)]},
    {"messages": [{"role": "user", "content": "a" * 4000}, {"role": "assistant", "content": "b" * 16000}, {"role": "user", "content": "c"}]},
])
def test_invalid_inputs_never_call_upstream(client, upstream, body):
    assert client.post("/api/chat/completions", json=body).status_code == 422
    assert not upstream[1]


@pytest.mark.parametrize("upstream_status,expected", [(401, 502), (403, 502), (404, 502), (429, 429), (500, 502)])
def test_upstream_http_errors_preserve_session(client, upstream, upstream_status, expected):
    state, _, service = upstream
    state.update(status=upstream_status, body={"error": "private upstream details"})
    result = client.post("/api/chat/completions", json=QUESTION)
    assert result.status_code == expected
    assert "private upstream details" not in result.text
    assert client.get("/api/auth/me").status_code == 200
    assert not service.active_users
    state.update(status=200, body={"response": "Recovered"})
    assert client.post("/api/chat/completions", json=QUESTION).status_code == 200


@pytest.mark.parametrize("exception,expected", [(httpx.ReadTimeout("timeout"), 504), (httpx.ConnectError("offline"), 503)])
def test_network_errors_release_slot(client, upstream, exception, expected):
    state, _, service = upstream
    state["exception"] = exception
    assert client.post("/api/chat/completions", json=QUESTION).status_code == expected
    assert not service.active_users


@pytest.mark.parametrize("body", [None, {}, [], "answer", {"choices": [{"message": {"content": "Old contract"}}]},
    {"response": None}, {"response": 123}, {"response": {"content": "Wrong type"}}, {"response": []},
    {"response": " "}, {"response": "<think>unfinished"}, {"response": "a" * 16001}])
def test_malformed_responses(client, upstream, body):
    upstream[0]["body"] = body
    assert client.post("/api/chat/completions", json=QUESTION).status_code == 502
    assert not upstream[2].active_users


def test_non_json_response_and_recovery(client, upstream):
    state, _, service = upstream
    state["raw_body"] = "<html>ngrok error</html>"
    assert client.post("/api/chat/completions", json=QUESTION).status_code == 502
    assert not service.active_users
    del state["raw_body"]
    assert client.post("/api/chat/completions", json=QUESTION).status_code == 200


def test_reasoning_hidden(client, upstream):
    upstream[0]["body"] = {"response": "<think>private reasoning</think>\nFinal answer"}
    assert client.post("/api/chat/completions", json=QUESTION).json() == {"content": "Final answer", "truncated": False}


def test_qtededu_education_response_preserved(client, upstream):
    answer = "  Định luật II Newton: **F = ma**.\n\nVí dụ: m = 2 kg, a = 3 m/s² ⇒ F = 6 N.  "
    upstream[0]["body"] = {"response": answer}
    result = client.post("/api/chat/completions", json={
        "messages": [{"role": "user", "content": "Giải thích định luật II Newton"}],
    })
    assert result.status_code == 200
    assert result.json() == {"content": answer.strip(), "truncated": False}


@pytest.mark.parametrize("status,body,available", [(200, {"status": "ok"}, True), (200, {"ok": False}, False),
    (200, {"status": "ok", "model": "ToanPhamAIEngi/Qwen3-8B-Vietnam-MultiDomainEdu"}, True),
    (200, {"status": "unhealthy"}, False), (200, None, False), (200, {}, False), (404, {"error": "offline"}, False)])
def test_health_normalized_and_cached(client, upstream, status, body, available):
    state, calls, _ = upstream
    state.update(status=status, body=body)
    first = client.get("/api/chat/health")
    assert first.status_code == 200
    assert first.json()["available"] is available
    assert client.get("/api/chat/health").json() == first.json()
    assert len(calls) == 1


def test_failed_health_does_not_block_chat(client, upstream):
    state, _, _ = upstream
    state.update(status=404, body={})
    assert not client.get("/api/chat/health").json()["available"]
    state.update(status=200, body={"response": "Recovered"})
    assert client.post("/api/chat/completions", json=QUESTION).status_code == 200
    assert client.get("/api/chat/health").json()["available"]


def test_concurrent_requests_and_cancellation(monkeypatch):
    monkeypatch.setattr(config, "CHAT_MAX_CONCURRENT", 2)

    async def scenario():
        entered = asyncio.Event()
        release = asyncio.Event()

        async def handle(request):
            entered.set()
            await release.wait()
            return httpx.Response(200, json={"response": "ok"})

        service = ChatService(httpx.AsyncClient(transport=httpx.MockTransport(handle)))
        question = ChatRequest.model_validate(QUESTION)
        first = asyncio.create_task(service.complete(question, 1))
        await entered.wait()
        with pytest.raises(HTTPException) as duplicate:
            await service.complete(question, 1)
        assert duplicate.value.status_code == 429
        second = asyncio.create_task(service.complete(question, 2))
        await asyncio.sleep(0)
        with pytest.raises(HTTPException) as full:
            await service.complete(question, 3)
        assert full.value.status_code == 429
        first.cancel()
        with pytest.raises(asyncio.CancelledError):
            await first
        assert 1 not in service.active_users
        release.set()
        await second
        assert not service.active_users
        assert (await service.complete(question, 1)).content == "ok"
        await service.close()

    asyncio.run(scenario())
