"""Existing RSS pipeline, normalized once for Home and News."""
import asyncio
import html
import ipaddress
import re
import time
import xml.etree.ElementTree as ET
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode, urljoin
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone
import httpx
from app.core.config import settings
from app.services.jolpica import ProviderError

cached = None
cached_at = 0.0
lock = asyncio.Lock()


def safe_url(value):
    try:
        url = urlsplit(value or "")
        if url.scheme not in ("http", "https") or not url.hostname or url.username or url.password:
            return None
        host = url.hostname.lower()
        if host == "localhost" or host.endswith((".local", ".internal")) or "." not in host:
            return None
        try:
            if not ipaddress.ip_address(host).is_global:
                return None
        except ValueError:
            pass
        query = [(k,v) for k,v in parse_qsl(url.query) if not k.lower().startswith("utm_") and k.lower() not in ("fbclid", "gclid")]
        return urlunsplit((url.scheme, url.netloc, url.path, urlencode(query), ""))
    except ValueError:
        return None


def plain(value):
    return html.unescape(re.sub(r"<[^>]*>", "", value or "")).strip()


def parse_feed(body, publisher, source_url, ingested_at):
    if len(body) > 2_000_000 or b"<!DOCTYPE" in body.upper() or b"<!ENTITY" in body.upper():
        raise ValueError("Unsafe or excessive XML")
    root = ET.fromstring(body)
    articles = []
    for item in root.findall(".//item")[:100]:
        title, link = plain(item.findtext("title")), safe_url(item.findtext("link"))
        if not title or not link:
            continue
        published = None
        try:
            stamp = parsedate_to_datetime(item.findtext("pubDate") or "")
            if stamp.tzinfo:
                published = stamp.astimezone(timezone.utc).isoformat()
        except (ValueError, TypeError, OverflowError):
            pass
        articles.append({"title": title, "summary": plain(item.findtext("description"))[:500], "link": link, "source": publisher, "source_url": source_url, "published": published, "ingested_at": ingested_at, "topics": [plain(c.text) for c in item.findall("category") if c.text], "image": None, "tag": "F1 news"})
    return articles


def deduplicate(articles):
    result, links, titles = [], set(), set()
    for article in sorted(articles, key=lambda a: a["published"] or "", reverse=True):
        title = re.sub(r"\W+", " ", article["title"].casefold()).strip()
        if article["link"] in links or title in titles:
            continue
        result.append(article)
        links.add(article["link"])
        titles.add(title)
    return result[:100]


async def get_feed():
    global cached, cached_at
    async with lock:
        if cached and time.monotonic() - cached_at < 600:
            return cached
        ingested_at = datetime.now(timezone.utc).isoformat()
        articles, errors = [], {}
        for specification in settings.NEWS_FEEDS.split(",")[:8]:
            try:
                url, publisher = specification.rsplit("|", 1)
                url = safe_url(url.strip())
                if not url:
                    raise ValueError("Invalid source")
                async with httpx.AsyncClient(timeout=8, headers={"User-Agent": "ApexF1/3.0"}) as client:
                    current_url = url
                    for redirect_count in range(4):
                        async with client.stream("GET", current_url) as response:
                            if 300 <= response.status_code < 400:
                                location = response.headers.get("location")
                                current_url = safe_url(urljoin(current_url, location or ""))
                                if not current_url or redirect_count == 3:
                                    raise ValueError("Unsafe or excessive redirect")
                                continue
                            response.raise_for_status()
                            body = bytearray()
                            async for chunk in response.aiter_bytes():
                                body.extend(chunk)
                                if len(body) > 2_000_000:
                                    raise ValueError("Feed too large")
                            break
                    else:
                        raise ValueError("Excessive redirects")
                articles.extend(parse_feed(bytes(body), publisher.strip(), url, ingested_at))
            except (ValueError, httpx.HTTPError, ET.ParseError):
                errors[specification.rsplit("|",1)[-1]] = "unavailable"
        if not articles:
            if cached and time.monotonic() - cached_at < 86400:
                return {**cached, "status": "stale", "errors": errors}
            raise ProviderError("news_unavailable")
        cached = {"status": "partial" if errors else "success", "articles": deduplicate(articles), "errors": errors, "ingested_at": ingested_at, "cache_seconds": 600}
        cached_at = time.monotonic()
        return cached
