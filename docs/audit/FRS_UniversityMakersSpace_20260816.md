# Functional Requirements Specification and Implementation Trace

**Project:** MIT-WPU University Maker's Space (UMS)  
**Version:** 1.0-audit  
**Date:** 2026-08-16  
**Prepared by:** Codex  
**Client:** MIT World Peace University  
**Status:** Draft — reverse-engineered current behavior and RFP gaps  
**SRS reference:** `SRS_UniversityMakersSpace_20260816.md`

## 1. Module inventory

| Module       | Purpose                                        | Current source                               | Status                                       |
| ------------ | ---------------------------------------------- | -------------------------------------------- | -------------------------------------------- |
| MOD-AUTH     | Google identity and sessions                   | `backend/src/modules/auth`, `src/lib/auth-*` | Connected core                               |
| MOD-USER     | Profiles, users, provisioning, roles           | `backend/src/modules/users`                  | Partial                                      |
| MOD-PROJECT  | Projects, teams, mentor decisions              | `backend/src/modules/projects`               | Partial                                      |
| MOD-SLOT     | Lab schedule, closures, generated availability | Prisma schema only                           | Gap                                          |
| MOD-BOOKING  | Capacity-safe reservations/cancellation        | `backend/src/modules/bookings`               | Backend core implemented                     |
| MOD-VISIT    | Quick Visits, entry, exit, occupancy           | Prisma schema plus mock screens              | Gap                                          |
| MOD-RESOURCE | Equipment/categories/consumables               | Equipment API plus schema                    | Partial                                      |
| MOD-NOTIFY   | In-app and email delivery                      | Notification API and queue declaration       | Partial/gap                                  |
| MOD-ADMIN    | Lab configuration, audit, reporting            | Schema plus mock screens                     | Gap                                          |
| MOD-FRONTEND | Responsive role experiences                    | `src/routes`, `src/components`               | Auth/onboarding connected; workflows partial |
| MOD-PWA      | Installability/offline shell                   | Manifest only                                | Gap                                          |
| MOD-PLATFORM | CI/CD, monitoring, backups, deployment         | No deployment assets                         | Gap                                          |
| MOD-EVENT    | Future workshops/events                        | `backend/src/modules/events`                 | Implemented ahead of V1 priority             |
| MOD-UPLOAD   | Future file upload                             | `backend/src/modules/uploads`                | Partial future scope                         |

## 2. Authentication and sessions

### FR-AUTH-001 — Publish Google client configuration

_Source: `backend/src/modules/auth/auth-routes.ts:13`_

The system SHALL expose the configured public Google web client ID and hosted domain without authentication.

**Current endpoint:** `GET /api/v1/auth/google/config`  
**Status:** Implemented.

### FR-AUTH-002 — Issue login CSRF pair

_Source: `backend/src/modules/auth/auth-service.ts:18`_

The system SHALL issue a random login CSRF token in the response and matching HttpOnly, SameSite cookie before accepting a GIS credential.

**Current endpoint:** `GET /api/v1/auth/google/csrf`  
**Status:** Implemented and integration-tested with mocks.

### FR-AUTH-003 — Verify MIT-WPU Google identity

_Source: `backend/src/modules/auth/google-identity.ts:13`_

The system SHALL validate Google signature, issuer behavior through the Google library, audience, expiry, verified email, signed hosted-domain claim, and institutional suffix before creating a session.

**Current endpoint:** `POST /api/v1/auth/google`  
**Status:** Implemented core. The frontend renders Google's official GIS control, obtains the login-CSRF pair, posts the credential, keeps the access token in memory, restores through the HttpOnly refresh cookie and routes by persisted role/onboarding state.

### FR-AUTH-004 — Persist and rotate sessions

_Source: `backend/src/modules/auth/auth-service.ts:91`_

The system SHALL issue a 15-minute access token, persist only a SHA-256 refresh-token hash, rotate refresh tokens with unique JWT IDs, and revoke the session when reuse is detected.

**Endpoints:** `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`  
**Status:** Implemented and connected to browser session restoration/logout. ⚠️ GAP: Refresh replay/concurrency still needs dedicated integration and production-browser acceptance testing.

### FR-AUTH-005 — Route authenticated roles

The frontend SHALL load `/auth/me`, retain the access token only in safe application memory, refresh through credentials-included requests, and route users based on persisted roles/profile completion.

**Status:** Partial. Session restoration, a one-refresh retry mutex, `/auth/me`, logout and role route guards are connected. A clearly labelled, tab-scoped frontend preview switch remains until Phase 8; it changes mock navigation only and cannot change backend roles or permissions.

## 3. Users, profiles, and provisioning

### FR-USER-001 — Create default student identity

_Source: `backend/src/modules/auth/auth-service.ts:32`_

The system SHALL create a new valid institutional user with only `STUDENT` and `profileComplete=false` unless an active provisioning record exists.

**Status:** Implemented in backend.

### FR-USER-002 — Complete onboarding

_Source: `backend/src/modules/auth/auth-service.ts:144`_

The system SHALL validate unique ten-digit PRN, active department/programme consistency, year range, and optional phone/division, then atomically persist the profile and mark it complete.

**Current endpoint:** `POST /auth/onboarding`  
**Status:** Implemented core. Authenticated reference APIs expose active departments, filtered programmes and configured academic years; the connected form validates and persists onboarding. ⚠️ GAP: Admin editing and production acceptance remain.

### FR-USER-003 — Provision privileged identities

_Source: `backend/src/modules/users/user-routes.ts:19`_

Only a user with `user.roles.manage` SHALL create or alter email-based privileged role claims. Claimed-user role changes SHALL revoke active sessions and create an audit event.

**Endpoints:** `GET|POST /users/provisioning`, `PATCH /users/provisioning/:id`, `PATCH /users/:id/roles`  
**Status:** Implemented in backend.

### FR-USER-004 — Safe university search

The system SHALL provide paginated, minimum-length, role-filtered endpoints for teammate, faculty, and administrative search without exposing the complete directory.

**Status:** Partial. Admin-only user listing exists; student teammate and faculty search do not.

## 4. Projects, teams, and mentorship

### FR-PROJECT-001 — Create an atomic project submission

The system SHALL use an idempotent transaction to create the project, accepted leader membership, invited-member records, mentor request, equipment/consumable requirements, audit record, and notification outbox jobs.

**Status:** Missing. Current `POST /projects` creates only the project and leader at `project-service.ts:72`.

### FR-PROJECT-002 — Invite a member

_Source: `backend/src/modules/projects/project-service.ts:136`_

The system SHALL allow the project leader to create a time-limited hashed invitation for an institutional email and set the project to team-acceptance pending.

**Current endpoint:** `POST /projects/:id/members`  
**Status:** Partial. Invitation creation exists; delivery and response do not.

### FR-PROJECT-003 — Accept or decline invitation

The invited user SHALL accept or decline using the intended email identity. Repeated requests SHALL be idempotent, expired/cancelled invitations SHALL fail safely, and project state SHALL be recalculated.

**Status:** Missing; there are no invitation response routes.

### FR-PROJECT-004 — Request a faculty mentor

_Source: `backend/src/modules/projects/project-service.ts:168`_

The project leader SHALL request an active Faculty Mentor only after invitations resolve. The system SHALL allow at most one pending request.

**Current endpoint:** `POST /projects/:id/mentor-requests`  
**Status:** Implemented in backend, but not part of atomic project submission and not connected to notifications/UI.

### FR-PROJECT-005 — Decide a mentor request

_Source: `backend/src/modules/projects/project-service.ts:208`_

The assigned faculty member SHALL approve or reject a pending request. Rejection SHALL require a reason; approval SHALL verify the project.

**Current endpoint:** `POST /projects/:id/mentor-decision`  
**Status:** Partial. Core transaction exists; notifications, idempotent repeated-decision behavior, connected UI, and concurrency tests are absent.

### FR-PROJECT-006 — Maintain project requirements

The leader SHALL select configured equipment and consumables as expected requirements without creating reservations.

**Status:** Schema only. No API writes the requirement join tables.

### Project state transition

| Action                      | Required current state  | New state               | Current implementation                                     |
| --------------------------- | ----------------------- | ----------------------- | ---------------------------------------------------------- |
| Create project              | —                       | DRAFT                   | Yes                                                        |
| Invite members              | DRAFT/eligible          | TEAM_ACCEPTANCE_PENDING | Partial                                                    |
| All invitations resolved    | TEAM_ACCEPTANCE_PENDING | MENTOR_APPROVAL_PENDING | Missing automatic transition                               |
| Mentor approves             | MENTOR_APPROVAL_PENDING | VERIFIED                | Yes                                                        |
| Mentor rejects              | MENTOR_APPROVAL_PENDING | REJECTED                | Yes                                                        |
| Major verified-project edit | VERIFIED                | Relevant pending state  | Missing                                                    |
| Remove accepted member      | Eligible                | Reverification required | Missing                                                    |
| Change mentor               | Any eligible            | MENTOR_APPROVAL_PENDING | Partial request behavior; explicit verified flow undefined |
| Archive                     | Owned/manageable        | ARCHIVED                | Yes                                                        |

## 5. Labs, slots, and bookings

### FR-SLOT-001 — Configure operating policy

Admins SHALL manage lab name, timezone, weekly hours, closures, slot duration, booking/Quick Visit capacities, horizon, and cancellation window, with audit logging.

**Status:** Schema only; no API.

### FR-SLOT-002 — Generate slots

The system SHALL generate idempotent dated slots from weekly configuration and closure exceptions using Asia/Kolkata policy while storing timestamps consistently.

**Status:** Missing.

### FR-SLOT-003 — Query live availability

The system SHALL return eligible dates/slots, remaining attendee capacity, and project-relevant equipment availability using paginated/bounded server queries.

**Status:** Missing.

### FR-BOOKING-001 — Create a capacity-safe reservation

_Source: `backend/src/modules/bookings/booking-service.ts:67`_

The system SHALL validate leader ownership, verified project, accepted selected members, lab match, booking window, slot status, attendee capacity, resources, and idempotency inside a serializable slot-row-locked transaction.

**Current endpoint:** `POST /bookings`  
**Status:** Implemented in backend. ⚠️ GAP: The RFP treats equipment as advisory in V1, while the current service blocks a booking when requested equipment is unavailable and reserves per-slot equipment quantities.

### FR-BOOKING-002 — Cancel a reservation

_Source: `backend/src/modules/bookings/booking-service.ts:184`_

The owner or operational manager SHALL cancel an eligible confirmed booking without deleting it, respecting the configured cancellation window and preserving reason/actor/time/audit.

**Current endpoint:** `POST /bookings/:id/cancel`  
**Status:** Implemented in backend; notification propagation missing.

### FR-BOOKING-003 — Operate booking status

Operational users SHALL apply only allowed, locked state transitions and audit the change.

**Current endpoint:** `PATCH /bookings/:id/status`  
**Status:** Implemented for state changes.

### Booking state transition

| From           | Action                   | To        | Allowed now |
| -------------- | ------------------------ | --------- | ----------- |
| CONFIRMED      | Start/check-in operation | ACTIVE    | Yes         |
| CONFIRMED      | Cancel                   | CANCELLED | Yes         |
| CONFIRMED      | No arrival               | NO_SHOW   | Yes         |
| ACTIVE         | Complete                 | COMPLETED | Yes         |
| Terminal state | Any later mutation       | —         | Rejected    |

⚠️ GAP: `CANCELLED` does not distinguish Student versus Lab Assistant except through `cancelledById`; acceptable display logic must derive the actor role/history.

### FR-BOOKING-004 — Publish availability

After booking/cancellation/status changes, the system SHALL invalidate/publish slot availability so open clients update and degrade to periodic revalidation if real-time transport fails.

**Status:** Missing.

## 6. Visits and live operations

### FR-VISIT-001 — Request Quick Visit

The system SHALL reserve one place against separate configurable Quick Visit capacity using an idempotent locked transaction.

**Status:** Schema only; no route/service.

### FR-VISIT-002 — Check in selected booking participants

The Lab Assistant SHALL mark individual or all expected participants entered, recording actual timestamp and operator.

**Status:** Missing.

### FR-VISIT-003 — Check out active visitors

The Lab Assistant SHALL mark individual/all active visitors exited, recording timestamp/operator and completing attendance state.

**Status:** Missing.

### FR-VISIT-004 — Calculate live occupancy

The system SHALL count visits checked in but not checked out independently of reserved booking capacity and SHALL continue to show overstays until checkout.

**Status:** Missing.

### Attendance state transition

| Source               | Action              | State/result              |
| -------------------- | ------------------- | ------------------------- |
| Booking participant  | Reservation created | EXPECTED                  |
| Booking/Quick Visit  | Check in            | CHECKED_IN plus Visit row |
| Active Visit         | Check out           | CHECKED_OUT and timestamp |
| Expected participant | Mark absent         | NO_SHOW                   |

The schema can represent these states, but no implementation enforces the transitions.

## 7. Equipment and consumables

### FR-RESOURCE-001 — Browse equipment

_Source: `backend/src/modules/equipment/equipment-service.ts:10`_

Authenticated users SHALL query a paginated, searchable, lab/category/status-filtered catalogue.

**Status:** Backend implemented; frontend disconnected.

### FR-RESOURCE-002 — Manage catalogue

Admins SHALL create/update/retire equipment with valid lab/category relations and quantity invariants.

**Status:** Backend mostly implemented; category CRUD and connected UI missing.

### FR-RESOURCE-003 — Update operational availability

Lab Assistants SHALL change status/available quantity and record reason/audit without receiving full catalogue-management permission.

**Endpoint:** `PATCH /api/v1/equipment/:id/availability`  
**Status:** Implemented in backend. The route requires `equipment.availability.manage`, accepts only status/available quantity plus a mandatory reason, locks the row, and writes before/after audit metadata. ⚠️ GAP: connected Lab Assistant UI and near-real-time propagation remain.

### FR-RESOURCE-004 — Manage consumables

Admins SHALL manage consumable categories/items; students SHALL read active values for project requirements.

**Status:** Missing APIs.

## 8. Notifications and email

### FR-NOTIFY-001 — In-app notification center

_Source: `backend/src/modules/notifications`_

Users SHALL list paginated own notifications and mark them read; links SHALL target relevant entities.

**Status:** Basic backend implemented; frontend disconnected.

### FR-NOTIFY-002 — Transactional event generation

Project invitations, mentor requests/decisions, project verification/rejection, bookings, cancellations, and resource incidents SHALL create notification/outbox records in the same successful business transaction where practical.

**Status:** Missing.

### FR-NOTIFY-003 — Asynchronous email

A worker SHALL consume delivery jobs, use institution-approved provider templates, retry transient failures, persist attempts/state, and alert on sustained failure without delaying user APIs.

**Status:** Missing. A BullMQ queue declaration is not a worker.

### Delivery state transition

| From       | Action                    | To         |
| ---------- | ------------------------- | ---------- |
| PENDING    | Worker claims             | PROCESSING |
| PROCESSING | Provider accepts          | SENT       |
| PROCESSING | Attempt fails below limit | PENDING    |
| PROCESSING | Attempts exhausted        | FAILED     |

Schema supports these states; runtime behavior is absent.

## 9. Frontend, responsive behavior, and PWA

### FR-UI-001 — Use authoritative server state

The frontend SHALL use typed API functions and React Query for remote identity, projects, availability, bookings, visits, resources, notifications, and administration.

**Status:** Missing. `src/lib/makerspace-context.tsx` stores all data in `useState`; no `fetch`/Axios/query usage exists for product data.

### FR-UI-002 — Responsive role interfaces

The system SHALL provide intentional mobile, tablet/iPad, and desktop layouts with touch-sized controls and no hover-only operation.

**Status:** Partial visual implementation; no device acceptance suite.

### FR-UI-003 — Loading/error/empty/retry states

Every remote view SHALL have bounded loading, success, empty, error, and retry states with human-readable conflict/permission/network errors.

**Status:** Missing for real data because no remote views exist.

### FR-PWA-001 — Installable application

The application SHALL provide manifest, required icon sizes, HTTPS, registered service worker, standalone launch, safe caching, offline indicator, and blocked offline booking/attendance.

**Status:** Partial. Manifest exists; service worker, suitable icon set, caching, offline UX, and installability test are absent.

### FR-PERF-001 — Frontend performance

Routes SHALL be code-split and primary assets optimized to meet the RFP's LCP/navigation targets.

**Status:** Not met/evidenced. Route splitting is disabled in `vite.config.ts:22`; production build reports a client chunk over 500 kB.

## 10. Data requirements

The redesigned schema contains 31 domain models. Presence means the storage shape exists, not that its workflow is implemented.

| Domain       | Entities                                                                                         | Key constraints/indexes                                                      | Runtime status                     |
| ------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------- |
| Identity     | User, Session, UserProvisioning                                                                  | Unique Google subject/email, role GIN, session expiry/revocation indexes     | Implemented core                   |
| Academics    | Department, Programme, StudentProfile                                                            | Unique PRN; department/programme relation and active validation              | Partial APIs                       |
| Labs         | Lab, LabSchedule, LabClosure, LabSlot                                                            | Per-lab weekly schedule, closure ranges, unique dated slots, capacities      | Schema only                        |
| Resources    | EquipmentCategory, Equipment, ConsumableCategory, Consumable                                     | Lab-scoped names, status/category indexes, quantity checks                   | Equipment partial; consumables gap |
| Projects     | Project, ProjectMember, MentorRequest, ProjectEquipmentRequirement, ProjectConsumableRequirement | Scoped indexes, unique membership/email, one pending mentor request          | Partial                            |
| Reservations | Booking, BookingParticipant, BookingEquipment, BookingConsumable                                 | User idempotency key, slot/status indexes, attendee checks                   | Booking core implemented           |
| Visits       | QuickVisit, Visit                                                                                | Separate idempotency/capacity source; exactly one booking/Quick Visit source | Schema only                        |
| Events       | Event, EventRegistration                                                                         | Date/capacity checks, unique registration                                    | Future scope implemented           |
| Messaging    | Notification, NotificationDelivery                                                               | User/read index, unique channel delivery                                     | Basic notifications; delivery gap  |
| Files        | Upload                                                                                           | Owner/time index                                                             | Future scope partial               |
| Governance   | AuditLog                                                                                         | Actor/time, entity/time, action/time indexes                                 | Partial writes; no read API        |

Historical integrity gap: Booking preserves the slot relation and participant identifiers, but does not snapshot project title, participant display identity, or resource labels. Mutable related records can change how old history renders.

## 11. Business rules register

| Rule            | Requirement                                                         | Enforcement                           |
| --------------- | ------------------------------------------------------------------- | ------------------------------------- |
| BR-AUTH-001     | Only verified `@mitwpu.edu.in` Workspace identities sign in         | Backend Google verifier               |
| BR-AUTH-002     | Privileged roles are deny-by-default and pre-provisioned            | Auth/user services                    |
| BR-AUTH-003     | Role changes revoke active sessions                                 | User service                          |
| BR-PROJECT-001  | Creator is accepted Team Leader                                     | Project create transaction            |
| BR-PROJECT-002  | All invitations resolve before mentor request                       | Project service                       |
| BR-PROJECT-003  | Only assigned faculty decides pending request                       | Project scope/query                   |
| BR-BOOKING-001  | Only verified project leader creates booking                        | Booking service                       |
| BR-BOOKING-002  | Every attendee is an accepted member                                | Booking service                       |
| BR-BOOKING-003  | Committed attendees cannot exceed slot capacity                     | Serializable row lock                 |
| BR-BOOKING-004  | Duplicate create retries do not duplicate booking                   | User-scoped idempotency key           |
| BR-BOOKING-005  | Cancellation retains historical row                                 | Status mutation                       |
| BR-VISIT-001    | Reserved capacity and physical occupancy are separate               | ⚠️ GAP                                |
| BR-RESOURCE-001 | Available quantity cannot exceed total                              | Service and DB constraint             |
| BR-TIME-001     | University timezone is Asia/Kolkata, timestamps stored consistently | Schema default; schedule behavior gap |

## 12. Error handling

Current backend errors use:

```json
{
  "success": false,
  "message": "User-safe message",
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "details": []
  }
}
```

| HTTP status | Current use                                                         |
| ----------- | ------------------------------------------------------------------- |
| 400         | Validation/reference/business input                                 |
| 401         | Missing/invalid/expired session or token                            |
| 403         | Permission, ownership, institutional account, or CSRF failure       |
| 404         | Scoped/missing resource                                             |
| 409         | Uniqueness, state, capacity, availability, or serializable conflict |
| 429         | Redis-backed rate limit                                             |
| 500         | Redacted unexpected error in production                             |

The frontend now has a shared credentials-aware API client, standard envelope/error mapping, request IDs and coordinated refresh retry. ⚠️ GAP: Booking screens do not yet present conflict alternatives.

## 13. Current API inventory

| Area                | Endpoints present                                                   | Important gaps                                           |
| ------------------- | ------------------------------------------------------------------- | -------------------------------------------------------- |
| Auth                | Google config/CSRF/sign-in, refresh, logout, me, onboarding         | Production security/browser acceptance                   |
| Reference data      | departments, programmes, academic years, labs, equipment categories | Admin mutation APIs and client catalogue import          |
| Users               | list/get/update/deactivate, roles, provisioning                     | self-edit flow; safe teammate/faculty search             |
| Projects            | list/get/create/update/archive, invite, mentor request/decision     | invitation response, requirements, atomic submission     |
| Bookings            | list/get/create/cancel/status                                       | slots/availability, publication, concurrency tests       |
| Equipment           | list/get/create/update/delete                                       | category CRUD, LA availability-specific route/audit      |
| Notifications       | list/create/read                                                    | automatic domain events, email delivery                  |
| Events              | CRUD/register                                                       | Future scope                                             |
| Uploads             | create/delete                                                       | MIME allowlist, malware scan/signed access; future scope |
| Labs/slots          | None                                                                | Entire domain API                                        |
| Quick Visits/visits | None                                                                | Entire domain API                                        |
| Consumables         | None                                                                | Entire domain API                                        |
| Audit/reporting     | None                                                                | Read/export/admin capability                             |

## 14. Test traceability

| Required test                    | Current evidence                                     | Status       |
| -------------------------------- | ---------------------------------------------------- | ------------ |
| Google student login             | Mocked identity/DB integration-style test            | Partial      |
| Unauthorized institutional login | CSRF absence only; no real invalid-domain token test | Gap          |
| Pre-provisioned faculty          | No test                                              | Gap          |
| Project verification             | No test                                              | Gap          |
| Invitation idempotency           | No endpoint/test                                     | Gap          |
| Concurrent capacity race         | No real PostgreSQL concurrency test                  | Critical gap |
| Cancellation and history         | No test                                              | Gap          |
| Entry/exit/occupancy             | No implementation/test                               | Critical gap |
| Equipment incident propagation   | No implementation/test                               | Gap          |
| Responsive/browser/accessibility | No automated/manual evidence                         | Gap          |
| Load/security                    | No evidence                                          | Critical gap |

## 15. Prioritized gap register

| Gap                                      | Severity | Required resolution                                                                             |
| ---------------------------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| Frontend disconnected from backend       | Blocker  | Typed API/auth/query integration and removal of mock authority                                  |
| No route guards; local role switch       | Blocker  | Server-derived session/permissions and role routing                                             |
| Invitation accept/decline absent         | Blocker  | Idempotent token/user response endpoints and UI                                                 |
| Project submission not atomic            | Blocker  | Transactional aggregate command/outbox                                                          |
| No slot availability/generation          | Blocker  | Lab admin, generator, availability query                                                        |
| No Quick Visit/attendance/occupancy      | Blocker  | Complete Visit domain                                                                           |
| LA availability UI/realtime connection   | High     | Connect the operations screen to the dedicated audited availability route and propagate changes |
| No email worker/event generation         | High     | Outbox/jobs/worker/provider/delivery telemetry                                                  |
| No concurrent booking test               | Blocker  | Real PostgreSQL race test plus load scenario                                                    |
| No service worker/offline/installability | High     | PWA implementation and Lighthouse/install tests                                                 |
| No backups/monitoring/staging/CI/CD      | Blocker  | Production operations baseline                                                                  |
| Insufficient automated tests             | Blocker  | Unit, DB integration, E2E, accessibility, security, and load suites                             |

---

Generated through the Code Analyst workflow. All gaps require implementation and acceptance evidence before RFP sign-off.
