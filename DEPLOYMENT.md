# Deploying सृजन

Front end on Netlify, API on Render, with managed Postgres and Redis.

**The API runs anywhere.** It holds no state between requests and starts no
background workers, so the same build runs on Render, Railway, Fly or a
serverless platform such as Vercel. `src/server.ts` binds a port for a normal
Node host; `api/index.ts` exports the same Express app as a request handler.

**But it needs a scheduler.** Releasing no-show slots, closing overstayed visits
and sending queued email used to run on in-process timers. They now run when
something calls `POST /api/v1/jobs/run` with the `JOBS_TOKEN` secret. Set that up
or none of it happens: a team that never turns up keeps its slot forever, and no
invitation email is ever sent. Section 3 covers it.

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

### Moving your existing data across

If you already have a populated local database — faculty, equipment, materials —
export it and load it into the managed one rather than starting empty.

```bash
# Export (from the project root, with the local containers running)
docker exec ums-pg pg_dump -U postgres -d ums_dev \
  --no-owner --no-privileges \
  --exclude-table-data=sessions \
  --exclude-table-data=notification_deliveries \
  > srijan-neon.sql

# Import
psql "postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require" -f srijan-neon.sql
```

The dump carries the schema, so run it **before** the first deploy — it includes
Prisma's `_prisma_migrations` table, which means `prisma migrate deploy` in the
build will see the schema as current and do nothing.

Two tables are deliberately exported empty:

- **`sessions`** — refresh tokens signed with the old `JWT_REFRESH_SECRET`. They
  could never validate against the new one, so they are noise.
- **`notification_deliveries`** — the email outbox. A local database usually has
  a few messages that were queued and never sent; restoring them means the first
  scheduled run emails real people something you wrote while testing.

The file contains real names, email addresses and PRNs. `.gitignore` refuses to
commit `*.sql`, but delete it once the import is done rather than leaving it in
Downloads.

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

To deploy the API to Vercel instead, use `backend/vercel.json`: it builds the
same code and serves `api/index.ts` as a function. Set `connection_limit=1` in
`DATABASE_URL` and use your provider's pooled endpoint — a serverless platform
opens a connection per cold start, and that is the usual way to exhaust a small
database plan.

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
| `JOBS_TOKEN` | 32+ random characters — the scheduler's password |
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

## 3. The scheduler — do not skip this

Nothing runs between requests. Something outside the API must call it every
minute, or no-shows are never released and queued email is never sent.

`POST /api/v1/jobs/run` is the endpoint. It authenticates two ways, because
schedulers differ:

```
X-Jobs-Token: <JOBS_TOKEN>          # Render Cron, GitHub Actions, cron-job.org
Authorization: Bearer <JOBS_TOKEN>  # Vercel Cron, which cannot set custom headers
```

It takes a Redis lease, so two overlapping calls are harmless — and a manual call
while a scheduled one is running is safe.

**On Render** — `backend/render.yaml` declares a cron service alongside the web
service. Set `API_URL` to your API's URL and `JOBS_TOKEN` to the same value the
web service uses.

**On Vercel** — `backend/vercel.json` declares the cron. Set `CRON_SECRET` and
`JOBS_TOKEN` to the same value; Vercel sends `CRON_SECRET` as a bearer token.
Minute-level schedules need a Pro plan; on Hobby the finest is daily, which is
too coarse for releasing no-shows.

**Anywhere else** — a free scheduler such as cron-job.org works:

```
POST https://YOUR-API/api/v1/jobs/run
Header: X-Jobs-Token: <JOBS_TOKEN>
Every minute
```

Check it is working:

```bash
curl -X POST https://YOUR-API/api/v1/jobs/run -H "X-Jobs-Token: $JOBS_TOKEN"
# {"success":true,"message":"Maintenance complete","data":{...}}
```

A 404 means `JOBS_TOKEN` is unset on the API. A 401 means the two values differ.

---

## 4. Front end on Netlify

Connect the repository. `netlify.toml` supplies the build command, publish
directory, caching and the single-page fallback, so the only thing to set is:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://YOUR-API.onrender.com` |

No trailing slash, and no `/api/v1` — the client appends that.

This is read at **build** time and inlined into the bundle. Changing it requires
a redeploy, not a restart.

---

## 5. Google sign-in

In the Google Cloud console, under the OAuth client's **Authorised JavaScript
origins**, add your Netlify URL:

```
https://YOUR-SITE.netlify.app
```

Not the API origin — the browser runs the sign-in, so Google checks the origin
the page was served from. Sign-in fails with no visible error if this is missing,
which is the single most common cause of "the button does nothing".

---

## 6. Check it worked

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
5. Call the maintenance endpoint by hand once (section 3). If it returns 200,
   the scheduler will too.

---

## 7. After the first deploy

- Render's free tier sleeps after inactivity; the first request then takes ~50
  seconds. Use a paid instance for anything students rely on.
- Set up backups on the managed database. Nothing in this repository does that.
- `REMAINING_WORK.md` lists what is not built, including monitoring, CI and load
  testing.
