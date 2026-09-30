# TeamFlow

**Role-Based Team Task & Workload Management Platform**

TeamFlow is a SaaS-style team management platform for planning projects, assigning tasks, tracking workload, and keeping teams unblocked. Built with a Python/FastAPI backend, MySQL via SQLAlchemy, and a Bootstrap 5 + Chart.js frontend.

---

## Problem Statement

Small teams routinely lose track of who is overloaded, which tasks are overdue, and who should pick up the next piece of work. TeamFlow centralizes projects, tasks, and team workload in one place, and adds a rule-based recommendation engine so managers can assign work based on actual current capacity instead of guesswork.

---

## Features

- JWT authentication with password hashing (bcrypt)
- Three roles — Admin, Project Manager, Team Member — enforced **server-side**, not just hidden in the UI
- Full CRUD for users, projects, tasks, comments, and project membership
- Kanban board with drag-and-drop status updates (persisted through the API)
- Automatic overdue-task detection (due date passed + not completed)
- Team workload calculation (active/completed/overdue tasks, completion rate, workload score)
- **Smart Assignee Recommendation** — rule-based engine that scores project members by current load and explains its pick
- Dashboard with Chart.js visualizations: status distribution, priority distribution, workload, recent tasks
- Search & filtering on tasks (keyword, project, assignee, status, priority, overdue)
- Task comment threads
- Responsive, modern SaaS-style UI (sidebar nav, cards, badges, modals, toasts, empty/loading states)

### Special Features

- **Smart Assignee Recommendation** (`app/services/recommendation_service.py`): purely arithmetic rule-based scoring — no external AI calls — that penalizes active/overdue load and rewards completion rate, then explains the reasoning in plain English.
- **Overdue detection** is computed dynamically from `due_date` + `status`, not stored as a separate flag, so it's always accurate.

---

## Technology Stack

| Layer      | Choice                                   |
|------------|-------------------------------------------|
| Frontend   | HTML5, CSS3, JavaScript, Bootstrap 5, Chart.js |
| Backend    | Python 3.11+, FastAPI                     |
| Database   | MySQL, SQLAlchemy ORM                     |
| Auth       | JWT (python-jose), bcrypt (passlib)       |
| Testing    | Pytest, FastAPI TestClient, SQLite (test DB) |
| DevOps     | Git, GitHub, Jenkins                      |

---

## Architecture

```
Browser (Bootstrap + vanilla JS)
        │  fetch() + Bearer JWT
        ▼
FastAPI app (routers → services → SQLAlchemy models)
        │
        ▼
MySQL database
```

- **Routers** handle HTTP concerns and role checks.
- **Services** hold business logic (overdue detection, workload math, recommendation scoring) independent of the web layer, so it's unit-testable and reusable.
- **Schemas** (Pydantic) validate input/output shapes separately from the SQLAlchemy models.

---

## Database Design

| Table            | Purpose                                                |
|-------------------|---------------------------------------------------------|
| `users`           | Accounts, hashed passwords, role                        |
| `projects`        | Project metadata, owner, status, timeline                |
| `project_members` | Many-to-many join between users and projects             |
| `tasks`           | Work items with assignee, priority, status, due date      |
| `comments`        | Task discussion threads                                   |

Foreign keys: `projects.created_by → users.id`, `project_members.{project_id,user_id}`, `tasks.{project_id,assigned_to,created_by}`, `comments.{task_id,user_id}`.

---

## API Endpoints

Interactive docs are auto-generated at **`/docs`** (Swagger UI) and **`/redoc`**.

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

GET    /api/users
POST   /api/users
GET    /api/users/{id}
PUT    /api/users/{id}
DELETE /api/users/{id}

GET    /api/projects
POST   /api/projects
GET    /api/projects/{id}
PUT    /api/projects/{id}
DELETE /api/projects/{id}
POST   /api/projects/{id}/members
DELETE /api/projects/{id}/members/{user_id}

GET    /api/tasks               (supports project_id, assigned_to, status_filter, priority, keyword, overdue_only)
POST   /api/tasks
GET    /api/tasks/{id}
PUT    /api/tasks/{id}
DELETE /api/tasks/{id}
GET    /api/tasks/recommend/{project_id}

GET    /api/tasks/{task_id}/comments
POST   /api/tasks/{task_id}/comments
DELETE /api/comments/{id}

GET    /api/dashboard/summary
GET    /api/workload
GET    /api/workload/me
```

---

## Project Structure

```
TeamFlow/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/            # config, security (JWT + password hashing)
│   │   ├── database/        # SQLAlchemy engine/session
│   │   ├── models/          # ORM models
│   │   ├── schemas/         # Pydantic request/response models
│   │   ├── routers/         # FastAPI route handlers
│   │   ├── services/        # business logic (overdue, workload, recommendation)
│   │   └── dependencies/    # auth dependencies / role guards
│   ├── tests/                # Pytest suite
│   ├── seed.py                # demo data seeder
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── pages/                 # login, register, dashboard, projects, tasks, kanban, team, profile...
│   ├── css/
│   └── js/
├── Jenkinsfile
├── .gitignore
└── README.md
```

---

## Installation

### Prerequisites
- Python 3.11+
- MySQL Server 8.0+ running locally (or accessible)

### 1. Clone & configure environment

```bash
cd backend
cp .env.example .env
# edit .env with your MySQL credentials and a strong JWT_SECRET
```

### 2. Create the database

```sql
CREATE DATABASE teamflow CHARACTER SET utf8mb4;
```

### 3. Install backend dependencies

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

---

## Environment Variables (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and fill in real values — every variable is documented there with what it does. The full list:

| Variable | Local dev value | What it's for |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | your local MySQL | Database connection |
| `DB_USE_SSL` | `false` | Set `true` for TiDB Cloud or any managed host that requires TLS |
| `JWT_SECRET` | any string | **Must** be a long, random, unique value in production — the app refuses to start with the insecure default outside dev/test |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `JWT_EXPIRE_MINUTES` | `1440` | How long a login session lasts |
| `ENVIRONMENT` | `development` | Set to `production` on a real deploy — this enables the JWT-secret safety check, disables `/docs`/`/redoc`/`/openapi.json`, and makes a failed database connection crash startup loudly instead of silently limping along |
| `CORS_ORIGINS` | `http://localhost:5500,http://127.0.0.1:5500` | Comma-separated list of frontend origins allowed to call the API |
| `ADMIN_SETUP_TOKEN` | any string, or leave unset | One-time token required in the registration form to create the first Admin account; leave unset to disable admin self-registration entirely |

Never commit `.env` — it's already in `.gitignore`.

---

## Running the Backend

```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload
```

Tables are created automatically on startup. API docs: http://localhost:8000/docs

### Seed demo data (optional but recommended)

```bash
cd backend
venv\Scripts\activate
python seed.py
```

This creates 1 Admin, 1 Project Manager, 4 Team Members, 4 projects, and 15 tasks (with completed, in-progress, and overdue examples) so the dashboard looks realistic immediately.

Demo logins (password for all: `password123`):
- Admin: `admin@teamflow.com`
- Project Manager: `pm@teamflow.com`
- Team Members: `priya@teamflow.com`, `rahul@teamflow.com`, `sara@teamflow.com`, `karan@teamflow.com`

---

## Running the Frontend

The frontend is static HTML/CSS/JS — no build step. Serve it with any static server, e.g.:

```bash
cd frontend
python -m http.server 5500
```

Then open http://localhost:5500. It talks to the backend at `http://localhost:8000/api` by default when run locally — this is auto-detected in `frontend/js/config.js`, which also documents how to point the frontend at a production backend URL.

---

## Running Tests

```bash
cd backend
venv\Scripts\activate
pytest -v
```

Tests run against an in-memory SQLite database (via a FastAPI dependency override), so they don't require MySQL and run fast in CI. Coverage includes registration, login (success/failure), auth, user/project/task/comment CRUD, role-based authorization, overdue detection, workload calculation, and smart assignee recommendation.

---

## Deploying to Render with TiDB Cloud

This walks through the exact setup this project is configured for: a Render Web Service running the FastAPI backend, connected to a TiDB Cloud (MySQL-compatible, TLS-required) database.

### 1. Set up TiDB Cloud

1. Create a free TiDB Cloud Serverless cluster at [tidbcloud.com](https://tidbcloud.com).
2. From the cluster's **Connect** panel, copy the host, port (usually `4000`), user, and password. TiDB Cloud requires TLS — this project already handles that correctly (see `backend/app/database/database.py`), you don't need to download or configure a certificate file yourself.
3. Create the database: connect with any MySQL client and run `CREATE DATABASE teamflow CHARACTER SET utf8mb4;` (or use whatever name you'll put in `DB_NAME`).

### 2. Create the Render Web Service

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. On [render.com](https://render.com), create a new **Web Service** from your GitHub repo.
3. **Root Directory**: `backend`
4. **Build Command**: `pip install -r requirements.txt`
5. **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### 3. Pin the Python version (required)

Render defaults to a very recent Python version that may not yet have prebuilt wheels for this project's pinned dependencies (this caused a real build failure — `pydantic-core` trying to compile from source and failing on Render's read-only filesystem). This repo includes `backend/.python-version` pinning Python 3.12, which Render reads automatically **when the Root Directory is `backend`**.

As a more reliable backup (env vars take priority over the file, regardless of Root Directory path resolution), also set this in Render's **Environment** tab:
```
PYTHON_VERSION=3.12.7
```

### 4. Set environment variables in Render

In the Render service's **Environment** tab, add:
```
ENVIRONMENT=production
DB_HOST=<your TiDB Cloud host>
DB_PORT=4000
DB_NAME=teamflow
DB_USER=<your TiDB Cloud user>
DB_PASSWORD=<your TiDB Cloud password>
DB_USE_SSL=true
JWT_SECRET=<generate a long random value — never reuse the local dev one>
CORS_ORIGINS=<your deployed frontend's URL, e.g. https://your-frontend.onrender.com>
ADMIN_SETUP_TOKEN=<a random one-time token, to create your first admin — remove it after>
```

### 5. Deploy, then verify

1. Trigger the deploy. Watch the build logs — it should install cleanly on Python 3.12 with no Cargo/Rust compilation step.
2. Once live, Render gives you a URL like `https://teamflow-xxxx.onrender.com`. Test it: `https://teamflow-xxxx.onrender.com/api/health` should return `{"status":"ok"}`.
3. **You still need to enter this URL into the frontend** — open `frontend/js/config.js` and set `PRODUCTION_API_BASE_URL` to `https://teamflow-xxxx.onrender.com/api` (this file intentionally does not guess or invent this URL for you, since it doesn't exist until you deploy).
4. Register your first Admin using the `ADMIN_SETUP_TOKEN` you set above, then consider removing that env var from Render so no one else can self-register as Admin.
5. Confirm `/docs` now returns `404` on the production URL (it's intentionally disabled outside dev) — this is expected, not a bug.

### Troubleshooting

- **Build fails on `pydantic-core` / Cargo / Rust**: the Python version pin above didn't take effect. Double-check `PYTHON_VERSION=3.12.7` is set in Render's Environment tab and redeploy.
- **App "deploys" but every request 500s**: check the Render logs for `Database connection failed during startup` — in production this now crashes the app on purpose (so Render marks the deploy as failed, instead of quietly running with no database). Fix the `DB_*` variables and redeploy.
- **CORS errors in the browser console**: `CORS_ORIGINS` on Render must exactly match your frontend's actual URL (scheme + host, no trailing slash).

---

## Jenkins CI/CD

`Jenkinsfile` defines: **Checkout → Install dependencies → Run Pytest (JUnit report) → Build/validate → Deploy (main branch only)**. The pipeline fails the build if any test fails.

---

## Future Improvements

- Real-time updates via WebSockets (live Kanban sync across users)
- File attachments on tasks
- Email/Slack notifications for overdue tasks and assignments
- Project-level Gantt/timeline view
- Audit log of task/project changes
- Dockerized deployment (docker-compose for API + MySQL)

---

## Author

Built by Roja — this is a portfolio project demonstrating full-stack development, role-based authorization, business-logic services, and CI/CD wiring.
