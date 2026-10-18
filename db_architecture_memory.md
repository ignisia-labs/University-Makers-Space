## Client Standards

### MIT-WPU University Maker's Space

- Engine: PostgreSQL through Prisma ORM.
- Architecture: Stateless modular-monolith API with PostgreSQL as the authoritative product store.
- Naming: Prisma camelCase mapped to PostgreSQL snake_case.
- Scale: Approximately 40,000 registered university users; booking design must tolerate peak contention on a small number of popular LabSlot rows.
- Consistency: Booking capacity, participant eligibility, project policy, creation/cancellation idempotency, and status transitions require transactional consistency.
- Authorization: Application-enforced permissions and ownership checks; PostgreSQL Row Level Security is not enabled yet. Database credentials must remain private to trusted application and migration workloads with least-privilege roles.
- Compliance: Deployment must provide TLS in transit, managed encryption at rest, secrets management, access logging, and an approved DPDP Act 2023 retention/deletion policy for identity snapshots and booking history.

## Active Projects

### University Maker's Space — Phase 4 Capacity Bookings

- Core entities: Lab, LabSlot, Project, ProjectMember, Booking, BookingParticipant, BookingStatusHistory, Notification, AuditLog.
- Concurrency boundary: A selected LabSlot row serializes capacity decisions; project-scoped locking protects configurable future-booking limits.
- Historical policy: Booking time, timezone, cancellation window, Lab name, project title, selected-participant identity, project role, cancellation actor, and status transitions are immutable snapshots.
- Version 1 resource policy: Equipment and consumables are advisory project requirements only; booking allocation tables and QR/barcode credentials are excluded.
- Pending production dependencies: Connection pooling and limits, representative hot-slot load tests, database metrics/slow-query alerts, backup/PITR, restore testing, retention approval, and production security acceptance.
