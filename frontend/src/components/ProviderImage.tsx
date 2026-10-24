import { useState } from "react";
import { safeImageUrl } from "@/lib/media";

export function ProviderImage({ url, alt }: { url?: string | null; alt: string }) {
  const src = safeImageUrl(url);
  return <ImageState key={src ?? "missing"} src={src} alt={alt} />;
}
function ImageState({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false),
    [loaded, setLoaded] = useState(false);
  return (
    <div
      className="relative aspect-[4/5] w-44 rounded-2xl overflow-hidden bg-muted/30 flex items-center justify-center"
      aria-busy={!!src && !failed && !loaded}
    >
      {!src || failed ? (
        <span
          role="img"
          aria-label={`${alt}: image unavailable`}
          className="text-xs text-muted-foreground text-center px-5"
        >
          Portrait unavailable
        </span>
      ) : (
        <>
          <span className="absolute text-xs text-muted-foreground" aria-hidden="true">
            {!loaded ? "Loading portrait…" : ""}
          </span>
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`relative w-full h-full object-contain transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        </>
      )}
    </div>
  );
}
