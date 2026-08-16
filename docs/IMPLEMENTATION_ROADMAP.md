# UMS Shared Implementation Roadmap

**Project:** MIT-WPU University Maker's Space (UMS)  
**Baseline branch:** `backend-harsh`  
**Roadmap version:** 1.2 — Phase 2 implementation

**Last updated:** 2026-08-16 (Asia/Kolkata)  
**Source requirements:** `MakerSpace PRD.docx`  
**Detailed traceability:** `docs/audit/SRS_UniversityMakersSpace_20260816.md` and `docs/audit/FRS_UniversityMakersSpace_20260816.md`

This document is the shared execution page for local and remote contributors. It defines what currently works, what is still a prototype, the agreed eight delivery phases, and the acceptance checks required before a phase can be called complete. `MakerSpace PRD.docx` Version 1.0 is authoritative: when this roadmap, current code, stakeholder notes, or a proposed implementation differs from the RFP, contributors must follow the RFP and record the discrepancy rather than silently expanding scope.

## 1. Rules that apply to every phase

- PostgreSQL is the authoritative product data store. Do not add new production workflows to `makerspace-context.tsx`.
- Keep the Version 1 architecture a modular monolith with clear Auth, Users, Projects, Resources, Booking, Visits, Notifications, and Administration boundaries; do not introduce premature microservices.
- Keep the MakerSpace name, capacities, operating hours, schedules, departments, programmes, academic years, equipment, consumables, categories, approval requirements, and policies configurable. Do not hardcode client catalogue data into business logic.
- Google Workspace proves identity. Backend sessions, permissions, ownership checks, and persisted roles authorize actions.
- Never trust a frontend role, route, hidden button, project ID, participant count, capacity, equipment availability, or entity state.
- The **Prototype view** role switch is for reviewing unfinished mock workspaces only. It never grants backend permissions and must be removed in Phase 8.
- Use the shared frontend API client in `src/lib/api-client.ts`; do not create per-screen `fetch` wrappers or store access tokens in local/session storage.
- All list endpoints must be paginated or intentionally bounded. Prevent unrestricted university-directory enumeration.
- Booking capacity, project membership acceptance, project verification, role assignment, attendance, and state transitions require strong consistency. Retry-prone actions such as project/booking creation, invitation acceptance, Faculty decisions, and cancellation must be idempotent.
- Important privileged and operational mutations must have validation, authorization, stable error codes, and the RFP-required audit fields. Email, non-critical notifications, and analytics may be eventually consistent.
- Append material changes and decisions to `DEVELOPMENT_CHANGELOG.md` and update the SRS/FRS status when a requirement changes state.
- Never commit `.env` files, access tokens, Google secrets, database credentials, or production data.
- Do not rewrite published Lovable/Git history. Use normal branches and pull requests.

### Version 1 scope boundary

The following RFP items are deliberately **Future Scope** and must not be added to Phases 1–8 unless the RFP is formally revised:

- AI recommendations, booking assistance, or safety guidance.
- Mandatory barcode or QR scanning, university ID/NFC/RFID, or automated entry hardware.
- Equipment-specific reservations or full machine scheduling engines.
- 3D-printing or laser-cutting file/job queues.
- Consumable stock accounting, purchasing, warehouse functions, or issue/return inventory.
- Machine IoT telemetry, preventive maintenance, equipment issue-ticket workflows, or safety-training/certification systems.
- Multi-laboratory Student booking and academic-timetable integration. Version 1 remains one MakerSpace while keeping every operational entity linked to a future-proof `Lab`.
- Project documents/uploads, project storage allocation, workshops/events, push-notification expansion, advanced analytics, HOD dashboards, expanded project lifecycle/showcases, smart-capacity recommendations, waitlists, recurring bookings, external collaborators, payments, grading, and university-wide project management.

Project Domain/Category is optional/future-configurable in Version 1. The required project information is Project Name and Project Description.

## 2. What works now

### Connected and testable through the frontend

- Responsive landing page at `http://localhost:8081`.
- MIT-WPU Google Identity Services button and credential exchange.
- Login-CSRF protection and institutional Google token verification.
- Memory-only access tokens and HttpOnly rotating refresh sessions.
- Session restoration after browser refresh through `/auth/refresh` and `/auth/me`.
- Authenticated route guards, onboarding redirects, account-derived identity, and logout.
- New-student onboarding persisted to PostgreSQL.
- Student PRNs are normalized, unique, and validated through a configurable institutional pattern/hint rather than a hardcoded digit count. MIT-WPU must set and accept the final production pattern.
- Database-backed active departments, department-filtered programmes, and academic-year options.
- Real signed-in name, email, PRN/profile information on the shell, dashboard, and profile page.
- Tab-scoped **Prototype view** switch for Student, Faculty Mentor, Lab Assistant, Admin, and Super Admin mock workspaces.
- Database-backed Student profile editing, scoped/paginated project lists and details, atomic project submission, email-first teammate invitations, Faculty Mentor search, invitation decisions, mentor decisions, expected-resource editing, and in-app notification links.

### Backend foundations that work through the API

- Permission-based authorization and deny-by-default privileged-role provisioning.
- User/session revocation behavior for account and role changes.
- Complete scoped project/team/mentor workflow with idempotent aggregate submission, re-verification rules, audit records, and pending email-delivery records.
- Serializable, idempotent booking creation with slot locking and attendee-capacity checks. The current service also blocks/reserves equipment and consumables; that behavior conflicts with the RFP's advisory-only Version 1 equipment model and must be corrected in Phase 4.
- Booking cancellation and controlled operational status transitions.
- Equipment catalogue endpoints and audited Lab Assistant availability updates.
- Notification, user administration, and provisioning foundations.
- Authenticated reference reads for departments, programmes, academic years, labs, and equipment categories.
- Structured response envelopes, request IDs, Zod validation, Redis-backed rate limiting, logs, and Prisma error mapping.
- Versioned Prisma migrations and seed data for local development.
- Events and general uploads exist in the codebase but are Future Scope and do not count toward Version 1 completion.
- QR-related booking fields/behavior exist in the current backend but are Future Scope and must not be exposed as a Version 1 requirement or attendance workflow.

### Automated evidence currently available

- Backend TypeScript build passes.
- Frontend production build passes.
- Backend and frontend lint complete without errors. Existing UI-library Fast Refresh warnings remain.
- Fourteen backend unit/integration-style tests pass.
- Prisma schema validates and all five migrations apply successfully to local PostgreSQL.
- Live local health, CORS, Google configuration, and authenticated reference-data smoke tests pass.

## 3. What is still mock or incomplete

- The project/profile/Faculty Mentor workflows are connected; only the explicitly labelled Prototype view uses mock project data when previewing a role the signed-in account does not actually hold.
- Lab schedules, closures, slot generation, and availability APIs/UI are missing.
- Booking screens are not connected to real slot/project/booking APIs.
- Quick Visits, manual Lab Assistant check-in/out, live occupancy, late arrival, overstay, and no-show workflows are missing.
- Admin catalogue/configuration/reporting UI is missing; consumable inventory is not part of Version 1.
- Project workflow notifications and pending email-delivery records exist. The asynchronous email worker/provider, retries, templates, and near-real-time updates remain Phase 7.
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
5. Verify invalid PRNs are rejected by the configured policy and valid PRNs are normalized; record MIT-WPU acceptance of the production pattern.
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

Swagger can exercise implemented backend foundations, but successful privileged operations require a genuinely provisioned account and correct persisted state. The Prototype view switch does not grant API permissions. Booking APIs require valid configured slots, a verified project, accepted participants, and attendee capacity. Current equipment/consumable blocking and QR behavior are known RFP deviations scheduled for correction in Phase 4.

### Manual Phase 2 acceptance checklist

Before testing, ensure at least one actual Faculty Mentor is provisioned. For local development, set `SEED_FACULTY_MENTOR_EMAIL` and `SEED_FACULTY_MENTOR_NAME` in `backend/.env`, then run `npm run prisma:seed`.

1. Sign in as an onboarded Student, open Profile, edit permitted fields, save, refresh, and confirm the persisted values remain.
2. Open Projects, test search and the empty/list state, then create a solo project using a configured Faculty Mentor and optional equipment/consumables.
3. Confirm the project shows “Waiting for Faculty Mentor approval,” the Team Leader is accepted, and resources are described as expectations rather than reservations.
4. Enter the MIT-WPU email of a Student who has never used the app. Open the invitation link as that Student, sign in with the matching verified Google account, complete onboarding, and confirm the invitation reopens so it can be accepted or declined exactly once.
5. As Team Leader, cancel a pending/declined invitation or remove an accepted member. Confirm the human-readable status and re-verification behavior.
6. Open the pre-provisioned Faculty Mentor's secure email review link in a private browser. Confirm the full submission is visible without app login, approve one project, reject another with a required reason, and verify the Team Leader notification/state changes.
7. Confirm a project becomes Verified only when every retained invitation is accepted and the Faculty Mentor has approved.
8. Edit major details or change the Faculty Mentor on a verified project and confirm it returns to the correct pending state. Confirm resource-only changes remain advisory and do not invalidate approval.
9. Open Notifications for each account and confirm invitation, team-response, mentor-decision, and verification records link to the relevant project.
10. Repeat create/invitation/decision requests through the UI or API and confirm idempotent behavior without duplicate projects or memberships.

## 5. The agreed eight phases

### Phase 1 — Integration and identity foundation

**Status:** Completed core on `backend-harsh`.

Deliverables:

- Public landing page and MIT-WPU Google CTA.
- Shared frontend API/error client.
- Google sign-in handshake, session restoration, refresh coordination, `/auth/me`, and logout.
- Default Student creation plus deny-by-default pre-provisioned Faculty Mentor, Lab Assistant, Admin, and Super Admin identity handling.
- Authenticated and role-aware route guards for all five roles.
- Short connected Student onboarding with Google email read-only; full name, PRN, department, programme/class, and year; division/section only when required; and phone only if institutionally required. Both client and server validate required fields.
- Authenticated reference-data reads.
- Real identity/profile rendering.
- Local database migration/seed and Phase 1 test coverage.

Exit gate:

- The manual Phase 1 checklist passes with a real MIT-WPU account.
- Builds, lint, tests, Prisma validation, and migrations pass.

### Phase 2 — Projects, teams, and mentor verification

**Status:** Implemented on `backend-harsh`; real multi-account/manual acceptance and the final MIT-WPU PRN pattern remain environment/client acceptance items.

**Goal:** Make the complete pre-booking project journey real and remove project-related in-memory state.

Deliverables:

- Student profile view/edit behavior for the Student's own permitted fields, including replacement of the fixed 10-digit assumption with the client-confirmed normalized/unique MIT-WPU PRN validation rule.
- Email-first teammate invitations that do not require a supplied Student database or a pre-existing account. The Student enters teammate MIT-WPU addresses directly; only authorized Faculty Mentors are selected from the bounded, indexed, server-side directory supplied by the university.
- Project list/search and detail for projects where the Student is Team Leader or Member. Each result shows Project Name, Team Leader, member count, Faculty Mentor, verification status, and next booking when applicable.
- Project Detail sections for header/status, overview/description, Team Leader and member acceptance, Faculty Mentor/approval, expected equipment, expected consumables, and role-appropriate actions; its bookings section is connected in Phase 4.
- Required Project Name and Project Description. Domain/Category remains optional and is shown only when configured; it must not block Version 1 project creation.
- Explicit states: Draft, Team Acceptance Pending, Mentor Approval Pending, Verified, Rejected, and Archived. UI uses human-readable status messages rather than enum names.
- Atomic/idempotent project creation: create the project, accepted Team Leader membership, invitations, Faculty Mentor request, equipment/consumable requirement links, audit/domain events, and asynchronous notification jobs as one consistent operation.
- Configured equipment and consumables are expected project requirements only; selecting them does not reserve stock, quantities, machines, or time.
- Invitation records and Pending, Accepted, Declined, Cancelled, and—if expiration is enabled—Expired behavior. A teammate may be invited before registration; the matching verified Google identity is linked on first sign-in, incomplete Students complete onboarding, and the email/deep link then returns them to the relevant invitation. Repeated responses are idempotent.
- A project becomes Verified only after all required invited members accept and the assigned Faculty Mentor approves. Declined invitations and pending conditions remain visible in human language.
- Faculty Dashboard and project lists for Pending Approval, Active Projects, and Historical Projects, plus a public secure email review page. The signed action token stays in the URL fragment rather than server/access logs, expires after seven days, records the Faculty identity from the pre-provisioned request, is idempotent, and does not require Faculty app login. The decision view includes project name/description, leader, team, expected equipment/consumables, and submission date. Reject requires a reason.
- Pre-verification Team Leader editing, invitation cancellation, accepted-member removal, Faculty Mentor changes, and post-verification major edits with the RFP-defined re-verification effects. Faculty change revokes the previous approval and returns the project to Mentor Approval Pending; resource-change approval effects remain policy-configurable.
- Connected Student Dashboard states for new user, pending invitation, pending mentor approval, and relevant quick actions.
- Ownership, privacy, eligibility, state-transition, idempotency, rate-limit, audit, and notification-generation tests.

Exit gate:

- A Student can manage their profile, create a solo or team project, complete invitations, declare expected requirements, request an authorized Faculty Mentor, and receive an approval/rejection using only persisted data; Faculty may approve or reject via their signed email link without app login.
- Project lists, details, dashboard states, Faculty queues, edits, member removal, mentor changes, and re-verification rules match the RFP.
- Only a verified project led by the signed-in Team Leader can proceed to booking.
- Phase 2 must create the correct notification/email-queue records and deep-link targets for both unregistered Students and provisioned Faculty. Actual asynchronous provider delivery remains open until Phase 7 because production mail credentials have not been supplied.

### Phase 3 — Lab configuration, schedules, and slot availability

**Goal:** Generate Version 1 MakerSpace availability entirely from configurable lab policy while retaining a future-proof Lab relationship without adding multi-lab Student booking.

Deliverables:

- Admin configuration for MakerSpace name, weekly available days/hours, date-based closures/special hours, slot duration, attendee capacity, booking horizon, cancellation window, optional maximum future bookings per project, Quick Visit rules, and project-verification requirements.
- Initial configurable values—not hardcoded rules—of 08:30 opening, 18:30 closing, 60-minute slots, and 20 Student booking capacity. Client-approved changes must require no code deployment.
- Audited configuration changes with the appropriate confirmation UX.
- Idempotent dated slot generation/regeneration from weekly configuration and date exceptions rather than manual per-slot entry.
- Availability API by date/project/participant count with start/end time, remaining attendee capacity, and advisory availability for the selected project's configured equipment requirements.
- MIT-WPU local-time display with consistent internal timestamps, preferably UTC, and no scattered frontend timezone assumptions.
- Connected date and slot selection UI with no hardcoded dates, schedules, capacity, or catalogue data.
- Tests for all configured operational days, closures, special hours, schedule changes, horizon/cancellation boundaries, time zones, and duplicate generation.

Exit gate:

- Version 1 operates the single MakerSpace through Lab-scoped data. Admin configuration produces deterministic policy-compliant slots and Students see correct future dates, remaining participant places, and advisory equipment status.
- Multi-laboratory selection and academic-timetable integration remain Future Scope.

### Phase 4 — End-to-end capacity bookings

**Goal:** Connect the existing transactional booking core to the real Student experience.

Deliverables:

- RFP flow: Select eligible verified project → automatically select all accepted members → allow deselection → keep the Team Leader selected unless configured policy permits otherwise → choose date → choose slot → confirm.
- Derive participant count from validated accepted-member IDs. Capacity is consumed by selected participants, not number of projects or browser-provided counts.
- Display the selected project's equipment requirements and current availability for each slot as advisory information. Equipment unavailability must not block a general MakerSpace capacity booking in Version 1; equipment-specific reservations remain Future Scope.
- Remove/disable current Version 1 booking behavior that reserves or rejects based on equipment/consumable quantities. Do not create consumable allocations or stock accounting.
- Atomically lock/retrieve slot occupancy, recalculate confirmed capacity, validate selected participants and booking policy, create booking/participant history, commit, publish availability, and enqueue notifications.
- Clear conflict UX showing the updated remaining places plus Refresh Availability and alternate slots instead of a generic error.
- Confirmed, Cancelled by Student, Cancelled by Lab Assistant, No Show, Completed, and In Progress where applicable; historical rows are never deleted.
- Student Slots experience with Upcoming, Available Slots, and Past sections plus booking detail and eligible Team Leader cancellation.
- Update the Student Dashboard to prioritize an upcoming booking with project, date, slot, selected participants, and booking status, and show only actions the signed-in Student can actually perform.
- Cancellation releases reserved attendee capacity, preserves actor/reason/time and original booking/project/participant details, and triggers relevant notification/operations updates.
- Idempotency for creation and cancellation, controlled revalidation/real-time publication, real PostgreSQL concurrency tests, and peak booking load tests.
- QR/barcode credentials are not generated, returned, or required by the Version 1 booking/attendance UI. They remain Future Scope.

Exit gate:

- Concurrent requests cannot exceed the configured attendee capacity, retries do not duplicate bookings, and a Team Leader can create, view, and cancel a real reservation end to end.
- Equipment status is visible but does not create an equipment-specific reservation or incorrectly block MakerSpace capacity booking.
- Historical booking facts remain intact when related current records later change.
- Booking/cancellation notification events must be persisted; actual email delivery and live-client propagation remain open until Phase 7.

### Phase 5 — Quick Visits, attendance, and Lab Assistant operations

**Goal:** Operate physical entry, exit, occupancy, and exception handling.

Deliverables:

- A short Quick Visit request using only necessary fields such as Student, purpose, requested/current time, status, entry time, and exit time. Exact operating rules come from configuration; the RFP does not mandate a separate Quick Visit capacity or a fixed value of 10.
- Student Visit History showing date, Project Slot or Quick Visit type, project when applicable, entry time, exit time, and status.
- Lab Assistant navigation for Live, Bookings, Visits, Equipment, and Projects.
- Live Operations showing current slot, expected teams, expected participants, actual arrivals, current status, upcoming slots, and current physical occupancy.
- Booking detail actions to mark selected individuals entered/exited or mark the entire team arrived/exited, recording actual timestamps and responsible Lab Assistant.
- No mandatory manual PRN request during normal entry. Team/project/name selection is primary; manual search remains a fallback.
- No Show or Lab Assistant cancellation with actor, timestamp, reason/status, preserved history, notification, and capacity release when operationally appropriate.
- Live occupancy calculated from entered-but-not-exited attendance and kept separate from reserved booking capacity.
- Late arrivals remain allowed with actual timestamps. Overstaying Students remain shown as inside until the Lab Assistant records exit.
- Transaction, idempotency, authorization, occupancy, individual/team-action, no-show, late-arrival, overstay, and history tests.
- No mandatory barcode or QR scanning; scanning and automated entry remain Future Scope.

Exit gate:

- Lab Assistants can answer who is expected and who is physically inside, process individual/team arrivals and exits without mandatory PRN or scanning, manage no-shows, and retain accurate visit history.
- Reserved capacity and physical occupancy remain separate, and late arrivals/overstays behave exactly as specified by the RFP.
- Attendance/equipment operations must emit the required update events; cross-client real-time delivery remains open until Phase 7.

### Phase 6 — Resources, administration, and reporting

**Goal:** Remove remaining catalogue/configuration mocks and give administrators safe operational control.

Deliverables:

- Configurable equipment categories and resources with RFP fields: ID, name, category, description, Lab, image, total/available quantity, operational status, Student visibility, booking visibility, notes, and timestamps.
- RFP availability semantics such as Available, Partially Available, In Use, Reserved, Unavailable, Under Maintenance, Damaged, and Out of Service, with aggregate quantity/status handled consistently.
- Student Equipment screen backed by the API with category, availability, and search filters plus image, name, category, status, and description.
- Fast Lab Assistant availability updates with reason categories such as Maintenance, Damage, Temporary Issue, or Other; changes propagate to Student equipment and slot views.
- Admin management of persistent equipment properties. Preventive-maintenance scheduling, telemetry, issue tickets, certification, and dedicated machine reservations remain Future Scope.
- Consumable categories/items with name, category, description, active/inactive, optional unit type, and Student selection for project requirements only. No Version 1 stock quantity, consumption, booking allocation, purchase, or issue/return workflow.
- Department, programme, academic-year, equipment/consumable category, and other required reference-data administration. Project Domain/Category stays optional and cannot become a mandatory Version 1 field.
- Super Admin indexed/paginated search by name, email, or role; pre-provision Faculty Mentor/Lab Assistant/Admin/Super Admin; change or disable privileged access; review account status; manage authorized permissions; invalidate/re-evaluate sessions; and audit sensitive changes.
- Admin project, booking, and visit oversight plus operational dashboards focused on current occupancy, today's booking utilization, active projects, equipment unavailable, upcoming booking volume, and pending operational issues rather than decorative analytics.
- Super Admin dashboard for privileged accounts, platform-health summary, MakerSpace configuration, audit events, permission/governance work, and the future-proof Lab relationship without enabling multi-lab Student booking.
- Audit-log review containing actor, actor role, action, entity/type/ID, before/after where appropriate, timestamp, request ID, and policy-permitted IP/device metadata.
- Initial operational reporting/export for bookings by date, visits by date, projects, and equipment availability. The RFP does not prescribe CSV as the only format and excludes advanced BI.
- Server-side pagination/filtering/search, appropriate confirmation for destructive or sensitive actions, and audit coverage.

Exit gate:

- Students can browse the real equipment and consumable-requirement catalogues; Lab Assistants can change only live availability; Admins can maintain persistent operational data; and only Super Admins can manage privileged roles/permissions.
- Version 1 contains no consumable inventory, machine-job, preventive-maintenance, or advanced-analytics workflow.

### Phase 7 — Notifications, email, and near-real-time updates

**Goal:** Deliver the RFP-required workflow messages asynchronously and keep live operational views current.

Deliverables:

- Transactional notification/outbox events for Student Team Invitation, Faculty Mentor Request, Project Verification, Project Rejection with reason, Booking Confirmation, Booking Cancellation, and relevant in-app events including team acceptance/decline, mentor decisions, equipment issues, and system announcements.
- Optional booking reminders only when later enabled by configuration; they are not a mandatory Version 1 launch behavior.
- Asynchronous queue/worker: the business transaction succeeds, a notification job is created, the worker calls an institution-approved provider, transient failures retry, delivery attempts/final failures are logged, and user APIs never wait for provider delivery.
- Idempotent event/delivery handling so a retried business action creates one logical notification.
- Paginated in-app Notification Centre with unread indicator, recent notifications, read state, and direct links to the relevant project or booking.
- SSE, WebSocket, pub/sub-backed revalidation, or lightweight periodic revalidation for slot capacity, equipment status, active occupancy, and Lab Assistant attendance changes. The selected mechanism degrades gracefully after disconnection.
- Worker, retry, duplicate-delivery, privacy, authorization, deep-link, pagination, real-time disconnect/recovery, and failure-alerting tests.
- Push notifications and university-messaging integration remain Future Scope.

Exit gate:

- Required recipients reliably receive one logical email/in-app notification per RFP event, failures are observable/retryable without delaying user actions, and relevant live screens update or gracefully fall back to controlled revalidation.

### Phase 8 — Production readiness and launch acceptance

**Goal:** Prove the product is secure, scalable, accessible, installable, observable, and operable for the university launch.

Deliverables:

- Remove `makerspace-context.tsx` production workflow dependencies and remove the **Prototype view** role switch.
- Finalize the public landing page content: what the MakerSpace is, what Students can build, how access works, resource highlights where desired, and primary MIT-WPU Google CTA. Use an approved cover video or comparable modern media treatment as directed by the RFP. Visual treatment must be premium, modern, calm, professional, university-appropriate, and aligned with the MIT-WPU theme rather than generic SaaS styling.
- Complete the RFP navigation and action-oriented dashboards without decorative KPI overload: Student primary/secondary navigation including Help, focused Faculty dashboard, live Lab Assistant console, operational Admin dashboard, and governance-focused Super Admin dashboard.
- Enforce the shared design system for typography, spacing, colours/semantic statuses, radii, shadows, forms, buttons, cards, navigation, dialogs/sheets, tables, loading, empty, error, and success states. No colour-only statuses or page-specific design inventions.
- Responsive acceptance for desktop, mobile, tablet/iPad portrait and landscape: keyboard-friendly desktop, touch-first tablet with no hover dependency, and single-column mobile with large touch targets, compact/bottom navigation, guided booking, minimal typing, and sticky actions where useful.
- WCAG 2.1 AA-oriented checks for contrast, keyboard navigation, visible focus, labels, semantic HTML, screen-reader status messages, accessible dialogs, reduced motion, and touch targets.
- Loading/error/form UX: no indefinite spinner; every remote state supports loading, success, empty, error, and retry; primary content uses skeletons; forms preserve recoverable values, disable duplicate submission, and place client/server errors clearly. Include the RFP's meaningful empty states for Students without projects, Faculty without approvals, and Lab Assistants without current bookings. Avoid confirmation dialogs for reversible low-risk actions; confirm booking cancellation, project rejection, privileged role changes, and operationally significant unavailability changes.
- Validate the fewer-clicks principle throughout: retain known context, avoid repeated fields, giant dropdowns, modal overload, technical language, dense mobile tables, and actions the user cannot perform. The booking flow remains Select Project → Select Attendees → Choose Slot → Confirm.
- Complete PWA manifest, required icons, standalone/HTTPS launch, registered service worker, installability, home-screen launch, and explicit offline state. Cache only safe shell/static/reference content; never treat slot capacity, booking status, live equipment availability, permissions, or attendance as authoritative cache data. Block offline booking/attendance writes.
- Route-level code splitting, lazy loading, optimized images, server pagination, request deduplication, safe caching/prefetching/background revalidation, and removal of duplicate calls/oversized global state.
- Meet/evidence the RFP performance targets where feasible: landing LCP about ≤2.5 seconds, routine API reads generally <500 ms, search suggestions about <500–800 ms after debounce, booking generally <2 seconds, and near-instant cached/shell navigation under representative conditions.
- Security verification for authentication, sessions/cookies, CSRF, redirect allowlists, backend authorization/ownership/state, mass assignment, SQL injection, XSS, malformed/oversized input, rate limits, CSP, HSTS, X-Content-Type-Options, Referrer-Policy, frame protection, Permissions-Policy, privacy, log redaction, TLS, managed secrets, encryption at rest in managed storage, and least-privilege storage/database access. Do not store sensitive data in browser localStorage. Machine/project file-submission security remains Future Scope.
- Explicit threat tests: Student calling Admin API, changing another project ID, modifying browser role state, sending arbitrary participant IDs/counts, duplicate booking, expired invitation, and disabled-user authentication.
- Capacity model for the RFP population of 20,000+ Students and approximately 2,000+ Faculty/Lab Assistant/Admin users, including peak simultaneous authentication/search/booking demand. Keep application servers stateless, use shared database/session/queue/cache/real-time services, configure connection pooling, and monitor connections/query/transaction duration.
- Full automated/manual test matrix: unit, real-database integration, authentication/provisioning, booking concurrency, end-to-end Student/Faculty/operations flows, responsive, accessibility, security, performance, and load tests across latest Chrome, Edge, Safari, modern Firefox, Android Chrome, iOS Safari, iPadOS Safari, and Android tablets.
- Prove all ten RFP critical scenarios: New Student, pre-provisioned Faculty, project verification, rejected project, booking, concurrent booking, Student cancellation, Lab entry, Lab exit, and equipment failure propagation.
- Define and enforce retention for projects, bookings, visits, audit logs, and personal data. Preserve original booking date/time, project, participants, cancellation, and attendance history.
- Development/staging/production separation; CI/CD lint/type/unit/integration/build/security/staging/smoke/controlled-production gates; versioned/backward-safe migrations where practical; staging migration tests; recovery/rollback plan; and no direct manual production schema edits.
- Automated backups, point-in-time recovery where available, retention policy, documented recovery, and a tested restore process.
- Target 99.9% monthly availability excluding scheduled maintenance, prioritizing booking/attendance during MakerSpace operating hours.
- Centralized logs, metrics, error/performance/database monitoring, request tracing/correlation IDs, and uptime monitoring with alerts for elevated errors, authentication spikes, database/queue/email failures, booking anomalies, high latency, and outages.
- RFP acceptance matrix signed off using client-approved catalogue, operational policies, roles, content, retention, and configuration. Do not include Future Scope features in the Version 1 launch gate.

Exit gate:

- No mock role/data path remains in production.
- All 23 RFP launch-readiness criteria and all ten critical end-to-end scenarios have evidence and operational ownership.
- Staging, responsive/browser, accessibility, security, performance/load, installability/offline, monitoring, backup/restore, migration, and production smoke/recovery gates pass.
- Version 1 contains no Future Scope behavior presented as a launch requirement.

## 6. RFP coverage index

This index prevents phase grouping from changing or hiding the RFP scope. Section numbers refer to `MakerSpace PRD.docx` Version 1.0.

| RFP sections | Requirement area                                                                                                                                                      | Roadmap ownership                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1–6          | Vision, goals, non-goals, scale, configuration, UX principles                                                                                                         | Global rules, Version 1 boundary, Phase 8                                                         |
| 7–12         | Google authentication, provisioning, roles, permissions, onboarding                                                                                                   | Phase 1; profile correction/edit in Phase 2; administration/security acceptance in Phases 6 and 8 |
| 13–15        | Landing page, Student navigation, adaptive dashboard                                                                                                                  | Phases 1, 2, 4, and final Phase 8 acceptance                                                      |
| 16–26        | Projects, states, teams, invitations, mentor selection/approval, requirements, Faculty views                                                                          | Phase 2                                                                                           |
| 27–40        | Configured slots, participant capacity, booking flow, advisory equipment status, concurrency, conflict UX, states, cancellation/history                               | Phases 3 and 4; notifications/revalidation in Phase 7                                             |
| 41–52        | Quick Visits, visit history, Lab Assistant console, manual entry/exit, occupancy, no-show                                                                             | Phase 5                                                                                           |
| 53–63        | Equipment, consumable-requirement catalogue, Admin configuration, Super Admin governance                                                                              | Phase 6                                                                                           |
| 64–68        | Email, in-app notifications, notification centre, scalable search                                                                                                     | Search in Phases 2 and 6; delivery/realtime in Phase 7                                            |
| 69–83        | Responsive desktop/tablet/mobile, PWA/offline, visual system, accessibility, performance, loading/errors                                                              | Phase 8                                                                                           |
| 84–106       | Scalability, consistency, security, privacy, audit, protection, backups, reliability, observability, alerts                                                           | Global rules and Phase 8; domain consistency in Phases 2–7                                        |
| 107–117      | Data/API architecture, frontend state/forms/time, schedule generation/closures, retention, initial analytics/reporting                                                | Domain phases 2–7 and production acceptance in Phase 8                                            |
| 118–124      | Unit/integration/E2E/concurrency/responsive/accessibility/security/performance/load testing, browser support, deployment, CI/CD, migrations, secrets                  | Phase-specific tests plus Phase 8 acceptance                                                      |
| 125–153      | Modular-monolith/scaling/caching/connection architecture, threat cases, UX rules, dashboards, ownership, project edits, capacity/attendance/history, future-proof Lab | Global rules and Phases 2–8                                                                       |
| 154–184      | Future Scope                                                                                                                                                          | Explicitly excluded from Version 1 phases                                                         |
| 185–187      | Success metrics, 23 launch criteria, product summary                                                                                                                  | Phase 8 acceptance and operational evidence                                                       |

## 7. Remote team workflow

1. Start from the latest remote baseline:

   ```bash
   git fetch origin
   git switch backend-harsh
   git pull --ff-only
   git switch -c development-<name>
   ```

2. Begin with the first incomplete phase. Complete bounded work items within that phase; if its exit gate passes and time remains, continue only to the next consecutive phase. Never skip a dependency.
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

## 8. Copy-paste implementation prompt

Replace the bracketed fields before giving this prompt to a teammate or coding agent.

```text
You are contributing to the MIT-WPU University Maker's Space (UMS) repository.

Repository: https://github.com/ignisia-labs/University-Makers-Space
Baseline branch: backend-harsh
Starting phase: Phase [NUMBER] — [PHASE NAME]
Starting work item: [ONE BOUNDED DELIVERABLE OR COMPLETE PHASE]
Owner/branch: development-[NAME]

Before making changes, read these sources completely:
1. MakerSpace PRD.docx
2. docs/IMPLEMENTATION_ROADMAP.md
3. docs/audit/SRS_UniversityMakersSpace_20260816.md
4. docs/audit/FRS_UniversityMakersSpace_20260816.md
5. DEVELOPMENT_CHANGELOG.md
6. backend/docs/api-contract.md and backend/docs/openapi.yaml for affected APIs

Use backend-harsh as the code baseline and MakerSpace PRD.docx Version 1.0 as the requirements authority. If code, roadmap wording, stakeholder notes, or the proposed solution conflicts with the RFP, stop, record the conflict, and follow the RFP unless the repository owner supplies a formal scope revision. Start at the first assigned/incomplete phase and, if time permits, continue only to the next consecutive phase after the current phase exit gate passes. Preserve unrelated changes and do not rewrite published Git history.

Architecture constraints:
- PostgreSQL is authoritative; do not add production state to makerspace-context.tsx.
- Keep all university/lab/catalogue/policy values configurable rather than hardcoded.
- Google identity is not authorization. Enforce persisted roles, named permissions, ownership, eligibility, and state transitions on the backend.
- The Prototype view switch is mock navigation only and must never grant API access.
- Use src/lib/api-client.ts and the existing auth/session lifecycle.
- Use Zod validation, standard API envelopes/errors, bounded/paginated reads, audit/domain events, and Prisma migrations.
- Design retried mutations to be idempotent and booking capacity, membership, verification, role, attendance, and state changes to be transaction/concurrency safe.
- In Version 1, equipment/consumables are configured project requirements and equipment availability is advisory during capacity booking; do not create equipment-specific reservations or consumable inventory/allocation behavior.
- Never expose secrets, unrestricted directory data, browser-controlled participant counts/permissions, or internal-only fields.
- Do not implement RFP Future Scope: QR/barcode/NFC entry, equipment-specific reservations, consumable inventory, files/job queues, multi-lab Student booking, timetable integration, events, AI, IoT/maintenance, advanced analytics, waitlists, recurring bookings, external collaborators, or other deferred capabilities.

Required workflow:
1. Inspect the current implementation and map the assigned item to its RFP/SRS/FRS IDs.
2. State assumptions and define the API contract, permissions, state transitions, failure codes, and data constraints before coding.
3. Implement the smallest complete vertical slice: migration/model (if needed), service, authorization, controller/routes, typed frontend API/query integration, loading/empty/error/success UX, and tests.
4. Do not label mock UI or schema-only work as complete.
5. Add unit/integration tests, including unauthorized, validation, ownership, duplicate/retry, and concurrency cases where relevant.
6. Run frontend lint/build and backend lint/build/tests plus Prisma validation/migration checks when the schema changes.
7. Update backend/docs/api-contract.md, backend/docs/openapi.yaml, requirement status in the audit files, docs/IMPLEMENTATION_ROADMAP.md, and DEVELOPMENT_CHANGELOG.md when behavior changes.
8. Return a concise handoff containing changed files, migrations, endpoints, permissions, tests run, remaining gaps, and exact manual test steps.
9. After each completed phase, create a clearly labelled commit and record the phase evidence. If time runs out mid-phase, report it as Partial and stop at a safe commit; never mark it Complete.

Definition of done:
- The assigned deliverable works end to end with persisted data.
- Backend authorization is independently correct even if the frontend is bypassed.
- No relevant values are hardcoded.
- Error, empty, loading, retry, responsive, and accessible states are handled.
- Tests and documentation pass the current phase's exit gate.
- No Future Scope feature is counted toward Version 1 completion.

Do not skip an incomplete prerequisite phase or broaden the feature without explicit approval. If a required decision or client catalogue value is unavailable, keep the RFP-defined value configurable, document the dependency, and do not invent a product rule that changes Version 1 scope.
```

## 9. Coordination record

Use pull requests/issues for active assignments. At minimum, record:

| Phase | Work item  | Owner | Branch/PR | Status | Dependencies | Last updated |
| ----- | ---------- | ----- | --------- | ------ | ------------ | ------------ |
| 2     | Unassigned | —     | —         | Ready  | Phase 1      | 2026-08-16   |

Only the repository owner or designated technical lead should change a phase from **In progress** to **Complete**, after its exit gate has evidence.
