export type Role = 'ADMIN' | 'STUDENT' | 'STAFF';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  is_suspended: boolean;
  aptech_student_id?: string;
  phone?: string;
}

export interface StudentDetail {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  aptech_student_id: string;
  is_active: boolean;
  is_suspended: boolean;
  has_activated: boolean;
  created_at: string;
  enrollments_count: number;
  active_plans_count: number;
  active_plan_id?: string | null;
  access_type?: 'FULL' | 'TRIAL';
  has_trial_enrollment?: boolean;
  track_type?: 'COURSE' | 'PROFILE_BUILDING' | 'BOTH';
}

export type AttendanceStatusType = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface AttendanceRecord {
  id: string;
  student_id: string;
  enrollment_id: string;
  course_id?: string;
  course_name?: string;
  course_code?: string;
  student_name?: string;
  aptech_student_id?: string;
  study_task_id?: string;
  task_title?: string;
  attendance_date: string;
  status: AttendanceStatusType;
  remarks?: string;
  marked_by_name?: string;
  created_at: string;
}

export interface AttendanceSummary {
  total_classes: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  percentage: number;
}

export interface StudentAttendanceStats {
  summary: AttendanceSummary;
  records: AttendanceRecord[];
}

export interface BatchSheetStudent {
  student_id: string;
  enrollment_id: string;
  student_name: string;
  student_email: string;
  aptech_student_id: string;
  access_type: 'FULL' | 'TRIAL';
  current_status: AttendanceStatusType | null;
  remarks?: string | null;
  overall_attendance_pct: number;
  total_attended: number;
  total_classes: number;
}

export interface BatchSheetResponse {
  course_id: string;
  course_name: string;
  course_code: string;
  attendance_date: string;
  total_enrolled: number;
  sheet: BatchSheetStudent[];
}

export interface AdminStudentAttendanceOverviewItem {
  student_id: string;
  enrollment_id: string;
  user_id: string;
  full_name: string;
  email: string;
  aptech_student_id: string;
  phone?: string | null;
  course_id?: string | null;
  course_name?: string;
  course_code?: string;
  access_type: 'FULL' | 'TRIAL';
  current_status: AttendanceStatusType | null;
  remarks?: string | null;
  summary: AttendanceSummary;
}

export interface AdminStudentAttendanceOverviewResponse {
  attendance_date: string;
  total: number;
  items: AdminStudentAttendanceOverviewItem[];
}

export interface CourseResource {
  id?: string;
  title: string;
  resource_type: 'DOCUMENTATION' | 'PDF' | 'VIDEO' | 'EXERCISE';
  url: string;
  description?: string;
}

export interface CourseTopic {
  id: string;
  topic_code: string;
  title: string;
  description?: string;
  estimated_hours: number;
  difficulty: string;
  order_index: number;
  subtopics: string[];
  resources: CourseResource[];
}

export interface CourseModule {
  id: string;
  module_code: string;
  title: string;
  description?: string;
  order_index: number;
  estimated_hours: number;
  topics: CourseTopic[];
}

export interface Course {
  id: string;
  course_code: string;
  name: string;
  description?: string;
  official_duration_value: number;
  official_duration_unit: string;
  total_learning_hours: number;
  syllabus_version: string;
  category?: string;
  difficulty_level: string;
  prerequisites: string[];
  is_active: boolean;
  modules_count?: number;
  topics_count?: number;
  created_at: string;
}

export interface CourseSyllabus {
  course_id: string;
  course_code: string;
  name: string;
  official_duration_value: number;
  official_duration_unit: string;
  total_learning_hours: number;
  syllabus_version: string;
  modules: CourseModule[];
}

export interface Enrollment {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  aptech_student_id: string;
  course_id: string;
  course_name: string;
  course_code: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED';
  enrolled_date: string;
  valid_until?: string;
  payment_reference?: string;
  notes?: string;
  created_at: string;
}

export interface EnrolledCourseModuleSummary {
  module_code: string;
  title: string;
  estimated_hours: number;
  topics_count: number;
}

export type AccessType = 'FULL' | 'TRIAL';

export interface MyEnrolledCourse {
  enrollment_id: string;
  invoice_number?: string;
  course_id: string;
  course_name: string;
  course_code: string;
  description?: string;
  category?: string;
  difficulty_level?: string;
  syllabus_version?: string;
  prerequisites?: string[];
  official_duration_value: number;
  official_duration_unit: string;
  total_learning_hours: number;
  modules_count?: number;
  topics_count?: number;
  modules_summary?: EnrolledCourseModuleSummary[];
  status: string;
  access_type?: AccessType;
  has_active_plan: boolean;
  active_plan_id?: string;
  enrolled_date: string;
  valid_until?: string;
  payment_reference?: string;
  notes?: string;
  student_name?: string;
  student_email?: string;
  aptech_student_id?: string;
  phone?: string;
}

export interface Milestone {
  id?: string;
  title: string;
  target_week: number;
  target_date: string;
  is_completed: boolean;
}

export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'MISSED' | 'RESCHEDULED';
export type TaskType = 'TOPIC' | 'PRACTICE' | 'REVISION' | 'PROJECT' | 'ASSESSMENT';

export interface StudyTask {
  id: string;
  study_plan_id: string;
  topic_id?: string;
  topic_code?: string;
  title: string;
  description?: string;
  scheduled_date: string;
  estimated_duration_hours: number;
  actual_duration_hours: number;
  task_type: TaskType;
  status: TaskStatus;
  completed_at?: string;
  order_index: number;
  personal_notes?: string;
  is_locked?: boolean;
}

export type PlanApprovalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'CHANGES_REQUESTED';

export interface PendingEditData {
  requested_at?: string;
  available_days: string[];
  daily_study_hours: number;
  target_completion_date?: string;
  estimated_finish_date?: string;
  remaining_hours: number;
  remaining_tasks_count: number;
  completed_tasks_count: number;
  edit_status: PlanApprovalStatus;
  admin_feedback?: string | null;
  feasibility?: CapacityFeasibility;
}

export interface StudyPlanSnapshotTask {
  id: string;
  title: string;
  topic_code?: string | null;
  task_type: string;
  scheduled_date?: string | null;
  estimated_duration_hours: number;
  actual_duration_hours: number;
  status: string;
  completed_at?: string | null;
}

export interface StudyPlanVersionSnapshot {
  id: string;
  study_plan_id?: string | null;
  source_type: 'VERSION_SNAPSHOT' | 'ARCHIVED_PLAN';
  version_number: number;
  title: string;
  start_date: string;
  target_completion_date: string;
  daily_study_hours: number;
  available_days: string[];
  total_scheduled_hours: number;
  total_tasks: number;
  completed_tasks: number;
  archived_reason?: string | null;
  created_at: string;
  snapshot_tasks: StudyPlanSnapshotTask[];
  snapshot_milestones: Milestone[];
}

export interface StudyPlan {
  id: string;
  enrollment_id: string;
  student_id: string;
  course_id: string;
  course_name: string;
  course_code: string;
  title: string;
  syllabus_version: string;
  start_date: string;
  target_completion_date: string;
  total_scheduled_hours: number;
  is_active: boolean;
  status: string;
  access_type?: AccessType;
  unlocked_tasks_count?: number;
  approval_status: PlanApprovalStatus;
  admin_review_note?: string;
  reviewed_at?: string;
  daily_study_hours?: number;
  available_days?: string[];
  feasibility?: CapacityFeasibility;
  generation_source: string;
  total_tasks: number;
  completed_tasks: number;
  version_number?: number;
  has_pending_edit?: boolean;
  pending_edit_data?: PendingEditData | null;
  versions_count?: number;
  milestones: Milestone[];
  created_at: string;
  tasks?: StudyTask[];
}

export interface AdminStudyPlan extends StudyPlan {
  student_name: string;
  student_email: string;
  aptech_student_id: string;
  duration_days: number;
  completion_percent?: number;
  last_completed_task_title?: string | null;
  last_completed_at?: string | null;
}

export interface CapacityFeasibility {
  is_feasible: boolean;
  total_syllabus_hours: number;
  total_available_hours: number;
  capacity_ratio: number;
  recommended_min_days: number;
  warnings: string[];
  suggestions: string[];
}

export interface ModuleProgress {
  module_id: string;
  module_code: string;
  title: string;
  total_topics: number;
  completed_topics: number;
  completion_rate: number;
  total_hours: number;
  completed_hours: number;
}

export interface DailyStudyMetric {
  day: string;
  date_str: string;
  planned_hours: number;
  actual_hours: number;
}

export interface ProgressOverview {
  overall_progress_percent: number;
  total_syllabus_hours: number;
  planned_hours: number;
  actual_study_hours: number;
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  missed_tasks: number;
  current_streak_days: number;
  target_completion_date?: string;
  days_remaining: number;
  modules_progress: ModuleProgress[];
  weekly_breakdown: DailyStudyMetric[];
}

export interface AdminDashboardMetrics {
  total_students: number;
  active_students: number;
  pending_approvals: number;
  pending_plan_approvals?: number;
  suspended_accounts: number;
  total_courses: number;
  active_study_plans: number;
  completed_plans: number;
  avg_completion_rate: number;
}

export interface AITutorResponse {
  answer: string;
  key_takeaways: string[];
  suggested_practice_questions: string[];
  referenced_topics: string[];
  model_used: string;
}

export interface AIUsageMetrics {
  total_requests: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost_usd: number;
  by_feature: Record<string, number>;
}

export type RoadmapItemStatusType = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface ProfileRoadmapItem {
  id: string;
  student_id: string;
  period: string;
  order_index: number;
  main_actions: string;
  milestones_outputs?: string | null;
  status: RoadmapItemStatusType;
  meeting_topic?: string | null;
  session_date?: string | null;
  session_duration_minutes?: number | null;
  meeting_notes?: string | null;
  completed_at?: string | null;
  marked_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProfileRoadmapStats {
  total_items: number;
  completed: number;
  in_progress: number;
  pending: number;
  completion_percentage: number;
  total_session_minutes: number;
}

export interface ProfileRoadmapStudentSummary {
  student_id: string;
  student_name: string;
  student_email: string;
  aptech_student_id: string;
  track_type: 'COURSE' | 'PROFILE_BUILDING' | 'BOTH';
  stats: ProfileRoadmapStats;
  items: ProfileRoadmapItem[];
}


