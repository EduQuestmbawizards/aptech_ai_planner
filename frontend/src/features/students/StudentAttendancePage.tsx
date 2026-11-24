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
  Download,
  Paperclip,
  FileText,
  LayoutList,
  LayoutGrid,
} from 'lucide-react';

const getDocDownloadUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const rawEnv = (import.meta as any).env?.VITE_API_URL;
  const baseUrl = rawEnv ? rawEnv.replace(/\/+$/, '') : '';
  const token = localStorage.getItem('aptech_token');
  const full = baseUrl ? `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}` : url;
  return token ? `${full}${full.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : full;
};

export const StudentAttendancePage: React.FC = () => {
  const [data, setData] = useState<StudentAttendanceStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

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

      {/* Attendance History Table & Cards View */}
      <div className="bg-white rounded-3xl border border-amber-100 shadow-sm overflow-hidden">
        {/* Table Filter Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">Attendance Log History</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified by teachers and study planner completions.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs mr-1">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center space-x-1 px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  viewMode === 'table'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
                title="Table View"
              >
                <LayoutList className="w-3.5 h-3.5 mr-1" />
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`flex items-center space-x-1 px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  viewMode === 'cards'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
                title="Cards View"
              >
                <LayoutGrid className="w-3.5 h-3.5 mr-1" />
                <span>Cards</span>
              </button>
            </div>

            <span className="text-[11px] font-bold text-slate-500 mr-0.5 flex items-center gap-1">
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

        {/* Loading / Empty States */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 font-bold text-xs">
            Loading your attendance history...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-16 text-center text-slate-400 font-bold text-xs">
            No attendance records found for this filter.
          </div>
        ) : viewMode === 'cards' ? (
          /* Cards View - Executive Detailed View */
          <div className="p-4 sm:p-6 space-y-4 bg-slate-50/40">
            {filteredRecords.map((r) => {
              const isProfile = r.course_id === 'PROFILE_BUILDING';
              return (
                <div
                  key={r.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-amber-300 transition-all space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-slate-900 text-sm flex items-center">
                        <Calendar className="w-4 h-4 mr-1.5 text-slate-400" />
                        {r.attendance_date}
                      </span>
                      {isProfile ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                          Profile Mentorship Track
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          {r.course_code || 'Course'} • {r.course_name}
                        </span>
                      )}
                      <div>{getStatusBadge(r.status)}</div>
                    </div>

                    <div className="flex items-center space-x-3 text-xs text-slate-500 font-medium">
                      {r.duration_minutes && (
                        <span className="flex items-center text-slate-600 font-semibold bg-slate-100 px-2 py-0.5 rounded-md">
                          <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          {r.duration_minutes} mins
                        </span>
                      )}
                      <span>Faculty: <strong className="text-slate-800">{r.marked_by_name || 'Faculty Mentor'}</strong></span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {r.topic || r.task_title || (isProfile ? 'Mentorship Session' : 'Daily Lecture / Batch Session')}
                    </h3>
                  </div>

                  {/* MoM / Discussion Notes */}
                  <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/70 text-xs text-slate-800 space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      What Was Taught / MoM &amp; Discussion Summary:
                    </div>
                    <div className="whitespace-pre-line leading-relaxed text-slate-700">
                      {r.description || r.remarks || 'No notes recorded.'}
                    </div>

                    {r.remarks && r.description && r.remarks !== r.description && (
                      <div className="mt-2 pt-2 border-t border-slate-200/60 text-[11px] text-amber-900 italic bg-amber-50/70 p-2.5 rounded-lg">
                        <span className="font-bold not-italic text-amber-950">Mentor Guidance: </span>
                        {r.remarks}
                      </div>
                    )}

                    {/* Attached Documents Download Box */}
                    {((r.attachments && r.attachments.length > 0) || r.document_url) && (
                      <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                        {(r.attachments && r.attachments.length > 0 ? r.attachments : [{
                          url: r.document_url!,
                          name: r.document_name || 'Session Reference Document',
                          type: r.document_type,
                          size_bytes: r.document_size_bytes
                        }]).map((att, attIdx) => (
                          <div key={attIdx} className="flex flex-wrap items-center justify-between gap-2 bg-blue-50/70 p-3 rounded-lg border border-blue-100">
                            <div className="flex items-center space-x-2 text-xs font-semibold text-blue-900 truncate max-w-md">
                              <Paperclip className="w-4 h-4 text-blue-600 flex-shrink-0" />
                              <span className="truncate">{att.name || 'Session Reference Document'}</span>
                              {att.size_bytes ? (
                                <span className="text-[11px] text-blue-600 font-normal">
                                  ({(att.size_bytes / 1024).toFixed(0)} KB {att.type ? `• ${att.type}` : ''})
                                </span>
                              ) : null}
                            </div>
                            <a
                              href={getDocDownloadUrl(att.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={att.name || 'session-document'}
                              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download Document</span>
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View - Clean, Top-Aligned & Well-Spaced */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 w-32">Date</th>
                  <th className="py-3.5 px-4 w-40">Track / Course</th>
                  <th className="py-3.5 px-4 w-56">Topic / Class</th>
                  <th className="py-3.5 px-4 w-28">Status</th>
                  <th className="py-3.5 px-4 min-w-[380px]">What Was Taught / MoM Description</th>
                  <th className="py-3.5 px-4 w-36">Faculty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredRecords.map((r) => {
                  const isProfile = r.course_id === 'PROFILE_BUILDING';
                  return (
                    <tr
                      key={r.id}
                      className={`transition-colors align-top ${isProfile ? 'hover:bg-amber-50/20' : 'hover:bg-slate-50'}`}
                    >
                      {/* Date */}
                      <td className="py-4 px-4 align-top font-mono font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center space-x-1 text-slate-900">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{r.attendance_date}</span>
                        </div>
                      </td>

                      {/* Track / Course */}
                      <td className="py-4 px-4 align-top">
                        {isProfile ? (
                          <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                            Profile Mentorship
                          </span>
                        ) : (
                          <div>
                            <span className="font-bold text-slate-900 block">{r.course_code || 'Course'}</span>
                            <span className="text-[11px] text-slate-500 block truncate max-w-xs">{r.course_name}</span>
                          </div>
                        )}
                      </td>

                      {/* Topic / Class */}
                      <td className="py-4 px-4 align-top">
                        <div className="space-y-1">
                          <span className="font-bold text-slate-900 leading-snug block">
                            {r.topic || r.task_title || (isProfile ? 'Mentorship Session' : 'Daily Lecture / Batch Session')}
                          </span>
                          {r.duration_minutes && (
                            <span className="inline-flex items-center text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              <Clock className="w-3 h-3 mr-1 text-slate-400" />
                              {r.duration_minutes} mins
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 align-top whitespace-nowrap">
                        {getStatusBadge(r.status)}
                      </td>

                      {/* What Was Taught / MoM Description */}
                      <td className="py-4 px-4 align-top">
                        <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 text-xs text-slate-800 space-y-2 max-w-2xl">
                          <div className="whitespace-pre-line leading-relaxed text-slate-700">
                            {r.description || r.remarks || <span className="text-slate-400 italic">No notes recorded</span>}
                          </div>

                          {r.remarks && r.description && r.remarks !== r.description && (
                            <div className="pt-2 border-t border-slate-200/60 text-[11px] text-amber-900 italic bg-amber-50/60 p-2 rounded-lg">
                              <span className="font-bold not-italic text-amber-950">Mentor Guidance: </span>
                              {r.remarks}
                            </div>
                          )}

                          {/* Attached Documents Download Box */}
                          {((r.attachments && r.attachments.length > 0) || r.document_url) && (
                            <div className="pt-2 mt-1 border-t border-slate-200/60 space-y-1.5">
                              {(r.attachments && r.attachments.length > 0 ? r.attachments : [{
                                url: r.document_url!,
                                name: r.document_name || 'Session Document',
                                type: r.document_type,
                                size_bytes: r.document_size_bytes
                              }]).map((att, attIdx) => (
                                <div key={attIdx} className="flex items-center justify-between gap-2 bg-blue-50/80 p-2 rounded-lg border border-blue-100">
                                  <div className="flex items-center space-x-1.5 text-xs font-semibold text-blue-900 truncate">
                                    <Paperclip className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                                    <span className="truncate">{att.name || 'Session Document'}</span>
                                    {att.size_bytes && (
                                      <span className="text-[10px] text-blue-700 font-normal">
                                        ({(att.size_bytes / 1024).toFixed(0)} KB)
                                      </span>
                                    )}
                                  </div>
                                  <a
                                    href={getDocDownloadUrl(att.url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={att.name || 'session-document'}
                                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[11px] font-bold shadow-2xs transition-colors flex-shrink-0"
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>Download</span>
                                  </a>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Faculty */}
                      <td className="py-4 px-4 align-top whitespace-nowrap text-slate-700 text-xs font-semibold">
                        {r.marked_by_name || 'Faculty Mentor'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

