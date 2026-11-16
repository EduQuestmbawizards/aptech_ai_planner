import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useStudyTimer, formatTimerClock } from '../../context/StudyTimerContext';
import { StudyPlan, StudyTask, ProgressOverview, MyEnrolledCourse, StudentAttendanceStats } from '../../types';
import {
  CalendarCheck2,
  CalendarCheck,
  Clock,
  Flame,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Compass,
  Play,
  Pause,
  Timer,
  Save,
  Check,
  Lock,
} from 'lucide-react';

export const StudentDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    activeTask: timerTask,
    elapsedSeconds,
    isRunning,
    saving: timerSaving,
    lastSavedAt,
    startTimer,
    pauseTimer,
    resumeTimer,
    saveTimerSession,
    triggerDataRefresh,
  } = useStudyTimer();

  const [activePlan, setActivePlan] = useState<StudyPlan | null>(null);
  const [todayTasks, setTodayTasks] = useState<StudyTask[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<StudyTask[]>([]);
  const [overview, setOverview] = useState<ProgressOverview | null>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<MyEnrolledCourse[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<StudentAttendanceStats | null>(null);
  const [selectedTimerTaskId, setSelectedTimerTaskId] = useState<string>('');
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      // 1. Fetch enrolled courses and attendance in parallel
      const [enrRes, attRes] = await Promise.all([
        api.get('/enrollments/my'),
        api.get<StudentAttendanceStats>('/attendance/my').catch(() => null),
      ]);
      setEnrolledCourses(enrRes.data.items);
      if (attRes?.data) {
        setAttendanceStats(attRes.data);
      }

      // 2. Fetch active plan
      try {
        const planRes = await api.get('/plans/current');
        setActivePlan(planRes.data);

        // 3. Fetch today's tasks, all pending tasks, and progress overview in parallel
        const [todayRes, allTasksRes, progRes] = await Promise.all([
          api.get('/tasks/today'),
          api.get('/tasks'),
          api.get('/progress/overview'),
        ]);

        const todayList: StudyTask[] = todayRes.data || [];
        const allList: StudyTask[] = allTasksRes.data || [];
        const pendingList = allList.filter((t) => t.status !== 'COMPLETED');

        setTodayTasks(todayList);
        setUpcomingTasks(pendingList);
        setOverview(progRes.data);

        // Pre-select a sensible task for the live timer dropdown
        const defaultTask =
          todayList.find((t) => t.status !== 'COMPLETED') || pendingList[0];
        if (defaultTask) {
          setSelectedTimerTaskId((prev) =>
            prev && pendingList.some((p) => p.id === prev) ? prev : defaultTask.id
          );
        }
      } catch {
        // No active plan yet
        setActivePlan(null);
      }
    } catch (err) {
      console.error('Error fetching student dashboard', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData(true);
  }, [fetchDashboardData]);

  // Refresh KPIs & task lists whenever a timer session saves
  useEffect(() => {
    if (lastSavedAt > 0) {
      fetchDashboardData(false);
    }
  }, [lastSavedAt, fetchDashboardData]);

  const handleQuickComplete = async (task: StudyTask) => {
    if (task.status === 'COMPLETED') {
      return; // Permanently locked once completed
    }
    const ok = window.confirm(
      `Mark "${task.title}" as Completed?\n\nOnce ticked, it locks permanently for Teacher & Parent verification and cannot be undone.`
    );
    if (!ok) return;

    setCompletingTaskId(task.id);
    try {
      await api.patch(`/tasks/${task.id}/status`, { status: 'COMPLETED' });
      triggerDataRefresh();
      await fetchDashboardData(false);
    } catch (err) {
      console.error('Failed to update task status', err);
    } finally {
      setCompletingTaskId(null);
    }
  };

  const handleStartSelectedTimer = () => {
    const taskToStart =
      upcomingTasks.find((t) => t.id === selectedTimerTaskId) ||
      todayTasks.find((t) => t.id === selectedTimerTaskId) ||
      upcomingTasks[0];
    if (taskToStart) {
      startTimer({
        id: taskToStart.id,
        title: taskToStart.title,
        task_type: taskToStart.task_type,
        estimated_duration_hours: taskToStart.estimated_duration_hours,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // If student has no active plan yet, show onboarding invitation
  if (!activePlan) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-brand-900 to-slate-900 rounded-3xl p-8 text-white shadow-xl">
          <span className="text-xs font-mono font-semibold text-brand-300 uppercase tracking-widest bg-brand-800/60 px-3 py-1 rounded-full">
            Aptech Certified Career Track
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold mt-3 tracking-tight">
            Welcome, {user?.full_name}!
          </h1>
          <p className="text-sm text-slate-300 mt-2 max-w-xl">
            You are enrolled in Aptech's official curriculum. Generate your AI-powered personalized study schedule to match your target completion deadline and daily availability.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <button
              onClick={() => navigate('/planner/onboarding')}
              className="inline-flex items-center px-5 py-2.5 rounded-xl text-xs font-bold bg-brand-500 hover:bg-brand-400 text-white shadow-lg transition-all"
            >
              <Compass className="w-4 h-4 mr-2" />
              Launch Planner Onboarding Wizard
            </button>
          </div>
        </div>

        {/* Enrolled Courses Status Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
            Your Approved Course Enrollments
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {enrolledCourses.map((c) => (
              <div key={c.enrollment_id} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[10px] font-mono font-bold text-brand-700 bg-brand-100 px-2 py-0.5 rounded">
                  {c.course_code}
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-2">{c.course_name}</h3>
                <div className="text-xs text-slate-500 mt-1 flex items-center space-x-3">
                  <span>Official: {c.official_duration_value} {c.official_duration_unit}</span>
                  <span>•</span>
                  <span className="font-semibold text-slate-700">{c.total_learning_hours} hrs</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/80 rounded-3xl p-6 md:p-8 text-white shadow-xl border border-amber-500/20 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold">
              {activePlan.course_code}
            </span>
            <span className="text-xs text-amber-100/70 font-medium">Target: {activePlan.target_completion_date}</span>
            {activePlan.approval_status === 'PENDING_APPROVAL' && (
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950">
                Pending Admin Approval
              </span>
            )}
            {activePlan.approval_status === 'APPROVED' && (
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/40">
                Admin Approved ✓
              </span>
            )}
            {activePlan.approval_status === 'CHANGES_REQUESTED' && (
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-500 text-white">
                Changes Requested
              </span>
            )}
          </div>
          <h1 className="text-xl md:text-3xl font-black mt-2 tracking-tight text-white">
            Keep Going, <span className="text-amber-300">{user?.full_name}</span>!
          </h1>
          <p className="text-xs sm:text-sm text-amber-100/80 mt-1 max-w-lg font-normal">
            {activePlan.course_name} — <span className="text-amber-300 font-bold">{overview?.days_remaining || 0} days remaining</span> to your target completion goal.
          </p>
        </div>

        {/* Streak Counter Badge */}
        <div className="flex flex-wrap items-center gap-3">
          {attendanceStats && (
            <div
              onClick={() => navigate('/attendance')}
              className="flex items-center space-x-3 bg-slate-900/80 p-3.5 rounded-2xl border border-amber-500/30 shadow-md cursor-pointer hover:border-amber-400 transition-colors"
              title="Click to view full attendance history"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CalendarCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="text-lg font-black text-emerald-300">
                  {attendanceStats.summary.percentage}%
                </div>
                <div className="text-[10px] text-slate-300 uppercase tracking-wider font-bold">
                  Attendance ({attendanceStats.summary.present_count}/{attendanceStats.summary.total_classes})
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-4 bg-slate-900/80 p-3.5 rounded-2xl border border-amber-500/30 shadow-md">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Flame className="w-5 h-5 animate-pulse text-amber-400" />
            </div>
            <div>
              <div className="text-lg font-black text-amber-300">{overview?.current_streak_days || 0} Days</div>
              <div className="text-[10px] text-amber-200/70 uppercase tracking-wider font-bold">Active Streak</div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-amber-200/50 shadow-sm hover:border-amber-400/60 transition-colors">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Overall Progress</span>
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {overview?.overall_progress_percent || 0}%
          </div>
          <div className="w-full bg-amber-100/60 h-2 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-400 to-amber-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${overview?.overall_progress_percent || 0}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200/50 shadow-sm hover:border-amber-400/60 transition-colors">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Completed Tasks</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {overview?.completed_tasks || 0} / {overview?.total_tasks || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">{overview?.pending_tasks || 0} tasks pending</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200/50 shadow-sm hover:border-amber-400/60 transition-colors">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Actual Study Time</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {overview?.actual_study_hours || 0} hrs
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Logged in verified sessions</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200/50 shadow-sm hover:border-amber-400/60 transition-colors">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Syllabus Target</span>
            <CalendarCheck2 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {overview?.total_syllabus_hours || 0} hrs
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Total curriculum requirement</p>
        </div>
      </div>

      {/* Live Study Timer Focus Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 rounded-2xl p-5 md:p-6 text-white shadow-lg border border-amber-500/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                <Timer className="w-3 h-3 mr-1" />
                Live Study Timer
              </span>
              <span className="text-[11px] text-slate-400">
                Track live study time or mark tasks complete to auto-log hours
              </span>
            </div>

            {timerTask ? (
              <div className="text-sm font-bold text-white flex items-center gap-2 pt-1">
                <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
                <span>Studying: <span className="text-amber-300">{timerTask.title}</span></span>
              </div>
            ) : upcomingTasks.length > 0 ? (
              <div className="pt-1 flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="text-xs text-slate-300 font-medium whitespace-nowrap">Focus Topic:</label>
                <select
                  value={selectedTimerTaskId}
                  onChange={(e) => setSelectedTimerTaskId(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 max-w-md focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  {upcomingTasks.slice(0, 15).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.scheduled_date} — {t.title} ({t.estimated_duration_hours} hrs)
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-xs text-emerald-300 font-semibold pt-1">
                All tasks in your current plan are completed!
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="font-mono text-2xl sm:text-3xl font-black text-amber-300 bg-black/50 px-4 py-2 rounded-2xl border border-amber-500/30 tracking-wider">
              {formatTimerClock(timerTask ? elapsedSeconds : 0)}
            </div>

            {!timerTask ? (
              <button
                type="button"
                onClick={handleStartSelectedTimer}
                disabled={upcomingTasks.length === 0}
                className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-md shadow-amber-500/20 disabled:opacity-40 transition-all"
              >
                <Play className="w-4 h-4 mr-1.5" />
                Start Study Timer
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {isRunning ? (
                  <button
                    type="button"
                    onClick={pauseTimer}
                    disabled={timerSaving}
                    className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-200 border border-slate-700"
                  >
                    <Pause className="w-3.5 h-3.5 mr-1.5" />
                    Pause
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={resumeTimer}
                    disabled={timerSaving}
                    className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950"
                  >
                    <Play className="w-3.5 h-3.5 mr-1.5" />
                    Resume
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => saveTimerSession(false)}
                  disabled={timerSaving || elapsedSeconds < 5}
                  className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 disabled:opacity-40"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  Save Time
                </button>

                <button
                  type="button"
                  onClick={() => saveTimerSession(true)}
                  disabled={timerSaving}
                  className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-40"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Complete Task
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Today's Tasks + Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Tasks Widget */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Today's Study Agenda</h2>
              <p className="text-xs text-slate-500">Tasks allocated for today — complete or start a live timer directly here.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/tasks')}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center"
            >
              View All Tasks
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>

          {todayTasks.length === 0 ? (
            <div className="space-y-4">
              <div className="p-5 text-center bg-amber-50/70 rounded-xl border border-amber-200/70">
                <CalendarCheck2 className="w-7 h-7 text-amber-600 mx-auto mb-1.5" />
                <div className="text-xs font-bold text-slate-900">
                  No Tasks Scheduled Specifically for Today
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Today may be a rest day in your study schedule, or today's tasks are done. You can get ahead on your next topic below or adjust your study days.
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate('/planner')}
                    className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 transition-colors"
                  >
                    Edit Study Days
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/tasks')}
                    className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors"
                  >
                    Open All Tasks
                  </button>
                </div>
              </div>

              {upcomingTasks.length > 0 && (
                <div className="space-y-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Up Next in Your Plan
                  </div>
                  {upcomingTasks.slice(0, 2).map((t) => (
                    <div
                      key={t.id}
                      className="p-4 rounded-xl border border-slate-200/80 bg-white hover:border-amber-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                            {t.scheduled_date}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate">{t.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{t.description}</p>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                          {t.estimated_duration_hours} hrs
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            startTimer({
                              id: t.id,
                              title: t.title,
                              task_type: t.task_type,
                              estimated_duration_hours: t.estimated_duration_hours,
                            })
                          }
                          className="inline-flex items-center px-2.5 py-1.5 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300"
                        >
                          <Play className="w-3 h-3 mr-1" />
                          Timer
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickComplete(t)}
                          disabled={completingTaskId === t.id}
                          className="inline-flex items-center px-2.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          {completingTaskId === t.id ? 'Saving...' : 'Complete'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {todayTasks.map((t) => {
                const isCompleted = t.status === 'COMPLETED';
                return (
                  <div
                    key={t.id}
                    className={`p-4 rounded-xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isCompleted
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : 'border-slate-200/80 bg-white hover:border-amber-300'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-50 text-brand-700 font-semibold">
                          {t.task_type}
                        </span>
                        <span
                          className={`text-xs font-bold ${
                            isCompleted ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {t.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{t.description}</p>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                        {t.estimated_duration_hours} hrs
                      </span>
                      {!isCompleted && (
                        <button
                          type="button"
                          onClick={() =>
                            startTimer({
                              id: t.id,
                              title: t.title,
                              task_type: t.task_type,
                              estimated_duration_hours: t.estimated_duration_hours,
                            })
                          }
                          className="inline-flex items-center px-2.5 py-1.5 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300"
                        >
                          <Play className="w-3 h-3 mr-1" />
                          Timer
                        </button>
                      )}
                      {isCompleted ? (
                        <span
                          className="inline-flex items-center px-2.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200"
                          title="Completed topics are permanently locked"
                        >
                          <Lock className="w-3 h-3 mr-1" />
                          Done (Locked)
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleQuickComplete(t)}
                          disabled={completingTaskId === t.id}
                          className="inline-flex items-center px-2.5 py-1.5 text-xs font-bold rounded-lg shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          {completingTaskId === t.id ? 'Saving...' : 'Complete'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Milestones Timeline */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Upcoming Milestones</h2>
          <div className="space-y-3">
            {activePlan.milestones.slice(0, 4).map((m, idx) => (
              <div key={idx} className="flex items-start space-x-3 text-xs">
                <div className="mt-0.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-brand-600 ring-4 ring-brand-100"></div>
                </div>
                <div>
                  <div className="font-semibold text-slate-800">{m.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Target: {m.target_date}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={() => navigate('/planner')}
              className="w-full py-2 text-center text-xs font-semibold rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
            >
              Inspect Complete Study Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

