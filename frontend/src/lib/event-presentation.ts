import type { ScheduleEvent } from "./store";

export interface EventPresentation {
  displayName: string;
  cleanVenue: string;
  cleanCountry: string;
  cleanCircuit: string | null;
  hasConflict: boolean;
  conflictBadge: string | null;
  conflictDetail: string | null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Derive clean, non-contaminated UI presentation fields for a ScheduleEvent,
 * turning raw backend conflict markers into structured provider attribution.
 */
export function presentEvent(event: ScheduleEvent | null | undefined): EventPresentation {
  if (!event) {
    return {
      displayName: "Grand Prix",
      cleanVenue: "",
      cleanCountry: "",
      cleanCircuit: null,
      hasConflict: false,
      conflictBadge: null,
      conflictDetail: null,
    };
  }

  const rawName = (event.event_name || "").replace(/\s*\[Provider Conflict\]\s*/gi, "").trim();
  const rawLocation = (event.location || "").replace(/^Disputed\s*\((.+)\)$/i, "$1").trim();

  if (!event.has_conflict) {
    return {
      displayName: rawName || "Grand Prix",
      cleanVenue: rawLocation || event.country || "",
      cleanCountry: event.country || "",
      cleanCircuit: event.circuit_name || null,
      hasConflict: false,
      conflictBadge: null,
      conflictDetail: null,
    };
  }

  const fastf1 = (event.conflict?.fastf1 ?? {}) as Record<string, unknown>;
  const jolpica = (event.conflict?.jolpica ?? {}) as Record<string, unknown>;
  const f1Country = asString(fastf1.country);
  const jCountry = asString(jolpica.country);
  const f1Loc = asString(fastf1.location);
  const jLoc = asString(jolpica.location);
  const jCircuit = asString(jolpica.circuit_name);
  const f1Name = asString(fastf1.event_name);
  const jName = asString(jolpica.event_name);

  // Use agreed locality/venue cleanly instead of leaking compound disagreement strings
  const agreedVenue =
    f1Loc && jLoc && f1Loc.toLowerCase() === jLoc.toLowerCase()
      ? f1Loc
      : !event.location.toLowerCase().startsWith("disputed") && event.location
        ? event.location
        : f1Loc || jLoc;

  const countryLabel =
    jCountry && f1Country && jCountry.toLowerCase() !== f1Country.toLowerCase()
      ? `${jCountry} / ${f1Country}`
      : event.country;

  const conflictBadge =
    f1Country && jCountry && f1Country !== jCountry
      ? `Provider note: ${f1Country} (FastF1) vs ${jCountry} (Jolpica)`
      : "Provider metadata differs";

  const conflictDetail =
    typeof event.conflict?.description === "string" && event.conflict.description.trim()
      ? event.conflict.description.trim()
      : `FastF1 lists '${f1Name || rawName}' (${f1Country}, ${f1Loc || agreedVenue}); Jolpica lists '${jName || rawName}' (${jCountry}, ${jCircuit || jLoc}).`;

  return {
    displayName: rawName || f1Name || "Grand Prix",
    cleanVenue: agreedVenue || rawLocation || "",
    cleanCountry: countryLabel,
    cleanCircuit: event.circuit_name || jCircuit || null,
    hasConflict: true,
    conflictBadge,
    conflictDetail,
  };
}
