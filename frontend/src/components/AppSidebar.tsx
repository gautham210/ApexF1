import { useState, useEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid,
  CalendarRange,
  Radio,
  Trophy,
  User,
  Bell,
  CalendarPlus,
  Film,
  Newspaper,
  MoreHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const primary = [
  { to: "/", label: "Today", icon: LayoutGrid },
  { to: "/sessions", label: "Sessions", icon: CalendarRange },
  { to: "/race-center", label: "Race Center", icon: Radio },
  { to: "/replay", label: "Replays", icon: Film },
  { to: "/standings", label: "Standings", icon: Trophy },
  { to: "/news", label: "News", icon: Newspaper },
] as const;

const secondary = [
  { to: "/companion", label: "Companion tools", icon: LayoutGrid },
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/calendar", label: "Calendar", icon: CalendarPlus },
  { to: "/profile", label: "Profile", icon: User },
] as const;

// 4 high-frequency destinations for mobile dock
const mobilePrimary = [
  { to: "/", label: "Today", icon: LayoutGrid },
  { to: "/sessions", label: "Sessions", icon: CalendarRange },
  { to: "/race-center", label: "Race Center", icon: Radio },
  { to: "/standings", label: "Standings", icon: Trophy },
] as const;

// Overflow destinations presented in the accessible More sheet
const mobileOverflow = [
  { to: "/companion", label: "Companion tools", icon: LayoutGrid },
  { to: "/replay", label: "Replays", icon: Film },
  { to: "/news", label: "News", icon: Newspaper },
  { to: "/calendar", label: "Calendar", icon: CalendarPlus },
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="desktop-navigation fixed left-0 top-0 z-40 hidden h-dvh w-[208px] flex-col items-stretch gap-6 overflow-y-auto border-r border-border bg-background/95 px-4 py-6 lg:flex">
      <Link to="/" className="flex flex-col items-center gap-1">
        <div className="grid h-10 w-10 place-items-center rounded-xl glass-strong">
          <span className="font-display text-xl leading-none">A</span>
        </div>
        <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground">F1</span>
      </Link>

      <nav aria-label="Primary navigation" className="flex flex-col gap-1">
        {primary.map((item) => (
          <DockLink key={item.to} {...item} active={pathname === item.to} />
        ))}
      </nav>

      <nav
        aria-label="Tools and preferences"
        className="mt-auto border-t border-border pt-4 flex flex-col gap-1"
      >
        {secondary.map((item) => (
          <DockLink key={item.to} {...item} active={pathname === item.to} small />
        ))}
      </nav>
    </aside>
  );
}

function DockLink({
  to,
  label,
  icon: Icon,
  active,
  small,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  active: boolean;
  small?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 transition-colors duration-150",
        small ? "min-h-11 w-full" : "min-h-11 w-full",
        active
          ? "bg-foreground/10 text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-foreground/5",
      )}
      aria-label={label}
      aria-current={active ? "page" : undefined}
    >
      <Icon className={small ? "h-4 w-4" : "h-[17px] w-[17px]"} strokeWidth={1.5} />
      {active && (
        <span className="absolute -left-2 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-primary" />
      )}
      <span className="text-sm whitespace-nowrap">{label}</span>
    </Link>
  );
}

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!moreOpen) return;
    const panel = dialog.current;
    const opener = trigger.current;
    if (!panel) return;
    const focusable = () =>
      Array.from(panel.querySelectorAll<HTMLElement>("a[href],button:not([disabled])"));
    focusable()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMoreOpen(false);
        return;
      }
      if (e.key === "Tab") {
        const items = focusable();
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    panel.addEventListener("keydown", key);
    return () => {
      panel.removeEventListener("keydown", key);
      opener?.focus();
    };
  }, [moreOpen]);

  // Close sheet on route transition
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const isOverflowActive = mobileOverflow.some((item) => pathname === item.to);

  return (
    <>
      {/* Backdrop for More sheet */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMoreOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* More Overflow Menu Sheet */}
      {moreOpen && (
        <div
          ref={dialog}
          role="dialog"
          aria-modal="true"
          aria-label="Additional navigation destinations"
          className="fixed bottom-20 left-1/2 z-50 w-[calc(100vw-32px)] max-w-xs -translate-x-1/2 rounded-3xl glass-strong p-4 border border-border/40 shadow-2xl lg:hidden animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="flex items-center justify-between border-b border-border/30 pb-3 mb-2 px-1">
            <span className="text-[10px] font-mono font-bold tracking-widest text-muted-foreground uppercase">
              More Features
            </span>
            <button
              onClick={() => setMoreOpen(false)}
              className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/10"
              aria-label="Close more menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {mobileOverflow.map((item) => {
              const active = pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex min-h-11 items-center gap-2.5 px-3 py-2.5 rounded-2xl text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                    active
                      ? "bg-foreground/10 text-foreground font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-foreground/5",
                  )}
                  onClick={() => setMoreOpen(false)}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Fixed bottom navigation pill */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-full glass-strong p-1.5 border border-border/40 shadow-2xl lg:hidden"
      >
        {mobilePrimary.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-label={item.label}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </Link>
          );
        })}

        {/* More trigger button */}
        <button
          onClick={() => setMoreOpen((v) => !v)}
          className={cn(
            "relative grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            moreOpen || isOverflowActive
              ? "bg-foreground/10 text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          ref={trigger}
          aria-label="More navigation destinations"
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
        >
          <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={1.5} />
          {isOverflowActive && !moreOpen && (
            <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </button>
      </nav>
    </>
  );
}
