# UMS Backend API Contract

All endpoints are prefixed with `/api/v1`, return JSON envelopes, validate body/params/query with Zod, and require `Authorization: Bearer <accessToken>` unless marked public.

## Auth

| Method | Path | Auth | Request | Success |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | public | `{ name, email, password }` | `201 { user }` |
| POST | `/auth/login` | public | `{ email, password }` | `200 { user, accessToken }` + refresh cookie |
| POST | `/auth/refresh` | refresh cookie | none | `200 { accessToken }` + rotated refresh cookie |
| POST | `/auth/logout` | any user | none | `204` |
| GET | `/auth/me` | any user | none | `200 current user claims` |

## Resources

| Resource | List | Detail | Create | Update | Delete | Roles |
| --- | --- | --- | --- | --- | --- | --- |
| Users | `GET /users` | `GET /users/:id` | - | `PATCH /users/:id` | `DELETE /users/:id` | admin |
| Equipment | `GET /equipment` | `GET /equipment/:id` | `POST /equipment` | `PATCH /equipment/:id` | `DELETE /equipment/:id` | read: all authenticated, write: staff/admin |
| Bookings | `GET /bookings` | `GET /bookings/:id` | `POST /bookings` | `PATCH /bookings/:id/status` | - | owner read, staff/admin approve |
| Projects | `GET /projects` | `GET /projects/:id` | `POST /projects` | `PATCH /projects/:id` | `DELETE /projects/:id` | student create, moderator/admin manage |
| Events | `GET /events` | `GET /events/:id` | `POST /events` | `PATCH /events/:id` | `DELETE /events/:id` | staff/admin manage |
| Notifications | `GET /notifications` | - | `POST /notifications` | `PATCH /notifications/:id/read` | - | user read, staff/admin create |
| Uploads | - | - | `POST /uploads` multipart `file` | - | `DELETE /uploads/:id` | authenticated |

List endpoints support `page`, `limit`, `search`, `status`, `category`, `sortBy`, and `order` where relevant. Empty lists return `200` with `data: []`.

## Errors

Errors use `{ success: false, message, error: { code, details } }` with `400`, `401`, `403`, `404`, `409`, `422`, `429`, or `500`.
