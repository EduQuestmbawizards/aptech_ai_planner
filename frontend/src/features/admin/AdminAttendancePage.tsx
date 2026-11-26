import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import {
  AdminStudentAttendanceOverviewResponse,
  AdminStudentAttendanceOverviewItem,
  AttendanceStatusType,
  StudentAttendanceStats,
} from '../../types';
import {
  CalendarCheck,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Save,
  Users,
  AlertCircle,
  X,
  Award,
  Filter,
  Check,
  HelpCircle,
  Calendar,
} from 'lucide-react';

export const AdminAttendancePage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'UNMARKED'>('ALL');

  const [overviewData, setOverviewData] = useState<AdminStudentAttendanceOverviewItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quick edits map: enrollment_id -> AttendanceStatusType
  const [localStatuses, setLocalStatuses] = useState<Record<string, AttendanceStatusType>>({});
  const [localRemarks, setLocalRemarks] = useState<Record<string, string>>({});

  // Modal: View Student Detailed Attendance History
  const [selectedStudentHistory, setSelectedStudentHistory] = useState<{
    student_id: string;
    student_name: string;
    aptech_student_id: string;
    data: StudentAttendanceStats | null;
    loading: boolean;
  } | null>(null);

  const fetchAttendanceOverview = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const params = new URLSearchParams();
      if (selectedDate) params.append('target_date', selectedDate);
      if (search.trim()) params.append('search', search.trim());

      const res = await api.get<AdminStudentAttendanceOverviewResponse>(
        `/attendance/admin/students-overview?${params.toString()}`
      );
      setOverviewData(res.data.items);

      // Pre-fill local state
      const sMap: Record<string, AttendanceStatusType> = {};
      const rMap: Record<string, string> = {};
      res.data.items.forEach((item) => {
        if (item.current_status) {
          sMap[item.enrollment_id] = item.current_status;
        }
        rMap[item.enrollment_id] = item.remarks || '';
      });
      setLocalStatuses(sMap);
      setLocalRemarks(rMap);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to load attendance records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceOverview();
  }, [selectedDate]);

  // Instant single-student mark Present / Absent
  const handleQuickMarkStudent = async (
    student: AdminStudentAttendanceOverviewItem,
    statusToMark: AttendanceStatusType
  ) => {
    try {
      setSavingId(student.enrollment_id);
      setSaveSuccess(null);
      setErrorMessage(null);

      // Use the student's actual class date when available, otherwise the selectedDate
      const dateToMark = student.class_date || selectedDate;

      await api.post('/attendance/batch', {
        attendance_date: dateToMark,
        course_id: student.course_id,
        records: [
          {
            student_id: student.student_id,
            enrollment_id: student.enrollment_id,
            status: statusToMark,
            study_task_id: student.class_task_id || undefined,
            remarks: localRemarks[student.enrollment_id] || (student.class_title ? `Class on ${dateToMark}: ${student.class_title}` : undefined),
          },
        ],
      });

      // Update local state
      setLocalStatuses((prev) => ({ ...prev, [student.enrollment_id]: statusToMark }));
      setSaveSuccess(`Marked ${student.full_name} as ${statusToMark} for class on ${dateToMark}!`);
      // Background refresh
      fetchAttendanceOverview();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || `Failed to mark ${statusToMark}.`);
    } finally {
      setSavingId(null);
    }
  };

  // Open detailed history modal for a student
  const handleOpenStudentHistory = async (student: AdminStudentAttendanceOverviewItem) => {
    setSelectedStudentHistory({
      student_id: student.student_id,
      student_name: student.full_name,
      aptech_student_id: student.aptech_student_id,
      data: null,
      loading: true,
    });

    try {
      const res = await api.get(`/attendance/students/${student.student_id}`);
      setSelectedStudentHistory({
        student_id: student.student_id,
        student_name: student.full_name,
        aptech_student_id: student.aptech_student_id,
        data: {
          summary: res.data.summary,
          records: res.data.records,
        },
        loading: false,
      });
    } catch (err) {
      setSelectedStudentHistory((prev) => (prev ? { ...prev, loading: false } : null));
    }
  };

  // Filtered by Search & Status
  const filteredStudents = useMemo(() => {
    return overviewData.filter((s) => {
      // Search by name or email or aptech id
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          s.full_name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.aptech_student_id.toLowerCase().includes(q);
        if (!match) return false;
      }

      const current = localStatuses[s.enrollment_id];
      if (statusFilter === 'PRESENT') return current === 'PRESENT';
      if (statusFilter === 'ABSENT') return current === 'ABSENT';
      if (statusFilter === 'UNMARKED') return !current;
      return true;
    });
  }, [overviewData, search, statusFilter, localStatuses]);

  // Overall counters for selected date
  const totalStudents = overviewData.length;
  const presentTodayCount = overviewData.filter(
    (s) => localStatuses[s.enrollment_id] === 'PRESENT'
  ).length;
  const absentTodayCount = overviewData.filter(
    (s) => localStatuses[s.enrollment_id] === 'ABSENT'
  ).length;
  const unmarkedTodayCount = totalStudents - presentTodayCount - absentTodayCount;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center font-black shadow-md flex-shrink-0">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-amber-300 tracking-tight">
                Student Attendance Management
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase font-bold">
                Admin Portal
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Search students by name or email, mark Present / Absent with one click, and view complete attendance history.
            </p>
          </div>
        </div>

        {/* Live Counters */}
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3">
          <div className="text-center px-3 border-r border-white/10">
            <div className="text-lg font-black text-white">{totalStudents}</div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Students</div>
          </div>
          <div className="text-center px-3 border-r border-white/10">
            <div className="text-lg font-black text-emerald-400">{presentTodayCount}</div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Present</div>
          </div>
          <div className="text-center px-3 border-r border-white/10">
            <div className="text-lg font-black text-rose-400">{absentTodayCount}</div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Absent</div>
          </div>
          <div className="text-center px-3">
            <div className="text-lg font-black text-amber-400">{unmarkedTodayCount}</div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Unmarked</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-5 border border-amber-100 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Date Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              Attendance Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Search by Name / Email */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-amber-600" />
              Search Student (Name, Email, Student ID)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by student name, email, or Aptech ID (e.g. Aarav, demo@aptech.edu, APT-)..."
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex items-center gap-1.5 sm:gap-2 pt-2 border-t border-slate-100 overflow-x-auto pb-1">
          <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Filter List:
          </span>
          {(['ALL', 'PRESENT', 'ABSENT', 'UNMARKED'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors shrink-0 whitespace-nowrap ${
                statusFilter === f
                  ? 'bg-slate-900 text-amber-300 border-slate-900'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {f === 'ALL'
                ? `All Students (${totalStudents})`
                : f === 'PRESENT'
                ? `Present (${presentTodayCount})`
                : f === 'ABSENT'
                ? `Absent (${absentTodayCount})`
                : `Unmarked (${unmarkedTodayCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{saveSuccess}</span>
          </div>
          <button onClick={() => setSaveSuccess(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-700 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Student Attendance List Table */}
      <div className="bg-white rounded-3xl border border-amber-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">
              Students Roster ({filteredStudents.length} matching)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click Present or Absent to mark immediately for <strong>{selectedDate}</strong>.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Student</th>
                <th className="py-3.5 px-3">Student ID</th>
                <th className="py-3.5 px-3">Enrolled Course</th>
                <th className="py-3.5 px-3 text-center">Overall Attendance</th>
                <th className="py-3.5 px-4 text-center">Status for {selectedDate}</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                    Loading student records...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                    No students match your search or filter.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st) => {
                  const currentStatus = localStatuses[st.enrollment_id];
                  const isMarkingThis = savingId === st.enrollment_id;
                  const summary = st.summary;

                  return (
                    <tr key={st.enrollment_id} className="hover:bg-amber-50/20 transition-colors">
                      {/* Student info */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-xs">{st.full_name}</div>
                        <div className="text-[11px] text-slate-400">{st.email}</div>
                      </td>

                      {/* Aptech ID & Access */}
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-700">
                        {st.aptech_student_id}
                        {st.access_type === 'TRIAL' && (
                          <span className="block text-[9px] font-sans font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded w-max mt-0.5">
                            Trial 20%
                          </span>
                        )}
                      </td>

                      {/* Course & Class Date */}
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-slate-800">{st.course_code}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                          {st.course_name}
                        </div>
                        {st.class_date && (
                          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 w-max">
                            <Calendar className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>Class Date: <strong>{st.class_date}</strong></span>
                          </div>
                        )}
                        {st.class_title && (
                          <div className="text-[10px] text-slate-500 line-clamp-1 italic mt-0.5 max-w-[180px]">
                            {st.class_title}
                          </div>
                        )}
                      </td>

                      {/* Overall % */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`font-black text-xs px-2.5 py-0.5 rounded-lg inline-block ${
                            summary.percentage >= 75
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : summary.percentage >= 60
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {summary.percentage}%
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {summary.present_count} / {summary.total_classes} attended
                        </div>
                      </td>

                      {/* Present / Absent Action Buttons */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-slate-50 shadow-xs">
                          <button
                            type="button"
                            disabled={isMarkingThis}
                            onClick={() => handleQuickMarkStudent(st, 'PRESENT')}
                            className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all flex items-center gap-1.5 ${
                              currentStatus === 'PRESENT'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-700 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                            title={`Mark Present for class on ${st.class_date || selectedDate}`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Present{st.class_date ? ` (${st.class_date})` : ''}
                          </button>
                          <button
                            type="button"
                            disabled={isMarkingThis}
                            onClick={() => handleQuickMarkStudent(st, 'ABSENT')}
                            className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all flex items-center gap-1.5 ${
                              currentStatus === 'ABSENT'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'text-slate-700 hover:text-rose-700 hover:bg-rose-50'
                            }`}
                            title="Mark Absent"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Absent
                          </button>
                        </div>
                      </td>

                      {/* View Button */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenStudentHistory(st)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-slate-900 text-amber-300 hover:bg-slate-800 shadow-xs transition-colors"
                          title="View complete date-wise attendance records"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View History
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

      {/* Student Attendance Detail Modal */}
      {selectedStudentHistory && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-6 py-5 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-amber-300">
                    {selectedStudentHistory.student_name} — Attendance Record
                  </h3>
                  <p className="text-xs text-slate-300 font-mono mt-0.5">
                    Student ID: {selectedStudentHistory.aptech_student_id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentHistory(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {selectedStudentHistory.loading ? (
                <div className="py-12 text-center text-slate-400 font-bold">
                  Loading attendance records...
                </div>
              ) : !selectedStudentHistory.data ? (
                <div className="py-12 text-center text-slate-400 font-bold">
                  Could not load records.
                </div>
              ) : (
                <>
                  {/* Summary Metric Dial */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Overall Attendance</div>
                      <div
                        className={`text-xl font-black mt-1 ${
                          selectedStudentHistory.data.summary.percentage >= 75
                            ? 'text-emerald-600'
                            : selectedStudentHistory.data.summary.percentage >= 60
                            ? 'text-amber-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {selectedStudentHistory.data.summary.percentage}%
                      </div>
                    </div>

                    <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200">
                      <div className="text-[10px] font-bold text-emerald-800 uppercase">Present Days</div>
                      <div className="text-xl font-black text-emerald-700 mt-1">
                        {selectedStudentHistory.data.summary.present_count}
                      </div>
                    </div>

                    <div className="bg-rose-50 p-3.5 rounded-2xl border border-rose-200">
                      <div className="text-[10px] font-bold text-rose-800 uppercase">Absent Days</div>
                      <div className="text-xl font-black text-rose-700 mt-1">
                        {selectedStudentHistory.data.summary.absent_count}
                      </div>
                    </div>

                    <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200">
                      <div className="text-[10px] font-bold text-amber-800 uppercase">Total Sessions</div>
                      <div className="text-xl font-black text-amber-700 mt-1">
                        {selectedStudentHistory.data.summary.total_classes}
                      </div>
                    </div>
                  </div>

                  {/* History Log Table */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 bg-slate-100/80 font-bold text-xs text-slate-700 border-b border-slate-200">
                      Date-wise Attendance History ({selectedStudentHistory.data.records.length} records)
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold sticky top-0">
                          <tr>
                            <th className="py-2.5 px-4">Date</th>
                            <th className="py-2.5 px-4">Course</th>
                            <th className="py-2.5 px-4">Topic / Session</th>
                            <th className="py-2.5 px-4">Status</th>
                            <th className="py-2.5 px-4">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {selectedStudentHistory.data.records.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-400">
                                No attendance entries recorded yet for this student.
                              </td>
                            </tr>
                          ) : (
                            selectedStudentHistory.data.records.map((r) => (
                              <tr key={r.id} className="hover:bg-slate-50/80">
                                <td className="py-2.5 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                                  {r.attendance_date}
                                </td>
                                <td className="py-2.5 px-4 font-semibold text-slate-700">
                                  {r.course_code || 'Course'}
                                </td>
                                <td className="py-2.5 px-4 text-slate-600">
                                  {r.task_title || <span className="text-slate-400 italic">Batch Session</span>}
                                </td>
                                <td className="py-2.5 px-4 whitespace-nowrap">
                                  {r.status === 'PRESENT' ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      Present
                                    </span>
                                  ) : r.status === 'ABSENT' ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                      <XCircle className="w-3 h-3 text-rose-600" />
                                      Absent
                                    </span>
                                  ) : r.status === 'LATE' ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                      <Clock className="w-3 h-3 text-amber-600" />
                                      Late
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                                      {r.status}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-4 text-slate-500">
                                  {r.remarks || '—'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedStudentHistory(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-200 bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
