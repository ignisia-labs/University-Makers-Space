# Deploying सृजन

Front end on Netlify, API on Render, with managed Postgres and Redis.

**Why Render and not Vercel for the API.** The API is a long-running server, not
a set of functions. It starts two background workers — the attendance reconciler
and the email dispatcher — that hold a Redis lease and run on a timer. On a
serverless platform the process is suspended between requests, so neither would
ever run: no-shows would never be released, and no invitation email would ever
be sent. Render, Railway and Fly all run it correctly. Vercel would appear to
work and quietly do half the job.

---

## 1. Managed database and cache

Create both before deploying anything.

**PostgreSQL** — Neon, Supabase, Render Postgres or Railway.
Take the connection string and append TLS:

```
postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require&connection_limit=5
```

`connection_limit=5` matters on small plans: without it Prisma opens a pool per
instance and can exhaust the database's allowance on the first restart.

**Redis** — Upstash, Render Key Value or Redis Cloud. Use the `rediss://` URL;
TLS is picked up from the scheme.

Redis is not optional. It backs rate limiting, the job leases and the
availability channel, and the API will not start without it.

---

## 2. API on Render

Push this branch, then either point Render at `backend/render.yaml` or create a
Web Service by hand with:

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Build command | `npm ci && npx prisma generate && npx prisma migrate deploy && npm run build` |
| Start command | `npm run start` |
| Health check path | `/health` |

Migrations run in the build, before the new instance takes traffic, so a release
never serves against a schema it was not compiled for.

### Environment variables

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | the Postgres URL from step 1 |
| `REDIS_URL` | the `rediss://` URL from step 1 |
| `JWT_SECRET` | 32+ random characters |
| `JWT_REFRESH_SECRET` | 32+ random characters, different from the above |
| `GOOGLE_CLIENT_ID` | from the Google Cloud console |
| `FRONTEND_URL` | `https://YOUR-SITE.netlify.app` |
| `CROSS_SITE_COOKIES` | `true` |
| `CLOUDINARY_CLOUD_NAME` | from Cloudinary |
| `CLOUDINARY_API_KEY` | from Cloudinary |
| `CLOUDINARY_API_SECRET` | from Cloudinary — **reveal it first, do not copy the masked value** |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASSWORD` `MAIL_FROM` | your mail provider |

Generate the secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**`CROSS_SITE_COOKIES=true` is not optional here.** Netlify and Render are
different sites, so the browser will only return the session cookie if it is
`SameSite=None; Secure`. Leave it false and sign-in appears to succeed, then the
very next request is anonymous.

`FRONTEND_URL` accepts a comma-separated list if you also want deploy previews
to work:

```
FRONTEND_URL=https://srijan.netlify.app,https://deploy-preview-12--srijan.netlify.app
```

### First run

Once the service is live, seed the Super Admin:

```bash
# From the Render shell, in the backend directory
npm run prisma:seed
```

That creates one thing: a provisioning grant for `ignisia@mitwpu.edu.in`, so
that address becomes Super Admin the first time it signs in with Google. No
users, departments, equipment or materials are invented.

Then import your own data:

```bash
npx tsx scripts/import-inventory.ts --commit   # equipment and materials
```

Faculty are imported through the interface: **Administration → Faculty → Import
from Excel**.

---

## 3. Front end on Netlify

Connect the repository. `netlify.toml` supplies the build command, publish
directory, caching and the single-page fallback, so the only thing to set is:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://YOUR-API.onrender.com` |

No trailing slash, and no `/api/v1` — the client appends that.

This is read at **build** time and inlined into the bundle. Changing it requires
a redeploy, not a restart.

---

## 4. Google sign-in

In the Google Cloud console, under the OAuth client's **Authorised JavaScript
origins**, add your Netlify URL:

```
https://YOUR-SITE.netlify.app
```

Not the API origin — the browser runs the sign-in, so Google checks the origin
the page was served from. Sign-in fails with no visible error if this is missing,
which is the single most common cause of "the button does nothing".

---

## 5. Check it worked

```bash
curl https://YOUR-API.onrender.com/health
# {"success":true,"message":"OK","data":{"status":"ok"}}
```

Then in the browser, on the Netlify URL:

1. The landing page loads.
2. Sign in with an `@mitwpu.edu.in` account.
3. **Reload the page.** You should still be signed in — this is what proves the
   cross-site cookie is working. If you are signed out, `CROSS_SITE_COOKIES` is
   not `true`, or `FRONTEND_URL` does not exactly match the site's origin.
4. Open a deep link such as `/dashboard` directly. It should load, not 404 —
   that proves the SPA fallback.

---

## 6. After the first deploy

- Render's free tier sleeps after inactivity; the first request then takes ~50
  seconds. Use a paid instance for anything students rely on.
- Set up backups on the managed database. Nothing in this repository does that.
- `REMAINING_WORK.md` lists what is not built, including monitoring, CI and load
  testing.
