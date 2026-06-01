import io


def test_upload_txt(client):
    content = b"The return policy allows returns within 30 days of purchase with a receipt."
    response = client.post(
        "/upload",
        files={"file": ("policy.txt", io.BytesIO(content), "text/plain")},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "ready"
    assert data["filename"] == "policy.txt"
    assert isinstance(data["document_id"], int)


def test_upload_appears_in_list(client):
    content = b"Shipping takes 5-7 business days for standard delivery."
    client.post(
        "/upload",
        files={"file": ("shipping.txt", io.BytesIO(content), "text/plain")},
    )
    resp = client.get("/documents")
    assert resp.status_code == 200
    filenames = [d["filename"] for d in resp.json()]
    assert "shipping.txt" in filenames


def test_upload_empty_file_returns_400(client):
    response = client.post(
        "/upload",
        files={"file": ("empty.txt", io.BytesIO(b""), "text/plain")},
    )
    assert response.status_code == 400


def test_upload_unsupported_type_returns_400(client):
    response = client.post(
        "/upload",
        files={"file": ("image.png", io.BytesIO(b"\x89PNG\r\n"), "image/png")},
    )
    assert response.status_code == 400


def test_delete_document(client):
    content = b"This document will be deleted."
    upload_resp = client.post(
        "/upload",
        files={"file": ("temp.txt", io.BytesIO(content), "text/plain")},
    )
    doc_id = upload_resp.json()["document_id"]

    del_resp = client.delete(f"/documents/{doc_id}")
    assert del_resp.status_code == 204

    docs = client.get("/documents").json()
    assert not any(d["id"] == doc_id for d in docs)
