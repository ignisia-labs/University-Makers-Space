# MAKERS LAB APP

## BY IGNISIA CLUB

<div align="center">
  <img src="https://images.unsplash.com/photo-1516321165247-4aa89a48be28?auto=format&fit=crop&w=1200&q=80" alt="Makerspace community workspace" width="1100" />
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
http://localhost:5173
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

---

## 📜 License

This project is intended for academic and club-based innovation use. Update this section if formal licensing is required.
