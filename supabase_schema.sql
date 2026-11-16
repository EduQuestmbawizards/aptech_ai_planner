-- ==========================================================
-- APTECH AI CAREER & STUDY PLANNER - SUPABASE POSTGRESQL SCHEMA
-- Execute this entire script directly in the Supabase SQL Editor
-- ==========================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean drop of any conflicting old or partial tables
DROP TABLE IF EXISTS study_sessions CASCADE;
DROP TABLE IF EXISTS study_tasks CASCADE;
DROP TABLE IF EXISTS study_plan_milestones CASCADE;
DROP TABLE IF EXISTS planner_preferences CASCADE;
DROP TABLE IF EXISTS study_plans CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS course_resources CASCADE;
DROP TABLE IF EXISTS course_topics CASCADE;
DROP TABLE IF EXISTS course_modules CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS invitations CASCADE;
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS ai_usage_logs CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS student_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. USERS TABLE
CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'STUDENT',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 2. STUDENT PROFILES TABLE
CREATE TABLE student_profiles (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(64) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    aptech_student_id VARCHAR(64) UNIQUE NOT NULL,
    phone VARCHAR(32),
    current_level VARCHAR(32) DEFAULT 'BEGINNER',
    target_career VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 3. COURSES TABLE
CREATE TABLE courses (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    course_code VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    official_duration_value INTEGER NOT NULL,
    official_duration_unit VARCHAR(32) NOT NULL DEFAULT 'MONTHS',
    total_learning_hours DOUBLE PRECISION NOT NULL,
    syllabus_version VARCHAR(32) NOT NULL DEFAULT 'v1.0',
    category VARCHAR(64),
    difficulty_level VARCHAR(32) DEFAULT 'INTERMEDIATE',
    prerequisites JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 4. COURSE MODULES TABLE
CREATE TABLE course_modules (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    course_id VARCHAR(64) NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    module_code VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL,
    estimated_hours DOUBLE PRECISION NOT NULL
);

-- 5. COURSE TOPICS TABLE
CREATE TABLE course_topics (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    module_id VARCHAR(64) NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
    topic_code VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    estimated_hours DOUBLE PRECISION NOT NULL,
    difficulty VARCHAR(32) DEFAULT 'INTERMEDIATE',
    order_index INTEGER NOT NULL,
    subtopics JSONB DEFAULT '[]'::jsonb
);

-- 6. COURSE RESOURCES TABLE
CREATE TABLE course_resources (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    topic_id VARCHAR(64) NOT NULL REFERENCES course_topics(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    resource_type VARCHAR(32) NOT NULL,
    url TEXT NOT NULL,
    description TEXT
);

-- 7. ENROLLMENTS TABLE
CREATE TABLE enrollments (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    student_id VARCHAR(64) NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
    course_id VARCHAR(64) NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    enrolled_date DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until DATE,
    payment_reference VARCHAR(128),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 8. STUDY PLANS TABLE
CREATE TABLE study_plans (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    enrollment_id VARCHAR(64) NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    student_id VARCHAR(64) NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
    course_id VARCHAR(64) NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    syllabus_version VARCHAR(32) NOT NULL,
    start_date DATE NOT NULL,
    target_completion_date DATE NOT NULL,
    total_scheduled_hours DOUBLE PRECISION NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS',
    generation_source VARCHAR(32) NOT NULL DEFAULT 'HYBRID_AI',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 9. PLANNER PREFERENCES TABLE
CREATE TABLE planner_preferences (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    study_plan_id VARCHAR(64) UNIQUE NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
    target_completion_date DATE NOT NULL,
    requested_duration_days INTEGER NOT NULL,
    daily_study_hours DOUBLE PRECISION NOT NULL,
    available_days JSONB DEFAULT '[]'::jsonb,
    preferred_learning_style VARCHAR(64),
    learning_goals JSONB DEFAULT '[]'::jsonb,
    known_topics JSONB DEFAULT '[]'::jsonb,
    weak_topics JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 10. STUDY PLAN MILESTONES TABLE
CREATE TABLE study_plan_milestones (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    study_plan_id VARCHAR(64) NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    target_week INTEGER NOT NULL,
    target_date DATE NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE
);

-- 11. STUDY TASKS TABLE
CREATE TABLE study_tasks (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    study_plan_id VARCHAR(64) NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
    topic_id VARCHAR(64) REFERENCES course_topics(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    scheduled_date DATE NOT NULL,
    estimated_duration_hours DOUBLE PRECISION NOT NULL,
    actual_duration_hours DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    task_type VARCHAR(32) NOT NULL DEFAULT 'TOPIC',
    status VARCHAR(32) NOT NULL DEFAULT 'NOT_STARTED',
    completed_at TIMESTAMPTZ,
    order_index INTEGER NOT NULL DEFAULT 1,
    personal_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 12. STUDY SESSIONS TABLE
CREATE TABLE study_sessions (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    task_id VARCHAR(64) NOT NULL REFERENCES study_tasks(id) ON DELETE CASCADE,
    student_id VARCHAR(64) NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
    duration_minutes INTEGER NOT NULL,
    notes TEXT,
    session_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 13. INVITATIONS TABLE
CREATE TABLE invitations (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 14. PASSWORD RESET TOKENS TABLE
CREATE TABLE password_reset_tokens (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 15. AI USAGE LOGS TABLE
CREATE TABLE ai_usage_logs (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    feature VARCHAR(64) NOT NULL,
    model VARCHAR(64) NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 16. AUDIT LOGS TABLE
CREATE TABLE audit_logs (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    actor_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(128),
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_student_profiles_aptech_id ON student_profiles(aptech_student_id);
CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(course_code);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_study_plans_student ON study_plans(student_id);
CREATE INDEX IF NOT EXISTS idx_study_plans_course ON study_plans(course_id);
CREATE INDEX IF NOT EXISTS idx_study_tasks_plan ON study_tasks(study_plan_id);
CREATE INDEX IF NOT EXISTS idx_study_tasks_date ON study_tasks(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_study_tasks_status ON study_tasks(status);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_reset_tokens(token);

-- ==========================================================
-- SEED DATA
-- ==========================================================

-- 1. Admin Account (Email: admin@aptech.edu | Password: AptechAdmin@2026!)
INSERT INTO users (id, email, password_hash, full_name, role, is_active, is_suspended)
VALUES (
    '745396b9-086b-4d84-975e-d6eb8ff42eec',
    'admin@aptech.edu',
    '$argon2id$v=19$m=65536,t=3,p=4$mrCwy6AJHiJvVEyGrcowzw$wiPhDx2oy5ZffPT/V/Sh1piob5/yig6iXrR5xv3b2+s',
    'System Administrator',
    'ADMIN',
    TRUE,
    FALSE
) ON CONFLICT (email) DO NOTHING;

-- 2. Demo Student Account (Email: student.demo@aptech.edu | Password: StudentDemo@2026!)
INSERT INTO users (id, email, password_hash, full_name, role, is_active, is_suspended)
VALUES (
    'b6916f3c-15c8-42c8-9d31-1bfef7d4030e',
    'student.demo@aptech.edu',
    '$argon2id$v=19$m=65536,t=3,p=4$cDVgLbOJq9lTBH4hrCqeyg$HG4abbifR/FMyVY4qzfjPlGT4y30TeRfT/693lgHIGQ',
    'Aarav Mehta',
    'STUDENT',
    TRUE,
    FALSE
) ON CONFLICT (email) DO NOTHING;

-- 3. Student Profile for Demo Student
INSERT INTO student_profiles (id, user_id, aptech_student_id, phone, current_level, target_career)
VALUES (
    'sp-demo-student-0001',
    'b6916f3c-15c8-42c8-9d31-1bfef7d4030e',
    'APT-MUM-2026-1001',
    '+91 98200 12345',
    'INTERMEDIATE',
    'Full Stack Software Engineer'
) ON CONFLICT (aptech_student_id) DO NOTHING;

-- Course: ACCP-PRO-FSWD
INSERT INTO courses (id, course_code, name, description, official_duration_value, official_duration_unit, total_learning_hours, syllabus_version, category, difficulty_level, prerequisites, is_active)
VALUES (
    'c-accp-pro-fswd-001',
    'ACCP-PRO-FSWD',
    'Aptech Certified Computer Professional (ACCP Pro) - Full Stack Web Development',
    'Comprehensive career track covering frontend engineering, Python FastAPI backend, database management with PostgreSQL, DevOps fundamentals, and modern cloud deployment.',
    6,
    'MONTHS',
    240,
    'v2.4',
    'Software Engineering',
    'INTERMEDIATE',
    '["Basic Computer Knowledge", "Logical Reasoning Fundamentals"]'::jsonb,
    TRUE
) ON CONFLICT (course_code) DO NOTHING;

INSERT INTO course_modules (id, course_id, module_code, title, description, order_index, estimated_hours)
VALUES ('m-accp-pro-fswd-mod-101', 'c-accp-pro-fswd-001', 'MOD-101', 'Modern Frontend Fundamentals & UI Engineering', 'Master HTML5 semantic markup, CSS3 Flexbox/Grid, responsive design patterns, TypeScript fundamentals, and modern UI component styling.', 1, 60)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_topics (id, module_id, topic_code, title, description, estimated_hours, difficulty, order_index, subtopics)
VALUES ('t-accp-pro-fswd-topic-101-1', 'm-accp-pro-fswd-mod-101', 'TOPIC-101-1', 'HTML5 Semantics, Web Accessibility & Modern DOM', 'Semantic HTML tags, accessibility (WCAG 2.1), ARIA roles, and efficient DOM traversal.', 12, 'BEGINNER', 1, '["HTML5 semantic structure", "Forms & custom validation", "ARIA attributes & accessibility standards", "DOM tree and browser rendering engine"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_resources (id, topic_id, title, resource_type, url, description)
VALUES ('r-t-accp-pro-fswd-topic-101-1-1', 't-accp-pro-fswd-topic-101-1', 'MDN Semantic HTML Guide', 'DOCUMENTATION', 'https://developer.mozilla.org/en-US/docs/Glossary/Semantics', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_resources (id, topic_id, title, resource_type, url, description)
VALUES ('r-t-accp-pro-fswd-topic-101-1-2', 't-accp-pro-fswd-topic-101-1', 'Web Accessibility Deep Dive (W3C)', 'PDF', 'https://www.w3.org/WAI/standards-guidelines/wcag/', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_topics (id, module_id, topic_code, title, description, estimated_hours, difficulty, order_index, subtopics)
VALUES ('t-accp-pro-fswd-topic-101-2', 'm-accp-pro-fswd-mod-101', 'TOPIC-101-2', 'Modern CSS3, Flexbox, Grid & Tailwind CSS', 'Modern CSS layouts, media queries, CSS variables, utility-first CSS methodology with Tailwind.', 18, 'BEGINNER', 2, '["Flexbox axes & alignment", "CSS Grid 2D layout systems", "Responsive breakpoints & mobile-first design", "Tailwind CSS architecture & custom themes"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_resources (id, topic_id, title, resource_type, url, description)
VALUES ('r-t-accp-pro-fswd-topic-101-2-1', 't-accp-pro-fswd-topic-101-2', 'CSS Tricks Guide to Flexbox & Grid', 'ARTICLE', 'https://css-tricks.com/snippets/css/a-guide-to-flexbox/', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_resources (id, topic_id, title, resource_type, url, description)
VALUES ('r-t-accp-pro-fswd-topic-101-2-2', 't-accp-pro-fswd-topic-101-2', 'Tailwind CSS Official Docs', 'DOCUMENTATION', 'https://tailwindcss.com/docs', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_topics (id, module_id, topic_code, title, description, estimated_hours, difficulty, order_index, subtopics)
VALUES ('t-accp-pro-fswd-topic-101-3', 'm-accp-pro-fswd-mod-101', 'TOPIC-101-3', 'TypeScript Core & Modern ESNext JavaScript', 'ECMAScript modern features, async/await, closures, TypeScript types, interfaces, generics and compile-time type safety.', 30, 'INTERMEDIATE', 3, '["Promises, Async/Await and Event Loop", "ES6+ Array methods and immutable patterns", "TypeScript primitive & union types", "Interfaces, Type Aliases & Generics"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_resources (id, topic_id, title, resource_type, url, description)
VALUES ('r-t-accp-pro-fswd-topic-101-3-1', 't-accp-pro-fswd-topic-101-3', 'TypeScript Official Handbook', 'DOCUMENTATION', 'https://www.typescriptlang.org/docs/handbook/intro.html', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_modules (id, course_id, module_code, title, description, order_index, estimated_hours)
VALUES ('m-accp-pro-fswd-mod-102', 'c-accp-pro-fswd-001', 'MOD-102', 'React.js Application Architecture & State Management', 'Single-page application development with React, React Router, custom hooks, context, state management, and API integration.', 2, 70)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_topics (id, module_id, topic_code, title, description, estimated_hours, difficulty, order_index, subtopics)
VALUES ('t-accp-pro-fswd-topic-102-1', 'm-accp-pro-fswd-mod-102', 'TOPIC-102-1', 'React Components, Props & Hooks Lifecycle', 'Functional components, useState, useEffect, useRef, useMemo, and useCallback optimizations.', 22, 'INTERMEDIATE', 1, '["Component lifecycle & virtual DOM diffing", "State immutability and batch updates", "Hooks rules and memoization patterns", "Custom hooks for reusable business logic"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_resources (id, topic_id, title, resource_type, url, description)
VALUES ('r-t-accp-pro-fswd-topic-102-1-1', 't-accp-pro-fswd-topic-102-1', 'React.dev Official Documentation', 'DOCUMENTATION', 'https://react.dev/learn', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_topics (id, module_id, topic_code, title, description, estimated_hours, difficulty, order_index, subtopics)
VALUES ('t-accp-pro-fswd-topic-102-2', 'm-accp-pro-fswd-mod-102', 'TOPIC-102-2', 'Form Handling, Zod Validation & Client Routing', 'React Hook Form integration with Zod schemas, React Router v6 nested routes and protected route guards.', 20, 'INTERMEDIATE', 2, '["React Router layouts & loaders", "Protected routes & role guards", "React Hook Form controllers", "Zod type-safe schema validation"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_resources (id, topic_id, title, resource_type, url, description)
VALUES ('r-t-accp-pro-fswd-topic-102-2-1', 't-accp-pro-fswd-topic-102-2', 'React Router 6 Guide', 'DOCUMENTATION', 'https://reactrouter.com/en/main', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_topics (id, module_id, topic_code, title, description, estimated_hours, difficulty, order_index, subtopics)
VALUES ('t-accp-pro-fswd-topic-102-3', 'm-accp-pro-fswd-mod-102', 'TOPIC-102-3', 'API Integration, Recharts & Frontend Analytics', 'Axios interceptors, JWT token refresh flows, error handling UI states, and Recharts interactive visualizations.', 28, 'INTERMEDIATE', 3, '["Axios client instances & error boundary handling", "Optimistic UI updates", "Recharts bar, line, and radar visualizations", "Responsive dashboards"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_resources (id, topic_id, title, resource_type, url, description)
VALUES ('r-t-accp-pro-fswd-topic-102-3-1', 't-accp-pro-fswd-topic-102-3', 'Recharts API Documentation', 'DOCUMENTATION', 'https://recharts.org/en-US/api', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_modules (id, course_id, module_code, title, description, order_index, estimated_hours)
VALUES ('m-accp-pro-fswd-mod-103', 'c-accp-pro-fswd-001', 'MOD-103', 'Backend Engineering with Python FastAPI & PostgreSQL', 'High performance REST APIs with FastAPI, Pydantic v2 data models, SQLAlchemy 2.0 ORM, and Supabase PostgreSQL.', 3, 70)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_topics (id, module_id, topic_code, title, description, estimated_hours, difficulty, order_index, subtopics)
VALUES ('t-accp-pro-fswd-topic-103-1', 'm-accp-pro-fswd-mod-103', 'TOPIC-103-1', 'FastAPI Core, Dependency Injection & Pydantic v2', 'Async endpoints, request validation, Pydantic schemas, dependency injection for DB sessions and auth.', 20, 'INTERMEDIATE', 1, '["FastAPI path & query parameters", "Pydantic v2 BaseModel & field validators", "FastAPI Depends pattern", "OpenAPI / Swagger interactive docs"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_resources (id, topic_id, title, resource_type, url, description)
VALUES ('r-t-accp-pro-fswd-topic-103-1-1', 't-accp-pro-fswd-topic-103-1', 'FastAPI Official Tutorial', 'DOCUMENTATION', 'https://fastapi.tiangolo.com/tutorial/', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_topics (id, module_id, topic_code, title, description, estimated_hours, difficulty, order_index, subtopics)
VALUES ('t-accp-pro-fswd-topic-103-2', 'm-accp-pro-fswd-mod-103', 'TOPIC-103-2', 'Relational Databases, PostgreSQL & SQLAlchemy 2.0', 'PostgreSQL schema design, indexing, relationships, foreign keys, Alembic migrations, and SQLAlchemy async sessions.', 26, 'ADVANCED', 2, '["Normalized schemas (3NF) and foreign key constraints", "B-Tree indexes and query optimization", "SQLAlchemy 2.0 declarative models", "Alembic migration generation & upgrades"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_resources (id, topic_id, title, resource_type, url, description)
VALUES ('r-t-accp-pro-fswd-topic-103-2-1', 't-accp-pro-fswd-topic-103-2', 'SQLAlchemy 2.0 Unified Tutorial', 'DOCUMENTATION', 'https://docs.sqlalchemy.org/en/20/tutorial/', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_topics (id, module_id, topic_code, title, description, estimated_hours, difficulty, order_index, subtopics)
VALUES ('t-accp-pro-fswd-topic-103-3', 'm-accp-pro-fswd-mod-103', 'TOPIC-103-3', 'Security, Argon2 Hashing & JWT Authentication', 'Token-based authentication, Argon2id password hashing, CSRF tokens, HttpOnly secure cookies, and role-based access control.', 24, 'ADVANCED', 3, '["Argon2id cryptographic salt and memory cost", "JWT access and refresh token lifecycle", "HttpOnly cookie headers and SameSite security", "Role & ownership authorization middleware"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_resources (id, topic_id, title, resource_type, url, description)
VALUES ('r-t-accp-pro-fswd-topic-103-3-1', 't-accp-pro-fswd-topic-103-3', 'OWASP Authentication Cheat Sheet', 'DOCUMENTATION', 'https://cheatsheetseries.owasp.org/', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_modules (id, course_id, module_code, title, description, order_index, estimated_hours)
VALUES ('m-accp-pro-fswd-mod-104', 'c-accp-pro-fswd-001', 'MOD-104', 'Full-Stack Integration, DevOps & Capstone Project', 'End-to-end integration of React and FastAPI, Docker containerization, CI/CD pipeline basics, and capstone deployment.', 4, 40)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_topics (id, module_id, topic_code, title, description, estimated_hours, difficulty, order_index, subtopics)
VALUES ('t-accp-pro-fswd-topic-104-1', 'm-accp-pro-fswd-mod-104', 'TOPIC-104-1', 'Docker Containerization & Multi-stage Builds', 'Dockerfiles for Node and Python, docker-compose orchestration, environment secrets, and container networking.', 14, 'INTERMEDIATE', 1, '["Container vs VM fundamentals", "FastAPI uvicorn production Dockerfile", "Vite production Nginx/Caddy container", "Docker-compose environment orchestration"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_resources (id, topic_id, title, resource_type, url, description)
VALUES ('r-t-accp-pro-fswd-topic-104-1-1', 't-accp-pro-fswd-topic-104-1', 'Docker Official Reference', 'DOCUMENTATION', 'https://docs.docker.com/', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_topics (id, module_id, topic_code, title, description, estimated_hours, difficulty, order_index, subtopics)
VALUES ('t-accp-pro-fswd-topic-104-2', 'm-accp-pro-fswd-mod-104', 'TOPIC-104-2', 'Capstone Project: Enterprise SaaS Web Application', 'Architecture, development, testing, and production deployment of a complete enterprise full-stack web application.', 26, 'ADVANCED', 2, '["Full-stack system architecture planning", "End-to-end user workflows & error boundaries", "Integration test suite execution", "Production deployment & monitoring setup"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_resources (id, topic_id, title, resource_type, url, description)
VALUES ('r-t-accp-pro-fswd-topic-104-2-1', 't-accp-pro-fswd-topic-104-2', 'Aptech Capstone Assessment Rubric', 'PDF', 'https://aptech-education.com/curriculum/capstone-rubric', NULL)
ON CONFLICT (id) DO NOTHING;

-- Course: ACCP-AI-DS
INSERT INTO courses (id, course_code, name, description, official_duration_value, official_duration_unit, total_learning_hours, syllabus_version, category, difficulty_level, prerequisites, is_active)
VALUES (
    'c-accp-ai-ds-002',
    'ACCP-AI-DS',
    'Advanced Diploma in Artificial Intelligence & Data Science',
    'Specialized curriculum covering Python for Data Science, statistical analysis, machine learning algorithms, deep learning neural networks, and generative AI systems with LLMs.',
    8,
    'MONTHS',
    320,
    'v1.8',
    'Artificial Intelligence',
    'ADVANCED',
    '["High School Mathematics", "Basic Python Programming"]'::jsonb,
    TRUE
) ON CONFLICT (course_code) DO NOTHING;

INSERT INTO course_modules (id, course_id, module_code, title, description, order_index, estimated_hours)
VALUES ('m-accp-ai-ds-mod-201', 'c-accp-ai-ds-002', 'MOD-201', 'Python for Data Science, NumPy & Pandas', 'Data wrangling, vectorization with NumPy, tabular data manipulation with Pandas, and exploratory data analysis.', 1, 80)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_topics (id, module_id, topic_code, title, description, estimated_hours, difficulty, order_index, subtopics)
VALUES ('t-accp-ai-ds-topic-201-1', 'm-accp-ai-ds-mod-201', 'TOPIC-201-1', 'NumPy Numerical Computing & Matrix Operations', 'Multi-dimensional arrays, broadcasting, vector math, linear algebra basics.', 35, 'BEGINNER', 1, '["Ndarray creation & indexing", "Broadcasting rules", "Matrix multiplication & decompositions"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_topics (id, module_id, topic_code, title, description, estimated_hours, difficulty, order_index, subtopics)
VALUES ('t-accp-ai-ds-topic-201-2', 'm-accp-ai-ds-mod-201', 'TOPIC-201-2', 'Pandas DataFrames & Exploratory Data Analysis', 'Series, DataFrames, data cleaning, aggregation, grouping, and visualization with Seaborn.', 45, 'INTERMEDIATE', 2, '["DataFrame indexing & filtering", "Handling missing values & outliers", "GroupBy aggregations & pivot tables", "Seaborn statistical plots"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_modules (id, course_id, module_code, title, description, order_index, estimated_hours)
VALUES ('m-accp-ai-ds-mod-202', 'c-accp-ai-ds-002', 'MOD-202', 'Machine Learning Algorithms & Scikit-Learn', 'Supervised and unsupervised learning, regression, classification, clustering, model evaluation, and cross-validation.', 2, 100)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_topics (id, module_id, topic_code, title, description, estimated_hours, difficulty, order_index, subtopics)
VALUES ('t-accp-ai-ds-topic-202-1', 'm-accp-ai-ds-mod-202', 'TOPIC-202-1', 'Supervised Learning: Regression & Classification', 'Linear regression, logistic regression, decision trees, random forests, and gradient boosting (XGBoost).', 50, 'INTERMEDIATE', 1, '["Cost functions & gradient descent", "Logistic regression & classification metrics", "Ensemble methods & Random Forest", "XGBoost hyperparameter tuning"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_topics (id, module_id, topic_code, title, description, estimated_hours, difficulty, order_index, subtopics)
VALUES ('t-accp-ai-ds-topic-202-2', 'm-accp-ai-ds-mod-202', 'TOPIC-202-2', 'Unsupervised Learning & Model Evaluation Pipelines', 'K-Means clustering, PCA dimensionality reduction, Scikit-learn Pipelines, and model serialization.', 50, 'ADVANCED', 2, '["K-Means and hierarchical clustering", "Principal Component Analysis (PCA)", "Scikit-Learn ColumnTransformer Pipelines", "Precision, Recall, ROC-AUC evaluation"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_modules (id, course_id, module_code, title, description, order_index, estimated_hours)
VALUES ('m-accp-ai-ds-mod-203', 'c-accp-ai-ds-002', 'MOD-203', 'Deep Learning & Generative AI Systems', 'Neural networks with PyTorch, transformers architecture, prompt engineering, and LLM fine-tuning/RAG pipelines.', 3, 140)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_topics (id, module_id, topic_code, title, description, estimated_hours, difficulty, order_index, subtopics)
VALUES ('t-accp-ai-ds-topic-203-1', 'm-accp-ai-ds-mod-203', 'TOPIC-203-1', 'Neural Networks & PyTorch Fundamentals', 'Perceptrons, backpropagation, activation functions, building neural networks with PyTorch.', 60, 'ADVANCED', 1, '["Tensors & Autograd", "Loss functions & Optimizers", "CNNs for image classification", "Overfitting prevention & dropout"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_topics (id, module_id, topic_code, title, description, estimated_hours, difficulty, order_index, subtopics)
VALUES ('t-accp-ai-ds-topic-203-2', 'm-accp-ai-ds-mod-203', 'TOPIC-203-2', 'Generative AI, Transformers & RAG Applications', 'Self-attention mechanisms, Transformer architectures, embeddings, vector databases, and Retrieval-Augmented Generation.', 80, 'ADVANCED', 2, '["Transformer encoder-decoder mechanics", "Text embeddings & cosine similarity", "Vector stores & hybrid search", "Building a production RAG assistant"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 4. Active Enrollment for Demo Student in ACCP-PRO-FSWD
INSERT INTO enrollments (id, student_id, course_id, status, enrolled_date, valid_until, payment_reference, notes)
VALUES (
    'enr-demo-student-fswd-001',
    'sp-demo-student-0001',
    'c-accp-pro-fswd-001',
    'ACTIVE',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '365 days',
    'PAY-APTECH-CASH-REC-10029',
    'Standard ACCP Pro Full Stack Web Development admission approved by center head.'
) ON CONFLICT (id) DO NOTHING;

-- 5. Active Study Plan for Demo Student
INSERT INTO study_plans (id, enrollment_id, student_id, course_id, title, syllabus_version, start_date, target_completion_date, total_scheduled_hours, is_active, status, generation_source)
VALUES (
    'plan-demo-student-fswd-001',
    'enr-demo-student-fswd-001',
    'sp-demo-student-0001',
    'c-accp-pro-fswd-001',
    'Personalized Master Track: Full Stack Web Development',
    'v2.4',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '180 days',
    240.0,
    TRUE,
    'IN_PROGRESS',
    'HYBRID_AI'
) ON CONFLICT (id) DO NOTHING;

-- 6. Planner Preferences for Demo Student
INSERT INTO planner_preferences (id, study_plan_id, target_completion_date, requested_duration_days, daily_study_hours, available_days, preferred_learning_style, learning_goals, known_topics, weak_topics)
VALUES (
    'pref-demo-student-fswd-001',
    'plan-demo-student-fswd-001',
    CURRENT_DATE + INTERVAL '180 days',
    180,
    2.5,
    '["MON", "TUE", "WED", "THU", "FRI", "SAT"]'::jsonb,
    'PROJECT_BASED',
    '["Master React, TypeScript and FastAPI", "Build real-world enterprise applications", "Clear Aptech certification"]'::jsonb,
    '["Basic HTML and programming concepts"]'::jsonb,
    '[]'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- 7. Sample Initial Daily Study Tasks
INSERT INTO study_tasks (id, study_plan_id, topic_id, title, description, scheduled_date, estimated_duration_hours, actual_duration_hours, task_type, status, order_index)
VALUES
(
    'task-fswd-001',
    'plan-demo-student-fswd-001',
    't-accp-pro-fswd-topic-101-1',
    'HTML5 Semantics, Web Accessibility & Modern DOM',
    'Review semantic HTML tags, accessibility standards (WCAG), and forms validation.',
    CURRENT_DATE,
    2.0,
    0.0,
    'TOPIC',
    'IN_PROGRESS',
    1
),
(
    'task-fswd-002',
    'plan-demo-student-fswd-001',
    't-accp-pro-fswd-topic-101-2',
    'Modern CSS3, Flexbox, Grid & Tailwind CSS',
    'Practice 2D layout building using CSS Grid, Flexbox alignment, and Tailwind utility classes.',
    CURRENT_DATE + INTERVAL '1 day',
    2.5,
    0.0,
    'PRACTICE',
    'NOT_STARTED',
    2
),
(
    'task-fswd-003',
    'plan-demo-student-fswd-001',
    't-accp-pro-fswd-topic-101-3',
    'TypeScript Core & Modern ESNext JavaScript',
    'Async/await, promises, event loop, and TypeScript interfaces & type annotations.',
    CURRENT_DATE + INTERVAL '2 days',
    3.0,
    0.0,
    'TOPIC',
    'NOT_STARTED',
    3
) ON CONFLICT (id) DO NOTHING;

SELECT 'Aptech AI Planner Supabase Schema & Seed Data successfully initialized!' AS result;
