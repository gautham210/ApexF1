import { matchesSession } from "../src/lib/session";
import { test } from "node:test";
import assert from "node:assert/strict";
import { getDriverNumberByName, getDriverByYear, getDriverNumberByAbbr } from "../src/lib/store";
import { createCalendar } from "../src/lib/calendar";
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
