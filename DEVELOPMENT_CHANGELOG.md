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
