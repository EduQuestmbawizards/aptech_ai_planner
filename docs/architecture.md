# Aptech AI Career & Study Planner — System Architecture

## 1. Overview
The **Aptech AI Career & Study Planner** is an enterprise-grade, independent web application designed for students enrolled in Aptech courses to generate personalized study schedules, track daily learning milestones, monitor study habits, and interact with an AI tutor rooted strictly in the official curriculum.

## 2. High-Level Architecture

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
|  | - Argon2 Password     | | - Profile management    | | - Fixed syllabus hierarchy    |  |
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

## 3. Security Highlights
1. **No Public Registration**: All students are invited by an Admin following admissions verification.
2. **Argon2 Password Hashing**: Memory-hard key derivation to guard against GPU attacks.
3. **Double Verification**: Frontend guards + Independent FastAPI dependency-injection checks for student ownership and role rights on every protected endpoint.
4. **AI Isolation**: AI cannot modify database state directly; all AI outputs are parsed through strict Pydantic v2 schemas and stored deterministically.

