# Andong Tourism Decision Support MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Vercel-ready, map-first Andong tourism decision-support MVP with six usable screens, explicit demo/live provenance, protected data ingestion, and field-task persistence.

**Architecture:** One Next.js App Router/TypeScript app owns UI, server routes, and domain logic. Server-only integrations fetch KTO municipal visitor data and national tourism content, then publish a PostgreSQL/PostGIS snapshot. If no DB is configured, the app renders an explicitly labelled demonstration snapshot and never claims its scores are observed results.

**Tech Stack:** Next.js, React, TypeScript, Leaflet, PostgreSQL/PostGIS via Supabase transaction pooler, Vitest, Testing Library, ESLint, Vercel Functions/Cron.

**Spec:** `docs/superpowers/specs/2026-09-21-andong-mvp-design.md`; UI source of truth: `DESIGN.md`.

## Global Constraints

- First/default screen is `A. 지도 중심 관제형`; no separate story landing or 3D object.
- Three canonical regions are 원도심·월영교권, 하회마을권, 도산·예끼마을권.
- KTO `DataLabService/locgoRegnVisitrDDList` is municipality/day data; never attribute it to a tourism zone.
- KTO `KorService2/areaBasedList2` provides POI positions; discover the Andong code through `areaCode2` rather than a guessed constant.
- Demo scores must be marked `예시 데이터 · 정책 판단 금지`; live scores remain `산출 대기` without independent zone-level inputs.
- A failed live fetch must preserve the last published snapshot, never silently switch to demo.
- Secrets remain server-only; `.env*` ignored, `NEXT_PUBLIC_` never used for service credentials.
- Mutating tasks require an authenticated administrator and configured PostgreSQL; demo interactions are browser-session-only.
- No commit, push, PR, service creation, or public deployment without a separate explicit request. This user preference overrides Superpowers' routine commit steps.

## Review Focus

1. API response `item` is missing or is one object instead of an array: ingestion returns an empty list or one normalized record, never crashes (Task 2 test).
2. `touNum` equals `0` versus a missing number: zero is preserved; missing is rejected/marked unknown (Task 2 test).
3. Two cron invocations overlap or a retry repeats the same date: a lease blocks overlap and upsert avoids duplicates (Task 3 test).
4. A public visitor or malformed browser request attempts task mutation: route returns 401/400 without a write (Task 5 test).
5. Database configured but latest fetch fails: pages retain the last live snapshot and display stale status, never demo values (Task 3 test).

## File Structure and Ownership

| Task | Exclusive paths | Consumes | Produces |
| --- | --- | --- | --- |
| 1 Foundation | `package.json`, lockfile, configs, `.gitignore`, `.env.example`, `src/lib/domain.ts`, `src/lib/demo.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/test/**` | spec | canonical types, demo snapshot, test/build scripts |
| 2 API normalization | `src/lib/tourism/**` | domain types | `fetchAndongVisitors`, `fetchAndongPlaces`, pure normalizers |
| 3 DB and sync | `db/**`, `src/lib/db.ts`, `src/lib/snapshot.ts`, `src/app/api/sync/**`, `src/lib/sync/**` | Task 1 types, Task 2 fetchers | `loadSnapshot`, `runSyncBatch`, schema |
| 4 Discovery UI | `src/app/page.tsx`, `src/app/compare/**`, `src/app/regions/**`, `src/components/discovery/**`, `src/styles/discovery.css` | Task 1 demo/types; Task 3 `loadSnapshot` | screens 1–3 |
| 5 Workflow UI/API | `src/lib/auth.ts`, `src/lib/tasks.ts`, `src/app/api/session/**`, `src/app/api/tasks/**`, `src/app/actions/**`, `src/app/field/**`, `src/app/report/**`, `src/components/workflow/**`, `src/styles/workflow.css` | Task 1 demo/types; Task 3 DB | screens 4–6 and protected mutations |
| 6 Integration | `README.md`, `vercel.json`, integration tests and small fixes in owned modules only after coordination | all earlier tasks | tested runnable app and deployment guide |

Shared file changes require the coordinator to assign ownership before edits. Tasks 2, 4, and 5 may run in parallel after Task 1; Task 3 starts once Task 2's public functions are stable. Task 6 starts after integration.

## Task 1: Foundation, canonical domain, and demo mode

**Files:** Create or modify the Task 1 exclusive paths above.

**Interfaces:** Export `RegionId`, `EvidenceStatus`, `SnapshotMode`, `RegionOverview`, `TourismPlace`, `ValidationTask`, `PublishedSnapshot`, `REGIONS` from `src/lib/domain.ts`. Export `demoSnapshot: PublishedSnapshot`, `demoTasks: ValidationTask[]` from `src/lib/demo.ts`. `PublishedSnapshot` must include `mode`, `publishedAt`, `visitorContext`, `regions`, `places`, `limitations`, and `status`. `RegionOverview` has separate nullable `potentialScore` and `confidenceScore` plus evidence status. Use named exports.

- [ ] Step 1: Bootstrap stable Next.js/TypeScript, Vitest/Testing Library, ESLint, Leaflet dependencies and scripts `dev`, `build`, `lint`, `typecheck`, `test`; create `.gitignore` before any `.env.local` exists. The `.env.example` contains names only: `TOUR_API_SERVICE_KEY`, `DATABASE_URL`, `CRON_SECRET`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `NEXT_PUBLIC_TILE_URL` (public tile URL is not a credential).
- [ ] Step 2: Write a failing test in `src/lib/domain.test.ts` that exercises all three region IDs and names, and a failing test in `src/lib/demo.test.ts` that asserts each numeric demo score has mode `demo` and the policy-warning label. Example:

```ts
expect(REGIONS.map((region) => region.name)).toEqual([
  '원도심·월영교권', '하회마을권', '도산·예끼마을권'
]);
expect(demoSnapshot.mode).toBe('demo');
expect(demoSnapshot.disclaimer).toContain('정책 판단 금지');
```

- [ ] Step 3: Run `npm test -- --run src/lib/domain.test.ts src/lib/demo.test.ts`; expected RED because exports are not yet implemented, not because the test runner is broken.
- [ ] Step 4: Implement the smallest typed domain and demo dataset. Demo points and scores are illustrative, use plausible Andong coordinates, and never claim to be observed API results. `src/app/layout.tsx` imports the global tokens and sets Korean metadata.
- [ ] Step 5: Run focused tests and then `npm test -- --run`, `npm run typecheck`, `npm run lint`, `npm run build`. Expected GREEN, zero type/lint/build errors. Report RED/GREEN evidence and changed files; do not commit.

## Task 2: KTO API response normalization and bounded fetch

**Files:** Create `src/lib/tourism/datalab.ts`, `src/lib/tourism/content.ts`, `src/lib/tourism/request.ts` and their focused tests only.

**Interfaces:** `fetchAndongVisitors(options: { serviceKey: string; startYmd: string; endYmd: string; fetchImpl?: typeof fetch }): Promise<VisitorRecord[]>`; `fetchAndongPlaces(options: { serviceKey: string; fetchImpl?: typeof fetch }): Promise<TourismPlace[]>`. Pure `normalizeVisitorItems(payload: unknown): VisitorRecord[]` and `normalizePlaceItems(payload: unknown): TourismPlace[]`. `VisitorRecord` has `baseYmd`, `signguCode`, `signguNm`, `visitorType`, `count`.

- [ ] Step 1: Write failing tests for missing/single/array `items.item`, a literal `touNum: '0'`, an absent `touNum`, API error header, missing coordinates, and pagination cap. One concrete fixture:

```ts
const response = { response: { header: { resultCode: '0000' }, body: {
  totalCount: 1, items: { item: { signguCode: 'x', signguNm: '안동시',
    baseYmd: '20260901', touDivCd: '2', touNum: '0' } } } } };
expect(normalizeVisitorItems(response)).toEqual([{
  baseYmd: '20260901', signguCode: 'x', signguNm: '안동시',
  visitorType: '2', count: 0
}]);
```

- [ ] Step 2: Run `npm test -- --run src/lib/tourism`; expected RED for missing normalizers/fetchers.
- [ ] Step 3: Implement URLSearchParams requests to HTTPS endpoints, max seven days per DataLab call and bounded pages, explicit `_type=json`, `MobileOS=ETC`, app name `WithLocal`. Resolve official Andong `sigunguCode` from `areaCode2` response by name; reject ambiguous/missing code. Never print full request URLs or keys. Validate `response.header.resultCode` and array-or-object item shapes.
- [ ] Step 4: Run focused tests, full suite, typecheck and lint. Expected GREEN. Report exact test counts and any live-response assumption not verified; do not commit.

## Task 3: PostGIS storage, published snapshot, and protected sync

**Files:** Create `db/migrations/001_init.sql`, `src/lib/db.ts`, `src/lib/snapshot.ts`, `src/lib/sync/run.ts`, `src/app/api/sync/route.ts`, and focused tests.

**Interfaces:** `loadSnapshot(): Promise<PublishedSnapshot>` returns demo only if `DATABASE_URL` is absent, else latest live snapshot or explicit live-empty/stale status. `runSyncBatch(options: { serviceKey: string; now?: Date }): Promise<{ status: 'published'|'busy'|'failed'; date: string }>` uses Task 2 fetchers and DB lease. The sync route accepts only `Authorization: Bearer <CRON_SECRET>`.

- [ ] Step 1: Write failing tests for no DB/demo, DB configured/latest fetch failed/stale live retained, unauthorized sync/401, duplicate date upsert, and overlapping lease/busy. The stale test must assert `mode === 'live'`, not just non-null data.
- [ ] Step 2: Run focused tests; expected RED for missing repository/sync behavior.
- [ ] Step 3: Implement PostgreSQL connection with one pooled connection, SSL and disabled prepared statements; create PostGIS extension/table indexes, unique content/date keys, a TTL lease, place geometry, task tables and a published snapshot record. Keep all SQL parameterized. Publish only after both fetch/normalize phases succeed; always release/expire lease after error. Bound one scheduled date window per invocation.
- [ ] Step 4: Add `src/app/api/sync/route.ts` for GET Cron and optional POST manual invocation using identical auth. Configure Node.js runtime and appropriate `maxDuration`; never return/log service key.
- [ ] Step 5: Run focused tests, full suite, typecheck, lint and build. Expected GREEN; report DB integration not exercised without a supplied Supabase instance; do not commit.

## Task 4: Map-first discovery, comparison, and evidence screens

**Files:** Create Task 4 exclusive paths; do not modify Task 1 global CSS/layout or Task 5 workflow paths.

**Interfaces:** Server pages import `loadSnapshot()` from Task 3. A `DiscoveryShell` Client Component receives serializable `PublishedSnapshot` and renders map/filters/drill-down. Routes: `/`, `/compare`, `/regions/[id]`. Use `REGIONS` and `RegionId`; never derive scientific zone scores from visitor context.

- [ ] Step 1: Write failing component tests that assert home renders a named map region and the `예시 데이터 · 정책 판단 금지` disclaimer; comparison displays three canonical region names; evidence detail displays source, spatial scope, period, and limitation. Add a test that live null score reads `산출 대기` rather than zero.
- [ ] Step 2: Run focused tests; expected RED for missing components/routes.
- [ ] Step 3: Implement responsive custom-CSS shell using the Claude Design export as visual reference: persistent header/left nav, warm ivory background, deep-green accent, clear status chips. The map uses Leaflet on the client only with configurable tile URL, visible OSM attribution and no prefetch; render a semantic list/table fallback when tiles fail. Show only verified POI markers in live mode. Filters and region selection update detail panel; evidence drawer returns focus when closed.
- [ ] Step 4: Implement 1440px desktop, 1024px notebook, 768px tablet, and <=767px mobile adaptations with no forced 1440px min-width. Add reduced-motion and high-contrast focus states.
- [ ] Step 5: Run focused tests, full suite, typecheck, lint and build. Expected GREEN; report screenshot/viewport checks pending integration; do not commit.

## Task 5: Protected workflow, field validation, and report screens

**Files:** Create Task 5 exclusive paths; do not modify Task 4 discovery paths or Task 1 shared layout.

**Interfaces:** Routes: `/actions`, `/field`, `/report`; session endpoint `POST /api/session`, `DELETE /api/session`; task endpoint `GET /api/tasks`, `POST /api/tasks`, `PATCH /api/tasks`. Task payload fields follow `ValidationTask` from Task 1. Admin cookie is HttpOnly/SameSite; no JS-readable token.

- [ ] Step 1: Write failing tests for wrong password, expired session, unauthenticated task POST/401, malformed task/400, DB missing/503, and authorized status transition. Write UI tests for action→validation connection, demo session-only save label, and report print content including date/source/limitations.
- [ ] Step 2: Run focused tests; expected RED for missing auth/workflow behavior.
- [ ] Step 3: Implement server-side credential check with timing-safe comparison, signed expiring cookie, and Zod or equivalent strict input validation. Use parameterized DB writes. No persistent changes in demo mode; UI explicitly labels demo actions as temporary. Route errors return consistent status and non-sensitive messages.
- [ ] Step 4: Implement task cards, field checklist with board/list and tablet layout, status/save feedback, evidence backlink, and print-friendly report with a real `window.print()` action. Link sharing may copy the report URL; no unsupported public-share claim.
- [ ] Step 5: Run focused tests, full suite, typecheck, lint and build. Expected GREEN; do not commit.

## Task 6: Integration, deployment guide, and release verification

**Files:** Modify `README.md`, create `vercel.json` and integration/e2e tests; only after explicit coordinator assignment change earlier-task files.

**Interfaces:** Consumes all public contracts from Tasks 1–5. No new product-level capability.

- [ ] Step 1: Write an end-to-end smoke test for six navigation routes and the demo provenance label; add a test for the map fallback and report print layout. Run tests and observe RED for any integration gap before fixing it.
- [ ] Step 2: Resolve wiring conflicts with targeted fixes and test RED→GREEN. Provide daily UTC Vercel Cron config, environment variable setup, SQL migration steps, local demo instructions, known API granularity, map tile provider requirement, and administrator setup in README. Do not paste a real key.
- [ ] Step 3: Run `npm test -- --run`, `npm run typecheck`, `npm run lint`, `npm run build` and browser viewport/screenshot smoke checks. Read all outputs; no success claim from exit codes alone.
- [ ] Step 4: Review every acceptance item in `DESIGN.md` against UI behavior, label blocked external deployment/configuration separately, and hand the diff to an independent reviewer. Fix Critical/Important review findings with failing tests then rerun the full suite. Do not commit or deploy.

## Execution Handoff

The user supplied the execution method: parallel native agents, with all production code authored by Terra. The coordinator owns the spec/plan, assigns non-overlapping files, handles interface integration, and dispatches independent reviews. The explicit no-question instruction supersedes the usual spec/plan review pauses. No source-control commit or external deployment is inferred from that autonomy request.

## Execution Record — 2026-09-21

Tasks 1–6 were implemented in the isolated worktree. Terra agents authored the application code in bounded lanes; the coordinator integrated, tested, and reviewed it. The unchecked boxes above preserve the original execution instructions, not an indication that implementation was skipped.

- Final local verification: 22 test files / 69 tests passed; `typecheck`, `lint`, and production `build` passed.
- A running production server passed the six-route HTTP smoke test, demo provenance, map fallback, report print markers, and unauthenticated task mutation rejection.
- Browser checks covered the discovery, comparison, evidence, workflow, and report screens; the 375px home and report had no document-level horizontal overflow. Map tiles loaded after initialization, with the accessible fallback list retained.
- Independent code review initially found two P2 issues (unpublished report date and failed-sync audit); both were corrected. Final read-only re-review found no actionable P1/P2 issue in the requested scope.
- External completion remains separate: no Supabase project/migration, Vercel deployment/Cron, production secrets, or live database sync was performed. A brief direct KTO response probe informed normalization but does not certify ongoing approval, quotas, or live data quality.
