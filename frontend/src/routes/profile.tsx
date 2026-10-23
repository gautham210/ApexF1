import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Check, ArrowRight } from "lucide-react";
import heroHelmet from "@/assets/hero-helmet.jpg";
import heroGarage from "@/assets/hero-garage.jpg";
import heroCircuit from "@/assets/hero-circuit.jpg";
import { GlassPanel } from "@/components/GlassPanel";
import { usePreferences, TEAMS, type TeamKey } from "@/lib/preferences";
import { useSettingsStore } from "@/lib/store";
import { useSeason } from "@/components/SeasonData";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "ApexF1 — Profile" },
      { name: "description", content: "Personalize your cinematic Formula 1 companion." },
    ],
  }),
  component: ProfilePage,
});

const circuits = [
  { key: "spa", name: "Spa-Francorchamps", sub: "Belgian Ardennes" },
  { key: "monaco", name: "Monaco", sub: "Monte-Carlo" },
  { key: "suzuka", name: "Suzuka", sub: "Mie, Japan" },
  { key: "silverstone", name: "Silverstone", sub: "Northamptonshire" },
  { key: "monza", name: "Monza", sub: "Temple of Speed" },
  { key: "marina-bay", name: "Marina Bay", sub: "Singapore" },
];

function ProfilePage() {
  const year = useSettingsStore((s) => s.selectedYear);
  const roster = useSeason(year);
  const drivers = Object.values(roster.data?.drivers ?? {})
    .map((d) => ({
      name: `${d.givenName} ${d.familyName}`,
      team: Object.values(d.teams).join(" / "),
      color: "currentColor",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const [prefs, update] = usePreferences();
  const [step, setStep] = useState<"identity" | "driver" | "team" | "circuit" | "done">(
    prefs.onboarded ? "done" : "identity",
  );

  return (
    <div className="pb-32">
      <section className="relative h-[56vh] min-h-[420px] w-full overflow-hidden">
        <motion.img
          initial={{ scale: 1.05 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          src={heroHelmet}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-transparent" />
        <div className="relative z-10 mx-auto flex h-full max-w-[1200px] flex-col justify-end px-6 pb-14 lg:px-12">
          <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">
            YOUR APEX
          </div>
          <h1 className="mt-3 font-display text-6xl md:text-7xl">Who do you race with?</h1>
          <p className="mt-3 max-w-lg text-muted-foreground">
            Tell us how you follow the season. The app quietly adapts — never shouts.
          </p>
        </div>
      </section>

      <div className="mx-auto -mt-12 max-w-[1100px] px-6 lg:px-12">
        <AnimatePresence mode="wait">
          {step === "identity" && (
            <Step
              key="identity"
              onNext={() => setStep("driver")}
              title="A quiet introduction"
              subtitle="No account required. Choices stay on your device."
            >
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { k: "Lifelong", desc: "I’ve watched for years." },
                  { k: "New here", desc: "Drawn in by the documentary." },
                  { k: "Just curious", desc: "Show me the best of it." },
                ].map((c) => {
                  const selected = prefs.persona === c.k;
                  return (
                    <button
                      key={c.k}
                      type="button"
                      onClick={() => {
                        update({ persona: c.k });
                        setStep("driver");
                      }}
                      className={cn(
                        "rounded-2xl glass p-5 text-left transition hover:bg-foreground/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        selected && "ring-1 ring-primary bg-foreground/[0.04]",
                      )}
                    >
                      <div className="font-display text-2xl">{c.k}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{c.desc}</div>
                    </button>
                  );
                })}
              </div>
            </Step>
          )}

          {step === "driver" && (
            <Step
              key="driver"
              onNext={() => setStep("team")}
              title="Your driver"
              subtitle={`Choose from provider-recorded drivers in ${year}.`}
            >
              <p role="status" className="text-sm text-muted-foreground mb-4">
                {roster.isPending
                  ? "Loading season driver registry…"
                  : roster.isError
                    ? "Driver registry unavailable. Try again when the provider recovers."
                    : drivers.length
                      ? `${year} provider roster`
                      : "No driver entries available for this season."}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                {drivers.map((d) => {
                  const selected = prefs.driver === d.name;
                  return (
                    <button
                      key={d.name}
                      type="button"
                      onClick={() => update({ driver: d.name })}
                      className={cn(
                        "group relative aspect-[3/4] overflow-hidden rounded-2xl text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        selected && "ring-1 ring-primary",
                      )}
                    >
                      <img
                        src={heroHelmet}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover opacity-60 transition group-hover:opacity-80"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <div
                          className="font-mono text-[9px] uppercase tracking-wider font-bold"
                          style={{ color: d.color }}
                        >
                          {d.team}
                        </div>
                        <div className="font-display text-xl leading-tight mt-0.5">{d.name}</div>
                      </div>
                      {selected && (
                        <div className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </Step>
          )}

          {step === "team" && (
            <Step
              key="team"
              onNext={() => setStep("circuit")}
              title="Your color palette"
              subtitle="A whisper of your colors appears across the app."
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(Object.keys(TEAMS) as TeamKey[]).map((k) => {
                  const t = TEAMS[k];
                  const selected = prefs.team === k;
                  return (
                    <button
                      key={k}
                      onClick={() => update({ team: k })}
                      className={cn(
                        "group relative flex items-center gap-4 overflow-hidden rounded-2xl glass p-5 text-left transition hover:bg-foreground/[0.05]",
                        selected && "ring-1 ring-foreground/20",
                      )}
                    >
                      <span
                        className="h-12 w-[3px] rounded-full"
                        style={{ background: t.accent }}
                      />
                      <div className="flex-1">
                        <div className="font-display text-2xl">{t.name}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground capitalize">
                          {t.warmth} palette
                        </div>
                      </div>
                      {selected && <Check className="h-4 w-4 text-foreground/70" />}
                    </button>
                  );
                })}
              </div>
            </Step>
          )}

          {step === "circuit" && (
            <Step
              key="circuit"
              onNext={() => {
                update({ onboarded: true });
                setStep("done");
              }}
              title="A circuit you love"
              subtitle="Save a circuit preference on this device."
              finalLabel="Enter ApexF1"
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {circuits.map((c) => {
                  const selected = prefs.circuit === c.key;
                  return (
                    <button
                      key={c.key}
                      onClick={() => update({ circuit: c.key })}
                      className={cn(
                        "group relative aspect-[5/3] overflow-hidden rounded-2xl text-left transition",
                        selected && "ring-1 ring-primary",
                      )}
                    >
                      <img
                        src={c.key === "spa" ? heroCircuit : heroGarage}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover opacity-60 transition group-hover:opacity-80"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <div className="font-display text-2xl">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.sub}</div>
                      </div>
                      {selected && (
                        <div className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </Step>
          )}

          {step === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <GlassPanel variant="strong" className="grid gap-8 p-8 lg:grid-cols-3">
                <ProfileFact label="Driver" value={prefs.driver ?? "—"} />
                <ProfileFact
                  label="Palette"
                  value={prefs.team ? TEAMS[prefs.team].name : "—"}
                  accent={prefs.team ? TEAMS[prefs.team].accent : undefined}
                />
                <ProfileFact
                  label="Circuit"
                  value={prefs.circuit ? prefs.circuit.toUpperCase() : "—"}
                />
              </GlassPanel>

              {/* Premium Notification Settings */}
              <GlassPanel variant="strong" className="p-8 space-y-6">
                <div>
                  <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">
                    ALERT CHANNELS
                  </div>
                  <h3 className="mt-2 font-display text-3xl">Paddock Notifications</h3>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Preferences stay on this device. Push delivery is not connected.
                  </p>
                </div>
                <div className="space-y-4 pt-2">
                  {[
                    {
                      key: "qualifying",
                      label: "Qualifying Alerts",
                      desc: "Save a preference for qualifying updates; delivery unavailable.",
                    },
                    {
                      key: "formationLap",
                      label: "Race Reminders",
                      desc: "Save a race reminder preference; background delivery unavailable.",
                    },
                    {
                      key: "weather",
                      label: "Weather Warnings",
                      desc: "Save a weather-alert preference; delivery unavailable.",
                    },
                    {
                      key: "replay",
                      label: "Constructor Updates",
                      desc: "Constructors and standings shift notifications.",
                    },
                  ].map((notif) => {
                    const active =
                      prefs.notifications[notif.key as keyof typeof prefs.notifications] ?? false;
                    return (
                      <div
                        key={notif.key}
                        className="flex items-center justify-between gap-4 p-4 bg-white/[0.01] border border-border/40 rounded-xl hover:bg-white/[0.02] transition"
                      >
                        <div>
                          <div className="text-sm font-bold text-foreground">{notif.label}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {notif.desc}
                          </div>
                        </div>
                        <button
                          role="switch"
                          aria-checked={active}
                          aria-label={notif.label}
                          onClick={() => {
                            update({
                              notifications: {
                                ...prefs.notifications,
                                [notif.key]: !active,
                              },
                            });
                          }}
                          className={cn(
                            "h-5 w-10 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer",
                            active ? "bg-primary" : "bg-white/10",
                          )}
                        >
                          <span
                            className={cn(
                              "h-4 w-4 rounded-full bg-background shadow-md transition-transform",
                              active ? "translate-x-5" : "translate-x-0",
                            )}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </GlassPanel>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setStep("driver")}
                  className="rounded-full glass px-5 py-2.5 text-sm transition hover:bg-foreground/10 cursor-pointer"
                >
                  Edit preferences
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem("apexf1.prefs.v1");
                    window.location.reload();
                  }}
                  className="rounded-full px-5 py-2.5 text-sm text-muted-foreground transition hover:text-foreground cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Step({
  title,
  subtitle,
  children,
  onNext,
  finalLabel,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onNext: () => void;
  finalLabel?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-8"
    >
      <GlassPanel variant="strong" className="p-8">
        <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">STEP</div>
        <h2 className="mt-2 font-display text-4xl">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        <div className="mt-8">{children}</div>
        <div className="mt-8 flex items-center justify-end">
          <button
            onClick={onNext}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm text-background transition hover:bg-foreground/90"
          >
            {finalLabel ?? "Continue"} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </GlassPanel>
    </motion.div>
  );
}

function ProfileFact({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="relative">
      {accent && (
        <span
          className="absolute -left-4 top-0 h-full w-[2px] rounded-full"
          style={{ background: accent }}
        />
      )}
      <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">
        {label.toUpperCase()}
      </div>
      <div className="mt-2 font-display text-3xl">{value}</div>
    </div>
  );
}
