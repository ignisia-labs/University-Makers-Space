# MIT-WPU MakerSpace — Student PWA Prototype

A touch-first, mock-data frontend covering the public landing page and the full authenticated student experience. No backend; all state is in-memory React state seeded with realistic sample data.

## Screens & Routes

| Route | Screen |
|---|---|
| `/` | Institutional landing page + "Sign in with MIT-WPU (@mitwpu.edu.in)" CTA (mock sign-in → onboarding) |
| `/onboarding` | One-step profile form (read-only email, name, PRN, department, programme, academic year) |
| `/dashboard` | 4-step process tracker, upcoming reservation card, quick action pills |
| `/projects` | Project cards + creation wizard (drawer on mobile, dialog on desktop) |
| `/book` | 4-step capacity-aware slot booking + confirmation drawer |
| `/visits` | Quick Visit request (purpose chips) + visit history timeline |
| `/equipment` | Category filter chips + equipment catalogue cards |

## Layout & Navigation

- App shell wraps all authenticated routes: bottom tab bar under 768px (Home, Projects, Book, Visits, Equipment), collapsible icon/label sidebar at ≥768px, top bar with student name and PRN.
- Every tap target ≥44×44px; pills, chips, and cards use generous padding and `min-h-11`.
- Fluid breakpoints: 320–480 (single column), 768–1024 (two column grids), ≥1024 (sidebar + content max-width).

## Design System

- Slate + indigo tokens defined as oklch semantic variables in `src/styles.css` (`--primary` indigo, slate surfaces, `--success` / `--warning` / `--info` for status badges). No hardcoded color classes.
- Crisp 1px borders, `rounded-xl` cards, subtle shadows, no glassmorphism.
- Typography: geometric sans for headings, neutral sans for body, loaded via `<link>` in `__root.tsx`.
- Status badge variants: Draft, Mentor Approval Pending, Verified, Available, Under Maintenance, Active.

## Feature Details

- **Process tracker:** 4 steps with completed/current/upcoming states, horizontal on desktop, compact on mobile.
- **Project wizard:** name + description, member search with removable chips, faculty mentor select, equipment/consumables selector chips, "Submit for Verification" → project appears with Pending status.
- **Booking:** verified project select → attending member checkboxes with live capacity counter → horizontal date pill carousel → time slot cards showing spots left and per-equipment availability → confirmation drawer writes an upcoming reservation to dashboard state.
- **Quick Visit:** purpose chips, one-tap request, appended to the visit history timeline with entry/exit timestamps and Project Slot vs Quick Visit typing.
- **Equipment:** generated images for a small set of machines, category filters, status pills, spec lists.

## Technical Notes

- TanStack Start file routes; each route gets its own `head()` metadata (title, description, og/twitter).
- Mock data + mutations live in `src/lib/makerspace-data.ts` and a `MakerSpaceProvider` context so bookings/projects created in one screen show up in others during the session.
- shadcn primitives (Dialog, Drawer, Select, Checkbox, Badge, Card, Tabs) for accessible ARIA behavior; icon-only buttons get `aria-label`.
- PWA polish: manifest + theme color, standalone-friendly safe-area padding on the bottom nav. No service worker caching logic beyond the manifest.
