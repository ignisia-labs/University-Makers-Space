# University Makers Space

A modern makerspace platform for managing bookings, projects, equipment access, events, and community collaboration inside a university innovation lab.

## What we do

University Makers Space helps students, faculty, and staff:

- book equipment and lab resources
- manage maker projects and team invites
- track project progress and ownership
- browse upcoming events and registrations
- access a central dashboard for operations and notifications
- support admin and moderation workflows for lab coordination

This project is designed to make the makerspace feel organized, accessible, and student-friendly while giving admins the tools they need to run the space smoothly.

## Platform overview

- Frontend: React + TypeScript + TanStack Router + Tailwind CSS
- Backend: Express + TypeScript + Prisma + PostgreSQL
- Auth: JWT with refresh-token flow
- Real-time/queue workflows: Redis + BullMQ
- File uploads: Cloudinary
- API docs: Swagger UI in development

## Features

- Equipment booking and status management
- Project creation, member management, and invitations
- Event listings and registrations
- Notifications and activity tracking
- Role-based access for students, staff, moderators, and admins
- Search, filtering, pagination, and structured API responses
- Secure API layer with validation, logging, rate limiting, and CORS config

## Tech stack

### Frontend
- React
- TypeScript
- Vite
- TanStack Start / Router
- Tailwind CSS
- shadcn/ui-inspired components

### Backend
- Node.js
- Express
- Prisma ORM
- PostgreSQL
- Redis
- JWT
- Cloudinary
- Zod validation

## Local development

### 1) Install dependencies

```bash
git clone https://github.com/ignisia-labs/University-Makers-Space.git
cd University-Makers-Space
npm install
```

### 2) Start the frontend

```bash
npm run dev
```

Then open:

```text
http://localhost:5173
```

### 3) Start the backend

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run dev
```

Then open:

```text
http://localhost:4000/health
```

Swagger docs are available at:

```text
http://localhost:4000/api/docs
```

## Environment notes

The backend requires PostgreSQL, Redis, and valid environment variables set in the backend `.env` file. You’ll need to configure:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CLOUDINARY_*`
- `FRONTEND_URL`

## Project structure

```text
.
├── src/                 # Frontend app
├── public/              # Static assets
├── backend/             # Express + Prisma API
├── package.json         # Frontend scripts
├── README.md            # Project docs
└── vite.config.ts       # Vite config
```

## Contributing

Pull requests are welcome. For larger changes, please open an issue first so the project direction can be discussed clearly.

## License

This project is currently for internal academic and lab use. Update this section if you plan to open-source or license it formally.
