# UMS Development Changelog

This log records product context, implementation decisions, and material changes made during development. Dates use the project timezone: Asia/Kolkata.

## 2026-08-15 — Project context ingested

- Confirmed product: MIT-WPU MakerSpace Management Platform (UMS), an internal, responsive Progressive Web App for MakerSpace operations.
- Reviewed `MakerSpace PRD.docx` (v1.0 draft) and the current frontend prototype.
- Confirmed Version 1 primary workflow: institutional identity → student onboarding → project/team → faculty mentor verification → resource requirements → capacity-aware booking → MakerSpace attendance.
- Confirmed roles: Student, Faculty Mentor, Lab Assistant, Admin, and Super Admin. Authentication and authorization must be separate; privileged actions require server-side permission checks.
- Confirmed operational constraints: configurable hours, slot duration, booking horizon and capacity; initial stated capacity is 20 booked attendees, with a separate Quick Visit capacity of 10. These values must remain configuration, not hardcoded product rules.
- Confirmed the equipment catalogue, categories, domains, schedules, lab configuration, consumables and future labs must all be editable/configurable.
- Confirmed UX priorities: minimum necessary clicks, polished responsive mobile/tablet/desktop experience, accessible semantic statuses, and PWA installation/offline support.
- Confirmed future extensibility: a lab entity should underpin resources, bookings, visits and schedules even though Version 1 operates a single MakerSpace; AI assistance is deferred/prototype-only and must be grounded in the configured catalogue.
- Current codebase status: a TanStack Start + React + TypeScript frontend prototype exists with role-based screens and in-memory state. It is not yet a production backend implementation for Google authentication, transactional booking, real-time updates, email delivery, persistent data, or server-side authorization.

## 2026-08-15 — Backend-branch architecture audit

- Audited the `ansh_backend` branch against the MakerSpace PRD and a 40,000-user target.
- Decision: do not connect the current frontend to the backend or deploy it as the MakerSpace production system yet. Its data model and booking logic do not represent the required project, mentor, participant, lab-capacity, quick-visit, attendance, QR, and configuration workflows.
- The existing backend is a useful Express/Prisma foundation: it has TypeScript, PostgreSQL via Prisma, JWT middleware, request validation, basic RBAC, Redis, structured logging, API envelopes and external upload storage.
- Production blockers identified: unrestricted password registration instead of institutional Google Sign-In; role-model mismatch; no frontend API integration; booking inventory is decremented permanently and lacks time-overlap/capacity-safe concurrency; no Lab, slot, visit/attendance, mentor, resource-requirement, configuration or audit-log models; and no database migration history.
- Verification: frontend build passed; backend TypeScript build passed; backend has three passing mocked/schema-level tests; backend lint did not run in isolation due to a missing local ESLint configuration and repository-wide lint currently fails on 137 formatting errors. No database, Redis, Cloudinary, load, or end-to-end browser test was possible without real runtime infrastructure.

## 2026-08-16 — Institutional authentication and domain redesign

- Replaced password registration/login with MIT-WPU Google Workspace identity verification. The backend validates Google's signature and audience plus `email_verified`, the signed hosted-domain (`hd`) claim, and the configured `@mitwpu.edu.in` domain; Google `sub` is persisted as the stable identity.
- Added server-side sessions with 15-minute access tokens, one-time refresh-token rotation, hashed refresh tokens, replay-triggered revocation, login CSRF protection, HttpOnly cookies, session revocation on role/account changes, and sign-in audit records.
- Adopted deny-by-default privilege provisioning. New institutional users receive only `STUDENT`; Faculty Mentor, Lab Assistant, Admin, and Super Admin roles must be pre-provisioned by a Super Admin. Replaced route role checks with named server-side permissions.
- Redesigned the PostgreSQL/Prisma domain around configurable labs, operating schedules, closures and generated slots; department/programme-backed student profiles; equipment and consumables; project teams and mentor approvals; selected booking participants and resource reservations; Quick Visits; attendance visits; events; notifications/delivery attempts; uploads; sessions; and audit logs.
- Added a fresh baseline migration with relational constraints, high-use indexes, normalized institutional-email and 10-digit PRN checks, positive capacity/range checks, exactly-one-source attendance records, and a partial unique index limiting each project to one pending mentor request.
- Replaced permanent inventory decrement booking behavior with serializable, slot-row-locked booking checks. Booking capacity and equipment reservations are calculated per slot, repeated client requests are protected by a user-scoped idempotency key, status changes are locked and audited, cancellation rules come from lab configuration, and only QR hashes are stored.
- Updated the existing project, user, equipment, event, notification, upload, booking, seed, serializer, API contract, OpenAPI, and Google setup documentation to match the new domain.
- Verification completed: ESLint passed; TypeScript build passed; four authentication/validation tests passed; Prisma schema validation passed; npm production dependency audit reported zero vulnerabilities; and the baseline migration plus seed ran successfully against a disposable local PostgreSQL 17 database (32 public tables, one seeded lab, seven schedule rows). The verification database was removed afterward.
- Remaining implementation slices are explicitly not treated as complete: frontend Google Identity Services integration, project-invitation acceptance, lab/slot/closure administration and slot generation, Quick Visit APIs, QR check-in/out APIs, notification/email workers, production Redis/Cloudinary integration tests, and load/end-to-end testing.

## 2026-08-16 — Google Identity Services frontend bootstrap

- Added the asynchronous Google Identity Services client library to the application root document head so it is available on every frontend route without blocking HTML parsing.

## 2026-08-16 — RFP conformance cross-check

- Re-read the full `MakerSpace PRD.docx` Version 1 requirements and traced them against the current frontend, backend routes/services, Prisma schema/migration, infrastructure configuration, and automated tests.
- Conclusion: the RFP is not complete and the product is not launch-ready. Estimated Version 1 implementation is approximately one-third complete; this is an engineering coverage estimate, not an acceptance score.
- Confirmed the strongest completed backend foundations: institutional Google token verification, persisted/rotating sessions, privileged role provisioning, permission checks, scalable relational schema/migration, capacity-safe idempotent booking creation, and policy-aware cancellation.
- Confirmed the primary blocker: the frontend remains an in-memory prototype with no product API client, no Google credential handshake, no authenticated route guards, and a local prototype role switch.
- Confirmed missing launch-critical work: invitation accept/decline, atomic project submission/resources/notifications, faculty/teammate search, lab configuration and slot generation/availability APIs, real-time updates, Quick Visits, check-in/out/live occupancy, consumables APIs, Lab Assistant availability route, email worker, PWA service worker/offline behavior, concurrency/E2E/load/security/accessibility tests, CI/CD, staging, monitoring/alerts, and backup/restore operations.
- Recorded a specific authorization defect: Lab Assistants receive `equipment.availability.manage`, but the existing equipment update route requires `equipment.manage`, preventing the RFP-required operational availability update.
- Added detailed traceability reports under `docs/audit/`: `SRS_UniversityMakersSpace_20260816.md` and `FRS_UniversityMakersSpace_20260816.md`.
- Verification during the audit: frontend lint passed with eight warnings; frontend production build passed with a bundle-size warning; backend lint/build passed; four backend tests passed. Existing tests remain insufficient for RFP launch acceptance.

## 2026-08-16 — Google sign-in UI and Lab Assistant equipment availability

- Replaced the landing-page mock onboarding link with Google's official rendered Sign in with Google control and connected the complete login-CSRF/credential exchange to the backend.
- Added in-memory authentication state, backend-derived onboarding/role routing, loading/error/retry behavior, and configurable `VITE_API_BASE_URL`; the GIS library remains asynchronously loaded from Google's documented URL.
- Added `PATCH /api/v1/equipment/:id/availability`, protected by `equipment.availability.manage`, so Lab Assistants can update only operational status and available quantity without receiving catalogue-management access.
- Required a reason for each operational availability change, locked the equipment row during the update, enforced the total-quantity invariant, and atomically recorded before/after audit metadata.
- Kept full equipment creation, catalogue edits, and retirement restricted to `equipment.manage`; updated the API/OpenAPI and RFP traceability documents and added permission/validation regression coverage.

## 2026-08-16 — Local authentication runtime repair

- Diagnosed the landing-page Google Sign-In `Load failed` state as an unavailable backend on port 4000 rather than a Google Identity Services rendering failure.
- Added explicit `.env` loading for the backend runtime and Prisma seed process so local configuration is consistently available outside Prisma CLI commands.
- Improved the frontend network failure message so unavailable authentication infrastructure is distinguishable from invalid Google credentials.
- Initialized the local `ums_dev` PostgreSQL database, applied the baseline migration, seeded configurable reference/lab/equipment data, and verified the health and Google configuration endpoints with the configured frontend CORS origin.
- Corrected the documented and local development frontend origin from port 5173 to the project runtime's port 8081 so browsers can read credentialed authentication responses through CORS.

## 2026-08-16 — Phase 1 frontend/backend foundation

- Added a shared typed frontend API client with standard response/error parsing, credentials-included requests, memory-only access tokens, one coordinated refresh operation, one protected-request retry, request IDs, and authentication-loss handling.
- Connected full browser session lifecycle: refresh-cookie restoration, `/auth/me`, logout, backend-derived identity/permissions, onboarding redirects, and role route guards.
- Connected the Student onboarding screen to authenticated reference-data endpoints and backend persistence. Departments, department-filtered programmes, and academic-year choices now come from active database records; PRN validation and backend field-aware errors are surfaced in the UI.
- Added authenticated read endpoints for departments, programmes, academic years, labs, and equipment categories. Academic-year choices are now configurable schema data, seeded through migrations instead of a hardcoded accepted range.
- Updated the shell, dashboard, profile, and settings experiences to show real authenticated identity/profile data and provide responsive logout access; project/reservation/operations datasets remain explicitly mocked for later vertical slices.
- Hardened Express async authentication/rate-limit middleware error propagation and marked auth responses `Cache-Control: no-store` to prevent stale browser identity/permission responses.
- Added reference-data authentication/filter/validation integration coverage and updated the API/OpenAPI plus RFP SRS/FRS traceability records.
- Retained the frontend-only prototype role switch until Phase 8 so stakeholders can review every mock workspace with one authenticated account. The selected preview role never changes the persisted account role or backend permissions, and is stored only for the current browser tab.

## 2026-08-16 — Shared eight-phase implementation roadmap

- Added `docs/IMPLEMENTATION_ROADMAP.md` as the shared execution source for local and remote contributors.
- Recorded the current working/testable baseline, mock-versus-persisted boundaries, local setup and Phase 1 acceptance checklist.
- Consolidated remaining RFP delivery into eight ordered phases with deliverables and evidence-based exit gates; Phase 8 explicitly removes the temporary Prototype view role switch.
- Added remote branching/PR coordination rules and a reusable implementation prompt that requires RFP traceability, backend authorization, configurable data, complete vertical slices, tests, documentation, and explicit handoff evidence.
