import type { Plugin } from "vite";
import { createHash } from "node:crypto";
export function companionPwa(): Plugin {
  return {
    name: "apexf1-offline-shell",
    transformIndexHtml(html) {
      return html
        .replace(
          'content="width=device-width, initial-scale=1.0"',
          'content="width=device-width, initial-scale=1.0, viewport-fit=cover"',
        )
        .replace(
          "</head>",
          '<link rel="manifest" href="/manifest.webmanifest"/><link rel="apple-touch-icon" href="/icons/app-192.png"/></head>',
        );
    },
    generateBundle: {
      order: "post",
      handler(_, bundle) {
        const files = Object.keys(bundle)
          .filter((f) => !/^assets\/(three\.module|GLTFLoader|OrbitControls)-/.test(f))
          .filter((f) => /\.(js|css|jpg|png|svg|woff2?)$/.test(f) || f === "index.html");
        const html = bundle["index.html"];
        if (!html || html.type !== "asset") this.error("Final HTML missing from PWA bundle");
        const version = createHash("sha256")
          .update(JSON.stringify(bundle))
          .digest("hex")
          .slice(0, 12);
        const shell = `/offline-shell-${version}.html`;
        this.emitFile({ type: "asset", fileName: shell.slice(1), source: html.source });
        const source = `const CACHE='apexf1-shell-${version}';
const SHELL=${JSON.stringify(shell)};
const FILES=${JSON.stringify(files.map((f) => "/" + f).concat([shell, "/manifest.webmanifest", "/icons/app-192.png", "/icons/app-512.png"]))};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('apexf1-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname==='/health')return;
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(c=>c.match(SHELL)).then(r=>r||Response.error())));return;
 }
 if(FILES.includes(url.pathname))event.respondWith(caches.open(CACHE).then(c=>c.match(url.pathname,{ignoreVary:true,ignoreSearch:true})).then(r=>r||fetch(event.request)));
});`;
        this.emitFile({ type: "asset", fileName: "sw.js", source });
      },
    },
  };
}
