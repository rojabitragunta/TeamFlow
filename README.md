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

```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=teamflow
DB_USER=root
DB_PASSWORD=your-mysql-password

JWT_SECRET=change-this-to-a-long-random-secret-string
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440
```

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
