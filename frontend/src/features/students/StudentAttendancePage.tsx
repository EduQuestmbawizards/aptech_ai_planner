import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { StudentAttendanceStats, AttendanceRecord } from '../../types';
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  TrendingUp,
  AlertTriangle,
  Award,
  Filter,
  Calendar,
  Sparkles,
} from 'lucide-react';

export const StudentAttendancePage: React.FC = () => {
  const [data, setData] = useState<StudentAttendanceStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        setLoading(true);
        const res = await api.get<StudentAttendanceStats>('/attendance/my');
        setData(res.data);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load attendance records.');
      } finally {
        setLoading(false);
      }
    };
    fetchAttendance();
  }, []);

  const summary = data?.summary || {
    total_classes: 0,
    present_count: 0,
    absent_count: 0,
    late_count: 0,
    excused_count: 0,
    percentage: 100.0,
  };

  const records = data?.records || [];
  const filteredRecords = records.filter((r) => {
    if (statusFilter === 'ALL') return true;
    return r.status === statusFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Present
          </span>
        );
      case 'ABSENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Absent
          </span>
        );
      case 'LATE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Late (+0.5 credit)
          </span>
        );
      case 'EXCUSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            Excused Leave
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center font-black shadow-md flex-shrink-0">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-amber-300 tracking-tight">
              Class Attendance &amp; Records
            </h1>
            <p className="text-xs text-slate-300 mt-0.5">
              Verified daily attendance record for your enrolled courses &amp; study classes.
            </p>
          </div>
        </div>

        {/* Percentage Score Dial */}
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 self-start sm:self-center">
          <div className="text-right">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Overall Record</div>
            <div
              className={`text-xl font-black ${
                summary.percentage >= 75
                  ? 'text-emerald-400'
                  : summary.percentage >= 60
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {summary.percentage}%
            </div>
          </div>
          {summary.percentage >= 75 ? (
            <Award className="w-7 h-7 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-7 h-7 text-amber-400" />
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Classes
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">{summary.total_classes}</div>
          <span className="text-[10px] text-slate-400 font-medium">Logged sessions</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
            Present
          </span>
          <div className="text-2xl font-black text-emerald-700 mt-1">{summary.present_count}</div>
          <span className="text-[10px] text-emerald-600 font-medium">Full attendance</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-rose-100 shadow-xs">
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">
            Absent
          </span>
          <div className="text-2xl font-black text-rose-700 mt-1">{summary.absent_count}</div>
          <span className="text-[10px] text-rose-500 font-medium">Missed classes</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-xs">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
            Late / Excused
          </span>
          <div className="text-2xl font-black text-amber-700 mt-1">
            {summary.late_count + summary.excused_count}
          </div>
          <span className="text-[10px] text-amber-600 font-medium">
            {summary.late_count} late, {summary.excused_count} excused
          </span>
        </div>
      </div>

      {/* Threshold Warning or Kudos */}
      {summary.total_classes > 0 && summary.percentage < 75 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900 text-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Attendance Notice:</strong> Your current attendance is {summary.percentage}%, which is below the 75% guideline. Please ensure regular attendance to stay eligible for official certificate and optimal syllabus pacing.
          </div>
        </div>
      )}

      {/* Attendance History Table */}
      <div className="bg-white rounded-3xl border border-amber-100 shadow-sm overflow-hidden">
        {/* Table Filter Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">Attendance Log History</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified by teachers and study planner completions.
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Filter:
            </span>
            {(['ALL', 'PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors ${
                  statusFilter === s
                    ? 'bg-slate-900 text-amber-300 border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Track / Course</th>
                <th className="py-3 px-4">Topic / Class</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">What Was Taught / MoM Description</th>
                <th className="py-3 px-4">Faculty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                    Loading your attendance history...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                    No attendance records found for this filter.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const isProfile = r.course_id === 'PROFILE_BUILDING';
                  return (
                    <tr key={r.id} className={`transition-colors ${isProfile ? 'hover:bg-amber-50/30' : 'hover:bg-slate-50'}`}>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                        {r.attendance_date}
                      </td>
                      <td className="py-3 px-4">
                        {isProfile ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            Profile Mentorship
                          </span>
                        ) : (
                          <>
                            <span className="font-bold text-slate-900">{r.course_code || 'Course'}</span>
                            <span className="text-[11px] text-slate-400 block truncate max-w-xs">{r.course_name}</span>
                          </>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800 line-clamp-2">
                          {r.task_title || (isProfile ? 'Mentorship Session' : 'Daily Lecture / Batch Session')}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">{getStatusBadge(r.status)}</td>
                      <td className="py-3 px-4 text-slate-700 max-w-md">
                        {r.remarks ? (
                          <p className="whitespace-pre-line leading-relaxed text-xs">{r.remarks}</p>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-[11px]">
                        {r.marked_by_name || 'Faculty Mentor'}
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

