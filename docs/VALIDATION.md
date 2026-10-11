# Validation record

Continuation from remediation commit `2e986227434bde44196e1d1b19c1557f1b4e1a69`, 2026-10-11. Node 22.18; Python 3.13.5 on Windows.

| Check | Result | Scope |
|---|---|---|
| Backend unittest suite | PASS, 24 tests on the preceding remediation state; current suite 25 tests NOT VERIFIED | New season calculations, pagination, OAuth renewal, RSS safety and transfer tests were added; rerunning Python tests in this sandbox hangs at the first async test. The prior passing suite included 12 backend tests from that previous commit plus 12 new platform tests before the career snapshot regression was added. |
| Frontend npm test | PASS, 4 tests | Driver season numbers, UTC ICS, exact live session identity, safe image URL handling |
| TypeScript `tsc --noEmit` | PASS after Home News search-state correction | Full frontend project, including generated file routes |
| ESLint | PASS, zero errors and 8 Fast Refresh warnings | Full frontend; final Home edit is formatted; warnings identify component files with shared non-component exports |
| Vite production build | BLOCKED in this continuation | Sandbox returned Windows `EPERM` from `realpath` at `frontend/index.html`; prior remediation commit build passed before these added routes |
| Real Jolpica season/career smoke | BLOCKED | Auto-approval service hit the account usage limit before the request was executed |
| Real RSS provider smoke | BLOCKED | Same approval-service limit; deterministic parsing, URL, deduplication and XML security tests passed in the earlier run |
| Live OpenF1 | NOT VERIFIED | This environment has no authorized provider credentials; mock tests cover token renewal and conservative status transitions |
| Desktop UI route review | PASS, limited | Standings unavailable state, News page, driver profile and accessible portrait fallback rendered in local browser |
| Tablet/mobile browser matrix | NOT VERIFIED | Browser viewport connection dropped; no responsive dimensions were claimed |
| Historical dependency scans | Existing remediation baseline | Previous resolved npm audit: zero advisories; backend scan covered declared pins only and did not certify transitive dependencies |

Commands: `python -X utf8 -m unittest discover -s tests -v` with patched local dependencies in `PYTHONPATH`; frontend `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. Frontend tests, typecheck and lint passed; lint reports eight Fast Refresh warnings. Production build was attempted and hit the sandbox filesystem error.

This pass adds domain/provider tests that could not be rerun after the environment limit. Do not treat the changed Python suite or final Vite bundle as verified. See [remaining work](REMEDIATION_PLAN.md) and [architecture limits](PLATFORM_ARCHITECTURE.md).
