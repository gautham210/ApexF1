import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter } from "@tanstack/react-router";
import { MotionConfig } from "framer-motion";
import { AppSidebar, MobileNav } from "@/components/AppSidebar";
import { AppAvailability } from "@/components/AppAvailability";
import { AmbientBackdrop } from "@/components/AmbientBackdrop";
import { GlobalContextInit } from "@/components/GlobalContextInit";

import "../styles.css";

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

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl">Signal lost</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something interrupted the feed.</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded-full glass-strong px-5 py-2.5 text-sm transition hover:bg-foreground/10"
        >
          Reconnect
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <AppAvailability />
        <GlobalContextInit />
        <div className="min-h-screen">
          <AmbientBackdrop />
          <AppSidebar />
          <MobileNav />
          <main className="lg:pl-[84px]">
            <Outlet />
          </main>
        </div>
      </MotionConfig>
    </QueryClientProvider>
  );
}
