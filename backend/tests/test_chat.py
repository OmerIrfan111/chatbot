import io


def _seed(client, text: str = "The return policy allows returns within 30 days."):
    client.post(
        "/upload",
        files={"file": ("policy.txt", io.BytesIO(text.encode()), "text/plain")},
    )


def test_chat_no_docs_returns_400(client):
    resp = client.post("/chat", json={"question": "What is the return policy?"})
    assert resp.status_code == 400


def test_chat_returns_expected_shape(client):
    _seed(client)
    resp = client.post("/chat", json={"question": "What is the return policy?"})
    assert resp.status_code == 200
    data = resp.json()
    assert "answer" in data
    assert "sources" in data
    assert "confidence" in data
    assert isinstance(data["sources"], list)
    assert 0.0 <= data["confidence"] <= 1.0


def test_chat_sources_have_required_fields(client):
    _seed(client)
    resp = client.post("/chat", json={"question": "Tell me about returns."})
    data = resp.json()
    for source in data["sources"]:
        assert "filename" in source
        assert "page" in source
        assert "score" in source
        assert "snippet" in source


def test_chat_refusal_text_propagated(client, mock_openai):
    """When LLM returns the refusal string it passes through unchanged."""
    mock_openai.chat.invoke.return_value.content = (
        "I don't have enough information in the provided documents to answer that."
    )
    _seed(client)
    resp = client.post("/chat", json={"question": "What is the meaning of life?"})
    assert resp.status_code == 200
    assert "don't have enough information" in resp.json()["answer"]


def test_chat_accepts_history(client):
    _seed(client)
    history = [
        {"role": "user", "content": "What is your return policy?"},
        {"role": "assistant", "content": "Returns are allowed within 30 days."},
    ]
    resp = client.post(
        "/chat",
        json={"question": "Can I return after 60 days?", "chat_history": history},
    )
    assert resp.status_code == 200
    assert "answer" in resp.json()
