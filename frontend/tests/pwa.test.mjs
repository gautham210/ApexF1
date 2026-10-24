import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const manifest = JSON.parse(
  await readFile(new URL("../dist/manifest.webmanifest", import.meta.url), "utf8"),
);
const source = await readFile(new URL("../dist/sw.js", import.meta.url), "utf8");
test("production manifest has standalone installation, correct icons and deep links", async () => {
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.start_url, "/");
  for (const icon of manifest.icons) {
    const bytes = await readFile(new URL("../dist" + icon.src, import.meta.url));
    const size = Number(icon.sizes.split("x")[0]);
    assert.equal(bytes.readUInt32BE(16), size);
    assert.equal(bytes.readUInt32BE(20), size);
  }
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /manifest.webmanifest/);
  assert.match(html, /viewport-fit=cover/);
});
function worker(staticMatch) {
  const handlers = {};
  const deleted = [];
  const installed = [];
  let skipped = false;
  const cache = {
    addAll: async (files) => installed.push(...files),
    match:
      staticMatch ??
      (async (key) => (String(key).startsWith("/offline-shell-") ? "offline shell" : undefined)),
  };
  const self = {
    location: { origin: "https://fixture.test" },
    clients: { claim: async () => {} },
    addEventListener: (kind, fn) => (handlers[kind] = fn),
    skipWaiting: () => (skipped = true),
  };
  const caches = {
    open: async () => cache,
    keys: async () => ["apexf1-shell-old", "unrelated-app-cache"],
    delete: async (key) => deleted.push(key),
  };
  vm.runInNewContext(source, {
    self,
    caches,
    URL,
    Response,
    fetch: async () => {
      throw Error("offline");
    },
  });
  return { handlers, deleted, installed, skipped: () => skipped };
}
test("offline worker precaches shell, falls back on navigation, never caches provider API", async () => {
  const w = worker();
  let pending;
  w.handlers.install({ waitUntil: (p) => (pending = p) });
  await pending;
  assert.ok(w.installed.some((f) => f.startsWith("/offline-shell-")));
  assert.ok(w.installed.includes("/icons/app-512.png"));
  assert.ok(!w.installed.some((f) => /three\.module|GLTFLoader|OrbitControls/.test(f)));
  assert.ok(!w.installed.some((f) => f.startsWith("/api/")));
  let response;
  w.handlers.fetch({
    request: { method: "GET", url: "https://fixture.test/companion?view=times", mode: "navigate" },
    respondWith: (p) => (response = p),
  });
  assert.equal(await response, "offline shell");
  for (const url of [
    "https://fixture.test/api/live/snapshot",
    "https://provider.example/timing",
    "https://fixture.test/health",
  ]) {
    let intercepted = false;
    w.handlers.fetch({
      request: { method: "GET", url, mode: "cors" },
      respondWith: () => (intercepted = true),
    });
    assert.equal(intercepted, false);
  }
});
test("updates wait for consent and only delete this applications old caches", async () => {
  const w = worker();
  assert.equal(w.skipped(), false);
  w.handlers.message({ data: "ACTIVATE_UPDATE" });
  assert.equal(w.skipped(), true);
  let pending;
  w.handlers.activate({ waitUntil: (p) => (pending = p) });
  await pending;
  assert.deepEqual(w.deleted, ["apexf1-shell-old"]);
});

test("versioned offline shell references the exact cached build assets", async () => {
  const files = JSON.parse(source.match(/const FILES=(.*);/)[1]);
  const shell = files.find((f) => f.startsWith("/offline-shell-"));
  const html = await readFile(new URL("../dist" + shell, import.meta.url), "utf8");
  for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g))
    assert.ok(files.includes(match[1]), `Offline dependency missing: ${match[1]}`);
});

test("static assets use their precached path despite Origin variants and query strings", async () => {
  const file = JSON.parse(source.match(/const FILES=(.*);/)[1]).find((f) => f.endsWith(".js"));
  const w = worker(async (key, options) =>
    key === file && options?.ignoreVary === true ? "cached script" : undefined,
  );
  let response;
  w.handlers.fetch({
    request: {
      method: "GET",
      url: `https://fixture.test${file}?v=ignored`,
      mode: "cors",
      headers: { Origin: "https://fixture.test" },
    },
    respondWith: (p) => (response = p),
  });
  assert.equal(await response, "cached script");
});
