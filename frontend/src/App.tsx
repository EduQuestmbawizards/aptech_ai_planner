import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StudyTimerProvider } from './context/StudyTimerContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// Layouts
import { AdminLayout } from './layouts/AdminLayout';
import { StudentLayout } from './layouts/StudentLayout';

// Auth Pages
import { LoginPage } from './features/authentication/LoginPage';
import { ActivationPage } from './features/authentication/ActivationPage';
import { ForgotPasswordPage } from './features/authentication/ForgotPasswordPage';
import { ResetPasswordPage } from './features/authentication/ResetPasswordPage';

// Admin Pages
import { AdminDashboardPage } from './features/admin/AdminDashboardPage';
import { AdminStudentsPage } from './features/admin/AdminStudentsPage';
import { AdminCoursesPage } from './features/admin/AdminCoursesPage';
import { AdminEnrollmentsPage } from './features/admin/AdminEnrollmentsPage';
import { AdminStudyPlansPage } from './features/admin/AdminStudyPlansPage';
import { AdminAIUsagePage } from './features/admin/AdminAIUsagePage';
import { AdminAttendancePage } from './features/admin/AdminAttendancePage';

// Student Pages
import { StudentDashboardPage } from './features/students/StudentDashboardPage';
import { MyCoursesPage } from './features/students/MyCoursesPage';
import { MyPlannerPage } from './features/planner/MyPlannerPage';
import { PlannerOnboardingWizard } from './features/planner/PlannerOnboardingWizard';
import { DailyTasksPage } from './features/tasks/DailyTasksPage';
import { WeeklySchedulePage } from './features/tasks/WeeklySchedulePage';
import { CourseSyllabusPage } from './features/courses/CourseSyllabusPage';
import { ProgressAnalyticsPage } from './features/analytics/ProgressAnalyticsPage';
import { AILearningAssistantPage } from './features/ai/AILearningAssistantPage';
import { ProfileSettingsPage } from './features/students/ProfileSettingsPage';
import { StudentAttendancePage } from './features/students/StudentAttendancePage';

const RootRedirect: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <StudyTimerProvider>
        <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/activate" element={<ActivationPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/" element={<RootRedirect />} />

          {/* Admin Protected Routes */}
          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/students" element={<AdminStudentsPage />} />
              <Route path="/admin/courses" element={<AdminCoursesPage />} />
              <Route path="/admin/enrollments" element={<AdminEnrollmentsPage />} />
              <Route path="/admin/study-plans" element={<AdminStudyPlansPage />} />
              <Route path="/admin/attendance" element={<AdminAttendancePage />} />
              <Route path="/admin/ai-usage" element={<AdminAIUsagePage />} />
            </Route>
          </Route>

          {/* Student Protected Routes */}
          <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
            <Route element={<StudentLayout />}>
              <Route path="/dashboard" element={<StudentDashboardPage />} />
              <Route path="/courses" element={<MyCoursesPage />} />
              <Route path="/planner" element={<MyPlannerPage />} />
              <Route path="/planner/onboarding" element={<PlannerOnboardingWizard />} />
              <Route path="/tasks" element={<DailyTasksPage />} />
              <Route path="/weekly" element={<WeeklySchedulePage />} />
              <Route path="/attendance" element={<StudentAttendancePage />} />
              <Route path="/syllabus" element={<CourseSyllabusPage />} />
              <Route path="/analytics" element={<ProgressAnalyticsPage />} />
              <Route path="/ai-assistant" element={<AILearningAssistantPage />} />
              <Route path="/profile" element={<ProfileSettingsPage />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </BrowserRouter>
      </StudyTimerProvider>
    </AuthProvider>
  );
};

export default App;

