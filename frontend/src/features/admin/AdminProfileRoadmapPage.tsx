import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import {
  ProfileRoadmapStudentSummary,
  ProfileRoadmapItem,
  ProfileSessionAttendance,
  SessionAttachmentItem,
  RoadmapItemStatusType,
  AttendanceStatusType,
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
  Edit3,
  BookOpen,
  Target,
  Award,
  CalendarCheck,
  Plus,
  Trash2,
  GraduationCap,
  Download,
  Paperclip,
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

  // Edit Milestone & Deliverables modal state
  const [activeItemForEdit, setActiveItemForEdit] = useState<ProfileRoadmapItem | null>(null);
  const [editPeriod, setEditPeriod] = useState<string>('');
  const [editMainActions, setEditMainActions] = useState<string>('');
  const [editMilestonesOutputs, setEditMilestonesOutputs] = useState<string>('');
  const [editLoading, setEditLoading] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Session Attendance Modal State
  const [showSessionModal, setShowSessionModal] = useState<boolean>(false);
  const [sessionTargetItem, setSessionTargetItem] = useState<ProfileRoadmapItem | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionDate, setSessionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sessionTopic, setSessionTopic] = useState<string>('');
  const [sessionDescription, setSessionDescription] = useState<string>('');
  const [sessionDuration, setSessionDuration] = useState<number>(45);
  const [sessionStatus, setSessionStatus] = useState<AttendanceStatusType>('PRESENT');
  const [sessionRemarks, setSessionRemarks] = useState<string>('');
  const [sessionLoading, setSessionLoading] = useState<boolean>(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Attached Session Reference Documents (Supports multiple files)
  const [sessionAttachments, setSessionAttachments] = useState<SessionAttachmentItem[]>([]);
  const [sessionDocFile, setSessionDocFile] = useState<File | null>(null);
  const [sessionDocUrl, setSessionDocUrl] = useState<string | null>(null);
  const [sessionDocName, setSessionDocName] = useState<string | null>(null);
  const [sessionDocType, setSessionDocType] = useState<string | null>(null);
  const [sessionDocSize, setSessionDocSize] = useState<number | null>(null);
  const [sessionDocUploading, setSessionDocUploading] = useState<boolean>(false);

  // Manual Milestone Modal State
  const [showAddMilestoneModal, setShowAddMilestoneModal] = useState<boolean>(false);
  const [manualPeriod, setManualPeriod] = useState<string>('');
  const [manualActions, setManualActions] = useState<string>('');
  const [manualOutputs, setManualOutputs] = useState<string>('');
  const [manualLoading, setManualLoading] = useState<boolean>(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const getDocDownloadUrl = (url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const rawEnv = (import.meta as any).env?.VITE_API_URL;
    const baseUrl = rawEnv ? rawEnv.replace(/\/+$/, '') : '';
    const token = localStorage.getItem('aptech_token');
    const full = baseUrl ? `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}` : url;
    return token ? `${full}${full.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : full;
  };

  // View All Sessions History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [studentSessionsHistory, setStudentSessionsHistory] = useState<ProfileSessionAttendance[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

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
      if (res.data.sessions) {
        setStudentSessionsHistory(res.data.sessions);
      }
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

  const handleOpenEditModal = (item: ProfileRoadmapItem) => {
    setActiveItemForEdit(item);
    setEditPeriod(item.period || '');
    setEditMainActions(item.main_actions || '');
    setEditMilestonesOutputs(item.milestones_outputs || '');
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItemForEdit || !selectedStudent) return;
    setEditLoading(true);
    setEditError(null);

    try {
      await api.patch(`/profile-roadmap/items/${activeItemForEdit.id}`, {
        period: editPeriod,
        main_actions: editMainActions,
        milestones_outputs: editMilestonesOutputs,
      });

      await loadStudentDetails(selectedStudent.student_id);
      setActiveItemForEdit(null);
    } catch (err: any) {
      setEditError(err.response?.data?.detail || 'Failed to update milestone details.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleOpenAddSession = (item?: ProfileRoadmapItem) => {
    setSessionTargetItem(item || null);
    setEditingSessionId(null);
    setSessionDate(new Date().toISOString().split('T')[0]);
    setSessionTopic(item ? `${item.period} Mentorship Session` : '');
    setSessionDescription('');
    setSessionDuration(45);
    setSessionStatus('PRESENT');
    setSessionRemarks('');
    setSessionAttachments([]);
    setSessionDocFile(null);
    setSessionDocUrl(null);
    setSessionDocName(null);
    setSessionDocType(null);
    setSessionDocSize(null);
    setSessionDocUploading(false);
    setSessionError(null);
    setShowSessionModal(true);
  };

  const handleOpenEditSession = (session: ProfileSessionAttendance, item?: ProfileRoadmapItem) => {
    setSessionTargetItem(item || null);
    setEditingSessionId(session.id);
    setSessionDate(session.session_date);
    setSessionTopic(session.topic);
    setSessionDescription(session.description);
    setSessionDuration(session.duration_minutes);
    setSessionStatus(session.status);
    setSessionRemarks(session.remarks || '');

    // Multi-attachment initialization
    let initialAtts: SessionAttachmentItem[] = [];
    if (session.attachments && session.attachments.length > 0) {
      initialAtts = session.attachments;
    } else if (session.document_url) {
      initialAtts = [{
        url: session.document_url,
        name: session.document_name || 'Attached Document',
        type: session.document_type,
        size_bytes: session.document_size_bytes,
      }];
    }
    setSessionAttachments(initialAtts);
    setSessionDocFile(null);
    setSessionDocUrl(session.document_url || null);
    setSessionDocName(session.document_name || null);
    setSessionDocType(session.document_type || null);
    setSessionDocSize(session.document_size_bytes || null);
    setSessionDocUploading(false);
    setSessionError(null);
    setShowSessionModal(true);
  };

  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    setSessionDocUploading(true);
    setSessionError(null);
    try {
      const newItems: SessionAttachmentItem[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await api.post('/profile-roadmap/sessions/upload-document', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        newItems.push({
          url: uploadRes.data.document_url,
          name: uploadRes.data.document_name,
          type: uploadRes.data.document_type,
          size_bytes: uploadRes.data.document_size_bytes,
        });
      }
      setSessionAttachments((prev) => [...prev, ...newItems]);
    } catch (err: any) {
      setSessionError(err?.response?.data?.detail || 'Failed to upload one or more files.');
    } finally {
      setSessionDocUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setSessionAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleOpenAddManualMilestone = () => {
    setManualPeriod(`Month ${(selectedStudent?.items.length || 0) + 1}`);
    setManualActions('');
    setManualOutputs('');
    setManualError(null);
    setShowAddMilestoneModal(true);
  };

  const handleSaveManualMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    if (!manualPeriod.trim() || !manualActions.trim()) {
      setManualError('Period / Milestone name and Key Actions are required.');
      return;
    }
    setManualLoading(true);
    setManualError(null);
    try {
      await api.post(`/profile-roadmap/students/${selectedStudent.student_id}/items`, {
        period: manualPeriod.trim(),
        main_actions: manualActions.trim(),
        milestones_outputs: manualOutputs.trim() || undefined,
        order_index: (selectedStudent.items.length || 0) + 1,
      });
      await loadStudentDetails(selectedStudent.student_id);
      setShowAddMilestoneModal(false);
    } catch (err: any) {
      setManualError(err?.response?.data?.detail || 'Failed to create milestone.');
    } finally {
      setManualLoading(false);
    }
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setSessionLoading(true);
    setSessionError(null);

    try {
      const finalAttachments = sessionAttachments;
      const firstAtt = finalAttachments[0];

      const payload = {
        roadmap_item_id: sessionTargetItem?.id || undefined,
        session_date: sessionDate,
        topic: sessionTopic,
        description: sessionDescription,
        duration_minutes: Number(sessionDuration),
        status: sessionStatus,
        remarks: sessionRemarks || undefined,
        document_url: firstAtt?.url || null,
        document_name: firstAtt?.name || null,
        document_type: firstAtt?.type || null,
        document_size_bytes: firstAtt?.size_bytes || null,
        attachments: finalAttachments,
      };

      if (editingSessionId) {
        await api.patch(`/profile-roadmap/sessions/${editingSessionId}`, payload);
      } else {
        await api.post(`/profile-roadmap/students/${selectedStudent.student_id}/sessions`, payload);
      }

      await loadStudentDetails(selectedStudent.student_id);
      setShowSessionModal(false);
    } catch (err: any) {
      setSessionError(err.response?.data?.detail || 'Failed to save session attendance.');
    } finally {
      setSessionLoading(false);
      setSessionDocUploading(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm('Are you sure you want to delete this session attendance log?')) return;
    if (!selectedStudent) return;
    try {
      await api.delete(`/profile-roadmap/sessions/${sessionId}`);
      await loadStudentDetails(selectedStudent.student_id);
      // Also update history list if open
      setStudentSessionsHistory((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete session attendance.');
    }
  };

  const handleOpenHistoryModal = async () => {
    if (!selectedStudent) return;
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/profile-roadmap/students/${selectedStudent.student_id}/sessions`);
      setStudentSessionsHistory(res.data);
    } catch (err) {
      console.error('Failed to load session history', err);
    } finally {
      setHistoryLoading(false);
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

                  <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                    <button
                      onClick={() => handleOpenAddSession()}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center shadow-xs transition-colors"
                      title="Log a new mentorship session, discussion notes, and reference files"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Log Session &amp; MoM
                    </button>

                    <button
                      onClick={handleOpenAddManualMilestone}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center shadow-xs transition-colors"
                      title="Add a single milestone/competition manually"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Milestone
                    </button>

                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center shadow-xs"
                      title="Upload or update full 12-month excel roadmap"
                    >
                      <Upload className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                      {selectedStudent.items.length > 0 ? 'Upload Excel' : 'Upload Excel Plan'}
                    </button>

                    <button
                      onClick={handleOpenHistoryModal}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 flex items-center transition-colors"
                      title="View complete date-wise session attendance history modal"
                    >
                      <CalendarCheck className="w-3.5 h-3.5 mr-1 text-slate-500" />
                      History Modal
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
                  <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100">
                    <div className="text-[11px] font-medium text-blue-700">Total Sessions Logged</div>
                    <div className="text-lg font-black text-blue-800 mt-0.5">
                      {selectedStudent.stats.total_sessions_count || selectedStudent.stats.completed} Sessions
                    </div>
                  </div>
                  <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-100">
                    <div className="text-[11px] font-medium text-amber-700">Completion Rate</div>
                    <div className="text-lg font-black text-amber-800 mt-0.5">
                      {selectedStudent.stats.completion_percentage}%
                    </div>
                  </div>
                  <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-100">
                    <div className="text-[11px] font-medium text-emerald-700">Mentorship Hours</div>
                    <div className="text-lg font-black text-emerald-800 mt-0.5">
                      {(selectedStudent.stats.total_session_minutes / 60).toFixed(1)} hrs
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 1: Mentorship Sessions & MoM History */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <CalendarCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Mentorship Sessions &amp; MoM History ({studentSessionsHistory.length})
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Date-wise counseling sessions, discussion topics, and attached reference files.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenAddSession()}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Log New Session</span>
                  </button>
                </div>

                {studentSessionsHistory.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <p className="font-semibold text-slate-700">No sessions logged yet for this student.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      You can log an introductory call, competition proposal discussion, or mentorship session right away.
                    </p>
                    <button
                      onClick={() => handleOpenAddSession()}
                      className="mt-3 inline-flex items-center px-3.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Log First Session Now
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {studentSessionsHistory.map((sess) => {
                      const allAtts = (sess.attachments && sess.attachments.length > 0)
                        ? sess.attachments
                        : sess.document_url
                        ? [{
                            url: sess.document_url,
                            name: sess.document_name || 'Attached Document',
                            type: sess.document_type,
                            size_bytes: sess.document_size_bytes,
                          }]
                        : [];

                      return (
                        <div
                          key={sess.id}
                          className="bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-xl p-4 transition-all"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/60">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-slate-900 flex items-center">
                                <Calendar className="w-3.5 h-3.5 mr-1 text-slate-500" />
                                {sess.session_date}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                  sess.status === 'PRESENT'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : sess.status === 'LATE'
                                    ? 'bg-amber-100 text-amber-800'
                                    : sess.status === 'ABSENT'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {sess.status}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">
                                ⏱️ {sess.duration_minutes} mins
                              </span>
                              {sess.period && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-50 text-amber-800 rounded border border-amber-200">
                                  {sess.period}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-1.5">
                              {sess.marked_by_name && (
                                <span className="text-[11px] text-slate-500 font-medium mr-1.5">
                                  Faculty: <span className="font-semibold text-slate-700">{sess.marked_by_name}</span>
                                </span>
                              )}
                              <button
                                onClick={() => handleOpenEditSession(sess)}
                                className="p-1 text-slate-500 hover:text-blue-600 rounded hover:bg-white transition-colors"
                                title="Edit Session"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteSession(sess.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-white transition-colors"
                                title="Delete Session"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="mt-2.5">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900">{sess.topic}</h4>
                            <p className="text-xs text-slate-700 mt-1 whitespace-pre-line leading-relaxed">
                              {sess.description}
                            </p>
                            {sess.remarks && (
                              <div className="text-[11px] text-slate-600 bg-amber-50/80 p-2 rounded-lg border border-amber-200/60 mt-2 italic">
                                <span className="font-bold not-italic text-amber-900">Faculty Guidance: </span>
                                {sess.remarks}
                              </div>
                            )}

                            {/* Attached Documents */}
                            {allAtts.length > 0 && (
                              <div className="mt-3 pt-2.5 border-t border-slate-200/60 space-y-1.5">
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
                                  <Paperclip className="w-3 h-3 text-blue-600" />
                                  <span>Attached Documents ({allAtts.length}):</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {allAtts.map((att, attIdx) => (
                                    <div
                                      key={attIdx}
                                      className="flex items-center space-x-2 bg-blue-50/80 border border-blue-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-900"
                                    >
                                      <FileText className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                                      <span className="truncate max-w-[200px]">{att.name}</span>
                                      {att.size_bytes ? (
                                        <span className="text-[10px] text-blue-700 font-normal">
                                          ({(att.size_bytes / 1024).toFixed(0)} KB)
                                        </span>
                                      ) : null}
                                      <a
                                        href={getDocDownloadUrl(att.url)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download={att.name}
                                        className="p-1 text-blue-700 hover:text-blue-950 rounded hover:bg-blue-100 transition-colors"
                                        title="Download Document"
                                      >
                                        <Download className="w-3 h-3" />
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 2: Month-Wise Roadmap Milestones List */}
              {selectedStudent.items.length === 0 ? (
                <div className="bg-white p-8 sm:p-10 text-center rounded-2xl border border-dashed border-slate-300 shadow-sm space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
                    <Compass className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">Roadmap Milestones Still In Discussion</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                      You can add milestones individually as competitions are shortlisted, or upload a full 12-month Excel plan whenever finalized.
                    </p>
                  </div>
                  <div className="flex items-center justify-center flex-wrap gap-2.5 pt-2">
                    <button
                      onClick={handleOpenAddManualMilestone}
                      className="inline-flex items-center px-4 py-2 text-xs font-bold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all"
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      Add Milestone Manually
                    </button>
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 shadow-xs transition-all"
                    >
                      <Upload className="w-4 h-4 mr-1.5 text-slate-500" />
                      Upload Full Excel Plan
                    </button>
                  </div>
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
                              
                              {/* 1. Key Actions & Study Scope */}
                              <div className="mt-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200/70">
                                <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                  <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Key Actions &amp; Focus Scope</span>
                                </div>
                                <p className="text-xs text-slate-800 font-medium whitespace-pre-line leading-relaxed">
                                  {item.main_actions}
                                </p>
                              </div>

                              {/* 2. Milestones & Expected Outputs */}
                              <div className="mt-2.5 p-3 bg-amber-50/70 rounded-xl border border-amber-200/80">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center space-x-1.5 text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                                    <Target className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Expected Milestones &amp; Deliverables</span>
                                  </div>
                                </div>
                                {item.milestones_outputs ? (
                                  <p className="text-xs text-amber-950 font-medium whitespace-pre-line leading-relaxed">
                                    {item.milestones_outputs}
                                  </p>
                                ) : (
                                  <div className="flex items-center justify-between text-xs text-amber-800/80 italic">
                                    <span>No specific deliverables defined yet for this month.</span>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditModal(item)}
                                      className="text-amber-700 underline font-semibold hover:text-amber-900 not-italic ml-2"
                                    >
                                      + Add Deliverables
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* 3. Conducted Sessions & Attendance */}
                              <div className="mt-2.5 p-3 bg-blue-50/50 rounded-xl border border-blue-200/70">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-1.5 text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                                    <CalendarCheck className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Sessions &amp; Attendance ({item.sessions?.length || 0})</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAddSession(item)}
                                    className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-white border border-blue-200 rounded shadow-2xs hover:bg-blue-50 transition-colors"
                                  >
                                    <Plus className="w-3 h-3 mr-0.5 text-blue-600" />
                                    Add Session
                                  </button>
                                </div>

                                {item.sessions && item.sessions.length > 0 ? (
                                  <div className="space-y-2">
                                    {item.sessions.map((sess) => (
                                      <div key={sess.id} className="bg-white p-2.5 rounded-lg border border-blue-100/90 shadow-2xs text-xs space-y-1">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center space-x-2">
                                            <span className="font-bold text-slate-900 flex items-center">
                                              <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                                              {sess.session_date}
                                            </span>
                                            <span className={`px-2 py-0.2 rounded-full text-[10px] font-extrabold uppercase ${
                                              sess.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-800' :
                                              sess.status === 'LATE' ? 'bg-amber-100 text-amber-800' :
                                              sess.status === 'ABSENT' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                                            }`}>
                                              {sess.status}
                                            </span>
                                            <span className="text-[11px] text-slate-500 font-medium">
                                              ⏱️ {sess.duration_minutes} mins
                                            </span>
                                          </div>
                                          <div className="flex items-center space-x-1">
                                            <button
                                              type="button"
                                              onClick={() => handleOpenEditSession(sess, item)}
                                              className="p-1 text-slate-400 hover:text-amber-700 rounded hover:bg-slate-50"
                                              title="Edit Session"
                                            >
                                              <Edit3 className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteSession(sess.id)}
                                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-50"
                                              title="Delete Session"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                        <div className="font-semibold text-slate-800">{sess.topic}</div>
                                        <p className="text-slate-600 text-[11px] whitespace-pre-line leading-relaxed">{sess.description}</p>
                                        {sess.remarks && (
                                          <div className="text-[10px] text-slate-400 italic">
                                            Mentor Note: {sess.remarks}
                                          </div>
                                        )}
                                        {sess.document_url && (
                                          <div className="pt-1.5 mt-1 border-t border-slate-100 flex items-center justify-between">
                                            <div className="flex items-center space-x-1 text-[11px] text-blue-900 font-medium truncate max-w-[220px]">
                                              <Paperclip className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                              <span className="truncate">{sess.document_name || 'Attached Document'}</span>
                                              {sess.document_size_bytes && (
                                                <span className="text-[10px] text-slate-400">
                                                  ({(sess.document_size_bytes / 1024).toFixed(0)} KB)
                                                </span>
                                              )}
                                            </div>
                                            <a
                                              href={getDocDownloadUrl(sess.document_url)}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              download={sess.document_name || 'document'}
                                              className="inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-bold border border-blue-200 transition-colors"
                                            >
                                              <Download className="w-2.5 h-2.5" />
                                              <span>Download</span>
                                            </a>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-xs text-blue-700/80 italic flex items-center justify-between">
                                    <span>No sessions logged yet for {item.period}.</span>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenAddSession(item)}
                                      className="text-blue-700 underline font-semibold hover:text-blue-900 not-italic ml-2"
                                    >
                                      + Log 1st Session
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex sm:flex-col items-end gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleOpenAddSession(item)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 shadow-2xs transition-colors"
                            >
                              <CalendarCheck className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                              Log Session
                            </button>

                            <button
                              onClick={() => handleOpenEditModal(item)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
                              title="Edit milestone focus area, actions and deliverables"
                            >
                              <Edit3 className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                              Edit Actions &amp; Outputs
                            </button>

                            <button
                              onClick={() => handleOpenMoMModal(item)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center shadow-sm transition-colors ${
                                isCompleted
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                  : 'bg-amber-600 text-white hover:bg-amber-700'
                              }`}
                            >
                              <MessageSquareText className="w-3.5 h-3.5 mr-1.5" />
                              {isCompleted ? 'Edit MoM / Log' : 'Mark Completed'}
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

      {/* Edit Milestone & Deliverables Modal */}
      {activeItemForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Edit Milestone Actions &amp; Deliverables
                  </h3>
                  <p className="text-xs text-slate-500">
                    Configure study actions and tangible outputs for this stage
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveItemForEdit(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 mt-4">
              {/* Period / Month */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Period / Month *
                </label>
                <input
                  type="text"
                  required
                  value={editPeriod}
                  onChange={(e) => setEditPeriod(e.target.value)}
                  placeholder="e.g. November 2026"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Main Actions */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                  <span>Key Actions &amp; Focus Scope *</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={editMainActions}
                  onChange={(e) => setEditMainActions(e.target.value)}
                  placeholder="Detail what the student needs to learn, read, organize, or conduct..."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none leading-relaxed"
                />
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Guides the student on what specific syllabus, research, or shadowing actions to execute.
                </p>
              </div>

              {/* Milestones & Outputs */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1.5">
                  <Target className="w-3.5 h-3.5 text-amber-600" />
                  <span>Expected Milestones &amp; Deliverables</span>
                </label>
                <textarea
                  rows={4}
                  value={editMilestonesOutputs}
                  onChange={(e) => setEditMilestonesOutputs(e.target.value)}
                  placeholder="e.g. &#10;• Literature review draft (min 15 citations) completed.&#10;• Completed first 10 hours at elderly care center (Project CARE).&#10;• Clinical shadowing clearance received from host physician."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none leading-relaxed"
                />
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Tangible evidence, competition entries, documents, or logs the mentor will evaluate.
                </p>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveItemForEdit(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50 flex items-center"
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  {editLoading ? 'Saving...' : 'Save Milestone Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* Log / Edit Session Attendance Modal */}
      {showSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingSessionId ? 'Edit Session Attendance' : 'Log Mentorship Session & Attendance'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Student: <span className="font-semibold text-slate-800">{selectedStudent?.student_name}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSessionModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {sessionError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{sessionError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSession} className="space-y-4 mt-4">
              {/* Linked Roadmap Month */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Roadmap Month / Milestone Stage
                </label>
                <select
                  value={sessionTargetItem?.id || ''}
                  onChange={(e) => {
                    const item = selectedStudent?.items.find((i) => i.id === e.target.value);
                    setSessionTargetItem(item || null);
                  }}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">General Mentorship Session (Not linked to specific month)</option>
                  {selectedStudent?.items.map((i) => (
                    <option key={i.id} value={i.id}>
                      Month {i.order_index}: {i.period}
                    </option>
                  ))}
                </select>
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
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Duration (Minutes) *
                  </label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      min={10}
                      max={480}
                      required
                      value={sessionDuration}
                      onChange={(e) => setSessionDuration(Number(e.target.value))}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    {[30, 45, 60].map((m) => (
                      <button
                        type="button"
                        key={m}
                        onClick={() => setSessionDuration(m)}
                        className={`px-1.5 py-1.5 text-[10px] font-bold rounded border ${
                          sessionDuration === m
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Attendance Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Attendance Status *
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'] as const).map((st) => (
                    <button
                      type="button"
                      key={st}
                      onClick={() => setSessionStatus(st)}
                      className={`py-1.5 px-2 text-xs font-bold rounded-lg border text-center transition-all ${
                        sessionStatus === st
                          ? st === 'PRESENT'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : st === 'LATE'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : st === 'ABSENT'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                            : 'bg-slate-800 text-white border-slate-800 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Topic Taught */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Session Topic / Concept Taught *
                </label>
                <input
                  type="text"
                  required
                  value={sessionTopic}
                  onChange={(e) => setSessionTopic(e.target.value)}
                  placeholder="e.g. Research Methodology, Doctor Shadowing Prep, Diamond Pitch"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Description / What was taught */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  What Was Taught / MoM &amp; Discussion Notes *
                </label>
                <textarea
                  rows={4}
                  required
                  value={sessionDescription}
                  onChange={(e) => setSessionDescription(e.target.value)}
                  placeholder="e.g. Discussed primary research question. Literature review draft to be submitted by next week. Elderly home visit schedule confirmed."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  These details will be immediately visible to the student in their transparent attendance log.
                </p>
              </div>

              {/* Optional Remarks */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Faculty Guidance / Private Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={sessionRemarks}
                  onChange={(e) => setSessionRemarks(e.target.value)}
                  placeholder="e.g. Student showed great curiosity; submitted case reflection on time"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Session Reference Documents Upload (Supports Multiple Files) */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                    <span>Session Reference Documents ({sessionAttachments.length})</span>
                  </label>
                  <span className="text-[10px] text-slate-400">PDF, Word, Excel, PPT, Images (Max 25MB each)</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Upload syllabus files, research papers, discussion drafts, or MoM documents. You can attach multiple files to a single session.
                </p>

                {/* Uploaded attachments list */}
                {sessionAttachments.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {sessionAttachments.map((att, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center space-x-2 truncate">
                          <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <div className="truncate">
                            <p className="text-xs font-bold text-blue-900 truncate">{att.name}</p>
                            {att.size_bytes ? (
                              <p className="text-[10px] text-blue-700">{(att.size_bytes / 1024).toFixed(0)} KB {att.type ? `• ${att.type}` : ''}</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <a
                            href={getDocDownloadUrl(att.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={att.name}
                            className="p-1 text-blue-700 hover:text-blue-950 rounded hover:bg-blue-100 transition-colors"
                            title="Download / View"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                            title="Remove Document"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-1">
                  <label className="inline-flex items-center space-x-2 px-3 py-1.5 bg-white border border-slate-300 hover:border-blue-500 rounded-lg text-xs font-semibold text-slate-700 hover:text-blue-600 cursor-pointer shadow-2xs transition-all">
                    <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                    <span>{sessionDocUploading ? 'Uploading Attachment(s)...' : '+ Attach Document(s)'}</span>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp"
                      onChange={handleUploadFiles}
                      disabled={sessionDocUploading}
                    />
                  </label>
                  {sessionDocUploading && (
                    <span className="text-[11px] text-blue-600 font-medium ml-2 animate-pulse">
                      Uploading to secure storage...
                    </span>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSessionModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sessionLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50 flex items-center"
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  {sessionLoading ? 'Saving...' : editingSessionId ? 'Update Session' : 'Save Session & Attendance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View All Sessions & Attendance History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-100 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Complete Attendance &amp; Mentorship Session History
                  </h3>
                  <p className="text-xs text-slate-500">
                    Student: <span className="font-semibold text-slate-800">{selectedStudent?.student_name}</span> ({selectedStudent?.aptech_student_id})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick KPI stats in History Modal */}
            <div className="grid grid-cols-3 gap-3 my-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <div className="text-[11px] font-bold text-slate-500 uppercase">Total Sessions</div>
                <div className="text-xl font-black text-slate-900 mt-0.5">{studentSessionsHistory.length}</div>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                <div className="text-[11px] font-bold text-emerald-700 uppercase">Present Rate</div>
                <div className="text-xl font-black text-emerald-800 mt-0.5">
                  {studentSessionsHistory.length > 0
                    ? Math.round(
                        (studentSessionsHistory.filter((s) => s.status === 'PRESENT').length /
                          studentSessionsHistory.length) *
                          100
                      )
                    : 100}
                  %
                </div>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-center">
                <div className="text-[11px] font-bold text-blue-700 uppercase">Total Hours Logged</div>
                <div className="text-xl font-black text-blue-800 mt-0.5">
                  {(
                    studentSessionsHistory.reduce((acc, s) => acc + s.duration_minutes, 0) / 60
                  ).toFixed(1)}{' '}
                  hrs
                </div>
              </div>
            </div>

            {/* History Table / Timeline */}
            {historyLoading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading complete session history...</div>
            ) : studentSessionsHistory.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No mentorship sessions recorded yet for this student. Click "Log Session &amp; Attendance" to record the first class.
              </div>
            ) : (
              <div className="space-y-3 mt-2">
                {studentSessionsHistory.map((s) => (
                  <div key={s.id} className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 text-xs space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-200/60">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-slate-900 flex items-center">
                          <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          {s.session_date}
                        </span>
                        {s.period && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">
                            {s.period}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            s.status === 'PRESENT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : s.status === 'LATE'
                              ? 'bg-amber-100 text-amber-800'
                              : s.status === 'ABSENT'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-slate-500 text-[11px]">
                        <span>⏱️ {s.duration_minutes} mins</span>
                        <span>• Faculty: {s.marked_by_name || 'Admin'}</span>
                        <div className="flex items-center space-x-1 ml-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowHistoryModal(false);
                              handleOpenEditSession(s);
                            }}
                            className="p-1 text-slate-400 hover:text-amber-700 rounded hover:bg-slate-200"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSession(s.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-200"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="font-bold text-slate-900">{s.topic}</span>
                    </div>

                    <p className="text-slate-700 text-xs whitespace-pre-line leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200/60">
                      {s.description}
                    </p>

                    {s.remarks && (
                      <div className="text-[11px] text-slate-500 italic">
                        <span className="font-semibold text-slate-600 not-italic">Faculty Guidance: </span>
                        {s.remarks}
                      </div>
                    )}

                    {s.document_url && (
                      <div className="pt-2 mt-1 border-t border-slate-200/60 flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 text-xs text-blue-900 font-semibold truncate max-w-[280px]">
                          <Paperclip className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                          <span className="truncate">{s.document_name || 'Session Document'}</span>
                          {s.document_size_bytes && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({(s.document_size_bytes / 1024).toFixed(0)} KB)
                            </span>
                          )}
                        </div>
                        <a
                          href={getDocDownloadUrl(s.document_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={s.document_name || 'document'}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[11px] font-bold shadow-2xs transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
              >
                Close History
              </button>
            </div>
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

      {/* Manual Milestone Creation Modal */}
      {showAddMilestoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add Milestone / Competition Manually</h3>
                  <p className="text-xs text-slate-500">Student: {selectedStudent?.student_name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddMilestoneModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {manualError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{manualError}</span>
              </div>
            )}

            <form onSubmit={handleSaveManualMilestone} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Milestone Name / Period *
                </label>
                <input
                  type="text"
                  required
                  value={manualPeriod}
                  onChange={(e) => setManualPeriod(e.target.value)}
                  placeholder="e.g. November 2026 or Milestone 1: HOSA Surgical Technologist"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Key Actions &amp; Study Focus *
                </label>
                <textarea
                  rows={3}
                  required
                  value={manualActions}
                  onChange={(e) => setManualActions(e.target.value)}
                  placeholder="e.g. Introduction to AST guidelines, Surgical Technologist Theory Notes (Q1-Q35), reference textbook study."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deliverables &amp; Expected Outputs (Optional)
                </label>
                <textarea
                  rows={2}
                  value={manualOutputs}
                  onChange={(e) => setManualOutputs(e.target.value)}
                  placeholder="e.g. Chapter 1-3 summary notes completed, initial test score 80%+"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none leading-relaxed"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddMilestoneModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50 flex items-center"
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  {manualLoading ? 'Saving Milestone...' : 'Save Milestone'}
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

