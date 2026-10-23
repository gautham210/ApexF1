import { useEffect, useState } from "react";
export function AppAvailability() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [waiting, setWaiting] = useState<ServiceWorkerRegistration | null>(null);
  const [failure, setFailure] = useState(false);
  useEffect(() => {
    let probe: AbortController | null = null;
    const check = async () => {
      probe?.abort();
      probe = new AbortController();
      const current = probe;
      const timeout = setTimeout(() => current.abort(), 4000);
      try {
        await fetch("/health", { cache: "no-store", signal: current.signal });
        if (!disposed) setOffline(false);
      } catch {
        if (!disposed) setOffline(true);
      } finally {
        clearTimeout(timeout);
      }
    };
    const online = () => {
      setOffline(!navigator.onLine);
      if (navigator.onLine) void check();
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    let disposed = false;
    let stopWatching = () => {};
    void check();
    const healthTimer = setInterval(() => void check(), 30000);
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => {
          if (disposed) return;
          let installing: ServiceWorker | null = null;
          const check = () => {
            if (!disposed && reg.waiting) setWaiting(reg);
          };
          const watch = () => {
            installing?.removeEventListener("statechange", check);
            installing = reg.installing;
            installing?.addEventListener("statechange", check);
          };
          check();
          watch();
          reg.addEventListener("updatefound", watch);
          stopWatching = () => {
            reg.removeEventListener("updatefound", watch);
            installing?.removeEventListener("statechange", check);
          };
        })
        .catch(() => {
          if (!disposed) setFailure(true);
        });
    }
    return () => {
      disposed = true;
      stopWatching();
      clearInterval(healthTimer);
      probe?.abort();
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
    };
  }, []);
  return (
    <>
      {(offline || waiting || failure) && (
        <div
          role="status"
          className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-3 bg-background border-b border-border px-5 py-3 text-sm"
        >
          {offline && (
            <span>
              Offline — saved interface only. Previously loaded data may be stale; live timing is
              unavailable.
            </span>
          )}
          {failure && <span>Offline installation unavailable. Online browsing still works.</span>}
          {waiting && (
            <button
              className="underline min-h-11"
              onClick={() => {
                const reload = () => window.location.reload();
                navigator.serviceWorker.addEventListener("controllerchange", reload, {
                  once: true,
                });
                waiting.waiting?.postMessage("ACTIVATE_UPDATE");
              }}
            >
              Update ready — reload app
            </button>
          )}
        </div>
      )}
    </>
  );
}
