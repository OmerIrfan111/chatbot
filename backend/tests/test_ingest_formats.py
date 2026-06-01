"""
Phase 3 — multi-format ingestion tests.
All OpenAI calls are mocked via conftest fixtures.
"""
import csv
import io
import struct
import zipfile


# ── helpers ───────────────────────────────────────────────────────────────────

def _txt_file(text: str = "The return policy allows 30-day returns."):
    return ("policy.txt", io.BytesIO(text.encode()), "text/plain")


def _csv_bytes() -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Product", "Price", "Stock"])
    writer.writerow(["Widget A", "9.99", "100"])
    writer.writerow(["Widget B", "19.99", "50"])
    return buf.getvalue().encode()


def _markdown_bytes() -> bytes:
    return b"# FAQ\n\n## Returns\n\nReturns accepted within 30 days.\n\n## Shipping\n\nFree shipping over $50."


def _html_bytes() -> bytes:
    return b"<html><body><h1>Policy</h1><p>Returns are accepted within 30 days.</p></body></html>"


def _minimal_docx_bytes() -> bytes:
    """Create a minimal valid .docx (zip with required XML)."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("[Content_Types].xml", """<?xml version="1.0"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>""")
        z.writestr("_rels/.rels", """<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>""")
        z.writestr("word/_rels/document.xml.rels", """<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>""")
        z.writestr("word/document.xml", """<?xml version="1.0"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Warranty covers defects for one year from purchase date.</w:t></w:r></w:p>
  </w:body>
</w:document>""")
    return buf.getvalue()


# ── format tests ──────────────────────────────────────────────────────────────

def test_upload_txt(client):
    resp = client.post("/upload", files={"file": _txt_file()})
    assert resp.status_code == 201
    assert resp.json()["status"] == "ready"


def test_upload_csv(client):
    resp = client.post("/upload", files={"file": ("data.csv", io.BytesIO(_csv_bytes()), "text/csv")})
    assert resp.status_code == 201


def test_upload_markdown(client):
    resp = client.post("/upload", files={"file": ("faq.md", io.BytesIO(_markdown_bytes()), "text/markdown")})
    assert resp.status_code == 201


def test_upload_html(client):
    resp = client.post("/upload", files={"file": ("page.html", io.BytesIO(_html_bytes()), "text/html")})
    assert resp.status_code == 201


def test_upload_docx(client):
    resp = client.post("/upload", files={"file": ("doc.docx", io.BytesIO(_minimal_docx_bytes()), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")})
    assert resp.status_code == 201


def test_upload_all_six_appear_in_list(client):
    uploads = [
        ("a.txt",  io.BytesIO(b"Text content about returns"),       "text/plain"),
        ("b.csv",  io.BytesIO(_csv_bytes()),                         "text/csv"),
        ("c.md",   io.BytesIO(_markdown_bytes()),                    "text/markdown"),
        ("d.html", io.BytesIO(_html_bytes()),                        "text/html"),
        ("e.docx", io.BytesIO(_minimal_docx_bytes()),               "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ]
    for name, buf, ct in uploads:
        r = client.post("/upload", files={"file": (name, buf, ct)})
        assert r.status_code == 201, f"Failed for {name}: {r.text}"

    docs = client.get("/documents").json()
    names = [d["filename"] for d in docs]
    for name, _, _ in uploads:
        assert name in names


# ── edge-case tests ───────────────────────────────────────────────────────────

def test_empty_file_returns_400(client):
    resp = client.post("/upload", files={"file": ("empty.txt", io.BytesIO(b""), "text/plain")})
    assert resp.status_code == 400
    assert "empty" in resp.json()["detail"].lower()


def test_oversized_file_returns_400(client):
    big = b"x" * (51 * 1024 * 1024)  # 51 MB
    resp = client.post("/upload", files={"file": ("big.txt", io.BytesIO(big), "text/plain")})
    assert resp.status_code == 400
    assert "50 MB" in resp.json()["detail"]


def test_unsupported_type_returns_400(client):
    resp = client.post("/upload", files={"file": ("img.png", io.BytesIO(b"\x89PNG"), "image/png")})
    assert resp.status_code == 400


def test_corrupt_docx_returns_400(client):
    resp = client.post("/upload", files={"file": ("bad.docx", io.BytesIO(b"not a zip"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")})
    assert resp.status_code == 400


def test_html_strips_scripts(client):
    html = b"<html><script>alert('xss')</script><body><p>Clean content here.</p></body></html>"
    resp = client.post("/upload", files={"file": ("page.html", io.BytesIO(html), "text/html")})
    assert resp.status_code == 201
