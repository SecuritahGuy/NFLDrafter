"""Quota-aware client for the official FantasyPros API."""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from typing import Any

from dotenv import load_dotenv
from sqlalchemy import func, select

from ..db import SessionLocal
from ..models import ApiCallLog, ApiResponseCache


load_dotenv()

DEFAULT_BASE_URL = "https://api.fantasypros.com/public/v2/json"
DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60
_locks: dict[str, asyncio.Lock] = {}


class FantasyProsAPIError(RuntimeError):
    pass


@dataclass(slots=True)
class CachedResponse:
    data: dict[str, Any]
    cache_key: str
    cache_status: str
    fetched_at: int
    expires_at: int
    response_headers: dict[str, str]


def _normalized_query(params: dict[str, Any] | None) -> dict[str, str]:
    return {
        str(key): str(value)
        for key, value in sorted((params or {}).items())
        if value is not None
    }


def _cache_key(endpoint: str, params: dict[str, Any] | None) -> str:
    payload = json.dumps(
        {"endpoint": endpoint, "query": _normalized_query(params)},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def _request_json(url: str, api_key: str) -> tuple[dict[str, Any], int, dict[str, str]]:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "NFLDrafter/1.0 (personal, non-commercial)",
            "x-api-key": api_key,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            data = json.loads(response.read())
            headers = {
                key.lower(): value for key, value in response.headers.items()
                if key.lower().startswith("x-ratelimit")
                or key.lower() in {"retry-after", "etag", "last-modified"}
            }
            return data, response.status, headers
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:500]
        raise FantasyProsAPIError(f"FantasyPros returned HTTP {exc.code}: {detail}") from exc
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise FantasyProsAPIError(f"FantasyPros request failed: {exc}") from exc


class FantasyProsClient:
    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        default_ttl_seconds: int = DEFAULT_TTL_SECONDS,
    ) -> None:
        self.api_key = api_key or os.getenv("FANTASYPROS_API_KEY")
        self.base_url = (base_url or os.getenv("FANTASYPROS_API_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
        self.default_ttl_seconds = default_ttl_seconds

    async def get_json(
        self,
        endpoint: str,
        *,
        params: dict[str, Any] | None = None,
        ttl_seconds: int | None = None,
        force_refresh: bool = False,
        allow_stale: bool = True,
        cache_only: bool = False,
    ) -> CachedResponse:
        endpoint = "/" + endpoint.strip("/")
        query = _normalized_query(params)
        key = _cache_key(endpoint, query)
        now = int(time.time())
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl_seconds

        async with SessionLocal() as session:
            cached = await session.get(ApiResponseCache, key)
            if cached and not force_refresh and cached.expires_at > now:
                cached.last_accessed_at = now
                await session.commit()
                return CachedResponse(
                    cached.response, key, "fresh", cached.fetched_at,
                    cached.expires_at, cached.response_headers or {},
                )
            if cache_only:
                if cached and allow_stale:
                    return CachedResponse(
                        cached.response, key, "stale", cached.fetched_at,
                        cached.expires_at, cached.response_headers or {},
                    )
                raise FantasyProsAPIError("No cached FantasyPros response exists for this query")

        lock = _locks.setdefault(key, asyncio.Lock())
        async with lock:
            # Another request may have filled the cache while this one waited.
            async with SessionLocal() as session:
                cached = await session.get(ApiResponseCache, key)
                if cached and not force_refresh and cached.expires_at > int(time.time()):
                    cached.last_accessed_at = int(time.time())
                    await session.commit()
                    return CachedResponse(
                        cached.response, key, "fresh", cached.fetched_at,
                        cached.expires_at, cached.response_headers or {},
                    )

            if not self.api_key:
                if cached and allow_stale:
                    return CachedResponse(
                        cached.response, key, "stale", cached.fetched_at,
                        cached.expires_at, cached.response_headers or {},
                    )
                raise FantasyProsAPIError("FANTASYPROS_API_KEY is not configured")

            url = f"{self.base_url}{endpoint}"
            if query:
                url = f"{url}?{urllib.parse.urlencode(query)}"
            requested_at = int(time.time())
            try:
                data, status_code, headers = await asyncio.to_thread(
                    _request_json, url, self.api_key
                )
            except FantasyProsAPIError:
                await self._record_call(endpoint, query, requested_at, 0)
                if cached and allow_stale:
                    return CachedResponse(
                        cached.response, key, "stale", cached.fetched_at,
                        cached.expires_at, cached.response_headers or {},
                    )
                raise
            await self._record_call(endpoint, query, requested_at, status_code)

            fetched_at = int(time.time())
            expires_at = fetched_at + max(ttl, 0)
            async with SessionLocal() as session:
                row = await session.get(ApiResponseCache, key)
                values = {
                    "provider": "fantasypros",
                    "endpoint": endpoint,
                    "query": query,
                    "response": data,
                    "fetched_at": fetched_at,
                    "expires_at": expires_at,
                    "last_accessed_at": fetched_at,
                    "status_code": status_code,
                    "response_headers": headers,
                }
                if row:
                    for field, value in values.items():
                        setattr(row, field, value)
                else:
                    session.add(ApiResponseCache(cache_key=key, **values))
                await session.commit()
            return CachedResponse(data, key, "miss", fetched_at, expires_at, headers)

    async def _record_call(
        self, endpoint: str, query: dict[str, str], requested_at: int, status_code: int
    ) -> None:
        async with SessionLocal() as session:
            session.add(ApiCallLog(
                call_id=str(uuid.uuid4()),
                provider="fantasypros",
                endpoint=endpoint,
                query=query,
                requested_at=requested_at,
                status_code=status_code,
            ))
            await session.commit()

    async def projections(
        self,
        season: int,
        *,
        position: str | None = None,
        week: int | None = None,
        force_refresh: bool = False,
        cache_only: bool = False,
    ) -> CachedResponse:
        params = {"position": position, "week": week}
        return await self.get_json(
            f"/nfl/{season}/projections",
            params=params,
            force_refresh=force_refresh,
            cache_only=cache_only,
        )


async def cache_status() -> dict[str, Any]:
    async with SessionLocal() as session:
        rows = (
            await session.execute(
                select(ApiResponseCache)
                .where(ApiResponseCache.provider == "fantasypros")
                .order_by(ApiResponseCache.fetched_at.desc())
            )
        ).scalars().all()
        now = int(time.time())
        utc_day_start = now - (now % 86400)
        calls_today = (
            await session.execute(
                select(func.count(ApiCallLog.call_id)).where(
                    ApiCallLog.provider == "fantasypros",
                    ApiCallLog.requested_at >= utc_day_start,
                )
            )
        ).scalar_one()
    daily_budget = int(os.getenv("FANTASYPROS_DAILY_CALL_BUDGET", "50"))
    return {
        "configured": bool(os.getenv("FANTASYPROS_API_KEY")),
        "entries": len(rows),
        "fresh_entries": sum(row.expires_at > now for row in rows),
        "latest_fetch": rows[0].fetched_at if rows else None,
        "latest_rate_limit": rows[0].response_headers if rows else {},
        "default_ttl_seconds": DEFAULT_TTL_SECONDS,
        "tracked_calls_today": calls_today,
        "estimated_calls_remaining": max(daily_budget - calls_today, 0),
        "daily_call_budget": daily_budget,
    }
