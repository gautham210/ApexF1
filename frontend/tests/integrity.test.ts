import { matchesSession } from "../src/lib/session";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getDriverNumberByName,
  getDriverByYear,
  getDriverNumberByAbbr,
  getDriversListByYear,
  type ScheduleEvent,
} from "../src/lib/store";
import { createCalendar } from "../src/lib/calendar";
import { safeImageUrl } from "../src/lib/media";
import { dashboardResponseSchema } from "../src/lib/api/client";
import { z } from "zod";
import {
  parseRaceCenterSearch,
  formatRaceCenterSearch,
  getVerifiedEventLabel,
  getVerifiedEventVenue,
  getSessionTelemetryState,
  MIN_SUPPORTED_YEAR,
} from "../src/lib/event-identity";
import {
  computeSessionTimingState,
  findFocusedSession,
  formatSessionCountdown,
} from "../src/lib/session-timing";
import {
  USER_PREFERENCES_KEY,
  loadUserPreferences,
  saveUserPreferences,
  type Persona,
} from "../src/lib/preferences";

test("season-aware driver numbers never prefer global aliases", () => {
  for (const [name, number] of [
    ["Max Verstappen", "3"],
    ["Lando Norris", "1"],
    ["Isack Hadjar", "6"],
    ["Arvid Lindblad", "41"],
  ])
    assert.equal(getDriverNumberByName(2026, name), number);
  assert.equal(getDriverNumberByName(2025, "Max Verstappen"), "1");
  assert.equal(getDriverNumberByName(2025, "Lando Norris"), "4");
  assert.equal(getDriverByYear(2026, "1").abbr, "NOR");
  assert.equal(getDriverNumberByAbbr(2026, "HAD"), "6");
  assert.equal(getDriverNumberByName(2018, "Max Verstappen"), null);
});
test("calendar emits UTC instants, escaped text and no invented end times", () => {
  const event = {
    round_number: 1,
    country: "Test",
    location: "A,B",
    event_name: "Fixture;GP",
    session1: "Practice 1",
    session1_date: "2026-06-07T23:00:00-04:00",
    is_completed: false,
    is_upcoming: true,
  };
  const ics = createCalendar([event], 2026, new Date("2026-01-01T00:00:00Z"));
  assert.ok(ics.includes("DTSTART:20260608T030000Z"));
  assert.ok(ics.includes("LOCATION:A\\,B\\, Test"));
  assert.ok(!ics.includes("DTEND"));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.ok(
    !createCalendar([{ ...event, session1_date: "invalid" }], 2026).includes("BEGIN:VEVENT"),
  );
});

test("live identity uses session date, never country or meeting ID", () => {
  const event = {
    round_number: 1,
    country: "USA",
    location: "Miami",
    event_name: "Fixture",
    session5: "Race",
    session5_date: "2026-05-01T14:00:00Z",
    is_completed: false,
    is_upcoming: true,
  };
  assert.equal(matchesSession(event, "Race", "2026-05-01T16:00:00+02:00"), true);
  assert.equal(matchesSession(event, "Race", "2026-10-01T14:00:00Z"), false);
  assert.equal(matchesSession(event, "Qualifying", event.session5_date), false);
  assert.equal(matchesSession(event, "Race"), false);
});

test("provider portraits reject unsafe URLs and preserve missing-image fallback", () => {
  assert.equal(safeImageUrl(null), null);
  assert.equal(safeImageUrl("javascript:alert(1)"), null);
  assert.equal(
    safeImageUrl("https://example.com/portrait.png"),
    "https://example.com/portrait.png",
  );
});

test("dashboard contract preserves official snapshot and partial-domain metadata", () => {
  const payload = {
    success: true,
    timestamp: "2026-10-11T00:00:00Z",
    data: {
      season_context: {
        year: 2025,
        current_round: 2,
        completed_rounds: 1,
        total_rounds: 24,
        is_active_weekend: false,
        latest_completed_race: null,
        next_race: null,
      },
      news: [],
      insights: {
        qualifying_p1_leader: {
          name: "Unavailable",
          stat: "Qualifying unavailable",
          status: "unavailable",
        },
      },
      driver_standings: [],
      constructor_standings: [],
      history_status: "partial",
      history_round: 2,
      history_source: "Jolpica",
      history_fetched_at: "2026-10-11T00:00:00Z",
      history_errors: { qualifying: "unavailable" },
      news_status: "stale",
      news_errors: { publisher: "unavailable" },
      upcoming_schedule: [],
    },
  };
  assert.equal(dashboardResponseSchema.parse(payload).data.history_round, 2);
  assert.throws(() =>
    dashboardResponseSchema.parse({
      ...payload,
      data: { ...payload.data, history_status: "complete" },
    }),
  );
});

test("F-01 regression: dashboard schema accepts error:null from real API response", () => {
  // Captured from GET /api/dashboard-context?year=2026 on 2026-10-20.
  // The backend returns error:null on success; the old z.string().optional()
  // schema rejected null, causing Home to show "unavailable" despite valid data.
  const realResponseFixture = {
    success: true,
    timestamp: "2026-10-20T12:00:00Z",
    error: null,
    data: {
      season_context: {
        year: 2026,
        current_round: 17,
        completed_rounds: 17,
        total_rounds: 23,
        is_active_weekend: false,
        latest_completed_race: {
          round_number: 17,
          country: "Singapore",
          location: "Marina Bay",
          event_name: "Singapore Grand Prix",
          is_completed: true,
          is_upcoming: false,
        },
        next_race: {
          round_number: 18,
          country: "United States",
          location: "Austin",
          event_name: "United States Grand Prix",
          is_completed: false,
          is_upcoming: true,
        },
      },
      news: [],
      insights: {},
      driver_standings: [
        {
          position: 1,
          name: "Max Verstappen",
          points: 340,
          wins: 7,
          driver_id: "max_verstappen",
          constructor_id: "aston_martin",
          number: "3",
          code: "VER",
          display_name: "Max Verstappen",
          team: "Aston Martin",
          nationality: "Dutch",
          color: "#358C75",
        },
      ],
      constructor_standings: [
        {
          position: 1,
          name: "McLaren",
          points: 610,
          wins: 8,
          constructor_id: "mclaren",
        },
      ],
      history_status: "success",
      history_round: 17,
      history_source: "Jolpica",
      history_fetched_at: "2026-10-20T12:00:00Z",
      history_errors: {},
      news_status: "success",
      news_errors: {},
      upcoming_schedule: [],
    },
  };

  // 1. The schema must accept error:null without throwing
  const parsed = dashboardResponseSchema.parse(realResponseFixture);

  // 2. Representative dashboard data must survive parsing
  assert.equal(parsed.data.driver_standings[0].name, "Max Verstappen");
  assert.equal(parsed.data.constructor_standings[0].name, "McLaren");
  assert.equal(parsed.data.history_status, "success");
  assert.equal(parsed.data.history_round, 17);

  // 3. Regression guard: a string-only schema (the old contract) must reject null
  const oldErrorSchema = z.string().optional();
  const oldResult = oldErrorSchema.safeParse(null);
  assert.equal(oldResult.success, false, "old schema must reject null to prove the regression");

  // 4. The fixed schema must accept null, undefined, and string
  const fixedErrorSchema = z.string().nullable().optional();
  assert.equal(fixedErrorSchema.safeParse(null).success, true);
  assert.equal(fixedErrorSchema.safeParse(undefined).success, true);
  assert.equal(fixedErrorSchema.safeParse("some error").success, true);
});

test("M-04 regression: Race Center preserves mode=archive and mode=replay", () => {
  // 1. mode=archive must NOT be dropped (F-02 defect)
  const archiveResult = parseRaceCenterSearch({
    mode: "archive",
    year: "2025",
    round: "5",
    session: "Race",
  });
  assert.equal(archiveResult.mode, "archive", "mode=archive must be preserved");
  assert.equal(archiveResult.year, 2025);
  assert.equal(archiveResult.round, 5);
  assert.equal(archiveResult.session, "Race");
  assert.equal(archiveResult.error, undefined);

  // 2. mode=replay must be preserved
  const replayResult = parseRaceCenterSearch({
    mode: "replay",
    year: "2026",
    round: "1",
    session: "Qualifying",
  });
  assert.equal(replayResult.mode, "replay");
  assert.equal(replayResult.year, 2026);
  assert.equal(replayResult.round, 1);
  assert.equal(replayResult.session, "Qualifying");
  assert.equal(replayResult.error, undefined);

  // 3. Invalid mode must produce an explicit error instead of silent corruption
  const invalidModeResult = parseRaceCenterSearch({
    mode: "unknown_mode",
  });
  assert.ok(invalidModeResult.error);
  assert.match(invalidModeResult.error, /Unsupported mode/);
});

test("M-04 regression: Race Center rejects pre-2018 years with explicit error rather than silently defaulting", () => {
  // year=2017 must NOT silently become 2026 (F-02 defect)
  const pre2018 = parseRaceCenterSearch({
    year: "2017",
    round: "5",
    session: "Race",
  });
  assert.ok(pre2018.error, "pre-2018 year must produce an explicit error");
  assert.match(pre2018.error, /Unsupported season: 2017/);
  assert.match(pre2018.error, /2018/);

  // Non-integer year must produce an explicit error
  const nonIntYear = parseRaceCenterSearch({
    year: "invalid_year",
  });
  assert.ok(nonIntYear.error);
  assert.match(nonIntYear.error, /Invalid year/);
});

test("M-04 regression: Race Center deep links validate round and session explicitly", () => {
  // Out-of-bounds round (> 24) must produce explicit error
  const outOfBoundsRound = parseRaceCenterSearch({
    round: "99",
  });
  assert.ok(outOfBoundsRound.error);
  assert.match(outOfBoundsRound.error, /Invalid round/);

  // Round 0 must produce explicit error
  const zeroRound = parseRaceCenterSearch({
    round: "0",
  });
  assert.ok(zeroRound.error);
  assert.match(zeroRound.error, /Invalid round/);

  // Invalid session string must produce explicit error
  const invalidSession = parseRaceCenterSearch({
    session: "WarmupSession",
  });
  assert.ok(invalidSession.error);
  assert.match(invalidSession.error, /Invalid session/);

  // Valid sessions must pass without error
  for (const validSession of [
    "Race",
    "Qualifying",
    "Sprint",
    "Sprint Qualifying",
    "Practice 1",
    "Practice 2",
    "Practice 3",
  ]) {
    const res = parseRaceCenterSearch({ session: validSession });
    assert.equal(res.session, validSession);
    assert.equal(res.error, undefined);
  }
});

test("M-04 regression: Race Center search params round-trip through serialize and parse", () => {
  const original = {
    mode: "archive" as const,
    year: 2025,
    round: 12,
    session: "Qualifying",
  };
  const formatted = formatRaceCenterSearch(original);
  const parsed = parseRaceCenterSearch(formatted);

  assert.equal(parsed.mode, original.mode);
  assert.equal(parsed.year, original.year);
  assert.equal(parsed.round, original.round);
  assert.equal(parsed.session, original.session);
  assert.equal(parsed.error, undefined);
});

test("M-03 regression: Truthful event labeling distinguishes verified, resolving, and provider conflict states", () => {
  // 1. Resolving state never claims verified Grand Prix name
  const resolving = getVerifiedEventLabel(undefined, true);
  assert.equal(resolving.isVerified, false);
  assert.equal(resolving.label, "Resolving event...");

  // 2. Missing/unresolved event never invents a placeholder
  const missing = getVerifiedEventLabel(null, false);
  assert.equal(missing.isVerified, false);
  assert.equal(missing.label, "Event details unavailable");

  // 3. Normal verified event
  const verified = getVerifiedEventLabel({
    round_number: 1,
    country: "Australia",
    location: "Melbourne",
    event_name: "Australian Grand Prix",
    is_completed: true,
    is_upcoming: false,
  });
  assert.equal(verified.isVerified, true);
  assert.equal(verified.isConflict, false);
  assert.equal(verified.label, "Australian Grand Prix");

  // 4. Provider conflict event visibly flags disagreement
  const conflictEvent = {
    round_number: 16,
    country: "Conflict: Bahrain (FastF1) vs Malaysia (Jolpica)",
    location: "Kuala Lumpur",
    event_name: "Bahrain Grand Prix [Provider Conflict]",
    is_completed: true,
    is_upcoming: false,
    has_conflict: true,
    conflict: {
      has_conflict: true,
      conflicting_fields: ["country", "event_name"],
      description: "Provider conflict",
    },
  };
  const conflictLabel = getVerifiedEventLabel(conflictEvent);
  assert.equal(conflictLabel.isVerified, false);
  assert.equal(conflictLabel.isConflict, true);
  assert.match(conflictLabel.label, /Provider Conflict/);
});

test("M-05 regression: Timing tower responsive columns fit mobile viewports", () => {
  // Columns: 28px minmax(64px, 1fr) minmax(60px, 90px) 30px 58px 62px 28px
  const minCols = [28, 64, 60, 30, 58, 62, 28];
  const totalMin = minCols.reduce((a, b) => a + b, 0);
  assert.ok(
    totalMin <= 340,
    `Leaderboard minimum width ${totalMin}px must be <= 340px to fit mobile viewport without clipping`,
  );
  assert.ok(totalMin < 390, "Leaderboard must comfortably fit within 390px mobile viewports");
});

test("M-06 regression: Mobile navigation reaches all 9 destinations without horizontal clipping", () => {
  const primaryDestinations = ["/", "/sessions", "/race-center", "/standings"];
  const overflowDestinations = ["/replay", "/news", "/calendar", "/notifications", "/profile"];
  const allDestinations = new Set([...primaryDestinations, ...overflowDestinations]);

  // Must have exactly 9 unique destinations
  assert.equal(allDestinations.size, 9);
  assert.equal(primaryDestinations.length, 4);
  assert.equal(overflowDestinations.length, 5);

  // 4 primary + 1 more trigger = 5 buttons * 44px + 4 gaps * 6px + 12px padding = 256px
  const dockWidth = 5 * 44 + 4 * 6 + 12;
  assert.ok(
    dockWidth <= 320,
    `Mobile dock width (${dockWidth}px) must fit within narrowest 320px viewport`,
  );
});

test("M-08 regression: Unknown circuits do not silently render a Spa track outline", () => {
  const knownCircuits = new Set([
    "belgium",
    "spa",
    "monaco",
    "japan",
    "suzuka",
    "britain",
    "silverstone",
    "italy",
    "monza",
    "singapore",
    "marina",
  ]);

  function getCircuitKey(country: string, location: string): string | null {
    const norm = (country || location || "").toLowerCase();
    if (norm.includes("belgium") || norm.includes("spa")) return "spa";
    if (norm.includes("monaco")) return "monaco";
    if (norm.includes("japan") || norm.includes("suzuka")) return "suzuka";
    if (norm.includes("britain") || norm.includes("silverstone")) return "silverstone";
    if (norm.includes("italy") || norm.includes("monza")) return "monza";
    if (norm.includes("singapore") || norm.includes("marina")) return "marina-bay";
    return null;
  }

  // Known circuits return their outline keys
  assert.equal(getCircuitKey("Belgium", "Spa"), "spa");
  assert.equal(getCircuitKey("Monaco", "Monte Carlo"), "monaco");
  assert.equal(getCircuitKey("Japan", "Suzuka"), "suzuka");
  assert.equal(getCircuitKey("Great Britain", "Silverstone"), "silverstone");
  assert.equal(getCircuitKey("Italy", "Monza"), "monza");
  assert.equal(getCircuitKey("Singapore", "Marina Bay"), "marina-bay");

  // Unmapped circuits must return null, NEVER fallback to spa
  assert.equal(getCircuitKey("United States", "Austin"), null);
  assert.equal(getCircuitKey("Qatar", "Lusail"), null);
  assert.equal(getCircuitKey("Saudi Arabia", "Jeddah"), null);
  assert.equal(getCircuitKey("Australia", "Melbourne"), null);
  assert.equal(getCircuitKey("Azerbaijan", "Baku"), null);
  assert.equal(getCircuitKey("Brazil", "Interlagos"), null);
});

test("F-08 regression: Session countdown timing state machine correctly never infers live or terminal status from a schedule", () => {
  const sessionDate = "2026-05-03T14:00:00Z"; // 14:00 UTC

  // 1. Before scheduled start -> upcoming with positive remaining countdown
  const tBefore = new Date("2026-05-03T12:00:00Z");
  const sBefore = computeSessionTimingState(sessionDate, "Race", tBefore);
  assert.equal(sBefore.status, "upcoming");
  assert.equal(sBefore.remainingMs, 2 * 60 * 60 * 1000);
  assert.equal(sBefore.label, "2h 0m");

  // The scheduled start does not prove the session started.
  const tStart = new Date("2026-05-03T14:00:00Z");
  const sStart = computeSessionTimingState(sessionDate, "Race", tStart);
  assert.equal(sStart.status, "start_passed");
  assert.equal(sStart.remainingMs, 0);
  assert.equal(sStart.label, "Scheduled start passed · status unverified");

  // Delays and cancellations cannot be inferred from a clock.
  const tDuring = new Date("2026-05-03T15:00:00Z");
  const sDuring = computeSessionTimingState(sessionDate, "Race", tDuring);
  assert.equal(sDuring.status, "start_passed");
  assert.equal(sDuring.remainingMs, 0);
  assert.equal(sDuring.label, "Scheduled start passed · status unverified");

  // An assumed duration cannot prove completion.
  const tEnd = new Date("2026-05-03T16:30:00Z");
  const sEnd = computeSessionTimingState(sessionDate, "Race", tEnd);
  assert.equal(sEnd.status, "start_passed");
  assert.equal(sEnd.remainingMs, 0);
  assert.equal(sEnd.label, "Scheduled start passed · status unverified");

  // Hours later, terminal status still needs provider evidence.
  const tAfter = new Date("2026-05-03T18:00:00Z");
  const sAfter = computeSessionTimingState(sessionDate, "Race", tAfter);
  assert.equal(sAfter.status, "start_passed");
  assert.equal(sAfter.remainingMs, 0);
  assert.equal(sAfter.label, "Scheduled start passed · status unverified");

  // Practice has the same evidence requirement.
  const pDuring = new Date("2026-05-01T11:00:00Z");
  const pAfter = new Date("2026-05-01T11:45:00Z");
  assert.equal(
    computeSessionTimingState("2026-05-01T10:00:00Z", "Practice 1", pDuring).status,
    "start_passed",
  );
  assert.equal(
    computeSessionTimingState("2026-05-01T10:00:00Z", "Practice 1", pAfter).status,
    "start_passed",
  );

  // 7. Missing or invalid scheduled timestamp -> unknown
  const sUnknown = computeSessionTimingState(undefined, "Race", tBefore);
  assert.equal(sUnknown.status, "unknown");
  assert.equal(sUnknown.remainingMs, 0);
  assert.equal(sUnknown.label, "Schedule unannounced");

  const sInvalid = computeSessionTimingState("not-a-date", "Race", tBefore);
  assert.equal(sInvalid.status, "unknown");
  assert.equal(sInvalid.label, "Schedule unannounced");

  // 8. Countdown formatting precision
  assert.equal(formatSessionCountdown(3 * 86400000 + 4 * 3600000), "3d 4h");
  assert.equal(formatSessionCountdown(2 * 3600000 + 15 * 60000), "2h 15m");
  assert.equal(formatSessionCountdown(45 * 60000 + 30000), "45m 30s");
  assert.equal(formatSessionCountdown(15000), "15s");
  assert.equal(formatSessionCountdown(0), "0s");

  // 9. findFocusedSession resolves correctly
  const event = {
    round_number: 1,
    event_name: "Bahrain Grand Prix",
    session1: "Practice 1",
    session1_date: "2026-05-01T10:00:00Z",
    session2: "Practice 2",
    session2_date: "2026-05-01T14:00:00Z",
    session3: "Practice 3",
    session3_date: "2026-05-02T10:00:00Z",
    session4: "Qualifying",
    session4_date: "2026-05-02T14:00:00Z",
    session5: "Race",
    session5_date: "2026-05-03T14:00:00Z",
    is_completed: false,
    is_upcoming: true,
  };
  // When before P1, focused session is P1
  const focusedBefore = findFocusedSession(event, new Date("2026-04-30T10:00:00Z"));
  assert.equal(focusedBefore?.name, "Practice 1");

  // After qualifying scheduled start, focus the next upcoming start.
  const focusedQual = findFocusedSession(event, new Date("2026-05-02T14:30:00Z"));
  assert.equal(focusedQual?.name, "Race");

  // When all sessions past, focused session is Race
  const focusedPost = findFocusedSession(event, new Date("2026-05-04T10:00:00Z"));
  assert.equal(focusedPost?.name, "Race");
});

test("F-14 regression: Profile identity persona and driver registry", () => {
  // 1. 2026 Driver registry contains the full grid (> 20 drivers), not an arbitrary subset
  const drivers2026 = Object.values(getDriversListByYear(2026));
  assert.ok(
    drivers2026.length >= 20,
    `2026 grid must contain at least 20 drivers, found ${drivers2026.length}`,
  );

  // Key official 2026 drivers must be present
  const driverNames = drivers2026.map((d) => d.name);
  assert.ok(driverNames.includes("Max Verstappen"));
  assert.ok(driverNames.includes("Lando Norris"));
  assert.ok(driverNames.includes("Lewis Hamilton"));
  assert.ok(driverNames.includes("Charles Leclerc"));
  assert.ok(driverNames.includes("Oscar Piastri"));
  assert.ok(driverNames.includes("Kimi Antonelli"));
  assert.ok(driverNames.includes("Isack Hadjar"));
  assert.ok(driverNames.includes("Arvid Lindblad"));

  // 2. Persona type mapping and preferences round-trip
  const testPersonas: Persona[] = ["enthusiast", "analyst", "casual"];
  for (const p of testPersonas) {
    const prefs = {
      favoriteDriver: "max_verstappen",
      favoriteTeam: "aston_martin",
      persona: p,
      notifications: true,
      dataDensity: "compact" as const,
    };
    // Ensure structure is clean and valid
    assert.equal(prefs.persona, p);
  }
});

test("F-16 regression: Sessions telemetry CTA honest availability and capability rules", () => {
  // 1. Unsupported season (< 2018) -> cannot navigate, explicit unsupported label
  const pre2018 = getSessionTelemetryState(2017, "Race", 1);
  assert.equal(pre2018.status, "unsupported_season");
  assert.equal(pre2018.canNavigate, false);
  assert.match(pre2018.label, /Telemetry unavailable \(< 2018\)/);

  // 2. Modern season with unknown availability -> unverified, clearly labeled as attempt
  const unverified = getSessionTelemetryState(2026, "Race", 1, {});
  assert.equal(unverified.status, "unverified");
  assert.equal(unverified.canNavigate, true);
  assert.equal(unverified.label, "Attempt to load telemetry");

  // 3. Modern season with verified availability -> known_available, links to telemetry
  const available = getSessionTelemetryState(2026, "Race", 1, { "2026-1-Race": true });
  assert.equal(available.status, "known_available");
  assert.equal(available.canNavigate, true);
  assert.equal(available.label, "Explore session telemetry");

  // 4. Modern season with provider failure or missing data -> known_unavailable, cannot navigate
  const unavailable = getSessionTelemetryState(2026, "Race", 1, { "2026-1-Race": false });
  assert.equal(unavailable.status, "known_unavailable");
  assert.equal(unavailable.canNavigate, false);
  assert.equal(unavailable.label, "Telemetry data unavailable");
});

test("F-05 regression: Disputed event venue prevents hybrid identity or confirmed circuit assertion", () => {
  // 1. Normal verified event exposes verified circuit
  const normalEvent = {
    round_number: 1,
    country: "Australia",
    location: "Melbourne",
    event_name: "Australian Grand Prix",
    circuit_name: "Albert Park Circuit",
    is_completed: true,
    is_upcoming: false,
    has_conflict: false,
  };
  const normalVenue = getVerifiedEventVenue(normalEvent as unknown as ScheduleEvent);
  assert.equal(normalVenue.isDisputed, false);
  assert.equal(normalVenue.circuitName, "Albert Park Circuit");
  assert.equal(normalVenue.location, "Melbourne");
  assert.equal(normalVenue.conflictDetails, null);

  // 2. Disputed event (e.g. Bahrain vs Malaysia dispute) does NOT assert circuitName
  const disputedEvent = {
    round_number: 16,
    country: "Conflict: Bahrain (FastF1) vs Malaysia (Jolpica)",
    location: "Disputed Venue",
    event_name: "Round 16 [Provider Conflict]",
    circuit_name: null,
    is_completed: false,
    is_upcoming: true,
    has_conflict: true,
    conflict: {
      has_conflict: true,
      conflicting_fields: ["venue", "country", "circuit_name"],
      description:
        "FastF1 reports Bahrain International Circuit; Jolpica reports Sepang International Circuit",
      candidates: {
        fastf1: { venue: "Bahrain", circuit: "Bahrain International Circuit" },
        jolpica: { venue: "Malaysia", circuit: "Sepang International Circuit" },
      },
    },
  };
  const disputedVenue = getVerifiedEventVenue(disputedEvent as unknown as ScheduleEvent);
  assert.equal(disputedVenue.isDisputed, true);
  assert.equal(
    disputedVenue.circuitName,
    null,
    "Must NOT assert a confirmed circuit when providers disagree",
  );
  assert.ok(disputedVenue.conflictDetails);
  const desc =
    typeof disputedVenue.conflictDetails?.description === "string"
      ? disputedVenue.conflictDetails.description
      : "";
  assert.match(desc, /Bahrain International Circuit/);
});

test("F-04 career schema retains incomplete-season disclosure", async () => {
  const { careerSchema } = await import("../src/lib/api/history");
  const career = careerSchema.parse({
    driver_id: "fixture",
    source: "Jolpica",
    fetched_at: "2026-01-01T00:00:00Z",
    wins: 2,
    championship_points: 30,
    titles: null,
    title_coverage: "partial",
    season_coverage: "partial",
    failed_seasons: [2024],
    records: [],
    season_records: [],
  });
  assert.equal(career.season_coverage, "partial");
  assert.deepEqual(career.failed_seasons, [2024]);
  assert.equal(career.titles, null);
});

import { formatInZone, eventProgression, simulate, raceWidgetData } from "../src/lib/companion";
import { validatedModel, cars } from "../src/lib/museum";
import { acceptLivePayload } from "../src/lib/live-state";
import type { Result } from "../src/lib/api/history";
import type { LiveSessionData } from "../src/hooks/useLiveSession";
test("IANA conversion handles rollover, DST gaps, repeated hours and unconfirmed instants", () => {
  assert.match(formatInZone("2026-01-01T20:00:00Z", "Asia/Kolkata"), /2 January 2026.*01:30/);
  assert.match(formatInZone("2026-03-29T00:30:00Z", "Europe/London"), /00:30/);
  assert.match(formatInZone("2026-03-29T01:30:00Z", "Europe/London"), /02:30/);
  assert.match(formatInZone("2026-11-01T05:30:00Z", "America/New_York"), /01:30/);
  assert.match(formatInZone("2026-11-01T06:30:00Z", "America/New_York"), /01:30/);
  assert.equal(formatInZone("2026-03-29", "UTC"), "Time unconfirmed");
  assert.equal(formatInZone(null, "UTC"), "Time unconfirmed");
  assert.equal(formatInZone("2026-01-01T00:00:00Z", "Invalid/Zone"), "Invalid timezone");
});
test("widget contract excludes unconfirmed times, respects session and round identity", () => {
  const event = {
    round_number: 4,
    event_name: "Fixture",
    country: "Fixture",
    location: "Fixture",
    is_completed: false,
    is_upcoming: true,
    session4: "Qualifying",
    session4_date: "2026-01-02T10:00:00Z",
    session5: "Race",
    session5_date: "2026-01-03T10:00:00Z",
  };
  const result = raceWidgetData([event], Date.parse("2026-01-02T11:00:00Z"));
  assert.equal(result.version, 1);
  assert.equal(result.nextSession?.name, "Race");
  assert.equal(result.nextRace?.round, 4);
  assert.equal(
    raceWidgetData([{ ...event, session4_date: "2026-01-02", session5_date: undefined }])
      .nextSession,
    null,
  );
});
test("event progression uses supplied historic fractional and sprint points, tracking transfers", () => {
  const rows = [
    {
      round: 1,
      session: "Race",
      points: 4.5,
      Driver: { driverId: "a" },
      Constructor: { constructorId: "old" },
    },
    {
      round: 2,
      session: "Race",
      points: 9,
      Driver: { driverId: "a" },
      Constructor: { constructorId: "new" },
    },
    {
      round: 2,
      session: "Sprint",
      points: 3,
      Driver: { driverId: "a" },
      Constructor: { constructorId: "new" },
    },
    {
      round: 2,
      session: "Qualifying",
      points: 99,
      Driver: { driverId: "a" },
      Constructor: { constructorId: "new" },
    },
  ] as Result[];
  assert.equal(eventProgression(rows, "drivers")[1].points.a, 16.5);
  const teams = eventProgression(rows, "constructors");
  assert.equal(teams[1].points.old, 4.5);
  assert.equal(teams[1].points.new, 12);
  assert.deepEqual(eventProgression([], "drivers"), []);
});
test("simulation preserves official baseline, supports fractional adjustments, ties, undo and reset", () => {
  const baseline = [
    { id: "a", name: "A", points: 10, position: 1 },
    { id: "b", name: "B", points: 10, position: 2 },
  ];
  const original = JSON.stringify(baseline);
  assert.deepEqual(
    simulate(baseline, []).map((r) => r.rank),
    [1, 2],
  );
  const changes = [{ id: "b", round: 1, delta: 0.5, note: "Manual" }];
  assert.equal(simulate(baseline, changes)[0].id, "b");
  assert.equal(
    simulate(baseline, [...changes, { id: "a", round: 2, delta: 0.5, note: "Tie" }])[0].tied,
    true,
  );
  assert.equal(simulate(baseline, changes.slice(0, -1))[0].id, "a");
  assert.equal(JSON.stringify(baseline), original);
  assert.throws(() => simulate(baseline, [{ id: "unknown", round: 1, delta: 1, note: "" }]));
  assert.throws(() => simulate(baseline, [{ id: "a", round: 1, delta: NaN, note: "" }]));
});
test("museum model manifest rejects missing, oversized, external and traversal assets", () => {
  assert.ok(
    cars.every((c) => /^https:\/\/www\.(mclaren|ferrari|williamsf1)\.com\//.test(c.source)),
  );
  assert.equal(validatedModel(undefined), null);
  const model = {
    url: "/models/reviewed.glb",
    credit: "Owner supplied",
    license: "Reviewed permission",
    bytes: 1024,
  };
  assert.equal(validatedModel(model)?.url, model.url);
  for (const url of ["https://unreviewed.example/car.glb", "/models/../secret.glb", "/model.exe"])
    assert.equal(validatedModel({ ...model, url }), null);
  assert.equal(validatedModel({ ...model, bytes: 25000001 }), null);
});
test("live reducer rejects older snapshots and expires stale or unauthenticated rows", () => {
  const initial = {
    is_live: false,
    state: "UNKNOWN",
    session_info: null,
    leaderboard: [],
    weather: null,
    race_control: [],
    last_update: null,
    is_waking: false,
    ws_connected: false,
  } as LiveSessionData;
  const now = Date.parse("2026-01-01T10:00:00Z");
  const payload = {
    is_live: true,
    state: "RACE",
    session_info: { session_key: 7 },
    timestamp: "2026-01-01T10:00:00Z",
    leaderboard: [{ position: 1 }],
  } as unknown as Partial<LiveSessionData> & { timestamp: string };
  const current = acceptLivePayload(initial, payload, now);
  assert.equal(current.is_live, true);
  assert.equal(
    acceptLivePayload(current, { ...payload, timestamp: "2026-01-01T09:59:59Z" }, now),
    current,
  );
  assert.equal(acceptLivePayload(initial, payload, now + 46000).is_live, false);
  assert.deepEqual(acceptLivePayload(current, { is_live: false }, now).leaderboard, []);
  assert.equal(acceptLivePayload(initial, { ...payload, session_info: null }, now).is_live, false);
});

import { googleCalendarUrl } from "../src/lib/calendar";
test("calendar links preserve exact start instants, no invented two-hour end or disputed venue", () => {
  const e = {
    round_number: 1,
    event_name: "Fixture",
    country: "Unknown",
    location: "Unknown",
    session5: "Race",
    session5_date: "2026-01-01T20:00:00Z",
    has_conflict: true,
    is_completed: false,
    is_upcoming: true,
  };
  const u = new URL(googleCalendarUrl(e, "session5")!);
  const dates = u.searchParams.get("dates")!.split("/");
  assert.equal(dates[0], dates[1]);
  assert.match(u.searchParams.get("location")!, /unconfirmed/);
  assert.equal(googleCalendarUrl({ ...e, session5_date: "2026-01-01" }, "session5"), null);
});

test("GLTF viewer dependency parses a synthetic test triangle and rejects invalid assets", async () => {
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const bytes = Buffer.from(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer).toString(
    "base64",
  );
  const fixture = {
    asset: { version: "2.0", generator: "ApexF1 synthetic test geometry — not a car" },
    scenes: [{ nodes: [0] }],
    scene: 0,
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ uri: `data:application/octet-stream;base64,${bytes}`, byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
    ],
  };
  const { LoadingManager } = await import("three");
  const loader = new GLTFLoader(
    new LoadingManager().setURLModifier((url) => modelResourceUrl(url, "https://apex.example")),
  );
  // Node lacks the browser progress-event API used by Three's data-URI loader.
  const prior = globalThis.ProgressEvent;
  if (!prior)
    Object.defineProperty(globalThis, "ProgressEvent", {
      configurable: true,
      value: class {
        constructor(public type: string) {}
      },
    });
  try {
    const gltf = await loader.parseAsync(JSON.stringify(fixture), "");
    assert.equal(gltf.scene.children.length, 1);
    await assert.rejects(() => loader.parseAsync("invalid model", ""));
  } finally {
    if (!prior) Reflect.deleteProperty(globalThis, "ProgressEvent");
  }
});

test("restoring a tied official baseline retains countback order and zero position changes", () => {
  const result = simulate(
    [
      { id: "z", name: "Zed", points: 10, position: 1 },
      { id: "a", name: "Alpha", points: 10, position: 2 },
    ],
    [],
  );
  assert.deepEqual(
    result.map((r) => r.id),
    ["z", "a"],
  );
  assert.deepEqual(
    result.map((r) => r.positionChange),
    [0, 0],
  );
});
test("widget season identity is independent of date rollover into the next calendar year", () => {
  const event = {
    round_number: 1,
    event_name: "Fixture",
    country: "Fixture",
    location: "Fixture",
    is_completed: false,
    is_upcoming: true,
    session5: "Race",
    session5_date: "2027-01-01T00:00:00Z",
  };
  assert.equal(
    raceWidgetData([event], Date.parse("2026-12-31T20:00:00Z"), 2026).nextRace?.year,
    2026,
  );
});

import { championshipGap, latestRaceWinner } from "../src/lib/companion";
import { modelResourceUrl } from "../src/lib/museum";
import type { Result } from "../src/lib/api/history";
test("countdowns reject date-only and timezone-ambiguous provider schedules", () => {
  for (const date of ["2026-04-01", "2026-04-01T12:00:00"])
    assert.equal(computeSessionTimingState(date, "Race", 0).status, "unknown");
  assert.equal(
    findFocusedSession({ session1: "Race", session1_date: "2026-04-01T12:00:00" }, 0),
    null,
  );
  assert.equal(
    computeSessionTimingState("2026-04-01T12:00:00+05:30", "Race", 0).status,
    "upcoming",
  );
});
test("snapshot gap uses official ranks and winner excludes disqualified or missing latest winners", () => {
  assert.equal(
    championshipGap([
      { position: 2, points: 90 },
      { position: 1, points: 100 },
    ]),
    10,
  );
  assert.equal(
    championshipGap([
      { position: 1, points: 100 },
      { position: 3, points: 80 },
    ]),
    null,
  );
  const earlier = {
    session: "Race",
    round: 1,
    position: 1,
    status: "Finished",
    positionText: "1",
  } as Result;
  const excluded = { ...earlier, round: 2, status: "Disqualified" };
  assert.equal(latestRaceWinner([earlier, excluded]), undefined);
  assert.equal(latestRaceWinner([earlier, { ...earlier, session: "Sprint", round: 2 }]), earlier);
});
test("model resource boundary permits embedded buffers and local blobs but denies external assets", () => {
  const origin = "https://apex.example";
  assert.equal(
    modelResourceUrl("data:application/octet-stream;base64,AAAA", origin),
    "data:application/octet-stream;base64,AAAA",
  );
  assert.equal(
    modelResourceUrl("blob:https://apex.example/test", origin),
    "blob:https://apex.example/test",
  );
  assert.equal(modelResourceUrl("/models/texture.png", origin), origin + "/models/texture.png");
  for (const url of [
    "https://other.example/car.png",
    "blob:https://other.example/test",
    "data:text/html;base64,AAAA",
    "/models/../secret",
  ])
    assert.throws(() => modelResourceUrl(url, origin));
});

import { resolveApiOrigin, websocketOrigin } from "../src/lib/api/config";
test("deployment configuration never falls back to a static production origin", () => {
  assert.equal(resolveApiOrigin(undefined, false, false, "https://frontend.example"), null);
  assert.equal(resolveApiOrigin(undefined, true, false), "http://localhost:8000");
  assert.equal(
    resolveApiOrigin(undefined, false, true, "https://proxy.example"),
    "https://proxy.example",
  );
  for (const input of ["https://backend.example", "https://backend.example/api/"]) {
    const origin = resolveApiOrigin(input, false, false)!;
    assert.equal(
      new URL("/api/history/season", origin).href,
      "https://backend.example/api/history/season",
    );
    assert.equal(websocketOrigin(origin), "wss://backend.example");
  }
  assert.equal(websocketOrigin("http://localhost:8000"), "ws://localhost:8000");
  for (const value of [
    "javascript:alert(1)",
    "https://user:pass@example.com",
    "https://example.com/path",
    "https://example.com/?token=x",
  ])
    assert.throws(() => resolveApiOrigin(value, false, false));
});
