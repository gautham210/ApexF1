import type { LiveSessionData } from "@/hooks/useLiveSession";
export function acceptLivePayload(
  previous: LiveSessionData,
  payload: Partial<LiveSessionData> & { timestamp?: string },
  now = Date.now(),
): LiveSessionData {
  const stamp = payload.timestamp ? Date.parse(payload.timestamp) : NaN;
  const old = previous.last_update ? Date.parse(previous.last_update) : NaN;
  if (Number.isFinite(stamp) && Number.isFinite(old) && stamp < old) return previous;
  const fresh = Number.isFinite(stamp) && now - stamp <= 45000 && stamp <= now + 5000;
  const live = payload.is_live === true && fresh && !!payload.session_info?.session_key;
  return {
    ...previous,
    status: payload.status,
    errors: payload.errors,
    is_live: live,
    state: payload.state ?? "UNKNOWN",
    session_info: payload.session_info ?? null,
    leaderboard: live ? (payload.leaderboard ?? []) : [],
    weather: live ? (payload.weather ?? null) : null,
    race_control: live ? (payload.race_control ?? []) : [],
    last_update: Number.isFinite(stamp) ? payload.timestamp! : null,
    is_waking: false,
  };
}
