# Development Changelog

Material product, architecture, requirement-status, and delivery decisions are appended here. The PRD/RFP remains authoritative; changelog entries describe implementation and verification state without changing requirements.

## 2026-08-23 — Phase 2 projects, teams, and mentor verification

**Branch:** `development-codex`

### Completed

- Connected production Student project list/search/detail/create, invitation deep links, dashboard states, Faculty queues, and permitted profile editing to persisted backend data while retaining the isolated **Prototype view** switch through Phase 7.
- Added bounded, rate-limited Student directory search and integrated the existing bounded authorized Faculty Mentor search into debounced selectors without downloading either directory.
- Completed atomic/idempotent project creation with the accepted Team Leader, invitation records, mentor request, expected equipment/consumable links, audit events, and notification/outbox records.
- Completed human-readable project states plus invitation accept/decline/cancel, accepted-member removal, mentor changes, Faculty approve/reject with required feedback, archive, expected-resource edits, and RFP-aligned re-verification behavior.
- Kept expected equipment and consumables advisory: Phase 2 selection creates requirement links and never reserves inventory, machines, quantities, or time.
- Added the directory-search index migration and updated the OpenAPI contract, roadmap, and persistent Codex context.

### Safari E2E verification

- Passed Student profile edit, team/mentor search, three-step creation, invitation/deep-link acceptance, pending-state progression, approval, resource-only verified edit, major-edit re-verification, member removal, invitation cancellation, mentor change, workflow notifications, and connected dashboard states.
- Passed Faculty pending/active/historical queues, full decision detail, required rejection reason/feedback, rejection transition, approval transition, and live queue/count updates.
- Observed no failed MakerSpace API response or unhandled UI error. Test records were removed afterward, and the real account's Student role plus original optional profile values were restored and verified.

### Verification

- Frontend lint passed with 0 errors and 11 existing Fast Refresh warnings; production build passed.
- Backend lint and TypeScript build passed; 31/31 tests passed across 7 suites.
- Prisma schema validation passed; all 6 migrations are applied and the local database is up to date.
- Root/frontend and backend production dependency audits report 0 vulnerabilities.
- Live frontend and backend health checks passed.

### Next

- Begin Phase 3 — Lab configuration, schedules, and slot availability.
- Actual asynchronous email delivery remains Phase 7; booking UI remains Phase 4; role-appropriate privileged shell cleanup remains QA-009 in Phase 6.
- Keep the Prototype view role switch until its required Phase 8 removal.

## 2026-08-23 — Dependency security remediation

**Branch:** `development-codex`

### Completed

- Closed the six dependency advisories reported for the default branch: five frontend dependency-chain alerts rooted in vulnerable `undici@7.28.0`, and one backend chain rooted in vulnerable `deepmerge-ts@7.1.5` through Prisma configuration.
- Overrode Undici to patched version `7.29.0` and explicitly retained Miniflare 4 for Nitro while Cloudflare/Wrangler continue using their compatible Miniflare 5 line.
- Pinned Prisma CLI and Prisma Client together at the audit-recommended safe version `6.12.0` and regenerated the Prisma client.
- Changed dependency metadata and lockfiles only; no RFP requirement, endpoint, schema, business rule, or mock-role-switch behavior changed.

### Verification

- Root/frontend `npm audit`: 0 vulnerabilities; dependency tree validation passed.
- Backend `npm audit`: 0 vulnerabilities; dependency tree validation passed.
- Frontend lint passed with 0 errors and 11 existing Fast Refresh warnings; production build passed.
- Backend lint, TypeScript build, and 24/24 tests across 6 suites passed.
- Prisma schema validation passed; all 5 local PostgreSQL migrations are applied and the database schema is up to date.

## 2026-08-23 — Phase 1 integration and identity foundation

**Branch:** `development-codex`

### Completed

- Replaced prototype production authentication with Google Identity Services backed by `/api/v1/auth/google/config`, CSRF-protected credential exchange, refresh-cookie rotation, `/auth/me`, and revocable logout.
- Added the shared authenticated frontend API/session layer, backend-derived five-role guards, real Student identity/profile rendering, and signed-out redirects to the public landing page.
- Connected Student onboarding to authenticated PRN policy, department, department-filtered programme, and academic-year APIs; Google email is verified and read-only.
- Preserved and verified the isolated five-role **Prototype view** switch as required through Phase 7; it grants no backend permissions.
- Added Google popup opener compatibility at the frontend response boundary for browsers where FedCM is unavailable.
- Fixed the real-browser regression where the immediate Google sign-in response omitted an existing Student's persisted academic profile until refresh.
- Retained the RFP scope boundary: project, booking, visit, equipment-operation, and privileged administration data remain assigned to their consecutive phases.

### Browser verification

- Real MIT-WPU Student Google sign-in passed in Safari with a 200 credential exchange and immediate dashboard update.
- Real onboarding passed with read-only verified email, preserved name/PRN, authenticated reference reads, department-filtered programme choices, persisted submission, and dashboard redirection.
- Session restoration passed after a full refresh without another Google prompt.
- Profile and Settings rendered persisted identity; Student access to Faculty, Lab Assistant, Admin, and Super Admin routes was denied.
- Logout revoked the session, and a signed-out dashboard request returned to the public landing page.
- All five Prototype view roles rendered successfully and remained isolated from API permissions.
- The Codex embedded browser could not reliably complete Google's macOS OAuth popup; this is a browser-surface limitation. The supported Safari flow passed cleanly.

### Verification

- Frontend lint: passed with 0 errors and 11 existing Fast Refresh warnings.
- Frontend production build: passed; only the existing bundle-size advisory remains.
- Backend lint and TypeScript build: passed.
- Backend tests: 24/24 passed across 6 suites.
- Prisma schema validation: passed.
- Prisma migration status: 5 migrations found; local PostgreSQL schema is up to date.
- Successful final Safari run: no failed MakerSpace API response and no unhandled UI error observed.

### Next

- Begin Phase 2 — Projects, teams, and mentor verification.
- Keep the Prototype view role switch until its required Phase 8 removal.

## 2026-08-23 — E2E issue triage and phased roadmap ownership

**Branch:** `development-codex`

### Completed

- Ran a browser E2E audit across landing, prototype sign-in, onboarding, session reload, Student profile, project creation, logout, Admin, Super Admin user search, validation, audit views, and frontend-proxied backend smoke responses.
- Recorded the evidence and ten issues in `Docs/E2E_QA_AUDIT_2026-08-23.md`.
- Corrected stale roadmap implementation-status statements without changing RFP requirements.
- Added priority and phase ownership for QA-001 through QA-010:
  - Phase 1: authentication/session/API integration, institutional identity enforcement, read-only verified email, reference-backed onboarding, backend-derived guards, and frontend lint gate.
  - Phase 2: persisted project/team/mentor integration.
  - Phase 6: persisted Admin/Super Admin data, actions, audit views, and privileged identity rendering.
  - Phase 8: client-safe error-envelope security acceptance, final E2E matrix, and removal of the prototype role switch.
- Explicitly retained the mock **Prototype view** role switch through Phases 1–7; it remains scheduled for removal only in Phase 8.
- Preserved the consecutive eight-phase implementation order and all Version 1/Future Scope boundaries.

### Verification

- Frontend build: passed.
- Frontend lint: failed with 21 existing formatting errors and 7 Fast Refresh warnings; tracked as QA-010 and required for the Phase 1 exit gate.
- Backend lint: passed.
- Backend TypeScript build: passed.
- Backend tests: 15/15 passed across 5 suites.
- Prisma schema validation: passed.
- Prisma migration status: 5 migrations found; local database schema is up to date.

### Remaining

- Start with Phase 1; close QA-001 through QA-005 and QA-010 for the Phase 1-owned integration surface before beginning Phase 2.
- Execute the manual Phase 1 checklist with real MIT-WPU Student and pre-provisioned privileged test accounts after frontend authentication integration is restored.
- Close domain-specific E2E issues in their assigned consecutive phases and retain the prototype role switch until Phase 8.
