<!-- This branch is the public demo. See "Running the demo" at the end. -->

# MAKERS LAB APP

## BY IGNISIA CLUB

<div align="center">
  <img src="./public/brand/banner.png" alt="Ignisia Club brand banner" width="1100" />
</div>

A bold digital platform for university makerspaces — built to help students, faculty, and club teams turn ideas into projects, prototypes, and real-world innovation.

### Build faster. Create bigger. Make smarter.

University Makers Space is the central hub for managing equipment access, project collaboration, events, bookings, and community activity inside a modern innovation lab.

---

## 🚀 What we do

We help makers and creators inside the club and university ecosystem to:

- book lab equipment and workshop resources
- manage maker projects and team collaborations
- invite members and track ownership
- discover upcoming events and community activities
- organize admin operations and role-based permissions
- keep notifications, tasks, and approvals in one place

This app creates a smooth, student-first experience while giving admins and moderators the control they need to run a productive maker ecosystem.

---

## ✨ Why it matters

The makerspace is more than a room — it is a space for experimentation, invention, and leadership.

Our platform brings structure to the chaos of creativity so students can focus on building instead of managing logistics.

---

## 🧩 Core features

- Equipment booking and reservation management
- Project creation with members and invites
- Event discovery and registrations
- Notifications and activity updates
- Role-based access for students, staff, moderators, and admins
- Search, filtering, pagination, and smart API responses
- Secure backend architecture with validation, logging, and rate limiting

---

## 🛠️ Tech stack

### Frontend

- React
- TypeScript
- Vite
- TanStack Router
- Tailwind CSS
- Modern UI component system

### Backend

- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL
- Redis
- JWT auth
- Cloudinary uploads
- Zod validation

---

## 📍 Local development

### 1) Clone the project

```bash
git clone https://github.com/ignisia-labs/University-Makers-Space.git
cd University-Makers-Space
```

### 2) Install frontend dependencies

```bash
npm install
```

### 3) Run the frontend

```bash
npm run dev
```

Open the app here:

```text
http://127.0.0.1:5174
```

### 4) Run the backend

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run dev
```

Check the API health here:

```text
http://localhost:4000/health
```

Swagger docs:

```text
http://localhost:4000/api/docs
```

---

## ⚙️ Environment setup

The backend requires valid environment variables in `backend/.env`:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `FRONTEND_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_HOSTED_DOMAIN`

> **These variables must live in `backend/.env`, not the repo-root `.env`.**
> The root `.env` is only read by Vite for the frontend build. The backend loads
> its own `backend/.env` via `dotenv`, and it will refuse to start if any
> required variable is missing.

### Google Workspace sign-in

The app uses **Google Identity Services (GIS) ID tokens**, not the OAuth
authorization-code flow. That has two consequences:

- **`GOOGLE_CLIENT_SECRET` is not used and is not needed.** The backend only
  verifies the signed ID token against `GOOGLE_CLIENT_ID`. Adding a client
  secret has no effect.
- **The client must be a "Web application" OAuth client**, and every origin you
  load the app from has to be registered in the Google Cloud Console under
  **Authorized JavaScript origins**.

Google treats `localhost` and `127.0.0.1` as *different* origins, so register
both for local development:

```text
http://127.0.0.1:5174
http://localhost:5174
```

> **Do not change the dev port casually.** 5174 is the origin registered
> against this project's Google OAuth client. Google rejects sign-in from any
> origin it does not recognise, so running on a different port breaks sign-in
> until somebody with Cloud Console access registers the new origin. For a
> one-off, `UMS_PORT=3000 npm run dev`.

No **Authorized redirect URI** is required for the GIS ID-token flow.

If the origin is not registered, the browser console shows
`[GSI_LOGGER]: The given origin is not allowed for the given client ID`
and the sign-in button either fails to render or does nothing when clicked.

---

## 🧪 Testing

```bash
cd backend
npm test          # unit + controller tests (Prisma and Redis are mocked)
npm run test:db   # the real thing — every suite below, against PostgreSQL
```

`npm run test:db` runs four verification suites against a live database with no
mocks. Each asserts behaviour that only appears when real SQL executes —
uniqueness, transactions, row locks and concurrency:

| Suite | Covers |
| --- | --- |
| `test:core-phases` | Identity, onboarding, PRN uniqueness, session revocation, project lifecycle, availability horizon, closures |
| `test:booking-concurrency` | Capacity races, idempotent retries, cancellation and capacity release |
| `test:phase5-attendance` | Quick Visit capacity races, check-in/out idempotency, occupancy invariants, the reconciler |
| `test:phase6-admin` | Permission matrix, reference-data cascades, audit trail, CSV export and formula-injection hardening |

They need a database they are allowed to mutate, and each refuses to run unless
you opt in explicitly:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ums_test npm run test:db
```

> The suites under `backend/tests/` mock Prisma and Redis, so no SQL executes
> there. Treat `npm run test:db` as the real coverage.

---

## 🗂️ Project structure

```text
.
├── src/                 # Frontend application
├── public/              # Static assets
├── backend/             # Express + Prisma backend
├── package.json         # Frontend scripts
├── README.md            # Project documentation
├── vite.config.ts       # App config
└── .gitignore
```

---

## 🌍 Built for innovation

Made for the Ignisia Club ecosystem — a place where ideas become projects, projects become prototypes, and prototypes become impact.

---

## 🤝 Contributing

Pull requests and feature ideas are welcome. For larger changes, open an issue first so the direction and architecture stay aligned with the project vision.

All contributors must use the shared [implementation roadmap](docs/IMPLEMENTATION_ROADMAP.md) for the current baseline, eight agreed phases, exit gates, remote workflow, and reusable task prompt.

---

## 📜 License

This project is intended for academic and club-based innovation use. Update this section if formal licensing is required.


---

# Running the demo

This branch is the **public demo** served at `makerspace.ignisia.tech`. It is
the current front end with no backend behind it: a static build that answers
its own API calls in the browser.

The full stack — Express, Prisma, Postgres, Redis — lives on the
`development-codex` branch, and the deployed production system runs from there.

```bash
npm install
npm run dev      # http://127.0.0.1:5174
npm run build    # static output in dist/client
```

No database, no API, no Docker.

## How it works without a server

`src/mocks/server.ts` intercepts `fetch` for `/api/v1/*` and answers from
`src/mocks/fixtures.json` — responses captured from the real API running
against the production seed. The shapes are not approximations; they are the
actual payloads, so every screen renders what it renders in production.

Sign-in is a role chooser rather than Google, because there is no server to
verify a Google credential against:

| Role | Lands on | Shows |
|---|---|---|
| Student | `/dashboard` | Projects, slot booking, visits, material claims |
| Lab Assistant | `/operations` | The live console, sessions, equipment management |
| Super Admin | `/admin` | Everything, plus people and reference data |

Writes are kept in memory for the length of the visit: they appear immediately
and are discarded on reload. Nothing a visitor does can break the demo for the
next one.

## The demo data

402 faculty, 53 machines, 150 materials, 5 domains — the real catalogue.

Two things are deliberately not real, because this repository is public and so
is the site:

- **Student records are synthetic.** Enrolment numbers, names and addresses
  are replaced with stable fakes.
- **Faculty email addresses are masked** (`a•••••@mitwpu.edu.in`). The names are
  genuine — showing the actual directory is the point — but the addresses came
  from an internal division spreadsheet, and a public repository is a
  scrapeable place to leave four hundred of them.

To publish the addresses verbatim, set `MASK_FACULTY_EMAILS = false` in
`scripts/build-demo-fixtures.mjs` and re-run it.

`scripts/build-demo-fixtures.mjs` builds the committed `fixtures.json` from
`src/mocks/fixtures.full.json`, which is the raw capture and is **not**
committed. Re-create that raw file with `scripts/capture-demo-fixtures.mjs`
from the local-stack folder, which replays the real API against the local seed.

## Deploying

Both `netlify.toml` and `vercel.json` carry the build environment, so a
connected host needs no dashboard settings:

| | |
|---|---|
| Build command | `npm run build` |
| Publish directory | `dist/client` |
| SPA fallback | every path → `/index.html` |

Pushing to `main` redeploys.
