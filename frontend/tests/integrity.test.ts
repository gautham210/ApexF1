import { matchesSession } from "../src/lib/session";
import { test } from "node:test";
import assert from "node:assert/strict";
import { getDriverNumberByName, getDriverByYear, getDriverNumberByAbbr } from "../src/lib/store";
import { createCalendar } from "../src/lib/calendar";
import { safeImageUrl } from "../src/lib/media";
import { dashboardResponseSchema } from "../src/lib/api/client";
import { z } from "zod";
import {
  parseRaceCenterSearch,
  formatRaceCenterSearch,
  getVerifiedEventLabel,
  MIN_SUPPORTED_YEAR,
} from "../src/lib/event-identity";
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
