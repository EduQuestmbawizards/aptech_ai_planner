import React, { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useStudyTimer, formatTimerClock } from '../context/StudyTimerContext';
import {
  LayoutDashboard,
  ListTodo,
  Calendar,
  CalendarCheck,
  BookOpen,
  LineChart,
  Bot,
  User,
  LogOut,
  GraduationCap,
  Menu,
  X,
  Compass,
  Play,
  Pause,
  CheckCircle2,
  Save,
  RotateCcw,
  Timer,
  Sparkles,
  Target,
  MessageSquare,
} from 'lucide-react';
import { api } from '../services/api';

export const StudentLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const {
    activeTask,
    elapsedSeconds,
    isRunning,
    saving,
    notification,
    clearNotification,
    pauseTimer,
    resumeTimer,
    resetTimer,
    saveTimerSession,
  } = useStudyTimer();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState<number>(0);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await api.get('/chat/unread-count');
        setUnreadMessages(res.data.total_unread);
      } catch {
        // ignore
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 8000);
    return () => clearInterval(interval);
  }, []);

  const isProfileBuildingOnly = user?.track_type === 'PROFILE_BUILDING';

  const allNavItems = [
    { label: 'Overview', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Profile Roadmap', to: '/profile-roadmap', icon: Target },
    { label: 'My Courses', to: '/courses', icon: GraduationCap, courseOnly: true },
    { label: 'Study Planner', to: '/planner', icon: Compass, courseOnly: true },
    { label: 'Daily Tasks', to: '/tasks', icon: ListTodo, courseOnly: true },
    { label: 'Weekly Schedule', to: '/weekly', icon: Calendar, courseOnly: true },
    { label: 'Attendance', to: '/attendance', icon: CalendarCheck },
    { label: 'Messages', to: '/chat', icon: MessageSquare, badge: unreadMessages },
    { label: 'Course Syllabus', to: '/syllabus', icon: BookOpen, courseOnly: true },
    { label: 'Progress Analytics', to: '/analytics', icon: LineChart, courseOnly: true },
    { label: 'AI Learning Assistant', to: '/ai-assistant', icon: Bot, courseOnly: true },
    { label: 'Profile & Settings', to: '/profile', icon: User },
  ];

  const navItems = isProfileBuildingOnly
    ? allNavItems.filter((item) => !item.courseOnly)
    : user?.track_type === 'COURSE'
    ? allNavItems.filter((item) => item.label !== 'Profile Roadmap')
    : allNavItems;

  return (
    <div className="min-h-screen bg-[#fcfaf4] flex flex-col md:flex-row">
      {/* Mobile Topbar */}
      <div className="md:hidden bg-slate-900 text-white p-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="text-xs font-black text-amber-300 tracking-tight uppercase">AI Study Planner</div>
            <div className="text-[10px] text-amber-200/90 font-mono font-medium">{user?.aptech_student_id || 'Student Portal'}</div>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg text-amber-300 hover:text-white hover:bg-slate-800"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-30 md:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 md:static md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Prominent Logo & Brand Header */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/70">
          <div className="flex items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border-2 border-amber-400/30 flex items-center justify-center shadow-lg shadow-amber-500/10">
              <Sparkles className="w-7 h-7 text-amber-400" />
            </div>
          </div>
          <div className="mt-3 text-center">
            <h1 className="text-sm font-black text-amber-300 tracking-wider uppercase">
              AI Study Planner
            </h1>
            <p className="text-[11px] text-amber-200/80 font-medium tracking-wide mt-0.5">
              Smart Courses & Roadmaps
            </p>
          </div>
        </div>

        {/* Student Badge Card */}
        <div className="px-4 py-3.5 border-b border-slate-800/60 bg-slate-850/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center font-black text-sm shadow-md">
              {user?.full_name?.charAt(0) || 'S'}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-white truncate">{user?.full_name}</div>
              <div className="text-[11px] text-amber-300 font-mono font-semibold truncate flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                {user?.aptech_student_id || 'Student'}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-extrabold shadow-md shadow-amber-500/20'
                      : 'text-slate-300 hover:text-amber-200 hover:bg-slate-800/70 font-medium'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-400 text-slate-950">
                    {item.badge}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <button
            onClick={() => logout()}
            className="flex items-center space-x-3 px-3.5 py-2.5 w-full rounded-xl text-sm font-semibold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-8">
        <div className="max-w-6xl mx-auto space-y-4">
          {/* Persistent Live Study Timer Bar (visible across all student pages when active) */}
          {activeTask && (
            <div className="bg-slate-900 text-white rounded-2xl p-3 sm:px-4 sm:py-3 shadow-lg border border-amber-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
              <div className="flex items-center space-x-3 min-w-0">
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isRunning ? 'bg-amber-400 text-slate-950 animate-pulse' : 'bg-slate-800 text-amber-300'}`}>
                  <Timer className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
                    {isRunning ? 'Live Study Timer Running' : 'Study Timer Paused'}
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-white truncate">{activeTask.title}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
                <span className="font-mono text-base sm:text-xl font-black text-amber-300 bg-slate-950/80 px-2.5 sm:px-3 py-1 rounded-xl border border-amber-500/30">
                  {formatTimerClock(elapsedSeconds)}
                </span>

                {isRunning ? (
                  <button
                    type="button"
                    onClick={pauseTimer}
                    disabled={saving}
                    className="inline-flex items-center px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-200 border border-slate-700 transition-colors"
                  >
                    <Pause className="w-3.5 h-3.5 mr-1" />
                    Pause
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={resumeTimer}
                    disabled={saving}
                    className="inline-flex items-center px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 mr-1" />
                    Resume
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => saveTimerSession(false)}
                  disabled={saving || elapsedSeconds < 5}
                  title="Save elapsed minutes to your study hours"
                  className="inline-flex items-center px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 disabled:opacity-40 transition-colors"
                >
                  <Save className="w-3.5 h-3.5 mr-1" />
                  Log Time
                </button>

                <button
                  type="button"
                  onClick={() => saveTimerSession(true)}
                  disabled={saving}
                  className="inline-flex items-center px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-40 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Complete
                </button>

                <button
                  type="button"
                  onClick={resetTimer}
                  disabled={saving}
                  title="Discard timer"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Toast feedback banner */}
          {notification && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs font-semibold shadow-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{notification}</span>
              </div>
              <button type="button" onClick={clearNotification} className="text-emerald-700 hover:text-emerald-950">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <Outlet />
        </div>
      </main>
    </div>
  );
};

