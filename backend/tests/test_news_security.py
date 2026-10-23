import asyncio
import socket
import unittest
from unittest.mock import AsyncMock, patch
import httpx
from app.services import news_service as news


def answer(ip):
    family = socket.AF_INET6 if ':' in ip else socket.AF_INET
    return (family, socket.SOCK_STREAM, 6, '', (ip, 443))


class FeedDestinationTests(unittest.IsolatedAsyncioTestCase):
    async def test_private_mixed_empty_and_mapped_answers_rejected(self):
        for addresses in [[], ['127.0.0.1'], ['10.0.0.1'], ['169.254.169.254'],
                          ['::1'], ['fc00::1'], ['::ffff:8.8.8.8'], ['8.8.8.8', '192.168.1.1']]:
            with self.subTest(addresses=addresses):
                with patch.object(asyncio.get_running_loop(), 'getaddrinfo', AsyncMock(return_value=[answer(ip) for ip in addresses])):
                    with self.assertRaises(ValueError):
                        await news.pinned_destination('https://publisher.example/feed')

    async def test_public_address_pinned_with_publisher_identity(self):
        for address in ['8.8.8.8', '2606:4700:4700::1111']:
            with patch.object(asyncio.get_running_loop(), 'getaddrinfo', AsyncMock(return_value=[answer(address)])) as resolver:
                url, hostname = await news.pinned_destination('https://publisher.example/feed?q=1')
                self.assertEqual(url.host, address)
                self.assertEqual(hostname, 'publisher.example')
                self.assertEqual(url.path, '/feed')
                self.assertEqual(url.query, b'q=1')
                resolver.assert_awaited_once()

    async def test_dns_failure_and_timeout_rejected(self):
        for failure in [socket.gaierror(), asyncio.TimeoutError()]:
            with patch.object(asyncio.get_running_loop(), 'getaddrinfo', AsyncMock(side_effect=failure)):
                with self.assertRaisesRegex(ValueError, 'DNS unavailable'):
                    await news.pinned_destination('https://publisher.example/feed')

    async def test_unsafe_scheme_and_nonstandard_port_rejected_before_dns(self):
        with patch.object(asyncio.get_running_loop(), 'getaddrinfo', AsyncMock()) as resolver:
            for url in ['file:///etc/passwd', 'http://localhost/feed', 'https://publisher.example:8443/feed']:
                with self.assertRaises(ValueError):
                    await news.pinned_destination(url)
            resolver.assert_not_awaited()

    async def test_redirect_to_private_dns_never_connects(self):
        requests = []
        def respond(request):
            requests.append(request)
            return httpx.Response(302, headers={'location': 'https://internal.example/feed'})
        client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        resolver = AsyncMock(side_effect=[[answer('8.8.8.8')], [answer('10.0.0.1')]])
        with patch.object(news, 'cached', None), patch.object(news, 'lock', asyncio.Lock()), patch.object(news.settings, 'NEWS_FEEDS', 'https://publisher.example/feed|Fixture'), patch.object(asyncio.get_running_loop(), 'getaddrinfo', resolver), patch.object(news.httpx, 'AsyncClient', return_value=client):
            with self.assertRaises(news.ProviderError):
                await news.get_feed()
        self.assertEqual(len(requests), 1)
        self.assertEqual(requests[0].url.host, '8.8.8.8')
        self.assertEqual(requests[0].headers['host'], 'publisher.example')
        self.assertEqual(requests[0].extensions['sni_hostname'], 'publisher.example')
