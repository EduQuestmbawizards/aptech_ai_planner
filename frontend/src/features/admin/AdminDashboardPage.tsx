import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { AdminDashboardMetrics, AdminStudyPlan } from '../../types';
import {
  Users,
  Clock,
  BookOpen,
  CalendarCheck,
  TrendingUp,
  ArrowUpRight,
  CheckSquare,
  Lock,
  Eye,
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [studentPlans, setStudentPlans] = useState<AdminStudyPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const [dashRes, plansRes] = await Promise.all([
          api.get<AdminDashboardMetrics>('/admin/dashboard'),
          api.get<{ items: AdminStudyPlan[] }>('/admin/study-plans?approval_status=ALL'),
        ]);
        setMetrics(dashRes.data);
        setStudentPlans(plansRes.data.items || []);
      } catch (err) {
        console.error('Failed to load admin metrics', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Students',
      value: metrics?.total_students || 0,
      icon: Users,
      color: 'bg-blue-500',
      subtitle: `${metrics?.active_students || 0} currently active`,
    },
    {
      title: 'Pending Plan Reviews',
      value: metrics?.pending_plan_approvals || 0,
      icon: Clock,
      color: 'bg-amber-500',
      subtitle: `${metrics?.pending_approvals || 0} enrollment approvals pending`,
    },
    {
      title: 'Active Study Plans',
      value: metrics?.active_study_plans || 0,
      icon: CalendarCheck,
      color: 'bg-emerald-500',
      subtitle: `${metrics?.completed_plans || 0} completed successfully`,
    },
    {
      title: 'Course Catalogues',
      value: metrics?.total_courses || 0,
      icon: BookOpen,
      color: 'bg-purple-500',
      subtitle: 'Approved curriculum tracks',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Admin Overview</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Centrally manage Aptech admissions, approved course tracks, and student study plan progress.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="/admin/study-plans"
            className="inline-flex items-center px-4 py-2 text-xs font-extrabold rounded-xl text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-sm transition-colors"
          >
            Review Study Plans
            <ArrowUpRight className="ml-1.5 w-3.5 h-3.5" />
          </a>
          <a
            href="/admin/students"
            className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-xl text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition-colors"
          >
            Manage Students
            <ArrowUpRight className="ml-1.5 w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm flex items-start justify-between"
            >
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.title}</p>
                <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{card.value}</h3>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">{card.subtitle}</p>
              </div>
              <div className={`${card.color} text-white p-2.5 rounded-xl shadow-md`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Highlights & Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center">
            <TrendingUp className="w-4 h-4 text-brand-600 mr-2" />
            Curriculum Progress & Completion Health
          </h2>
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <div className="text-3xl font-extrabold text-brand-700">{metrics?.avg_completion_rate || 0}%</div>
              <div className="text-xs text-slate-600 font-medium mt-1">Average Syllabus Task Completion Rate</div>
              <p className="text-[11px] text-slate-400 mt-2 max-w-sm">
                Calculated in real-time from active student study tasks and verified study sessions in PostgreSQL.
              </p>
            </div>
            <div className="w-full sm:w-48 bg-slate-200 h-3 rounded-full overflow-hidden">
              <div
                className="bg-brand-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, metrics?.avg_completion_rate || 0)}%` }}
              ></div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <span className="font-semibold text-slate-800">No Public Registrations Policy:</span>
              <p className="text-slate-500 mt-1">
                Accounts can only be created by an Admin or through verified EduQuest webhook payloads.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <span className="font-semibold text-slate-800">Deterministic Scheduling:</span>
              <p className="text-slate-500 mt-1">
                Strict course hours are preserved without halluncinating extra topics or discarding mandatory syllabus modules.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Operations Panel */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Operational Shortcuts</h2>
          <div className="space-y-2">
            <a
              href="/admin/students"
              className="block p-3 rounded-xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50/50 transition-colors"
            >
              <div className="text-xs font-bold text-slate-800">Add New Student & Invite</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Enroll into approved course & issue activation token</div>
            </a>
            <a
              href="/admin/courses"
              className="block p-3 rounded-xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50/50 transition-colors"
            >
              <div className="text-xs font-bold text-slate-800">Import Course Catalogue</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Upload structured JSON syllabus for new batches</div>
            </a>
            <a
              href="/admin/enrollments"
              className="block p-3 rounded-xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50/50 transition-colors"
            >
              <div className="text-xs font-bold text-slate-800">Verify Pending Enrollments</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Approve offline payments and admission forms</div>
            </a>
          </div>
        </div>
      </div>

      {/* Teacher & Student Verified Syllabus Checklist Tracker */}
      <div className="bg-white rounded-2xl p-6 border border-amber-200/70 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-amber-600" />
              Teacher &amp; Student Topic Completion Checklist (Live Audit)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Track exactly how many topics have been taught &amp; permanently locked by each student for parent/teacher records.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin/study-plans')}
            className="text-xs font-bold text-amber-700 hover:text-amber-800 inline-flex items-center self-start"
          >
            View All Study Plans
            <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Course</th>
                <th className="py-3 px-4">Verified Progress (Locked)</th>
                <th className="py-3 px-4">Last Completed Topic</th>
                <th className="py-3 px-4">Plan Status</th>
                <th className="py-3 px-4 text-right">Checklist</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {studentPlans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No active student study plans yet.
                  </td>
                </tr>
              ) : (
                studentPlans.map((p) => {
                  const pct =
                    p.completion_percent ??
                    (p.total_tasks > 0 ? Math.round((p.completed_tasks / p.total_tasks) * 100) : 0);
                  return (
                    <tr key={p.id} className="hover:bg-amber-50/30">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{p.student_name}</div>
                        <div className="text-[10px] font-mono text-slate-500">{p.aptech_student_id}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                          {p.course_code}
                        </span>
                        <div className="text-[11px] text-slate-600 mt-0.5 line-clamp-1">{p.course_name}</div>
                      </td>
                      <td className="py-3 px-4 min-w-[180px]">
                        <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                          <span className="text-emerald-700 flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            {p.completed_tasks} / {p.total_tasks} Topics
                          </span>
                          <span className="text-slate-800">{pct}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {p.last_completed_task_title ? (
                          <div>
                            <div className="font-semibold text-slate-800 line-clamp-1">{p.last_completed_task_title}</div>
                            {p.last_completed_at && (
                              <div className="text-[10px] text-slate-500 font-medium">
                                {p.last_completed_at.includes('T')
                                  ? p.last_completed_at.split('T')[0]
                                  : p.last_completed_at}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">No topics ticked yet</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {p.approval_status === 'APPROVED' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Approved
                          </span>
                        ) : p.approval_status === 'CHANGES_REQUESTED' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            Changes Requested
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                            Pending Review
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/study-plans?planId=${p.id}`)}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-amber-300"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Open Checklist
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

