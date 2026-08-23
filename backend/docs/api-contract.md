# UMS Backend API Contract

All endpoints are prefixed with `/api/v1`, return JSON envelopes, and validate body, parameters, and query data with Zod. Protected endpoints require `Authorization: Bearer <accessToken>`. Browser calls to authentication endpoints must also include credentials so the refresh and login-CSRF cookies are sent.

## Identity and sessions

| Method | Path                           | Access               | Purpose                                                                                                                             |
| ------ | ------------------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/auth/google/config`          | Public               | Public Google client ID and hosted domain                                                                                           |
| GET    | `/auth/google/csrf`            | Public, rate-limited | Creates the double-submit login CSRF cookie/token pair                                                                              |
| POST   | `/auth/google`                 | Public, rate-limited | Verifies `{ credential, csrfToken }`, creates/rotates a server session, and returns user, permissions, access token, and next route |
| POST   | `/auth/refresh`                | Refresh cookie       | Atomically rotates the refresh token and returns a new access token                                                                 |
| POST   | `/auth/logout`                 | Authenticated        | Revokes the current session and clears cookies                                                                                      |
| GET    | `/auth/me`                     | Authenticated        | Current persisted user and effective permissions                                                                                    |
| GET    | `/auth/student-profile/config` | Authenticated        | Configured PRN validation pattern and user-facing hint                                                                              |
| POST   | `/auth/onboarding`             | Student              | Completes `{ fullName, prn, departmentId, programmeId, academicYear, division?, phone? }`                                           |

The backend checks Google signature, audience, issuer, expiry, `email_verified`, and the signed Workspace `hd` claim. New eligible users receive only `STUDENT`. Privileged roles are assigned from Super-Admin-managed pre-provisioning records. Password registration and password login do not exist.

Authentication responses are marked `Cache-Control: no-store`. The frontend keeps access tokens in memory, restores sessions through the HttpOnly refresh cookie, and retries one failed protected request after a single shared refresh operation.

## Reference data

All reference-data endpoints require an authenticated session and return active records only.

| Method | Path                                          | Purpose                                                       |
| ------ | --------------------------------------------- | ------------------------------------------------------------- |
| GET    | `/reference-data/departments`                 | Student-onboarding department choices                         |
| GET    | `/reference-data/programmes?departmentId=`    | Programme choices, optionally filtered by department          |
| GET    | `/reference-data/academic-years`              | Configured academic-year choices                              |
| GET    | `/reference-data/labs`                        | Active labs and booking policy summaries                      |
| GET    | `/reference-data/equipment-categories?labId=` | Active categories, optionally filtered by lab                 |
| GET    | `/reference-data/project-resources?labId=`    | Configured equipment and consumables for project requirements |

## Roles and authorization

Users may carry multiple roles: `STUDENT`, `FACULTY_MENTOR`, `LAB_ASSISTANT`, `ADMIN`, and `SUPER_ADMIN`. Endpoints enforce named permissions server-side; the permission list returned to the frontend is presentation guidance, not an authorization source.

| Area          | Read scope                                               | Mutating access                                                                                                  |
| ------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Users         | Admin/Super Admin                                        | Admin manages profile activation; only Super Admin changes roles and provisioning                                |
| Equipment     | Authenticated                                            | Lab Assistant updates availability; Admin manages catalogue                                                      |
| Lab policy    | Authenticated availability; Admin configuration          | Admin/Super Admin changes policy, exceptions, and generated slots                                                |
| Projects      | Student's own team, assigned mentor, or operations staff | Student leader edits eligible projects; Faculty may decide by secure email action link; Admin manages any       |
| Bookings      | Student's own booking or operational staff               | Verified student project creates; owner cancels in policy window; Lab Assistant/Admin changes operational status |
| Events        | Authenticated                                            | Student/faculty registration; Lab Assistant/Admin manages                                                        |
| Notifications | Current user's own                                       | Admin/Super Admin creates                                                                                        |
| Uploads       | Authenticated                                            | Creator-managed through the existing upload API                                                                  |

## Important workflow endpoints

- `POST /projects` idempotently creates the complete project aggregate: leader, invitations, mentor request, requirements, audit, in-app notifications, and pending email-delivery records.
- `POST /projects/:id/members` invites a Student by institutional email; the Student may complete onboarding after opening the invitation.
- `POST /projects/:id/invitations/respond` idempotently accepts or declines the signed-in Student's invitation.
- `DELETE /projects/:id/members/:memberId` cancels an invitation or removes an accepted member with re-verification when required.
- `POST /projects/:id/mentor-requests` requests faculty verification.
- `POST /projects/:id/mentor-decision` remains available to an authenticated Faculty Mentor.
- `POST /projects/mentor-requests/:requestId/email-review` and `POST /projects/mentor-requests/:requestId/email-decision` power the signed, seven-day Faculty email action link; the token remains in the URL fragment and is submitted in the request body, so it is not sent in server/access logs. No app login is required and rejection requires a reason.
- `GET /users/search/faculty-mentors` provides minimum-length, paginated, role-filtered search over the university-provided Faculty directory. Teammates are invited directly by institutional email and do not need to exist before invitation.
- `PATCH /users/me/student-profile` updates the signed-in Student's permitted profile fields.
- `POST /bookings` accepts `labSlotId`, `projectId`, selected `participantIds`, requested equipment/consumables, and a UUID `idempotencyKey`.
- `POST /bookings/:id/cancel` cancels without deleting history.
- `PATCH /bookings/:id/status` applies the controlled operational transition table.
- `PATCH /equipment/:id/availability` lets Lab Assistants/Admins change only operational status or available quantity and requires an audited reason.
- `GET /labs/:labId/availability/dates` resolves the bounded booking window from weekly policy and date exceptions without frontend timezone calculations.
- `GET /labs/:labId/availability` returns one date's generated slots, remaining attendee places, project eligibility, and advisory equipment status.
- `GET|PUT /labs/:labId/configuration` reads or version-checks and saves the complete operating policy. A successful save audits the before/after policy and regenerates the future horizon.
- `PUT /labs/:labId/date-exceptions` creates or replaces a closure/special-hours override; `DELETE /labs/:labId/date-exceptions/:exceptionId` restores regular weekly hours.
- `POST /labs/:labId/slots/regenerate` idempotently reconciles an optional bounded date range with configured policy.
- `GET|POST|PATCH /users/provisioning` maintains deny-by-default privileged identity claims.
- `PATCH /users/:id/roles` changes roles and revokes all of that user's active sessions.

Booking creation uses a serializable transaction and locks the selected lab-slot row before checking lab capacity, equipment quantity, consumables, project verification, team membership, and attendee selection. A QR secret is returned only at creation; only its hash is stored.

## Domain configuration

The schema makes labs, per-day schedules, date closures/special hours, generated slots, capacities, booking horizon, cancellation window, optional maximum future bookings per project, Quick Visit policy, project-verification policy, equipment categories, equipment, consumable categories, consumables, departments, programmes, and academic-year choices data-driven.

Phase 3 configuration writes require `lab.configure`, use optimistic `configurationVersion` checks plus a serialized Lab row lock, and record an audit event. Slot rows carry a local MakerSpace date, UTC timestamps, a policy version, and indexed Lab/date/status access. Configuration writes and explicit regeneration materialize the bounded horizon; ordinary availability traffic is read-only unless a date is missing or stale. Duplicate generation updates the same unique slot rows and never creates duplicates. Slots with booking/visit history are closed instead of deleted when a later policy removes them.

## Responses and errors

Success envelopes use `{ success: true, message, data, meta? }`. Errors use `{ success: false, message, error: { code, details } }` with `400`, `401`, `403`, `404`, `409`, `422`, `429`, or `500`.

Prisma uniqueness conflicts map to `409`, invalid references to `400`, missing records to `404`, and serializable transaction conflicts to a retryable `409 TRANSACTION_CONFLICT`.
