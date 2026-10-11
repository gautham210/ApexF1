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
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/calendar", label: "Calendar", icon: CalendarPlus },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[84px] flex-col items-center justify-between py-7 lg:flex">
      <Link to="/" className="flex flex-col items-center gap-1">
        <div className="grid h-10 w-10 place-items-center rounded-xl glass-strong">
          <span className="font-display text-xl leading-none">A</span>
        </div>
        <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground">F1</span>
      </Link>

      <nav className="glass rounded-full p-1.5 flex flex-col gap-0.5">
        {primary.map((item) => (
          <DockLink key={item.to} {...item} active={pathname === item.to} />
        ))}
      </nav>

      <nav className="glass-subtle rounded-full p-1.5 flex flex-col gap-0.5">
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
        "group relative grid place-items-center rounded-full transition-all duration-300",
        small ? "h-9 w-9" : "h-10 w-10",
        active
          ? "bg-foreground/10 text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-foreground/5",
      )}
      aria-label={label}
    >
      <Icon className={small ? "h-4 w-4" : "h-[17px] w-[17px]"} strokeWidth={1.5} />
      {active && (
        <span className="absolute -left-2 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-primary" />
      )}
      <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md glass-strong px-2.5 py-1 text-[11px] opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </Link>
  );
}

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Show Today, Sessions, Race Center, Standings, Profile
  const items = [...primary, ...secondary];
  return (
    <nav className="fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100vw-24px)] -translate-x-1/2 gap-1 overflow-x-auto rounded-full glass-strong p-1.5 lg:hidden">
      {items.map((item) => {
        const active = pathname === item.to;
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors",
              active ? "bg-foreground/10 text-foreground" : "text-muted-foreground",
            )}
            aria-label={item.label}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </Link>
        );
      })}
    </nav>
  );
}
