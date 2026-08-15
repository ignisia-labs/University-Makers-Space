# UMS Shared Implementation Roadmap

**Project:** MIT-WPU University Maker's Space (UMS)  
**Baseline branch:** `backend-harsh`  
**Roadmap version:** 1.0  
**Last updated:** 2026-08-16 (Asia/Kolkata)  
**Source requirements:** `MakerSpace PRD.docx`  
**Detailed traceability:** `docs/audit/SRS_UniversityMakersSpace_20260816.md` and `docs/audit/FRS_UniversityMakersSpace_20260816.md`

This document is the shared execution page for local and remote contributors. It defines what currently works, what is still a prototype, the agreed eight delivery phases, and the acceptance checks required before a phase can be called complete.

## 1. Rules that apply to every phase

- PostgreSQL is the authoritative product data store. Do not add new production workflows to `makerspace-context.tsx`.
- Keep laboratories, capacities, operating hours, schedules, domains, departments, programmes, academic years, equipment, consumables, policies, and notification templates configurable. Do not hardcode client catalogue data into business logic.
- Google Workspace proves identity. Backend sessions, permissions, ownership checks, and persisted roles authorize actions.
- Never trust a frontend role, route, hidden button, QR payload, project ID, price, capacity, or availability value.
- The **Prototype view** role switch is for reviewing unfinished mock workspaces only. It never grants backend permissions and must be removed in Phase 8.
- Use the shared frontend API client in `src/lib/api-client.ts`; do not create per-screen `fetch` wrappers or store access tokens in local/session storage.
- All list endpoints must be paginated or intentionally bounded. Prevent unrestricted university-directory enumeration.
- Capacity, inventory, invitation decisions, mentor decisions, attendance, and state transitions must be transaction-safe and idempotent where retries are possible.
- Every material mutation must have validation, authorization, a stable error code, and an audit or domain-event plan.
- Append material changes and decisions to `DEVELOPMENT_CHANGELOG.md` and update the SRS/FRS status when a requirement changes state.
- Never commit `.env` files, access tokens, Google secrets, database credentials, or production data.
- Do not rewrite published Lovable/Git history. Use normal branches and pull requests.

## 2. What works now

### Connected and testable through the frontend

- Responsive landing page at `http://localhost:8081`.
- MIT-WPU Google Identity Services button and credential exchange.
- Login-CSRF protection and institutional Google token verification.
- Memory-only access tokens and HttpOnly rotating refresh sessions.
- Session restoration after browser refresh through `/auth/refresh` and `/auth/me`.
- Authenticated route guards, onboarding redirects, account-derived identity, and logout.
- New-student onboarding persisted to PostgreSQL.
- Database-backed active departments, department-filtered programmes, and academic-year options.
- Real signed-in name, email, PRN/profile information on the shell, dashboard, and profile page.
- Tab-scoped **Prototype view** switch for Student, Faculty Mentor, Lab Assistant, Admin, and Super Admin mock workspaces.

### Backend foundations that work through the API

- Permission-based authorization and deny-by-default privileged-role provisioning.
- User/session revocation behavior for account and role changes.
- Scoped project CRUD, member invitation creation, mentor request, and mentor decision foundations.
- Serializable, idempotent booking creation with slot locking and capacity/resource checks.
- Booking cancellation and controlled operational status transitions.
- Equipment catalogue endpoints and audited Lab Assistant availability updates.
- Event, notification, user administration, provisioning, and upload foundations.
- Authenticated reference reads for departments, programmes, academic years, labs, and equipment categories.
- Structured response envelopes, request IDs, Zod validation, Redis-backed rate limiting, logs, and Prisma error mapping.
- Versioned Prisma migrations and seed data for local development.

### Automated evidence currently available

- Backend TypeScript build passes.
- Frontend production build passes.
- Backend and frontend lint complete without errors. Existing UI-library Fast Refresh warnings remain.
- Ten backend unit/integration-style tests pass.
- Prisma schema validates and both migrations apply successfully to local PostgreSQL.
- Live local health, CORS, Google configuration, and authenticated reference-data smoke tests pass.

## 3. What is still mock or incomplete

- Student project list/detail/create UI still uses in-memory data.
- Invitation accept/decline and safe student/faculty search are missing.
- Atomic project submission including team, mentor, requirements, notifications, and retry handling is missing.
- Faculty approval UI is not connected end to end.
- Lab schedules, closures, slot generation, and availability APIs/UI are missing.
- Booking screens are not connected to real slot/project/booking APIs.
- Quick Visits, QR check-in/out, live occupancy, late arrival, and no-show workflows are missing.
- Consumables and most Admin configuration/reporting UI are missing.
- Workflow notifications, transactional email delivery, and near-real-time updates are missing.
- Service worker/offline UX, route splitting, accessibility/performance acceptance, CI/CD, staging, monitoring, backup/restore, load testing, and security acceptance are missing.
- No RFP launch gate has yet been proven against a production-like environment.

## 4. What can be tested now

### Local setup

```bash
git clone https://github.com/ignisia-labs/University-Makers-Space.git
cd University-Makers-Space
git switch backend-harsh
npm install
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
```

PostgreSQL and Redis must be running. Configure the real Google web client ID, local secrets, database URL, Redis URL, and `FRONTEND_URL=http://localhost:8081` in `backend/.env`. Google Cloud must allow `http://localhost:8081` as an authorized JavaScript origin.

Run the backend:

```bash
cd backend
npm run dev
```

Run the frontend in a second terminal:

```bash
npm run dev
```

Useful URLs:

- Frontend: `http://localhost:8081`
- Backend health: `http://localhost:4000/health`
- Swagger UI: `http://localhost:4000/api/docs`

### Manual Phase 1 acceptance checklist

1. Open the landing page and verify the official Google button renders without `Load failed`.
2. Sign in with a verified `@mitwpu.edu.in` Workspace account. A non-institutional account must be rejected by the backend.
3. For an incomplete Student account, verify redirection to onboarding.
4. Verify departments and academic years load from the API; selecting a department must filter programmes.
5. Verify invalid or non-10-digit PRNs cannot be submitted.
6. Complete onboarding and confirm redirection to the dashboard with the real name and PRN.
7. Refresh the browser. The session should restore without another Google prompt.
8. Open Profile and Settings and verify persisted identity plus logout.
9. On desktop, expand the sidebar and test every **Prototype view** role. Treat the displayed workspace records as mock data.
10. Sign out and verify protected routes redirect to the landing page.

### Automated checks

```bash
# Frontend
npm run lint
npm run build

# Backend
cd backend
npm run lint
npm run build
npm test
npx prisma validate
npx prisma migrate status
```

### API-only testing caveat

Swagger can exercise implemented backend foundations, but successful privileged operations require a genuinely provisioned account and correct persisted state. The Prototype view switch does not grant API permissions. Booking APIs also require valid seeded/configured slots, a verified project, accepted participants, and available resources.

## 5. The agreed eight phases

### Phase 1 — Integration and identity foundation

**Status:** Completed core on `backend-harsh`.

Deliverables:

- Shared frontend API/error client.
- Google sign-in handshake, session restoration, refresh coordination, `/auth/me`, and logout.
- Authenticated and role-aware route guards.
- Connected Student onboarding.
- Authenticated reference-data reads.
- Real identity/profile rendering.
- Local database migration/seed and Phase 1 test coverage.

Exit gate:

- The manual Phase 1 checklist passes with a real MIT-WPU account.
- Builds, lint, tests, Prisma validation, and migrations pass.

### Phase 2 — Projects, teams, and mentor verification

**Goal:** Make the complete pre-booking project journey real and remove project-related in-memory state.

Deliverables:

- Safe, paginated teammate and Faculty Mentor search.
- Atomic/idempotent project draft and submission contract.
- Project metadata, domain, team members, invitations, mentor request, equipment requirements, and consumable requirements.
- Invitation accept, decline, expiry, cancellation, and duplicate-response behavior.
- Faculty queue plus approve/reject flow with reasons.
- Connected Student project list/detail/create/edit UI and Faculty verification UI.
- Ownership, eligibility, state-transition, audit, and notification-outbox tests.

Exit gate:

- A Student can create a solo or team project, complete invitations, request a mentor, and receive an approval/rejection using only persisted data.
- An unapproved or incomplete project cannot proceed to booking.

### Phase 3 — Lab configuration, schedules, and slot availability

**Goal:** Generate bookable availability entirely from configurable lab policy.

Deliverables:

- Admin CRUD for labs, weekly schedules, holidays/closures, slot duration, booking horizon, capacities, cancellation window, and late-arrival policy.
- Idempotent slot generation/regeneration service and scheduled job.
- Availability API by lab/date/resource with remaining attendee and equipment capacity.
- Time-zone-safe handling using the lab's configured time zone.
- Connected calendar/date/slot selection UI.
- Tests for weekends, closures, schedule changes, horizon boundaries, and duplicate generation.

Exit gate:

- Admin configuration produces deterministic slots; Students see only active, future, policy-compliant availability with no hardcoded dates or capacities.

### Phase 4 — End-to-end bookings and QR reservations

**Goal:** Connect the existing transactional booking core to the real Student experience.

Deliverables:

- Booking flow using verified projects, accepted participants, slots, equipment, and consumables.
- Clear capacity/conflict errors and alternative-slot suggestions.
- Booking history/detail/cancellation UI.
- Server-generated QR credential with only a hash stored server-side; explicit expiry/revocation rules.
- Near-real-time availability revalidation after create/cancel/status changes.
- Real PostgreSQL concurrent-booking tests plus load tests for peak slot release.

Exit gate:

- Concurrent requests cannot exceed lab/equipment capacity, retries do not duplicate bookings, and the Student can create, view, and cancel a real reservation end to end.

### Phase 5 — Quick Visits, attendance, and Lab Assistant operations

**Goal:** Operate physical entry, exit, occupancy, and exception handling.

Deliverables:

- Quick Visit request/cancel flow with the separately configurable visitor capacity.
- QR scan/verify for booked Students versus visitors, with clear identity and reservation details.
- Check-in, check-out, manual override, rejection, duplicate scan, late arrival, no-show, and visit-history behavior.
- Live occupancy calculated from authoritative attendance records.
- Lab Assistant operations dashboard with today's queue, incidents, capacity, and equipment availability actions.
- Audit and concurrency tests for occupancy and repeated scans.

Exit gate:

- Lab Assistants can safely process every supported arrival/departure path and occupancy never exceeds the configured booked/visitor limits.

### Phase 6 — Resources, administration, and reporting

**Goal:** Remove remaining catalogue/configuration mocks and give administrators safe operational control.

Deliverables:

- Equipment category/catalogue CRUD, visibility, status, quantity, specifications, images, and maintenance behavior.
- Consumable categories, stock/availability, project requirements, and booking allocations.
- Department, programme, academic-year, project-domain, and other reference-data administration.
- User activation, provisioning, role management, and session-revocation UI.
- Audit-log review and initial project/booking/visit/equipment utilization reports with safe CSV export.
- Pagination, filtering, archive/restore strategy, and audit coverage.

Exit gate:

- An authorized Admin can maintain launch configuration without direct database edits, while a Lab Assistant remains limited to operational availability actions.

### Phase 7 — Notifications, email, and near-real-time updates

**Goal:** Make every approval, invitation, booking, incident, and reminder reliably reach the right people.

Deliverables:

- Transactional outbox/domain events for invitation, mentor decision, booking, cancellation, reminder, incident, no-show, and administrative changes.
- Queue worker with retry/backoff, deduplication, dead-letter handling, and delivery-attempt records.
- Approved institutional email provider and editable templates.
- Connected in-app notification centre and read/unread state.
- SSE/WebSocket or controlled revalidation for availability, approvals, notifications, and occupancy.
- Worker, retry, duplicate-delivery, authorization, and failure-observability tests.

Exit gate:

- Required recipients reliably receive one logical notification per event, failures are observable/retryable, and relevant screens update without a manual full-page refresh.

### Phase 8 — Production readiness and launch acceptance

**Goal:** Prove the product is secure, scalable, accessible, installable, observable, and operable for the university launch.

Deliverables:

- Remove `makerspace-context.tsx` production workflow dependencies and remove the **Prototype view** role switch.
- Complete PWA icons, service worker, installability, safe caching, offline shell, and offline/error/recovery UX.
- Route-level code splitting and bundle/performance work.
- WCAG 2.1 AA-oriented automated and manual accessibility verification.
- End-to-end browser/device matrix for Student, Faculty, Lab Assistant, Admin, and Super Admin.
- Security review: CSP, permissions policy, cookie/TLS configuration, rate limits, upload hardening, dependency/security scanning, and abuse cases.
- Representative 40,000-user capacity model, booking-race load tests, and performance/SLO evidence.
- CI/CD, development/staging/production environments, migration gates, rollback, monitoring, alerts, error tracking, logs/metrics/traces, backups/PITR, and restore drill.
- RFP acceptance matrix signed off with client-approved catalogue, policies, roles, and content.

Exit gate:

- No mock role/data path remains in production.
- Every launch-critical RFP condition has test evidence and operational ownership.
- Staging acceptance, security/load gates, backup restore, and production smoke/rollback procedures pass.

## 6. Remote team workflow

1. Start from the latest remote baseline:

   ```bash
   git fetch origin
   git switch backend-harsh
   git pull --ff-only
   git switch -c phase-<number>/<short-scope>-<name>
   ```

2. Pick one bounded work item from the **current phase**. Do not start a later phase if it depends on an unfinished contract.
3. Before implementation, write or confirm the API contract, state transitions, permissions, error codes, and database constraints relevant to the item.
4. Avoid editing the same core file in multiple parallel branches. Recommended lanes inside a phase:
   - data model/migrations and backend service;
   - API contract/controllers/authorization;
   - frontend query/mutation/UI states;
   - automated tests and acceptance fixtures.
5. Rebase is not required and published history must not be rewritten. Merge or update normally according to the repository owner's PR policy.
6. Before requesting review, update this roadmap if scope/status changed, append the changelog, and run the phase checks.
7. Open a pull request into `backend-harsh` with:
   - RFP/SRS/FRS requirement IDs addressed;
   - schema/API/UI behavior changed;
   - migrations and rollback considerations;
   - authorization and concurrency reasoning;
   - automated/manual verification evidence;
   - screenshots for visible changes.

## 7. Copy-paste implementation prompt

Replace the bracketed fields before giving this prompt to a teammate or coding agent.

```text
You are contributing to the MIT-WPU University Maker's Space (UMS) repository.

Repository: https://github.com/ignisia-labs/University-Makers-Space
Baseline branch: backend-harsh
Assigned phase: Phase [NUMBER] — [PHASE NAME]
Assigned work item: [ONE BOUNDED DELIVERABLE]
Owner/branch: phase-[NUMBER]/[SHORT-SCOPE]-[NAME]

Before making changes, read these sources completely:
1. MakerSpace PRD.docx
2. docs/IMPLEMENTATION_ROADMAP.md
3. docs/audit/SRS_UniversityMakersSpace_20260816.md
4. docs/audit/FRS_UniversityMakersSpace_20260816.md
5. DEVELOPMENT_CHANGELOG.md
6. backend/docs/api-contract.md and backend/docs/openapi.yaml for affected APIs

Use backend-harsh as the source-of-truth baseline. Work only inside the assigned phase/item and preserve existing unrelated changes. Do not rewrite published Git history.

Architecture constraints:
- PostgreSQL is authoritative; do not add production state to makerspace-context.tsx.
- Keep all university/lab/catalogue/policy values configurable rather than hardcoded.
- Google identity is not authorization. Enforce persisted roles, named permissions, ownership, eligibility, and state transitions on the backend.
- The Prototype view switch is mock navigation only and must never grant API access.
- Use src/lib/api-client.ts and the existing auth/session lifecycle.
- Use Zod validation, standard API envelopes/errors, bounded/paginated reads, audit/domain events, and Prisma migrations.
- Design retried mutations to be idempotent and capacity/inventory/state changes to be transaction/concurrency safe.
- Never expose secrets, unrestricted directory data, raw QR secrets after creation, or internal-only fields.

Required workflow:
1. Inspect the current implementation and map the assigned item to its RFP/SRS/FRS IDs.
2. State assumptions and define the API contract, permissions, state transitions, failure codes, and data constraints before coding.
3. Implement the smallest complete vertical slice: migration/model (if needed), service, authorization, controller/routes, typed frontend API/query integration, loading/empty/error/success UX, and tests.
4. Do not label mock UI or schema-only work as complete.
5. Add unit/integration tests, including unauthorized, validation, ownership, duplicate/retry, and concurrency cases where relevant.
6. Run frontend lint/build and backend lint/build/tests plus Prisma validation/migration checks when the schema changes.
7. Update backend/docs/api-contract.md, backend/docs/openapi.yaml, requirement status in the audit files, docs/IMPLEMENTATION_ROADMAP.md, and DEVELOPMENT_CHANGELOG.md when behavior changes.
8. Return a concise handoff containing changed files, migrations, endpoints, permissions, tests run, remaining gaps, and exact manual test steps.

Definition of done:
- The assigned deliverable works end to end with persisted data.
- Backend authorization is independently correct even if the frontend is bypassed.
- No relevant values are hardcoded.
- Error, empty, loading, retry, responsive, and accessible states are handled.
- Tests and documentation pass the current phase's exit gate.

Do not begin a later phase or broaden the feature without explicit approval. If a required decision or client catalogue value is unavailable, make the value configurable, document the assumption, and stop only when proceeding would produce incompatible behavior.
```

## 8. Coordination record

Use pull requests/issues for active assignments. At minimum, record:

| Phase | Work item  | Owner | Branch/PR | Status | Dependencies | Last updated |
| ----- | ---------- | ----- | --------- | ------ | ------------ | ------------ |
| 2     | Unassigned | —     | —         | Ready  | Phase 1      | 2026-08-16   |

Only the repository owner or designated technical lead should change a phase from **In progress** to **Complete**, after its exit gate has evidence.
