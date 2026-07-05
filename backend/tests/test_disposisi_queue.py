"""Backend regression tests for SIMONDU disposisi-queue.

Covers:
- POST /api/auth/login (kasubbid)
- GET  /api/disposisi-queue (Gajamada + ASTINA merge)
- GET  /api/astina/attachment/{fileId}?inline=1 (only if an ASTINA item has files)
- GET  /api/cases/{pid}/attachments (Gajamada attachments proxy)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://simondu-stage.preview.emergentagent.com").rstrip("/")

USERNAME = "kasubbid"
PASSWORD = "kasubbid123"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def logged_in(session):
    r = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": USERNAME, "password": PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    body = r.json()
    assert body.get("ok") is True
    assert body.get("user", {}).get("role") == "kasubbid"
    # simondu_session cookie should be set
    assert "simondu_session" in session.cookies.get_dict(), "session cookie missing"
    return session


# --- Auth ---
class TestAuth:
    def test_login_success(self, logged_in):
        assert logged_in is not None

    def test_login_invalid(self, session):
        r = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "kasubbid", "password": "wrongpwd"},
            timeout=15,
        )
        assert r.status_code in (400, 401), f"expected 401, got {r.status_code}"


# --- Disposisi Queue ---
class TestDisposisiQueue:
    @pytest.fixture(scope="class")
    def queue_data(self, logged_in):
        r = logged_in.get(f"{BASE_URL}/api/disposisi-queue", timeout=90)
        assert r.status_code == 200, f"queue endpoint returned {r.status_code}: {r.text[:300]}"
        return r.json()

    def test_response_shape(self, queue_data):
        assert "data" in queue_data
        assert "total" in queue_data
        assert isinstance(queue_data["data"], list)
        assert isinstance(queue_data["total"], int)
        # astina_error may be None or a string
        assert "astina_error" in queue_data

    def test_no_astina_error(self, queue_data):
        assert queue_data.get("astina_error") in (None, ""), (
            f"astina_error present: {queue_data.get('astina_error')}"
        )

    def test_has_gajamada_items(self, queue_data):
        gaj = [i for i in queue_data["data"] if i.get("_source") == "gajamada"]
        assert len(gaj) >= 1, "expected at least 1 Gajamada complaint (bug fix verification)"

    def test_has_astina_items(self, queue_data):
        ast = [i for i in queue_data["data"] if i.get("_source") == "astina"]
        assert len(ast) >= 1, "expected at least 1 ASTINA surat"

    def test_expected_totals(self, queue_data):
        # BUG-FIX: should be ~5 Gajamada + ~6 ASTINA = ~11 total
        gaj = [i for i in queue_data["data"] if i.get("_source") == "gajamada"]
        ast = [i for i in queue_data["data"] if i.get("_source") == "astina"]
        assert len(gaj) >= 3, f"Gajamada count too low: {len(gaj)}"
        assert len(ast) >= 3, f"ASTINA count too low: {len(ast)}"
        assert queue_data["total"] == len(queue_data["data"])

    def test_gajamada_fields_populated(self, queue_data):
        gaj = [i for i in queue_data["data"] if i.get("_source") == "gajamada"]
        if not gaj:
            pytest.skip("no gajamada items to check")
        item = gaj[0]
        # Gajamada items must have identifier and category (used in Detail Surat)
        assert item.get("id"), "gajamada.id missing"
        assert item.get("category"), "gajamada.category missing"

    def test_astina_fields_populated(self, queue_data):
        ast = [i for i in queue_data["data"] if i.get("_source") == "astina"]
        if not ast:
            pytest.skip("no astina items to check")
        item = ast[0]
        assert item.get("id"), "astina.id missing"
        assert item.get("perihal") or item.get("nomor_surat"), "astina missing perihal/nomor_surat"


# --- Attachment proxy ---
class TestAttachments:
    def test_astina_attachment_inline(self, logged_in):
        r = logged_in.get(f"{BASE_URL}/api/disposisi-queue", timeout=90)
        data = r.json().get("data", [])
        target = None
        for it in data:
            if it.get("_source") == "astina" and it.get("files"):
                target = it
                break
        if not target:
            pytest.skip("no astina item with files present")
        f0 = target["files"][0]
        file_id = f0.get("id") or f0.get("file_id") or f0.get("fileId")
        if not file_id:
            pytest.skip("astina file id not resolvable")
        r2 = logged_in.get(
            f"{BASE_URL}/api/astina/attachment/{file_id}?inline=1",
            timeout=60,
            stream=True,
        )
        # 200 stream or 302 redirect are acceptable
        assert r2.status_code in (200, 302), (
            f"astina attachment status {r2.status_code}: {r2.text[:200] if r2.status_code < 500 else ''}"
        )
        if r2.status_code == 200:
            ct = r2.headers.get("content-type", "")
            # not asserting strict pdf here; some endpoints return octet-stream
            assert ct, "missing content-type header"

    def test_gajamada_attachments_endpoint(self, logged_in):
        r = logged_in.get(f"{BASE_URL}/api/disposisi-queue", timeout=90)
        data = r.json().get("data", [])
        gaj = next((i for i in data if i.get("_source") == "gajamada"), None)
        if not gaj:
            pytest.skip("no gajamada item")
        pid = gaj.get("p_id") or gaj.get("id")
        r2 = logged_in.get(f"{BASE_URL}/api/cases/{pid}/attachments", timeout=60)
        # endpoint should exist; may return {data: []} for a complaint with no attachments
        assert r2.status_code in (200, 204), f"attachments endpoint {r2.status_code}"
        if r2.status_code == 200 and r2.text:
            body = r2.json()
            assert isinstance(body, (list, dict))
