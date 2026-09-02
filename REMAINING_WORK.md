# सृजन — remaining work

State as of 2 September 2026, branch `development-codex`.

Everything in Phases 1–7 that the app needs to run is built and verified against
a real database. This file lists what is *not* done, so nobody discovers it
during a demo.

---

## 1. Blocking a real deployment

These must be settled before students use the system.

### Cloudinary API secret is wrong

`backend/.env` has ten asterisks where the API secret should be — Cloudinary's
dashboard masks the value and the masked text was copied. The cloud name and key
are accepted; only the signature fails.

**Until this is fixed: no photo anywhere can be uploaded.** Equipment photos,
domain tile images, and any future file upload all fail with
`IMAGE_HOST_UNAVAILABLE`. Reveal the secret in the Cloudinary console and paste
the real value.

### Email is not configured

`SMTP_HOST` is unset, so the app uses a console transport: invitation and
notification emails are written to the log and **never sent**. A student invited
to a project will not hear about it. Set the SMTP variables (Brevo, Postmark,
SES) before inviting anyone who is not sitting next to you.

### Everything runs on one laptop

Postgres and Redis are local Docker containers. Both must move to managed
services before deployment — see `DEPLOYMENT.md`.

---

## 2. Known gaps in what is built

### Photos
No equipment or domain has an image. The placeholders are designed for this, so
nothing looks broken, but the catalogue is plainer than it should be. Blocked on
the Cloudinary secret above.

### Four inventory rows need a human
From the JN305 sheet, imported as-is because guessing would be worse:

| Row | Problem |
|---|---|
| `LED Driver` | No quantity in the sheet — stocked at 0 |
| `Resistor · 1.42 Ω` | No quantity in the sheet — stocked at 0 |
| `Connector · Arduino connector` | No quantity in the sheet — stocked at 0 |
| `USA-A` | Unreadable item name — filed as Uncategorised |

### One faculty row has a typo in the source
`sandeep.singhal@mitwu.edu.in` is missing the *p* in `mitwpu`. He was skipped.
Fix the cell and re-import; the import is idempotent.

### Two retired catalogue rows still exist
`Creality Ender-5 Plus` and `PLA Filament` came from an old seed. They are hidden
from every screen but the rows remain, because they are referenced by real
bookings and an issued claim. Deleting them would mean rewriting attendance
history. They disappear for good once the projects and bookings that reference
them are gone.

### Equipment lists page at 100
The catalogue screens fetch 100 items and say so when there are more. Past 100
machines they need real pagination. There are 24 today.

### Consumable units are guessed
The import read units from the quantity cell (`1 Bundle` → bundle). Most rows
had a bare number and defaulted to "piece". Check anything measured in grams or
metres.

---

## 3. Not built at all

### Phase 7 remainder
- **Notification preferences.** The settings screen lists what the app notifies
  you about and states plainly that choosing between them is not available. The
  backend has no per-user preference model.
- **Real-time updates.** Availability changes are published to a Redis channel
  but nothing subscribes. Screens poll on a timer (20–30s) instead. A booking
  taken by another team appears on the next poll, not instantly.

### Phase 8 — entirely
- CI/CD pipeline
- Monitoring, alerting and error tracking
- Load testing against the 500-concurrent-user target. The booking and claim
  paths are built for it — row locks, conditional updates, idempotency keys —
  and their concurrency suites pass, but no one has driven 500 real sessions
  through it.
- Database backups and a restore drill
- A staging environment

### Testing
- The 12 suites under `backend/tests/` are named "integration" but mock Prisma.
  The seven suites in `backend/scripts/verify-*.ts` are the ones that exercise a
  real database; those are the ones to trust.
- No frontend tests at all — no component, no end-to-end. Every UI claim in this
  project's history was verified by hand in a browser.
- No accessibility audit.

### Product gaps
- **Events** have a backend module and routes but no interface.
- **Reports** export CSV; nothing charts or schedules them.
- **A student cannot leave a project** — only the leader can remove members.
- **No password-less recovery** if a student loses access to their Google
  account; an administrator must unlink the identity by hand.

---

## 4. Things worth doing soon

- Commit more often. Two sessions of uncommitted work were nearly lost to a
  `git checkout`.
- Delete `.lovable/` and `AGENTS.md` if the project is no longer edited in
  Lovable. They were left alone because removing them may affect that link.
- `db_architecture_memory.md` and `DEVELOPMENT_CHANGELOG.md` are kept as real
  documentation, but neither has been updated since Phase 4.
- The prototype/mock UI layer is gone. If anything still looks like placeholder
  data, it is real data that needs editing, not code to change.
