"""
FastAPI reverse-proxy for SIMONDU_WEB.

Platform routes /api/* to backend:8001. Business logic lives in the Next.js
app on :3000, so this backend simply forwards every /api/* request to
http://localhost:3000/api/* and streams the response back.

Also exposes GET /health for liveness.
"""
import os
import logging
import httpx
from fastapi import FastAPI, Request, Response
from fastapi.responses import StreamingResponse, JSONResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("simondu-proxy")

NEXT_URL = os.environ.get("NEXT_UPSTREAM_URL", "http://localhost:3000")
TIMEOUT = float(os.environ.get("PROXY_TIMEOUT", "120"))

app = FastAPI()

# Reuse a single async client for connection pooling
_client: httpx.AsyncClient | None = None


@app.on_event("startup")
async def _startup():
    global _client
    _client = httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=False)
    logger.info("Proxy started, forwarding /api/* -> %s/api/*", NEXT_URL)


@app.on_event("shutdown")
async def _shutdown():
    global _client
    if _client is not None:
        await _client.aclose()


@app.get("/health")
async def health():
    return {"ok": True, "upstream": NEXT_URL}


# Hop-by-hop headers per RFC 7230 §6.1
HOP_BY_HOP = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailers", "transfer-encoding", "upgrade", "host",
    "content-length", "content-encoding",
}


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def proxy_api(path: str, request: Request):
    if _client is None:
        return JSONResponse({"ok": False, "error": "proxy not ready"}, status_code=503)

    upstream_url = f"{NEXT_URL}/api/{path}"
    if request.url.query:
        upstream_url += f"?{request.url.query}"

    headers = {k: v for k, v in request.headers.items() if k.lower() not in HOP_BY_HOP}
    # Preserve original host chain for downstream logging
    headers["x-forwarded-host"] = request.headers.get("host", "")
    headers["x-forwarded-proto"] = request.url.scheme

    body = await request.body()

    try:
        upstream = await _client.request(
            method=request.method,
            url=upstream_url,
            headers=headers,
            content=body,
        )
    except httpx.ConnectError:
        return JSONResponse(
            {"ok": False, "error": "Next.js upstream unreachable (starting up?)"},
            status_code=502,
        )
    except httpx.ReadTimeout:
        return JSONResponse({"ok": False, "error": "Upstream timeout"}, status_code=504)

    # Filter hop-by-hop response headers so httpx re-encodes body correctly
    response_headers = {
        k: v for k, v in upstream.headers.items() if k.lower() not in HOP_BY_HOP
    }
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=response_headers,
        media_type=upstream.headers.get("content-type"),
    )
