import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import {
  ProfileRoadmapStudentSummary,
  ProfileRoadmapItem,
  RoadmapItemStatusType,
} from '../../types';
import {
  Compass,
  Upload,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Users,
  Search,
  Check,
  ChevronRight,
  MessageSquareText,
  Sparkles,
  TrendingUp,
  FileText,
  X,
  PlayCircle,
  Clock3,
} from 'lucide-react';

export const AdminProfileRoadmapPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStudentId = searchParams.get('studentId') || '';

  const [students, setStudents] = useState<ProfileRoadmapStudentSummary[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId);
  const [selectedStudent, setSelectedStudent] = useState<ProfileRoadmapStudentSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Complete & MoM modal state
  const [activeItemForMoM, setActiveItemForMoM] = useState<ProfileRoadmapItem | null>(null);
  const [momTopic, setMomTopic] = useState<string>('');
  const [momDate, setMomDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [momDuration, setMomDuration] = useState<number>(45);
  const [momNotes, setMomNotes] = useState<string>('');
  const [momLoading, setMomLoading] = useState<boolean>(false);
  const [momError, setMomError] = useState<string | null>(null);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const res = await api.get('/profile-roadmap/students');
      setStudents(res.data);
      if (res.data.length > 0) {
        const currentTarget = initialStudentId
          ? res.data.find((s: ProfileRoadmapStudentSummary) => s.student_id === initialStudentId)
          : res.data[0];
        if (currentTarget) {
          setSelectedStudentId(currentTarget.student_id);
          setSelectedStudent(currentTarget);
        } else {
          setSelectedStudentId(res.data[0].student_id);
          setSelectedStudent(res.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load profile roadmap students', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentDetails = async (studentId: string) => {
    try {
      const res = await api.get(`/profile-roadmap/students/${studentId}`);
      setSelectedStudent(res.data);
      // Update student in list
      setStudents((prev) =>
        prev.map((s) => (s.student_id === studentId ? res.data : s))
      );
    } catch (err) {
      console.error('Failed to fetch student details', err);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setSearchParams({ studentId });
    loadStudentDetails(studentId);
  };

  const handleOpenMoMModal = (item: ProfileRoadmapItem) => {
    setActiveItemForMoM(item);
    setMomTopic(item.meeting_topic || `Mentorship Session: ${item.period}`);
    setMomDate(item.session_date || new Date().toISOString().split('T')[0]);
    setMomDuration(item.session_duration_minutes || 45);
    setMomNotes(item.meeting_notes || '');
    setMomError(null);
  };

  const handleSaveMoM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItemForMoM || !selectedStudent) return;
    setMomLoading(true);
    setMomError(null);

    try {
      const res = await api.patch(`/profile-roadmap/items/${activeItemForMoM.id}/complete`, {
        meeting_topic: momTopic,
        session_date: momDate,
        session_duration_minutes: Number(momDuration),
        meeting_notes: momNotes,
      });

      // Refresh student data
      await loadStudentDetails(selectedStudent.student_id);
      setActiveItemForMoM(null);
    } catch (err: any) {
      setMomError(err.response?.data?.detail || 'Failed to save session completion & MoM.');
    } finally {
      setMomLoading(false);
    }
  };

  const handleStatusChange = async (itemId: string, newStatus: RoadmapItemStatusType) => {
    if (!selectedStudent) return;
    try {
      await api.patch(`/profile-roadmap/items/${itemId}/status`, { status: newStatus });
      await loadStudentDetails(selectedStudent.student_id);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update status.');
    }
  };

  const handleUploadExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !selectedStudentId) {
      setUploadError('Please select a student and an .xlsx file.');
      return;
    }
    setUploadLoading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append('student_id', selectedStudentId);
    formData.append('replace_existing', 'true');
    formData.append('file', uploadFile);

    try {
      const res = await api.post('/profile-roadmap/upload-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadSuccess(`Roadmap uploaded successfully! ${res.data.items.length} months/milestones generated.`);
      setSelectedStudent(res.data);
      // update in student list
      setStudents((prev) =>
        prev.map((s) => (s.student_id === selectedStudentId ? res.data : s))
      );
      setUploadFile(null);
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadSuccess(null);
      }, 1500);
    } catch (err: any) {
      setUploadError(err.response?.data?.detail || 'Failed to upload and parse Excel file.');
    } finally {
      setUploadLoading(false);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.student_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.aptech_student_id.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.student_email.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
              <Compass className="w-4 h-4" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              Profile Building &amp; Mentorship Tracker
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage student-specific 12-month execution plans, upload Excel roadmaps, and log session Minutes of Meeting (MoM).
          </p>
        </div>

        <button
          onClick={() => {
            setShowUploadModal(true);
            setUploadError(null);
            setUploadSuccess(null);
          }}
          className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-lg text-white bg-amber-600 hover:bg-amber-700 shadow-sm transition-colors"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload / Replace Roadmap (.xlsx)
        </button>
      </div>

      {/* Main Grid: Student List Left, Roadmap Right */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Col: Student Selector */}
        <div className="lg:col-span-1 space-y-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm">
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="Search students..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>

            <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
              {filteredStudents.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No students found
                </div>
              ) : (
                filteredStudents.map((s) => {
                  const isSelected = s.student_id === selectedStudentId;
                  const hasRoadmap = s.items.length > 0;
                  return (
                    <button
                      key={s.student_id}
                      onClick={() => handleSelectStudent(s.student_id)}
                      className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all ${
                        isSelected
                          ? 'bg-amber-50/80 border-amber-300 shadow-sm'
                          : 'bg-white border-slate-200/70 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 truncate">
                          {s.student_name}
                        </span>
                        {hasRoadmap ? (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 rounded">
                            {s.stats.completed}/{s.stats.total_items}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500 rounded">
                            No Plan
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {s.aptech_student_id} • {s.student_email}
                      </div>
                      {hasRoadmap && (
                        <div className="mt-2 w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                          <div
                            className="bg-amber-500 h-1 rounded-full transition-all"
                            style={{ width: `${s.stats.completion_percentage}%` }}
                          />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Student Details & Roadmap Items */}
        <div className="lg:col-span-3 space-y-4">
          {selectedStudent ? (
            <>
              {/* Student Overview Header Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-base font-bold text-slate-900">
                        {selectedStudent.student_name}
                      </h2>
                      <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-800 rounded-full">
                        {selectedStudent.track_type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono">
                      ID: {selectedStudent.aptech_student_id} • {selectedStudent.student_email}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center"
                    >
                      <Upload className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                      {selectedStudent.items.length > 0 ? 'Re-upload Plan' : 'Upload Plan'}
                    </button>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-[11px] font-medium text-slate-500">Total Milestones</div>
                    <div className="text-lg font-black text-slate-900 mt-0.5">
                      {selectedStudent.stats.total_items} Months
                    </div>
                  </div>
                  <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-100">
                    <div className="text-[11px] font-medium text-emerald-700">Completed Sessions</div>
                    <div className="text-lg font-black text-emerald-800 mt-0.5">
                      {selectedStudent.stats.completed}
                    </div>
                  </div>
                  <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-100">
                    <div className="text-[11px] font-medium text-amber-700">Completion Rate</div>
                    <div className="text-lg font-black text-amber-800 mt-0.5">
                      {selectedStudent.stats.completion_percentage}%
                    </div>
                  </div>
                  <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100">
                    <div className="text-[11px] font-medium text-blue-700">Mentorship Hours</div>
                    <div className="text-lg font-black text-blue-800 mt-0.5">
                      {(selectedStudent.stats.total_session_minutes / 60).toFixed(1)} hrs
                    </div>
                  </div>
                </div>
              </div>

              {/* Month-Wise Roadmap List */}
              {selectedStudent.items.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">No Execution Plan Uploaded Yet</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                    Upload an Excel (.xlsx) file with columns: <b>Period / Month</b>, <b>Main actions</b>, and <b>Milestones and outputs</b> to populate this student's 12-month profile building journey.
                  </p>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-lg text-white bg-amber-600 hover:bg-amber-700 shadow-sm"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Excel Plan
                  </button>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Execution Plan &amp; Mentorship Log ({selectedStudent.items.length} Milestones)
                    </h3>
                    <span className="text-[11px] text-slate-500">
                      Live synced with student portal
                    </span>
                  </div>

                  {selectedStudent.items.map((item, idx) => {
                    const isCompleted = item.status === 'COMPLETED';
                    const isInProgress = item.status === 'IN_PROGRESS';

                    return (
                      <div
                        key={item.id}
                        className={`bg-white rounded-xl border p-4.5 transition-all shadow-sm ${
                          isCompleted
                            ? 'border-emerald-200/90 bg-emerald-50/20'
                            : isInProgress
                            ? 'border-blue-300 bg-blue-50/20'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          {/* Period & Number */}
                          <div className="flex items-start space-x-3">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5 ${
                                isCompleted
                                  ? 'bg-emerald-600 text-white'
                                  : isInProgress
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {idx + 1}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <h4 className="text-sm font-bold text-slate-900">
                                  {item.period}
                                </h4>
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                                    isCompleted
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      : isInProgress
                                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                                  }`}
                                >
                                  {item.status.replace('_', ' ')}
                                </span>
                              </div>
                              <p className="text-xs text-slate-700 font-medium mt-1.5 whitespace-pre-line leading-relaxed">
                                {item.main_actions}
                              </p>

                              {item.milestones_outputs && (
                                <div className="mt-2 text-xs bg-slate-50 border border-slate-200/80 rounded-lg p-2 text-slate-600">
                                  <span className="font-semibold text-slate-700">Expected Deliverables: </span>
                                  {item.milestones_outputs}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex sm:flex-col items-end gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleOpenMoMModal(item)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center shadow-sm transition-colors ${
                                isCompleted
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                  : 'bg-amber-600 text-white hover:bg-amber-700'
                              }`}
                            >
                              <MessageSquareText className="w-3.5 h-3.5 mr-1.5" />
                              {isCompleted ? 'Edit MoM / Log' : 'Mark Completed & Log Session'}
                            </button>

                            {/* Status Quick Switch */}
                            <select
                              value={item.status}
                              onChange={(e) =>
                                handleStatusChange(item.id, e.target.value as RoadmapItemStatusType)
                              }
                              className="text-[11px] border border-slate-200 rounded px-2 py-1 text-slate-600 bg-white"
                            >
                              <option value="PENDING">Pending</option>
                              <option value="IN_PROGRESS">In Progress</option>
                              <option value="COMPLETED">Completed</option>
                            </select>
                          </div>
                        </div>

                        {/* Completed Session MoM Banner */}
                        {isCompleted && item.meeting_notes && (
                          <div className="mt-4 pt-3.5 border-t border-emerald-200/60 bg-emerald-50/50 rounded-xl p-3 border">
                            <div className="flex flex-wrap items-center justify-between text-[11px] font-semibold text-emerald-900 mb-1.5">
                              <div className="flex items-center space-x-2">
                                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{item.meeting_topic || 'Mentorship Session Log'}</span>
                              </div>
                              <div className="flex items-center space-x-3 text-slate-600">
                                {item.session_date && (
                                  <span className="flex items-center">
                                    <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                                    {item.session_date}
                                  </span>
                                )}
                                {item.session_duration_minutes && (
                                  <span className="flex items-center">
                                    <Clock className="w-3 h-3 mr-1 text-slate-400" />
                                    {item.session_duration_minutes} mins
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-slate-700 bg-white/90 p-2.5 rounded-lg border border-emerald-100 whitespace-pre-line leading-relaxed">
                              {item.meeting_notes}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-xs text-slate-500">
              Select a student to view or manage their Profile Building Roadmap.
            </div>
          )}
        </div>
      </div>

      {/* Mark Completed & Log MoM Modal */}
      {activeItemForMoM && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Log Mentorship Session &amp; Minutes of Meeting (MoM)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Month: <span className="font-semibold text-amber-700">{activeItemForMoM.period}</span>
                </p>
              </div>
              <button
                onClick={() => setActiveItemForMoM(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {momError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{momError}</span>
              </div>
            )}

            <form onSubmit={handleSaveMoM} className="space-y-4 mt-4">
              {/* Meeting Topic / Agenda */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Meeting Topic / Agenda *
                </label>
                <input
                  type="text"
                  required
                  value={momTopic}
                  onChange={(e) => setMomTopic(e.target.value)}
                  placeholder="e.g. Research Methodology & Doctor Shadowing Outreach"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Date & Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Session Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={momDate}
                    onChange={(e) => setMomDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Duration (Minutes) *
                  </label>
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="number"
                      min={10}
                      max={480}
                      required
                      value={momDuration}
                      onChange={(e) => setMomDuration(Number(e.target.value))}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    {[30, 45, 60].map((m) => (
                      <button
                        type="button"
                        key={m}
                        onClick={() => setMomDuration(m)}
                        className={`px-2 py-1.5 text-[10px] font-bold rounded border ${
                          momDuration === m
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Minutes of Meeting (MoM) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Minutes of Meeting (MoM) &amp; Instructor Discussion Details *
                </label>
                <textarea
                  rows={4}
                  required
                  value={momNotes}
                  onChange={(e) => setMomNotes(e.target.value)}
                  placeholder="e.g. Discussed primary research question. Literature review draft to be submitted by next week. Elderly home visit confirmed."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none leading-relaxed"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  These notes will be immediately visible to the student in their Profile Building portal.
                </p>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveItemForMoM(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={momLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50 flex items-center"
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  {momLoading ? 'Saving...' : 'Save & Mark Completed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Excel Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Upload Profile Execution Plan (.xlsx)
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUploadExcel} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Student *
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  {students.map((s) => (
                    <option key={s.student_id} value={s.student_id}>
                      {s.student_name} ({s.aptech_student_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Excel Spreadsheet (.xlsx) *
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xlsm"
                  required
                  onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
                />
                <div className="mt-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-700">Supported Columns:</span>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li><b>Period / Month</b> (e.g. "November 2026" or serial date)</li>
                    <li><b>Main actions</b> (Detailed plan for the month)</li>
                    <li><b>Milestones and outputs</b> (Deliverables &amp; projects)</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadLoading || !uploadFile}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50 flex items-center"
                >
                  <Upload className="w-4 h-4 mr-1.5" />
                  {uploadLoading ? 'Uploading & Parsing...' : 'Upload & Generate Roadmap'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default AdminProfileRoadmapPage;

