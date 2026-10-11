# Validation record

Executed 2026-10-11 on Windows, Node 22.18 and Python 3.13.5.

| Check | Result | Scope |
|---|---|---|
| Backend unittest discovery | PASS, 12 tests | Archive isolation, HTTP errors, classification, UTC/off-week, owner snapshot totals, pagination/cache, timeout, historical identity |
| Frontend npm test | PASS, 3 tests | Season identity, ICS UTC/escaping, exact live-session identity |
| npm run typecheck | PASS | Full TypeScript project |
| npm run lint | PASS, 0 errors, 7 warnings | Final formatting pass; existing Fast Refresh warnings remain; generated test output excluded |
| npm run build | PASS | Vite production build, 2981 modules |
| npm audit | PASS, 0 advisories | Resolved npm dependency tree, recorded JSON |
| pip-audit | PASS, 0 advisories | Declared direct pins only, --no-deps --disable-pip; not transitive certification |
| Limited secret-pattern scan | PASS | App source: private keys, GitHub tokens, AWS access keys; not exhaustive |
| Real HTTP API smoke | PASS | Health, 2026 schedule (23), results (16 rounds), standings (23 drivers/11 teams), engines (5), R1 classification (22), dashboard |
| Live OpenF1 integration | BLOCKED | Provider returned 401; authenticated feed unavailable |
| Browser Home | PASS, limited | Observed fabricated weather removed in rendered DOM |
| Full browser/responsive matrix | BLOCKED / NOT VERIFIED | Browser disconnected after Standings navigation; no comprehensive UI pass |
| Clean pinned Python 3.11/Docker build | NOT VERIFIED | Available runtime used different installed scientific pins, with patched dotenv/Arrow imported from temporary directory |

Commands: `python -X utf8 -m unittest discover -s tests -v` from backend; `npm run typecheck`, `npm test`, `npm run lint`, `npm run build` from frontend. Backend PYTHONPATH included the local patched dependency directory and backend. Tests contain fixture data, never runtime fallback points.

Main JavaScript bundle: baseline 1058.43 KB / 318.94 KB gzip; final 421.64 KB / 136.48 KB gzip. Race Center is lazy-loaded at 420.44 KB / 116.22 KB gzip. These are build sizes, not measured browser latency or frame-rate claims.

Final test/build run caught generated test artifacts in lint scope; ESLint now ignores `.test-build`. Remaining warnings concern Fast Refresh exports. Provider smoke tests preceded final race-control and exact session identity changes; those latter paths have static/unit coverage, not real live integration coverage.

No deployment, PR, force push, or production data mutation was performed. See REMEDIATION_PLAN.md for remaining work.
