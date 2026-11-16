import json
import uuid
import os
from pathlib import Path

def esc(s):
    if s is None:
        return 'NULL'
    return "'" + str(s).replace("'", "''") + "'"

def esc_json(obj):
    if obj is None:
        return "'[]'::jsonb"
    s = json.dumps(obj)
    return "'" + s.replace("'", "''") + "'::jsonb"

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent
courses_json_path = ROOT_DIR / "course_data" / "sample_courses.json"

with open(courses_json_path, 'r', encoding='utf-8') as f:
    courses = json.load(f)

sql_lines = []
sql_lines.append('''-- ==========================================================
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
''')

course_id_map = {
    'ACCP-PRO-FSWD': 'c-accp-pro-fswd-001',
    'ACCP-AI-DS': 'c-accp-ai-ds-002'
}

for c in courses:
    c_code = c['course_code']
    c_id = course_id_map.get(c_code, str(uuid.uuid4()))
    sql_lines.append(f"""
-- Course: {c_code}
INSERT INTO courses (id, course_code, name, description, official_duration_value, official_duration_unit, total_learning_hours, syllabus_version, category, difficulty_level, prerequisites, is_active)
VALUES (
    {esc(c_id)},
    {esc(c_code)},
    {esc(c['name'])},
    {esc(c.get('description'))},
    {c['official_duration_value']},
    {esc(c['official_duration_unit'])},
    {c['total_learning_hours']},
    {esc(c['syllabus_version'])},
    {esc(c.get('category'))},
    {esc(c.get('difficulty_level', 'INTERMEDIATE'))},
    {esc_json(c.get('prerequisites', []))},
    TRUE
) ON CONFLICT (course_code) DO NOTHING;
""")
    for m in c.get('modules', []):
        m_code = m['module_code']
        m_id = f"m-{c_code.lower()}-{m_code.lower()}"
        sql_lines.append(f"""
INSERT INTO course_modules (id, course_id, module_code, title, description, order_index, estimated_hours)
VALUES ({esc(m_id)}, {esc(c_id)}, {esc(m_code)}, {esc(m['title'])}, {esc(m.get('description'))}, {m['order_index']}, {m['estimated_hours']})
ON CONFLICT (id) DO NOTHING;
""")
        for t in m.get('topics', []):
            t_code = t['topic_code']
            t_id = f"t-{c_code.lower()}-{t_code.lower()}"
            sql_lines.append(f"""
INSERT INTO course_topics (id, module_id, topic_code, title, description, estimated_hours, difficulty, order_index, subtopics)
VALUES ({esc(t_id)}, {esc(m_id)}, {esc(t_code)}, {esc(t['title'])}, {esc(t.get('description'))}, {t['estimated_hours']}, {esc(t.get('difficulty', 'INTERMEDIATE'))}, {t['order_index']}, {esc_json(t.get('subtopics', []))})
ON CONFLICT (id) DO NOTHING;
""")
            for r_idx, r in enumerate(t.get('resources', []), start=1):
                r_id = f"r-{t_id}-{r_idx}"
                sql_lines.append(f"""
INSERT INTO course_resources (id, topic_id, title, resource_type, url, description)
VALUES ({esc(r_id)}, {esc(t_id)}, {esc(r['title'])}, {esc(r['resource_type'])}, {esc(r['url'])}, {esc(r.get('description'))})
ON CONFLICT (id) DO NOTHING;
""")

sql_lines.append('''
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
''')

out_file = ROOT_DIR / "supabase_schema.sql"
with open(out_file, 'w', encoding='utf-8') as f:
    f.write(''.join(sql_lines))

print(f"Generated {out_file} successfully! Total size: {out_file.stat().st_size} bytes")

