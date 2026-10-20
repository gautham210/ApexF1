import { matchesSession } from "../src/lib/session";
import { test } from "node:test";
import assert from "node:assert/strict";
import { getDriverNumberByName, getDriverByYear, getDriverNumberByAbbr } from "../src/lib/store";
import { createCalendar } from "../src/lib/calendar";
import { safeImageUrl } from "../src/lib/media";
import { dashboardResponseSchema } from "../src/lib/api/client";
import { z } from "zod";
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
