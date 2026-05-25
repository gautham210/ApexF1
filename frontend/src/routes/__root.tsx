import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { AppSidebar, MobileNav } from "@/components/AppSidebar";
import { AmbientBackdrop } from "@/components/AmbientBackdrop";
import { GlobalContextInit } from "@/components/GlobalContextInit";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-8xl text-foreground">404</h1>
        <p className="mt-4 text-sm text-muted-foreground">This page is off the racing line.</p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center rounded-full glass-strong px-5 py-2.5 text-sm transition hover:bg-foreground/10"
        >
          Return to paddock
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl">Signal lost</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something interrupted the feed.</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-full glass-strong px-5 py-2.5 text-sm transition hover:bg-foreground/10"
        >
          Reconnect
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ApexF1 — A cinematic Formula 1 companion" },
      { name: "description", content: "ApexF1 is a premium, cinematic companion for the Formula 1 season — schedules, sessions, standings and race weekends." },
      { name: "theme-color", content: "#1a1a1c" },
      { property: "og:title", content: "ApexF1" },
      { property: "og:description", content: "A cinematic companion for the Formula 1 season." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <GlobalContextInit />
      <div className="min-h-screen">
        <AmbientBackdrop />
        <AppSidebar />
        <MobileNav />
        <main className="lg:pl-[84px]">
          <Outlet />
        </main>
      </div>
    </QueryClientProvider>
  );
}
