# ApexF1 companion implementation

Entry: `/companion?view=times|timeline|simulator|museum|discover&year=YYYY`. Museum details additionally accept `car=ID`. Existing navigation exposes Companion through the desktop dock and mobile More dialog; Home has a reusable race widget. URL year synchronizes the existing season store. Existing routes and visual tokens are retained.

## Data and ownership

- `lib/companion.ts` provides version-1 serializable race-widget data (season, round, session, canonical instant, dispute flag, generation time), IANA formatting, supplied-event-point accumulation, immutable scenario calculations and guarded local storage. The contract can be consumed by a future native adapter. It is not an Android/iOS widget implementation.
- Modern session timetables reuse the existing schedule query. Before 2018 only the canonical Jolpica calendar is requested through `/api/history/schedule`; race times absent from the provider remain unconfirmed. Event-local timezones are not inferred. UTC, Asia/Kolkata, browser-local and user-selected IANA zones use Intl, including DST and date rollover.
- `/api/history/progression` composes official selected-round standings through the shared Jolpica transport. At most three round jobs run concurrently, within the existing provider gate, 100-row pagination, 900-second cache and single-flight. Latest published round bounds requests. Failed snapshots have null points, never forward-filled or replaced by modern scoring. Driver/constructor keys remain distinct. The frontend key is year + kind, stale time 900 seconds; cancellation is passed through.
- The timeline distinguishes official snapshots, summed event points, and points scored at the selected event. Race/sprint results are separate from qualifying. Dropped scores and deductions remain represented by official snapshots. Missing snapshots break chart paths. Scrubber, playback, step/reset, competitor selection, keyboard/click inspection and links to provider classifications are connected.
- What-if supports explicit points adjustments to a provider official baseline, tagged by event and reason. It does not apply an invented finishing-position scoring system. Baseline records remain immutable. Ties in hypothetical results share provisional rank; official countback order is restored on reset. Save/load/delete/compare (ten named local scenarios, at most 100 changes each) are scoped by season and championship. Saved changes are explicitly rebased on the fetched snapshot. Unsupported finishing-order, dropped-score and steward-decision simulations remain disabled.
- Favorites use provider identities and link to existing season-specific profiles. Driver names synchronize with existing profile preferences; team appearance remains a palette preference, separate from a constructor identity. Discovery searches provider drivers, constructors, circuits and races within the selected season. Circuit geometry/length/records are not fabricated.

## Installable application

The Vite PWA plugin injects manifest, viewport-fit and touch-icon metadata without editing the pre-existing index.html working-tree entry. Authored 192/512 PNG app icons use a neutral ApexF1 letter treatment. Production registration is disabled during Vite development. Android installation is through the browser install action when offered; iOS uses Safari Share > Add to Home Screen. HTTPS or localhost is required. Physical-device installation is not certified here.

The worker captures an immutable, versioned HTML shell from the final build. Static asset requests are matched by build path with Vary/query differences ignored; this is safe only for the enumerated public static assets. API requests, health checks, external origins, non-GET requests and model assets are never cached. Heavy Three/loader/control chunks are excluded from pre-cache. Navigation is network-first with the versioned shell as offline fallback. Existing in-memory data is covered by the offline/stale banner; there is no persistent API cache. A network health probe and browser online events update availability. Waiting workers activate only through the explicit reload action; old ApexF1 caches are removed on activation, unrelated caches are untouched. Versioned shell and static Origin-variant regressions are tested against the actual production artifact.

Foreground notifications are opt-in and limited to a ten-minute reminder while the timezone page is open. Session identity + instant deduplicates reminders locally. Disputed sessions do not trigger reminders. Browser/OS throttling and notification API support can prevent delivery. Closed-app reminders require an actual push/native service, which is not claimed. Calendar export remains a manual snapshot; Google links are start-time markers with no invented two-hour duration.

## Museum and models

The editorial starter catalogue covers five sourced cars from McLaren, Williams and Ferrari. Primary-source links appear with each detail. No manufacturer imagery, logo binaries or model geometry is reused. Missing specifications, associations and wins remain unavailable. Era labels are editorial categories. Filtering, season selection, source links, car details and side-by-side comparison work independently of model supply.

To supply a model, add a reviewed file under `frontend/public/models/` and add `model: { url: '/models/car.glb', credit: '...', license: '...', bytes: ... }` to its catalogue entry in `lib/museum.ts`. URLs must remain local; model metadata and main payload are bounded to 25 MB. GLTF linked resources must also be reviewed local `/models/` assets; texture complexity and total GPU memory require operator review. Embedded resources are supported. There is no arbitrary image/model proxy. Three.js, OrbitControls and GLTFLoader are dynamic imports loaded only after the user requests a supplied model. Controls include drag/keyboard buttons, zoom, reset and fullscreen; rendering is demand-driven, not auto-rotating. Resize observers, renderer, controls, geometries, materials and textures are cleaned up. Failed/empty/unsafe models and unsupported WebGL get an unavailable state. A synthetic triangle is used only in tests, never as a production car fallback. No authentic model has been supplied, so real-car rendering/device performance remains unverified.

## Live and integrity

Schedule completion now requires an actual published race classification. The old four-hour rule is removed. Optional completion coverage is marked unverified when missing; provider failure returns an unavailable error. Schedule loads are shared by season with at most four pending jobs, 35-second caller deadlines and consumed background exceptions. Cancelling one caller does not cancel shared work; the underlying FastF1 thread cannot be force-cancelled and remains bounded by the pending-job cap.

Origin is required for WebSocket clients in every environment unless `WS_ALLOW_NO_ORIGIN` is explicitly enabled. That override is for deliberate non-browser clients, not authentication. The existing DNS-pinned RSS transport is retained. Full configured feed retrieval passed this run. Conflict metadata now follows the current cache key into canonical season views; disputed session pages do not render a guessed circuit outline.

Live requests use cancellation, timestamp ordering, 45-second client freshness expiry, cleared data on disconnect/failure, bounded exponential reconnect and 30-second REST fallback while disconnected. Actual authentication/session evidence remains server-side. Backend channel metadata preserves partial failures. Available laps supply completed lap/sector times; missing positions, DRS, pit counts and current tyre age remain null. Starting tyre age is not labelled as current age. Weather retains provider observation time and units. Authenticated real live behavior remains blocked by missing credentials. Existing archive telemetry remains separate.

## Validation and limits

See VALIDATION.md for executed commands, browser operations and failures encountered. Docker is unavailable; no container or remote CI run is claimed. There is no production deployment, native widget, background push delivery, exhaustive historical car database or unsupported historical finishing-order simulation. No remote push, merge or PR is part of this work.

## Exact delivery file inventory

49 intended files (including this documentation):

- `.github/workflows/ci.yml`
- `backend/app/api/history.py`
- `backend/app/api/routes.py`
- `backend/app/models/schemas.py`
- `backend/app/services/event_identity.py`
- `backend/app/services/f1_service.py`
- `backend/app/services/history_service.py`
- `backend/app/services/openf1_service.py`
- `backend/tests/test_companion.py`
- `backend/tests/test_integrity.py`
- `docs/COMPANION.md`
- `docs/PLATFORM_ARCHITECTURE.md`
- `docs/REMEDIATION_PLAN.md`
- `docs/VALIDATION.md`
- `docs/forensic-remediation/OVERNIGHT_FINDINGS_LEDGER.md`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/public/icons/app-192.png`
- `frontend/public/icons/app-512.png`
- `frontend/public/manifest.webmanifest`
- `frontend/pwa-plugin.ts`
- `frontend/src/components/AppAvailability.tsx`
- `frontend/src/components/AppSidebar.tsx`
- `frontend/src/components/CarViewer.tsx`
- `frontend/src/components/FavoriteSnapshot.tsx`
- `frontend/src/components/ForegroundReminder.tsx`
- `frontend/src/components/GlobalContextInit.tsx`
- `frontend/src/components/RaceWidget.tsx`
- `frontend/src/components/SeasonData.tsx`
- `frontend/src/hooks/useLiveSession.ts`
- `frontend/src/lib/api/client.ts`
- `frontend/src/lib/api/history.ts`
- `frontend/src/lib/calendar.ts`
- `frontend/src/lib/companion.ts`
- `frontend/src/lib/live-state.ts`
- `frontend/src/lib/museum.ts`
- `frontend/src/lib/store/index.ts`
- `frontend/src/routeTree.gen.ts`
- `frontend/src/routes/__root.tsx`
- `frontend/src/routes/calendar.tsx`
- `frontend/src/routes/companion.tsx`
- `frontend/src/routes/index.tsx`
- `frontend/src/routes/profile.tsx`
- `frontend/src/routes/race-center.tsx`
- `frontend/src/routes/sessions.tsx`
- `frontend/src/styles.css`
- `frontend/tests/integrity.test.ts`
- `frontend/tests/pwa.test.mjs`
- `frontend/vite.config.ts`
