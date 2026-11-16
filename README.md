# Aptech AI Career & Study Planner

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.2+-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4+-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E.svg?logo=supabase&logoColor=white)](https://supabase.com)

A production-ready, full-stack educational web application designed for students enrolled in Aptech career programs to generate personalized study schedules, execute daily learning milestones, monitor study habits, and interact with an AI tutor rooted strictly in the official Aptech curriculum.

---

## 1. Project Overview

- **Independent Web Platform**: Deployed on its own domain or subdomain (`career.example.com` / `api-career.example.com`).
- **No Public Registration**: Accounts are strictly provisioned upon verified Aptech admission by an administrator or via an authenticated EduQuest webhook.
- **Fixed Official Catalogue**: Admin maintains approved curriculum modules, accredited hours, and difficulty levels. AI is strictly constrained from altering official course hours or inventing unapproved topics.
- **Personalized Scheduling Engine**: Deterministic Python scheduling engine balances daily hours, available weekdays, topic prerequisites, and target completion deadlines.
- **Dynamic Rescheduling**: Missed or overdue tasks are automatically reallocated to subsequent open study days without deleting completed work.
- **Context-Aware AI Tutor**: Answers technical questions, explains errors, and suggests practice questions within the context of the active course syllabus, with strict token tracking and cost governance.

---

## 2. Architecture & Design

```
+-----------------------------------------------------------------------------------------+
|                                    Frontend Layer                                       |
|  React 18 + TypeScript + Vite + Tailwind CSS + React Router + Recharts + Lucide Icons   |
|                                                                                         |
|  - Student Portal: Dashboard, Onboarding Wizard, Daily Tasks, Weekly Planner, Calendar, |
|                    Progress Analytics, AI Learning Assistant, Syllabus Viewer           |
|  - Admin Portal: Metrics Overview, Student Management, Course Catalogue, Enrollments    |
+--------------------------------------------+--------------------------------------------+
                                             |
                               Secure HTTPS / REST API
                          (HttpOnly Cookies / Bearer JWT)
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
|                                     FastAPI Backend                                     |
|                                                                                         |
|  +----------------------+ +-------------------------+ +-------------------------------+  |
|  | Authentication & RBAC| | Admin & Student Service | | Course Catalogue Service      |  |
|  | - Argon2id Password   | | - Profile management    | | - Fixed syllabus hierarchy    |  |
|  | - JWT Tokens / CSRF  | | - Multi-course support  | | - Strict hours validation     |  |
|  | - Invitation Engine  | | - Audit trail logging   | | - JSON import/export parser   |  |
|  +----------------------+ +-------------------------+ +-------------------------------+  |
|                                                                                         |
|  +-------------------------------------+ +-------------------------------------------+  |
|  | Deterministic Python Scheduler      | | Modular AI Service Layer                   |  |
|  | - Capacity & Feasibility Validator  | | - OpenAI Pydantic Structured Output        |  |
|  | - Workload balancer across weekdays | | - Fallback Deterministic Engine            |  |
|  | - Missed Task dynamic reallocation  | | - Contextual Course Tutor                  |  |
|  | - Prerequisite topological ordering| | - Rate limiter & cost/token tracking       |  |
|  +-------------------------------------+ +-------------------------------------------+  |
|                                                                                         |
|  +------------------------------------------------------------------------------------+  |
|  | EduQuest Server-to-Server Integration API                                          |  |
|  | - HMAC Signature Verification (EDUQUEST_INTEGRATION_SECRET)                        |  |
|  | - Idempotent payload handling, duplicate checks, audit logging                      |  |
|  +------------------------------------------------------------------------------------+  |
+--------------------------------------------+--------------------------------------------+
                                             |
                              SQLAlchemy 2.0 Async/Sync ORM
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
|                                  Data & Storage Layer                                   |
|                                                                                         |
|  - Supabase PostgreSQL (Single source of truth for Relational Data, Constraints & RLS)   |
|  - Supabase Storage (Private course assets, signed URL generation for learning docs)    |
+-----------------------------------------------------------------------------------------+
```

---

## 3. Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Bundler**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **State & Data Fetching**: Axios with interceptors
- **Visualizations**: Recharts
- **Icons & Motion**: Lucide React, Framer Motion
- **Validation**: Zod & React Hook Form

### Backend
- **Framework**: Python 3.11+ / FastAPI
- **Data Validation**: Pydantic v2
- **ORM & Database**: SQLAlchemy 2.0+ / PostgreSQL (Supabase)
- **Migrations**: Alembic
- **Security & Passwords**: Argon2id (`argon2-cffi`), Python-JOSE (JWT tokens), HttpOnly cookies
- **AI Layer**: OpenAI Python SDK (`gpt-4o-mini`) with deterministic fallback
- **Testing**: Pytest & FastAPI TestClient

---

## 4. Supabase Setup & Architecture

1. Create a project in [Supabase](https://supabase.com).
2. Obtain your database connection strings:
   - **Transaction Pooler URL** (`postgresql://postgres:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`)
   - **Direct Database URL** (`postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres`)
3. Set the database connection in your `.env` file:
   ```bash
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres
   SUPABASE_URL=https://[PROJECT-ID].supabase.co
   SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
   SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]
   ```
4. Note: If `DATABASE_URL` is omitted during local development or unit testing, the backend automatically defaults to a local SQLite database (`sqlite:///./aptech_planner.db`).

---

## 5. Environment Variables Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Key | Description | Example |
|---|---|---|
| `DATABASE_URL` | Supabase PostgreSQL Connection URL | `postgresql://postgres:pwd@db.proj.supabase.co:5432/postgres` |
| `JWT_SECRET_KEY` | Secret key for signing session tokens (32+ chars) | `aptech-super-secret-jwt-key-32chars` |
| `OPENAI_API_KEY` | OpenAI API key for personalized planner & tutor | `sk-...` |
| `OPENAI_MODEL` | OpenAI Model tier | `gpt-4o-mini` |
| `EMAIL_HOST` | Transactional SMTP server | `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP port | `587` |
| `EMAIL_USERNAME` | SMTP user / sender address | `admin@aptech-planner.com` |
| `EMAIL_PASSWORD` | App password / SMTP secret | `••••••••••••` |
| `EMAIL_ENABLED` | Toggle live SMTP dispatch | `false` (logs token in console for dev) |
| `FRONTEND_URL` | Frontend origin for activation links | `http://localhost:5173` |
| `BACKEND_URL` | Backend API base origin | `http://localhost:8000` |
| `EDUQUEST_INTEGRATION_SECRET` | HMAC shared secret for EduQuest webhooks | `eduquest-shared-secret-key-32chars` |

---

## 6. Installation & Local Development

### Prerequisites
- Node.js (v18+)
- Python (3.11+)

### Backend Setup
```bash
# Navigate to backend
cd backend

# Create & activate Python virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Bootstrap database, admin account, and seed official courses
python scripts/bootstrap.py

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```
Backend API docs available at: [http://localhost:8000/docs](http://localhost:8000/docs)

### Frontend Setup
```bash
# In a new terminal, navigate to frontend
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Frontend application accessible at: [http://localhost:5173](http://localhost:5173)

---

## 7. Initial Credentials (Bootstrap)

After running `python backend/scripts/bootstrap.py`:

| Role | Email | Password |
|---|---|---|
| **Administrator** | `admin@aptech.edu` | `AptechAdmin@2026!` |
| **Demo Student** | `student.demo@aptech.edu` | `StudentDemo@2026!` |

*(The login screen also includes convenient 1-click test credential fill buttons).*

---

## 8. Running Automated Tests

To execute the test suite (health checks, authentication, role guards, catalogue import, planner onboarding, capacity calculations, task completion, and EduQuest HMAC verification):

```bash
cd backend
.\venv\Scripts\pytest
```

---

## 9. Future EduQuest Integration

The Career Planner exposes a dedicated, cryptographically signed webhook endpoint:

```http
POST /api/integrations/eduquest/student-registration
Content-Type: application/json
X-EduQuest-Signature: <hex_encoded_hmac_sha256>
X-Idempotency-Key: <unique_uuid>
```

Refer to [`docs/eduquest_integration.md`](file:///c:/Users/ASUS/Desktop/planner/docs/eduquest_integration.md) for sample payloads and verification examples.

---

## 10. Production Deployment (Docker)

```bash
# Build and launch both frontend and backend
docker-compose up --build -d
```

