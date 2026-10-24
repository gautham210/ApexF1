"""Shared Jolpica transport: bounded pagination, single-flight and explicit failures."""
import asyncio
import time
import httpx
from cachetools import TTLCache

BASE = "https://api.jolpi.ca/ergast/f1"
cache = TTLCache(maxsize=256, ttl=900)
pending = {}
gate = asyncio.Lock()
last_request = 0.0


class ProviderError(Exception):
    def __init__(self, reason="unavailable"):
        self.reason = reason
        super().__init__(reason)


async def page(path, offset=0):
    global last_request
    async with gate:
        await asyncio.sleep(max(0, 0.3 - (time.monotonic() - last_request)))
        last_request = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=15, headers={"User-Agent": "ApexF1/3.0"}) as client:
                response = await client.get(f"{BASE}/{path}.json", params={"limit": 100, "offset": offset})
                if response.status_code == 429:
                    raise ProviderError("rate_limited")
                response.raise_for_status()
                data = response.json()["MRData"]
                if int(data["offset"]) != offset or int(data["total"]) < 0:
                    raise ValueError("Invalid pagination")
                return data
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
            raise ProviderError("invalid_or_unavailable") from exc


async def collect(path, table, collection, nested=None):
    key = (path, table, collection, nested)
    if key in cache:
        return cache[key]
    if key in pending:
        return await asyncio.shield(pending[key])
    if len(pending) >= 24:
        raise ProviderError("busy")

    async def fetch():
        rows, offset, total = [], 0, None
        row_indexes, nested_identities = {}, {}
        for _ in range(100):
            payload = await page(path, offset)
            try:
                current = int(payload["total"])
                if total is not None and total != current:
                    raise ValueError("Dataset changed during pagination")
                total = current
                batch = payload[table][collection]
                if not isinstance(batch, list):
                    raise ValueError("Invalid collection")
                count = sum(len(row[nested]) for row in batch) if nested else len(batch)
                if nested:
                    for row in batch:
                        if table == "RaceTable":
                            circuit_id = row.get("Circuit", {}).get("circuitId")
                            identity = (row.get("season"), row.get("round"), row.get("raceName"), row.get("date"), circuit_id)
                        elif table == "StandingsTable":
                            identity = (row.get("season"), row.get("round"))
                        else:
                            identity = None
                        if identity is None or any(value is None for value in identity):
                            raise ValueError("Missing nested collection identity")
                        if identity not in row_indexes:
                            row_indexes[identity] = len(rows)
                            rows.append({**row, nested: list(row[nested])})
                            nested_identities[identity] = set()
                        else:
                            merged = rows[row_indexes[identity]]
                            previous_envelope = {key: value for key, value in merged.items() if key != nested}
                            current_envelope = {key: value for key, value in row.items() if key != nested}
                            if previous_envelope != current_envelope:
                                raise ValueError("Conflicting event envelope across pages")
                            merged[nested].extend(row[nested])
                        seen = nested_identities[identity]
                        for item in row[nested]:
                            driver_id = (item.get("Driver") or {}).get("driverId")
                            constructor_id = (item.get("Constructor") or {}).get("constructorId")
                            classification_id = driver_id or constructor_id
                            if classification_id is None or classification_id in seen:
                                raise ValueError("Missing or duplicate nested classification identity")
                            seen.add(classification_id)
                else:
                    rows.extend(batch)
                offset += count
                if offset == total:
                    cache[key] = rows
                    return rows
                if offset > total:
                    raise ValueError("Pagination exceeded provider total")
                if count == 0:
                    raise ValueError("Incomplete pagination")
            except (KeyError, TypeError, ValueError) as exc:
                raise ProviderError("invalid_payload") from exc
        raise ProviderError("pagination_limit")

    task = asyncio.create_task(fetch())
    pending[key] = task
    def finished(done):
        pending.pop(key, None)
        if not done.cancelled():
            done.exception()  # consume exception even when the HTTP caller disconnected
    task.add_done_callback(finished)
    return await asyncio.shield(task)
