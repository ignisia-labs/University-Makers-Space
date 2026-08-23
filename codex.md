# University Makers Space — Codex Context

This file is the persistent engineering context for this repository. Update it whenever the architecture, API, schema, service topology, or major state flow changes.

## Runtime and service topology

| Concern           | Implementation                                                   | Local endpoint                                    |
| ----------------- | ---------------------------------------------------------------- | ------------------------------------------------- |
| Web application   | React 19, TypeScript, Vite 8, TanStack Start/Router, React Query | `http://127.0.0.1:5174`                           |
| API               | Node.js, Express 4, TypeScript                                   | `http://127.0.0.1:4000`                           |
| API documentation | Swagger UI backed by `backend/docs/openapi.yaml`                 | `http://127.0.0.1:4000/api/docs` (non-production) |
| Database          | PostgreSQL accessed only through Prisma                          | `ums_dev` by default                              |
| Cache/queues      | Redis, ioredis, BullMQ                                           | `redis://localhost:6379` by default               |
| Uploads           | Multer memory uploads forwarded to Cloudinary                    | Cloudinary account required                       |

The frontend proxies `/api` and `/health` to port 4000 in development. It does **not** import backend code: Vite explicitly excludes `backend/` from scanning and watching. Backend service configuration belongs in `backend/.env` (ignored by Git). It needs database, Redis, JWT, Cloudinary, CORS origin, Google client, and PRN policy settings. `GOOGLE_CLIENT_SECRET` may be kept there for future OAuth flows, but the current Google ID-token verifier uses `GOOGLE_CLIENT_ID` only.

Dependency security baseline (2026-08-23): root/frontend and backend `npm audit` both report zero vulnerabilities. The frontend pins Miniflare 4 for Nitro's optional peer and overrides Undici to patched `7.29.0`, while Cloudflare/Wrangler retain their compatible Miniflare 5 line. Backend Prisma CLI and Client are pinned together at audit-recommended `6.12.0`; upgrade them only as a matched pair and re-run generate, validate, migration status, tests, and both audits.

## Project layout

```text
src/                         React/TanStack Start frontend
  routes/                    File-based route modules
  components/                Feature and shared UI components
  components/ui/             Radix/shadcn-style primitives
  lib/                       API/query clients, mock-state provider, utilities, errors
  assets/                    Landing/equipment imagery
backend/                     Independently-installed Express application
  src/app.ts                 Middleware and API router composition
  src/modules/               Vertical slices: routes → controllers → services → Zod schemas
  src/middleware/            Auth, authorization, validation, safety middleware
  src/config/                Validated environment, Prisma, Redis, logging, permissions
  prisma/schema.prisma       PostgreSQL data model
  prisma/migrations/         Versioned SQL migrations
  prisma/seed.ts             Reference-data and initial-user seeding
  docs/                      OpenAPI contract and Google auth notes
```

## Frontend architecture

`src/router.tsx` creates the TanStack Router and a `QueryClient`. `src/routes/__root.tsx` wraps every route in `QueryClientProvider`, `MakerSpaceProvider`, a toast provider, and SSR error/CSRF handling from `src/start.ts`.

`src/start.ts` also sets `Cross-Origin-Opener-Policy: same-origin-allow-popups` on application responses so Google Identity Services can return popup credentials when FedCM is unavailable.

Routes are file-based:

| URL                                                     | Module             | Purpose                                        |
| ------------------------------------------------------- | ------------------ | ---------------------------------------------- |
| `/`                                                     | `index.tsx`        | Public landing page                            |
| `/login`, `/onboarding`                                 | respective modules | Google sign-in and student profile completion  |
| `/dashboard`, `/profile`, `/settings`, `/notifications` | respective modules | Authenticated maker experience                 |
| `/projects`, `/projects/$projectId`                     | project modules    | Project list/detail and workflow               |
| `/invitations/$projectId`                               | invitation module  | Team invitation response                       |
| `/book`, `/bookings/$bookingId`                         | booking modules    | Capacity booking, history/detail, cancellation |
| `/equipment`, `/visits`                                 | respective modules | Inventory and visits                           |
| `/faculty`, `/operations`, `/admin`, `/super-admin`     | respective modules | Role-targeted operational consoles             |

`src/lib/api.ts` is the typed HTTP boundary. It keeps the access token in memory (local storage contains only a non-secret session-presence hint), sends refresh cookies, normalizes API envelopes, and exposes endpoint groups (`authApi`, `usersApi`, `referenceApi`, `projectsApi`, `notificationsApi`, `bookingsApi`, `equipmentApi`, and related resource clients). `src/lib/project-queries.ts` centralizes paginated project React Query keys, hooks, invalidation, and human-readable project status labels; `src/lib/booking-queries.ts` does the same for persisted booking views. Do not call `fetch` directly when an API client exists.

`src/lib/makerspace-context.tsx` is a separate, client-only prototype/demo state system. It owns profile, accounts, authentication/onboarding flags, projects, reservations, visits, equipment, consumables, notifications, users, audit events, configuration, slots, uploads, and notification preferences. It hydrates and cross-tab synchronizes the `mitwpu-makerspace-mock-state-v4` localStorage snapshot. Production Phase 1–4 identity/profile, project/team/mentor, lab availability, and capacity-booking routes use the API; mock implementations remain reachable only through the clearly isolated Prototype view. Keep the switch through Phase 7 and remove it in Phase 8.

Important reusable frontend pieces: `AppShell` (navigation/layout and persisted notifications), `ResponsiveModal`, `StatusBadge`, `DashboardQuickActions`, booking `SlotBookingModal`, production project `PersistedProjectWizard` and `PersistedProjectDetail`, prototype `ProjectDetailPanel`, and creation helpers `MentorSelect`, `ResourceSelection`, and `TeamMembers`. `components/ui/` provides composable Radix primitives. `lib/utils.ts` supplies class-name merging; `lib/project-resources.ts`, `error-capture.ts`, and `error-page.ts` support resources and failure handling.

## Backend architecture and request pipeline

`backend/src/server.ts` starts the app and gracefully closes Prisma/Redis on termination. `createApp()` applies HTTPS enforcement, request IDs, Pino HTTP logging, Helmet, CORS, compression, JSON parsing, cookies, HPP, request sanitization, rate limits, a health endpoint, Swagger in development, API routing, and the final error handler.

All versioned endpoints live under `/api/v1`. Most follow `authenticate → authorize (when needed) → validate (Zod) → async controller → service → Prisma`; controllers shape HTTP responses while services contain domain and transaction logic. Access is role-and-permission based: `STUDENT`, `FACULTY_MENTOR`, `LAB_ASSISTANT`, `ADMIN`, and `SUPER_ADMIN`; the permission map is `backend/src/config/permissions.ts`.

| Prefix            | Key operations                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `/auth`           | Google config/CSRF/sign-in, refresh/logout, current identity, onboarding, profile policy                     |
| `/users`          | Bounded Student/Faculty directory search, own permitted profile update, and user/provisioning administration |
| `/equipment`      | Read, create, update/delete inventory and update availability                                                |
| `/bookings`       | List/get/create, cancel, and staff status transitions                                                        |
| `/projects`       | CRUD, membership invitations, mentor requests/decisions, email review/decision callback routes               |
| `/reference-data` | Departments, programmes, years, labs, categories, project resource choices                                   |
| `/events`         | List/get/create/update/delete and register                                                                   |
| `/notifications`  | List, create, mark read                                                                                      |
| `/uploads`        | Authenticated and rate-limited Cloudinary uploads                                                            |

`/health` is unauthenticated. `/api/docs` is available only outside production. API response and failure conventions are centralized in `utils/api-response.ts`, `api-error.ts`, `async-handler.ts`; pagination, caching, and DTO serialization are in `utils/pagination.ts`, `cache.ts`, and `serializers.ts`.

## Data model and workflows

Prisma uses PostgreSQL UUIDs, relational foreign keys, explicit enums, indexes, and soft-delete fields on major operational entities.

| Area                | Models                                                                                                     | Relationship/workflow summary                                                                                                                                                                                                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity            | `User`, `Session`, `UserProvisioning`, `StudentProfile`                                                    | Google identity maps to a user; refresh sessions are hashed/revocable; provisioning preassigns roles; students complete PRN/department/programme/year profile data.                                                                                                                                                                                            |
| Reference/lab       | `Department`, `Programme`, `AcademicYearOption`, `Lab`, `LabSchedule`, `LabDateException`, `LabSlot`       | Configurable academic and lab availability data used by booking and onboarding.                                                                                                                                                                                                                                                                                |
| Inventory           | `EquipmentCategory`, `Equipment`, `ConsumableCategory`, `Consumable`                                       | Equipment has availability/status; categories and consumables scope project resources and bookings.                                                                                                                                                                                                                                                            |
| Projects            | `Project`, `ProjectMember`, `MentorRequest`, `ProjectEquipmentRequirement`, `ProjectConsumableRequirement` | Atomic/idempotent creation persists the accepted leader, invitations, mentor request, advisory expected resources, audit events, and notification deliveries. Projects move through draft, team acceptance, mentor approval, verified/rejected/archive states; major edits and mentor changes re-enter verification while resource-only edits retain approval. |
| Reservations/visits | `Booking`, `BookingParticipant`, `BookingStatusHistory`, `QuickVisit`, `Visit`                             | Bookings reserve attendee capacity only and preserve immutable Lab/project/slot/policy/participant facts plus append-only status history. Equipment/consumables are advisory; QR/barcode and booking-time resource allocations are excluded from Version 1. Attendance records actual lab use in Phase 5.                                                      |
| Community           | `Event`, `EventRegistration`, `Notification`, `NotificationDelivery`                                       | Events track organizer and registrations; notifications track in-app delivery/read state and optional channels.                                                                                                                                                                                                                                                |
| Governance/storage  | `Upload`, `AuditLog`                                                                                       | Uploads are owned and soft-deleted; audit records preserve actor/action metadata.                                                                                                                                                                                                                                                                              |

Critical write paths use Prisma transactions: auth account/session lifecycle, project creation/member invitation/mentor decisions, booking conflict and status handling, and inventory availability. Preserve transaction boundaries when modifying state-changing services.

Phase 2 directory reads are deliberately bounded: teammate and Faculty Mentor searches require a minimum query length, are server-filtered/paginated with a maximum of 20 results, and expose only the identification fields needed by the UI. The database enables `pg_trgm` and GIN indexes for case-insensitive Student name, email, and PRN search. Never replace this with an unrestricted directory download.

The production project UI derives access from persisted ownership/membership/current-mentor relationships. Faculty project visibility is scoped to the current mentor. Requirement selection is advisory and does not reserve equipment, consumables, quantities, machines, or time. Phase 4 booking creation runs at PostgreSQL `READ COMMITTED` with explicit project/slot row locks, payload-bound idempotency, capacity recalculation, immutable history, audit/outbox writes, and actionable conflicts. Cancellation separately preserves source/actor/reason/time and releases capacity. Actual asynchronous email sending remains Phase 7.

Quality baseline after Phase 4 (2026-08-23): frontend lint/build and backend lint/build pass; the guarded real-PostgreSQL concurrency harness fills a capacity-20 hot slot with exactly 20 winners from 40 simultaneous requests and no overbooking; Prisma validates with the complete migration chain applied; root/frontend and backend production audits report zero vulnerabilities. Phase 4 authenticated manual browser acceptance and Phase 8 production-like load/soak acceptance remain open.

Google sign-in returns the same persisted Student academic-profile shape as `/auth/me`, including department and programme relations, so the real identity renders immediately without a refresh.

## Development commands

Run each command from the indicated directory:

```bash
# frontend
npm install
npm run dev
npm run build
npm run lint

# backend
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate       # applies/develops PostgreSQL migrations
npm run prisma:seed          # optional reference data
npm run dev
npm run build
npm test
RUN_PHASE4_DATABASE_TESTS=true npm run test:booking-concurrency
```

Before starting the backend, ensure PostgreSQL and Redis are running and `backend/.env` has valid values. The repository does not include Docker Compose or a database server definition; those two services are external prerequisites. For a complete local application, start backend first, verify `/health`, then start Vite.

## Change guidelines

- Keep backend module boundaries intact: define/request-validate in `*-schema.ts`, map HTTP in controllers, put queries/rules in services, and wire URLs only in `*-routes.ts`.
- Update `backend/docs/openapi.yaml`, Prisma migrations/schema, API clients, and this file together whenever an endpoint or persisted contract changes.
- Do not expose secrets in frontend code, commits, logs, or `codex.md`; frontend obtains the public Google client ID at runtime from `/auth/google/config`.
- Keep Vite’s backend exclusions and proxy configuration; importing Node-only backend packages into the frontend breaks the dev/build graph.
