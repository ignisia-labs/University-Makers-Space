# MIT-WPU Google authentication setup

The backend accepts Google Identity Services ID tokens only when Google verifies all of the following:

- the token was issued for `GOOGLE_CLIENT_ID`;
- the Google account email is verified;
- the Google Workspace hosted-domain claim is `mitwpu.edu.in` (or the configured `GOOGLE_HOSTED_DOMAIN`);
- the email address belongs to that same domain.

The Google `sub` claim is stored as the stable external identity. Email is not used as the permanent identity key.

## Google Cloud Console

1. Create or select the MIT-WPU-managed Google Cloud project.
2. Configure the OAuth consent screen as **Internal** when the Workspace organization permits it.
3. Create an OAuth 2.0 **Web application** client.
4. Add the deployed frontend origins and local origin, for example `http://localhost:8081`, under **Authorized JavaScript origins**.
5. Put the generated client ID in backend `GOOGLE_CLIENT_ID`; the frontend obtains it from `/api/v1/auth/google/config` and never hardcodes it.
6. Keep `GOOGLE_HOSTED_DOMAIN=mitwpu.edu.in`. Do not treat the frontend `hd` option as an authorization control; the backend validates the signed token claim.

No Google client secret is required for the GIS ID-token sign-in flow used here.

## Backend environment

Copy `.env.example` to `.env` and configure at minimum:

```dotenv
GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
GOOGLE_HOSTED_DOMAIN=mitwpu.edu.in
JWT_SECRET=a-random-secret-with-at-least-32-characters
JWT_REFRESH_SECRET=a-different-random-secret-with-at-least-32-characters
FRONTEND_URL=http://localhost:8081
```

Set `SEED_SUPER_ADMIN_EMAIL` before seeding if the first administrator should be pre-provisioned. The address receives `SUPER_ADMIN` only after successfully signing in with its matching MIT-WPU Google account.

Set the frontend `VITE_API_BASE_URL` to the backend API prefix (for example, `http://localhost:4000/api/v1`). In production, the frontend defaults to the same-origin `/api/v1` path when this variable is omitted.

## Frontend handshake

1. `GET /api/v1/auth/google/config` to obtain the public client ID and hosted domain.
2. `GET /api/v1/auth/google/csrf` with credentials included. Store the returned `csrfToken`; the matching cookie is set by the backend.
3. Render Google Identity Services and receive its ID-token `credential`.
4. `POST /api/v1/auth/google` with `{ credential, csrfToken }`, again with credentials included.
5. Keep the short-lived access token in memory and send it as `Authorization: Bearer <token>`.
6. When it expires, `POST /api/v1/auth/refresh` with credentials included. The refresh cookie is HttpOnly and is rotated on every use.
7. Follow the response's `next` value: `onboarding` for a new student profile or `dashboard` otherwise.

Staff access is deny-by-default. Faculty, Lab Assistant, Admin, and Super Admin roles must be pre-provisioned through `/users/provisioning` by a Super Admin; users cannot claim privileged roles during sign-in.
