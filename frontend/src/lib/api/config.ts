/** Public backend origin; API callers already supply /api paths. */
export function resolveApiOrigin(
  value: string | undefined,
  development: boolean,
  proxy: boolean,
  pageOrigin?: string,
) {
  if (!value?.trim()) {
    if (development) return "http://localhost:8000";
    if (proxy && pageOrigin) return new URL(pageOrigin).origin;
    return null;
  }
  const url = new URL(value.trim());
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["/", "/api", "/api/"].includes(url.pathname)
  )
    throw new Error("API configuration must be an HTTP(S) backend origin");
  return url.origin;
}
export function websocketOrigin(origin: string | null) {
  if (!origin) return "";
  const url = new URL(origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.origin;
}
