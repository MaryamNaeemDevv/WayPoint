# Waypoint — Project Management & Team Collaboration Platform

Waypoint is a full-stack, real-time project management and collaboration platform built for
software teams. Administrators plan the route, Project Managers steer each leg, and Team
Members move the work forward — every task carries its own discussion thread, and every
status change is visible to the people who need to see it.

This project was built **entirely from Node.js core modules** — no `npm install` required.
That is a deliberate architecture choice (see *Why no framework?* below), not a limitation:
it demonstrates the underlying mechanics (routing, auth, sessions, an ORM-free data layer)
that frameworks like Express/Next.js/Prisma normally abstract away.

## Quick start

Requirements: **Node.js 22.5+** (for the built-in `node:sqlite` module). No other dependency
needs to be installed — there is no `package.json`, no `npm install` step.

```bash
# 1. Seed the database with demo accounts and sample projects (run once)
node server/seed.js

# 2. Start the server
node server/server.js

# 3. Open the app
# http://localhost:3000
```

To reset all data, stop the server, delete `data/taskflow.db`, and re-run `node server/seed.js`.

### Demo accounts (created by the seed script)

| Role              | Email                     | Password      |
|-------------------|---------------------------|---------------|
| Administrator     | admin@taskflow.dev        | admin123      |
| Project Manager   | hamza.pm@taskflow.dev     | password123   |
| Project Manager   | sara.pm@taskflow.dev      | password123   |
| Team Member       | bilal@taskflow.dev        | password123   |
| Team Member       | zainab@taskflow.dev       | password123   |
| Team Member       | usman@taskflow.dev        | password123   |
| Team Member       | mahnoor@taskflow.dev      | password123   |

New accounts can also self-register from the login screen; self-registration always creates a
**Team Member** account. Administrator and Project Manager accounts are provisioned by an
Administrator from the Users portal.

## Architecture

```
taskflow/
├── server/
│   ├── server.js          # HTTP entry point: static file serving + API router mounting
│   ├── seed.js             # Demo data generator (users, projects, tasks, comments)
│   ├── lib/
│   │   ├── db.js           # node:sqlite connection + schema (DDL)
│   │   ├── auth.js         # scrypt password hashing + HMAC-signed session tokens
│   │   ├── http.js         # Minimal router, body parser, JSON response helper
│   │   └── middleware.js   # requireAuth / requireRole guards, notify() + logActivity() helpers
│   └── routes/
│       ├── auth.js         # POST /api/auth/register, /login, /logout, GET /me
│       ├── users.js        # Admin user management (CRUD)
│       ├── projects.js     # Project CRUD, PM assignment, team membership
│       ├── tasks.js        # Task CRUD, status transitions, task discussion (comments)
│       ├── notifications.js
│       └── dashboard.js    # Role-scoped aggregate stats + deadline sweep job
├── public/                 # Static single-page app (no build step)
│   ├── index.html
│   ├── css/style.css       # Design system ("Waypoint" tokens — see below)
│   └── js/
│       ├── api.js          # fetch() wrapper for every endpoint
│       ├── state.js        # Global store + date/text formatting helpers
│       ├── router.js       # Hash-based client router with auth/role guards
│       ├── components/     # ui.js (icons, toasts, modals) + layout.js (sidebar/topbar shell)
│       └── pages/          # One file per screen (auth, dashboard, projects, tasks, users, ...)
└── data/
    └── taskflow.db          # SQLite database file (created on first run)
```

### Why no framework?

The environment this project was authored in has no package-registry access, so Express,
Prisma, React build tooling, etc. were not installable. Rather than ship something that only
half-works, the app was built directly on:

- **`node:sqlite`** (Node's built-in SQLite driver, stable since Node 22.5) as the database —
  no ORM, hand-written schema and parameterized queries.
- **`node:http`** with a small hand-rolled router (`server/lib/http.js`) instead of Express.
- **`node:crypto`** for password hashing (`scrypt`) and session tokens (HMAC-signed JSON,
  functionally a lightweight JWT) instead of `bcrypt`/`jsonwebtoken`.
- **Vanilla JS** (no React/Vue) for the frontend: a small hash-router, template-string
  rendering, and a fetch-based API client. No build step, no bundler.

Everything here maps 1:1 onto what you'd do with Express + Prisma + React if those were
available — the same routes, the same schema, the same component boundaries — just written
against Node's own primitives. Swapping in Express/Prisma later would be a mechanical,
low-risk change because the layering (routes → middleware → db) already matches that shape.

### Data model

- `users` — id, name, email, password hash, **role** (`ADMIN` / `PROJECT_MANAGER` /
  `TEAM_MEMBER`), status (active/suspended), title, avatar color.
- `projects` — name, description, start/end date, priority, status, `manager_id` (FK → users).
- `project_members` — join table linking team members to the projects they're on.
- `tasks` — title, description, `assignee_id`, priority, status (`TODO` → `IN_PROGRESS` →
  `REVIEW` → `COMPLETED`), due date, `project_id`.
- `task_comments` — the per-task discussion thread.
- `notifications` — per-user notification feed (task assigned, status changed, new comment,
  deadline approaching, added to project).
- `activity_log` — per-project audit trail shown on the Activity tab.

### Role-based access control

Enforced **server-side** on every route (never trust the client):

- **Administrator** — full CRUD on users and projects, assigns Project Managers, can view
  every project/task in the system, system-wide dashboard.
- **Project Manager** — manages only the projects they are assigned to: add/remove team
  members, create/edit/delete tasks, reassign tasks, change project status. Cannot see or
  touch projects they don't manage, cannot manage users.
- **Team Member** — sees only the projects they've been added to and the tasks assigned to
  them; can update a task's status and post in its discussion thread, but cannot create
  projects/tasks, assign work, or reach the Users portal (the route redirects away, and the
  API independently rejects the request).

### Notifications

Triggered on: task assignment, project-manager assignment, being added to a project, a task's
status changing (notifies the project manager), a new discussion comment (notifies the other
participants), and an hourly sweep that flags tasks due within 48 hours.

### Feature checklist (per the brief)

- [x] Admin / Project Manager / Team Member portals with distinct dashboards and permissions
- [x] Project CRUD with manager assignment, dates, priority, status, per-project workspace
- [x] Task CRUD with assignment, priority, due date, status (To Do → In Progress → Review → Completed)
- [x] Task Discussion thread per task
- [x] Notifications (assignment, status change, new discussion, approaching deadline)
- [x] Role-scoped dashboards (active/assigned/pending/completed counts, upcoming deadlines)
- [x] Search, filter, and sort on Projects, Tasks, and Users
- [x] Form validation, error handling, loading states, and success/error toasts throughout
- [x] Responsive layout (desktop, tablet, mobile — collapsible sidebar under 900px)
- [x] Activity timeline (bonus) per project
- [x] Clean, modular architecture with clear separation of routes / middleware / data / UI

## Security notes

- Passwords are hashed with `scrypt` (salted, per-user) — never stored or logged in plaintext.
- Sessions are HMAC-SHA256-signed, expiry-stamped tokens stored in an `HttpOnly` cookie —
  they can't be read or forged from client-side JS, and every request re-validates the user
  still exists and is active.
- All authorization checks happen in the route handlers, not just hidden in the UI.
- `TASKFLOW_SECRET` environment variable should be set to a long random string in any real
  deployment (`server/lib/auth.js` falls back to a dev-only default otherwise).
