import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardList,
  CalendarCheck,
  Sparkles,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  ChevronRight,
  Compass,
  MessageSquare,
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState<number>(0);
  const navigate = useNavigate();

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

  const navItems = [
    { label: 'Overview', to: '/admin', icon: LayoutDashboard },
    { label: 'Admins & Staff', to: '/admin/admins', icon: ShieldCheck },
    { label: 'Students', to: '/admin/students', icon: Users },
    { label: 'Courses', to: '/admin/courses', icon: BookOpen },
    { label: 'Enrollments', to: '/admin/enrollments', icon: ClipboardList },
    { label: 'Study Plans', to: '/admin/study-plans', icon: CalendarCheck },
    { label: 'Profile Building', to: '/admin/profile-roadmap', icon: Compass },
    { label: 'Attendance', to: '/admin/attendance', icon: CalendarCheck },
    { label: 'Messages', to: '/admin/chat', icon: MessageSquare, badge: unreadMessages },
    { label: 'AI Operations & Usage', to: '/admin/ai-usage', icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-[#fcfaf4] flex flex-col md:flex-row">
      {/* Mobile Topbar */}
      <div className="md:hidden bg-slate-900 text-white p-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="text-xs font-black text-amber-300 tracking-tight uppercase">Admin Portal</div>
            <div className="text-[10px] text-amber-200/90 font-mono uppercase tracking-wider font-semibold">Study Planner</div>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg text-amber-300 hover:text-white hover:bg-slate-800"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

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
              Admin Portal
            </h1>
            <p className="text-[11px] text-amber-200/80 font-medium tracking-wide mt-0.5">
              Study Planner Management
            </p>
          </div>
        </div>

        {/* User Card */}
        <div className="px-4 py-3.5 border-b border-slate-800/60 bg-slate-850/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center font-black text-sm shadow-md">
              {user?.full_name?.charAt(0) || 'A'}
            </div>
            <div className="overflow-hidden flex-1">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-white truncate">{user?.full_name}</span>
                {(user?.role === 'SUPER_ADMIN' || user?.email?.toLowerCase() === 'ankitk629990@gmail.com') && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-gradient-to-r from-amber-400 to-amber-300 text-slate-950 tracking-wider">
                    SUPER
                  </span>
                )}
              </div>
              <div className="text-[10px] text-amber-200/80 truncate font-mono mt-0.5">{user?.email}</div>
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
                end={item.to === '/admin'}
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
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

