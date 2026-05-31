# Task Tracker API

> SDE II Take-Home Assignment — Team Task Tracker REST API

A production-ready REST API for team-based task management with JWT authentication, role-based access control (RBAC), Redis caching, and containerised deployment.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Setup Instructions](#setup-instructions)
  - [Option A — Docker (recommended)](#option-a--docker-recommended)
  - [Option B — Local Development](#option-b--local-development)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [RBAC Roles & Permissions](#rbac-roles--permissions)
- [Status Transition Rules](#status-transition-rules)
- [Caching Strategy](#caching-strategy)
- [Design Decisions](#design-decisions)
- [What I Would Improve](#what-i-would-improve)

---

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Runtime    | Node.js 20                          |
| Framework  | Express.js                          |
| Database   | MySQL 8.0 + Sequelize ORM           |
| Cache      | Redis 7                             |
| Auth       | JWT (access + refresh token)        |
| Validation | express-validator                   |
| Container  | Docker + Docker Compose             |

---

## Setup Instructions

### Option A — Docker (recommended)

Reviewer can be up and hitting the API in under 2 minutes.

```bash
# 1. Clone the repo
git clone https://github.com/jeevansudhagar/tasktracker.git
cd tasktracker

# 2. Create environment file (edit DB_PASSWORD and JWT_SECRET)
cp backend/.env.example backend/.env

# 3. Start everything (MySQL + Redis + API)
docker compose up --build -d

# 4. Wait ~20 seconds for MySQL to initialise, then seed demo data
docker compose exec api node src/scripts/seed.js

# 5. Hit the health check
curl http://localhost:5000/health
```

**Demo credentials (after seeding):**

| Role    | Email               | Password      |
|---------|---------------------|---------------|
| ADMIN   | admin@acme.com      | Password@123  |
| MANAGER | manager@acme.com    | Password@123  |
| MEMBER  | member@acme.com     | Password@123  |

---

### Option B — Local Development

**Prerequisites:** Node.js 20+, MySQL 8, Redis 7

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET

# 3. Create the MySQL database
mysql -u root -p -e "CREATE DATABASE task_tracker_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 4. Start the dev server (auto-syncs Sequelize models)
npm run dev

# 5. Seed demo data
npm run seed
```

---

## Database Schema

```
organizations
  id (UUID PK), name, slug (UNIQUE), description, isActive, createdAt, updatedAt

users
  id (UUID PK), name, email (UNIQUE), password (bcrypt), role (ENUM: ADMIN|MANAGER|MEMBER),
  organizationId (FK → organizations), refreshToken, isActive, lastLoginAt, createdAt, updatedAt

projects
  id (UUID PK), name, description, organizationId (FK), createdById (FK → users),
  isActive, createdAt, updatedAt

tasks
  id (UUID PK), title, description, priority (ENUM: LOW|MEDIUM|HIGH),
  status (ENUM: TODO|IN_PROGRESS|IN_REVIEW|DONE|BLOCKED),
  dueDate, projectId (FK → projects), assigneeId (FK → users),
  createdById (FK → users), organizationId (FK), createdAt, updatedAt
```

### Indexes

| Table | Indexed Fields | Reason |
|-------|---------------|--------|
| users | email | Login lookup |
| users | organizationId, role | List users by org + role |
| tasks | status | Filter by status |
| tasks | assigneeId | Cache key + MEMBER scope |
| tasks | dueDate | Overdue queries |
| tasks | assigneeId + status | Composite — most common list query |
| tasks | organizationId + status | Org-wide status breakdown |

---

## API Endpoints

### Auth — `/api/v1/auth`

| Method | Endpoint        | Auth | Description                         |
|--------|-----------------|------|-------------------------------------|
| POST   | /register       |    | Register user + create/join org     |
| POST   | /login          |    | Login, returns access + refresh tokens |
| POST   | /refresh        |    | Rotate refresh token                |
| POST   | /logout         |    | Invalidate refresh token            |
| GET    | /me             |    | Get current user profile            |

### Users — `/api/v1/users`

| Method | Endpoint  | Roles          | Description             |
|--------|-----------|----------------|-------------------------|
| GET    | /         | ADMIN          | List all org users      |
| GET    | /:id      | ADMIN or self  | Get user by ID          |
| PATCH  | /:id      | ADMIN          | Update role / isActive  |
| DELETE | /:id      | ADMIN          | Soft-delete user        |

### Projects — `/api/v1/projects`

| Method | Endpoint  | Roles           | Description             |
|--------|-----------|-----------------|-------------------------|
| GET    | /         | All             | List org projects       |
| GET    | /:id      | All             | Get project + task summary |
| POST   | /         | ADMIN, MANAGER  | Create project          |
| PATCH  | /:id      | ADMIN, MANAGER  | Update project          |
| DELETE | /:id      | ADMIN           | Soft-delete project     |

### Tasks — `/api/v1/tasks`

| Method | Endpoint        | Roles                   | Description                     |
|--------|-----------------|-------------------------|---------------------------------|
| GET    | /               | All (MEMBER: own tasks) | List tasks (filter + paginate)  |
| GET    | /:id            | All (MEMBER: own only)  | Get task by ID                  |
| POST   | /               | ADMIN, MANAGER          | Create task                     |
| PATCH  | /:id            | ADMIN, MANAGER          | Update task fields              |
| PATCH  | /:id/status     | Assignee or ADMIN/MANAGER | Advance status (enforced transitions) |
| DELETE | /:id            | ADMIN                   | Delete task                     |

**Query params for GET /tasks:** `page`, `limit`, `status`, `priority`, `assigneeId`

### Analytics — `/api/v1/analytics` (Bonus)

| Method | Endpoint               | Roles          | Description                          |
|--------|------------------------|----------------|--------------------------------------|
| GET    | /overdue-summary       | ADMIN, MANAGER | Overdue count per user + avg completion time |
| GET    | /task-status-breakdown | ADMIN, MANAGER | Task counts per status per project   |

---

## RBAC Roles & Permissions

RBAC is enforced **at the middleware layer** (not inside controller logic). Each route declares its required role explicitly.

| Permission                          | ADMIN | MANAGER | MEMBER |
|-------------------------------------|:-----:|:-------:|:------:|
| Manage users (create/update/delete) |     |       |      |
| Create / update projects            |     |       |      |
| Delete projects                     |     |       |      |
| Create / update tasks               |     |       |      |
| Delete tasks                        |     |       |      |
| Advance task status                 |     |       |  Own only |
| View all org tasks                  |     |       |      |
| View own tasks only                 |     |       |      |
| View analytics                      |     |       |      |

---

## Status Transition Rules

Enforced server-side in `tasks.service.js → assertValidTransition()`. Transitions are **not** controlled by free-form input.

```
TODO ──────────► IN_PROGRESS ──────────► IN_REVIEW ──────────► DONE (terminal)
  │                   │                     │
  └──► BLOCKED ◄──────┘ ◄───────────────────┘
         │
         └──► TODO / IN_PROGRESS (reopen)
```

| From        | Allowed → To                          |
|-------------|---------------------------------------|
| TODO        | IN_PROGRESS, BLOCKED                  |
| IN_PROGRESS | IN_REVIEW, BLOCKED                    |
| IN_REVIEW   | DONE, BLOCKED, IN_PROGRESS            |
| DONE        | _(terminal — no transitions allowed)_ |
| BLOCKED     | TODO, IN_PROGRESS                     |

**Who can advance status:**
- The **assignee** of the task, OR
- Any **MANAGER** or **ADMIN**

---

## Caching Strategy

**Technology:** Redis 7 (via `redis` npm package v4)

**What is cached:**
- Task list results per assignee + query parameters
- Analytics endpoints (overdue summary, status breakdown)

**Cache key format:**
```
tasks:assignee:<assigneeId>:<page>:<limit>:<status>:<priority>:<orgId>
analytics:overdue:<orgId>
analytics:status-breakdown:<orgId>
```

**TTL:**
- Task lists: **5 minutes** (300s)
- Analytics: **10 minutes** (600s)

**Invalidation strategy (write-through invalidation):**

| Event                        | Keys Invalidated                          |
|------------------------------|-------------------------------------------|
| Task created                 | `tasks:assignee:<newAssigneeId>:*`        |
| Task updated (fields)        | `tasks:assignee:<oldAssigneeId>:*` + new  |
| Task status changed          | `tasks:assignee:<assigneeId>:*`           |
| Task deleted                 | `tasks:assignee:<assigneeId>:*`           |

Pattern-based invalidation uses Redis `SCAN` (not `KEYS`) to avoid blocking in production.

**Graceful degradation:** If Redis is unavailable, the app runs normally without caching — no crash.

---

## Design Decisions

### 1. UUID Primary Keys (not auto-increment)
Using UUIDs (`UUIDV4`) means IDs are globally unique and safe to expose in URLs. Prevents enumeration attacks and makes multi-tenant sharding straightforward.

### 2. Status Transitions in Service Layer
All business rules (status FSM, RBAC checks for who can advance status) live in `tasks.service.js`, not controllers. Controllers are thin — they call the service and return the response. This makes the logic independently testable.

### 3. Composite Indexes on Tasks
`(assigneeId, status)` and `(organizationId, status)` are the two most frequent query patterns in a task tracker. Composite indexes on these avoid full-table scans even with millions of rows.

### 4. Refresh Token Rotation
On every `/auth/refresh`, the old token is immediately invalidated and a new one issued. This prevents refresh token replay attacks. If someone steals a refresh token and uses it after the legitimate user has already rotated it, they get a 401.

### 5. Soft Deletes (isActive flag)
Users and projects are never hard-deleted — just set `isActive = false`. This preserves historical task data and audit trails (who created/assigned tasks that still exist).

### 6. Redis SCAN instead of KEYS for invalidation
`KEYS tasks:assignee:*` blocks the Redis event loop on large keyspaces. Using `SCAN` with cursor pagination is O(N) but non-blocking and safe for production.

---

## What I Would Improve

Given more time, I would add:

1. **Database migrations** — Replace `sequelize.sync({ alter: true })` with proper Sequelize CLI migrations for production-safe schema changes.

2. **Unit + integration tests** — At minimum: auth flow, status transition enforcement, and RBAC edge cases using Jest + Supertest.

3. **Rate limiting** — Add `express-rate-limit` on `/auth/login` and `/auth/register` to prevent brute force.

4. **WebSocket notifications** — Use Socket.io to push real-time status change events to connected clients (the bonus real-time feature).

5. **Audit log table** — Track every status change with `(taskId, fromStatus, toStatus, changedById, changedAt)` for compliance/history.

6. **Pagination cursor-based** — Replace offset pagination with cursor-based for consistent results on large datasets.

7. **Full frontend** — React task board with Kanban drag-and-drop (columns = statuses), integrated with this API.
