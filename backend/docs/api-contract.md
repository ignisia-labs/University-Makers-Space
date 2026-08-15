# UMS Backend API Contract

All endpoints are prefixed with `/api/v1`, return JSON envelopes, and validate body, parameters, and query data with Zod. Protected endpoints require `Authorization: Bearer <accessToken>`. Browser calls to authentication endpoints must also include credentials so the refresh and login-CSRF cookies are sent.

## Identity and sessions

| Method | Path                  | Access               | Purpose                                                                                                                             |
| ------ | --------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/auth/google/config` | Public               | Public Google client ID and hosted domain                                                                                           |
| GET    | `/auth/google/csrf`   | Public, rate-limited | Creates the double-submit login CSRF cookie/token pair                                                                              |
| POST   | `/auth/google`        | Public, rate-limited | Verifies `{ credential, csrfToken }`, creates/rotates a server session, and returns user, permissions, access token, and next route |
| POST   | `/auth/refresh`       | Refresh cookie       | Atomically rotates the refresh token and returns a new access token                                                                 |
| POST   | `/auth/logout`        | Authenticated        | Revokes the current session and clears cookies                                                                                      |
| GET    | `/auth/me`            | Authenticated        | Current persisted user and effective permissions                                                                                    |
| POST   | `/auth/onboarding`    | Student              | Completes `{ fullName, prn, departmentId, programmeId, academicYear, division?, phone? }`                                           |

The backend checks Google signature, audience, issuer, expiry, `email_verified`, and the signed Workspace `hd` claim. New eligible users receive only `STUDENT`. Privileged roles are assigned from Super-Admin-managed pre-provisioning records. Password registration and password login do not exist.

Authentication responses are marked `Cache-Control: no-store`. The frontend keeps access tokens in memory, restores sessions through the HttpOnly refresh cookie, and retries one failed protected request after a single shared refresh operation.

## Reference data

All reference-data endpoints require an authenticated session and return active records only.

| Method | Path                                          | Purpose                                              |
| ------ | --------------------------------------------- | ---------------------------------------------------- |
| GET    | `/reference-data/departments`                 | Student-onboarding department choices                |
| GET    | `/reference-data/programmes?departmentId=`    | Programme choices, optionally filtered by department |
| GET    | `/reference-data/academic-years`              | Configured academic-year choices                     |
| GET    | `/reference-data/labs`                        | Active labs and booking policy summaries             |
| GET    | `/reference-data/equipment-categories?labId=` | Active categories, optionally filtered by lab        |

## Roles and authorization

Users may carry multiple roles: `STUDENT`, `FACULTY_MENTOR`, `LAB_ASSISTANT`, `ADMIN`, and `SUPER_ADMIN`. Endpoints enforce named permissions server-side; the permission list returned to the frontend is presentation guidance, not an authorization source.

| Area          | Read scope                                               | Mutating access                                                                                                  |
| ------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Users         | Admin/Super Admin                                        | Admin manages profile activation; only Super Admin changes roles and provisioning                                |
| Equipment     | Authenticated                                            | Lab Assistant updates availability; Admin manages catalogue                                                      |
| Projects      | Student's own team, assigned mentor, or operations staff | Student leader edits eligible projects; faculty decides mentor request; Admin manages any                        |
| Bookings      | Student's own booking or operational staff               | Verified student project creates; owner cancels in policy window; Lab Assistant/Admin changes operational status |
| Events        | Authenticated                                            | Student/faculty registration; Lab Assistant/Admin manages                                                        |
| Notifications | Current user's own                                       | Admin/Super Admin creates                                                                                        |
| Uploads       | Authenticated                                            | Creator-managed through the existing upload API                                                                  |

## Important workflow endpoints

- `POST /projects` creates a project and accepted leader membership.
- `POST /projects/:id/members` invites an existing eligible student.
- `POST /projects/:id/mentor-requests` requests faculty verification.
- `PATCH /projects/:id/mentor-request` lets the requested faculty approve or reject.
- `POST /bookings` accepts `labSlotId`, `projectId`, selected `participantIds`, requested equipment/consumables, and a UUID `idempotencyKey`.
- `POST /bookings/:id/cancel` cancels without deleting history.
- `PATCH /bookings/:id/status` applies the controlled operational transition table.
- `PATCH /equipment/:id/availability` lets Lab Assistants/Admins change only operational status or available quantity and requires an audited reason.
- `GET|POST|PATCH /users/provisioning` maintains deny-by-default privileged identity claims.
- `PATCH /users/:id/roles` changes roles and revokes all of that user's active sessions.

Booking creation uses a serializable transaction and locks the selected lab-slot row before checking lab capacity, equipment quantity, consumables, project verification, team membership, and attendee selection. A QR secret is returned only at creation; only its hash is stored.

## Domain configuration

The schema makes labs, per-day schedules, closures, generated slots, capacities, booking horizon, cancellation window, equipment categories, equipment, consumable categories, consumables, departments, programmes, and academic-year choices data-driven. Authenticated read APIs now expose the Phase 1 reference values. Administrative mutation APIs for configuration records remain a subsequent implementation slice; these records are currently managed by migrations/seed or direct administration.

## Responses and errors

Success envelopes use `{ success: true, message, data, meta? }`. Errors use `{ success: false, message, error: { code, details } }` with `400`, `401`, `403`, `404`, `409`, `422`, `429`, or `500`.

Prisma uniqueness conflicts map to `409`, invalid references to `400`, missing records to `404`, and serializable transaction conflicts to a retryable `409 TRANSACTION_CONFLICT`.
