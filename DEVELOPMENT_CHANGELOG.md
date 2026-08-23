# Development Changelog

Material product, architecture, requirement-status, and delivery decisions are appended here. The PRD/RFP remains authoritative; changelog entries describe implementation and verification state without changing requirements.

## 2026-08-23 — Phase 4 end-to-end capacity bookings

**Branch:** `development-codex`

### Completed

- Connected the production Student Slots experience to persisted APIs: eligible verified Team Leader projects, accepted-member selection, configurable Team Leader attendance, date/slot choice, advisory equipment, confirmation, Upcoming/Past history, booking detail, cancellation, Project Detail previews, and Dashboard upcoming-booking priority.
- Redesigned the Phase 4 booking schema around immutable Lab/project/slot/policy/participant snapshots and append-only status history. Removed Version 1 booking resource-allocation tables and booking/Quick Visit QR fields; equipment and consumables remain advisory as required by the RFP.
- Implemented payload-bound create/cancel idempotency, explicit PostgreSQL project/slot/booking row locks, exact capacity recalculation, actionable conflicts, bounded retries, atomic Redis mutation limits, audit records, deduplicated notifications, and pending email-delivery outbox rows.
- Enforced the Version 1 verified-project rule in booking creation, availability, API validation, the Admin policy UI, and a database constraint. Team Leader attendance remains configurable.
- Preserved Student creation notes across operational status changes, scoped participant email/PRN values to self or operational readers, and bounded Project Detail to the 20 most recent immutable booking previews while retaining paginated full history.
- Added paginated verified-project selection beyond the first 50 records, excluded elapsed slots on the current date, double-checked stale slot reconciliation after the Lab lock, and added global temporal/status indexes for bounded operational booking lists.
- Retained the isolated **Prototype view** switch through Phase 7; it still grants no backend permission.

### Verification

- Backend lint and TypeScript build passed; 76/76 tests passed across 12 suites. Frontend production build passed and lint has 0 errors with the same 11 pre-existing Fast Refresh warnings.
- Prisma validation passed; all 10 migrations are applied locally. A temporary empty database successfully applied migrations 1–10 and proved status history present, legacy allocation tables absent, QR columns absent, the verified-project constraint present, and all three global operational booking-list indexes present; that temporary database was then removed.
- The guarded real-PostgreSQL concurrency suite passed repeatedly. Its latest 40-request burst produced exactly 20 confirmations and 20 `SLOT_CAPACITY_EXCEEDED` conflicts at occupancy 20/20 in 280 ms. Capacity races, exact create/cancel replay, changed-payload protection, future-booking limits, capacity release, immutable snapshots, audit/outbox uniqueness, removed artifacts, and strict cleanup also passed.
- Root/frontend and backend production dependency audits report 0 vulnerabilities, OpenAPI YAML parses, and `git diff --check` passes.
- Local runtime smoke checks passed for the backend health endpoint and the frontend development server. The automated browser connector had no available browser session during final acceptance, so no authenticated visual result is being claimed from that check.

### Remaining acceptance

- Complete the authenticated Phase 4 manual browser checklist in the shared roadmap at mobile, tablet/iPad, and desktop widths. Phase 3 manual acceptance remains independently open; the stakeholder explicitly authorized Phase 4 development to proceed.
- Phase 7 still owns actual asynchronous email delivery and cross-client near-real-time propagation. Phase 8 still owns production-like load, soak, failure/recovery, deployment sizing, monitoring, and launch acceptance for approximately 40,000 registered users.
- Begin Phase 5 only after the stakeholder accepts Phase 4 or explicitly authorizes the next phase.

## 2026-08-23 — Phase 3 lab configuration and availability

**Branch:** `development-codex`

### Completed

- Added Lab-scoped Admin policy for the MakerSpace name, seven-day operating schedule, date closures/special hours, slot duration, attendee capacity, horizon, cancellation window, optional future-booking limit, Quick Visit settings, and project-verification requirement.
- Added optimistic configuration versions, database constraints, audit history, explicit confirmation UX, and deterministic bulk slot reconciliation that preserves historical or occupied records.
- Connected production Admin configuration and Student date/slot availability UI to authenticated APIs while retaining the isolated **Prototype view** switch through Phase 7.
- Added project/participant-aware capacity display and advisory project-equipment availability without reserving equipment or creating a booking before Phase 4.
- Added institutional Admin provisioning through `SEED_ADMIN_EMAIL`; the local environment provisions `ignisia@mitwpu.edu.in` without hardcoding that address into authorization logic.
- Changed request limiting so requests with a cryptographically verified access token are isolated by token subject and campus users behind a shared NAT are not incorrectly treated as one user; route-specific limits and downstream session validation remain enforced.

### Verification

- Backend lint and TypeScript build passed; 45/45 tests passed across 9 suites. Frontend production build passed and lint has 0 errors with the same 11 Fast Refresh warnings.
- Prisma schema validation passed; all 7 migrations are applied to local PostgreSQL.
- Real API/PostgreSQL checks passed for configuration reads/writes, stale-version rejection, 15-day horizon, closure/reopening, slot counts, and idempotent regeneration retaining 150 unique slots.
- Temporary QA users, date exceptions, and two regeneration audit records created by verification were removed; the original MakerSpace name and open schedule were restored.
- Manual browser acceptance across Admin/Student roles and responsive widths remains pending before the phase is marked complete.

### Next

- Run the still-open Phase 3 manual checklist in the roadmap; the stakeholder explicitly authorized Phase 4 implementation while that independent acceptance record remains pending.
- Production readiness for approximately 40,000 registered users still requires Phase 8 staging load/concurrency tests, deployment sizing, monitoring, and failure/recovery acceptance.

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
