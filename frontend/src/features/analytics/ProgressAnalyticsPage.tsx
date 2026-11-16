import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { ProgressOverview } from '../../types';
import {
  LineChart,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  CalendarCheck,
  Flame,
  Layers,
  AlertCircle,
} from 'lucide-react';

export const ProgressAnalyticsPage: React.FC = () => {
  const [overview, setOverview] = useState<ProgressOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        setLoading(true);
        const res = await api.get<ProgressOverview>('/progress/overview');
        setOverview(res.data);
      } catch (err) {
        console.error('Failed to load progress analytics', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProgress();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-2" />
        <h2 className="text-sm font-bold text-slate-800">No Analytics Available</h2>
        <p className="text-xs text-slate-500 mt-1">Please ensure an active study plan is configured.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Progress & Learning Analytics</h1>
        <p className="text-xs text-slate-500 mt-1">
          Real-time metrics derived strictly from your verified study sessions and completed syllabus tasks.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Syllabus Completion</p>
          <h3 className="text-2xl font-extrabold text-brand-700 mt-1">{overview.overall_progress_percent}%</h3>
          <p className="text-[11px] text-slate-400 mt-1">
            {overview.completed_tasks} of {overview.total_tasks} topics completed
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Logged Study Hours</p>
          <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">{overview.actual_study_hours} hrs</h3>
          <p className="text-[11px] text-slate-400 mt-1">Across verified timer sessions</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Learning Streak</p>
          <h3 className="text-2xl font-extrabold text-amber-500 mt-1">{overview.current_streak_days} Days</h3>
          <p className="text-[11px] text-slate-400 mt-1">Consecutive study consistency</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Days to Target Goal</p>
          <h3 className="text-2xl font-extrabold text-purple-600 mt-1">{overview.days_remaining} Days</h3>
          <p className="text-[11px] text-slate-400 mt-1">Target: {overview.target_completion_date}</p>
        </div>
      </div>

      {/* Weekly Hours Breakdown Chart */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Weekly Learning Hours: Planned vs Actual
            </h2>
            <p className="text-xs text-slate-500">Track your daily adherence against scheduled curriculum hours.</p>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={overview.weekly_breakdown} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} unit="h" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Bar dataKey="planned_hours" name="Planned Study Hours" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual_hours" name="Actual Study Hours Logged" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Module-wise Progress Breakdown */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Module-by-Module Curriculum Progress</h2>
        <div className="space-y-4">
          {overview.modules_progress.map((mod) => (
            <div key={mod.module_id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                <div>
                  <span className="font-mono font-bold text-slate-400 mr-2">{mod.module_code}</span>
                  <span className="font-bold text-slate-800">{mod.title}</span>
                </div>
                <div className="flex items-center space-x-3 text-slate-500">
                  <span>
                    {mod.completed_topics} / {mod.total_topics} Topics
                  </span>
                  <span>•</span>
                  <span className="font-bold text-brand-700">{mod.completion_rate}%</span>
                </div>
              </div>

              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-brand-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${mod.completion_rate}%` }}
                ></div>
              </div>

              <div className="flex justify-between text-[11px] text-slate-400">
                <span>{mod.completed_hours} hrs completed</span>
                <span>{mod.total_hours} hrs total accredited</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

