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
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Check,
  ChevronRight,
  MessageSquareText,
  Sparkles,
  FileText,
  X,
  PlayCircle,
  Clock3,
  Edit3,
  Target,
  Award,
  Plus,
  Trash2,
  GraduationCap,
  Download,
  Paperclip,
  ExternalLink,
  Layers,
  FileCode2,
  FileCheck,
  Filter,
  CheckCircle,
  XCircle,
  RefreshCw,
  FolderOpen,
  Upload,
} from 'lucide-react';
import { InteractiveProposalModal } from '../../components/InteractiveProposalModal';

export const AdminProfileRoadmapPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStudentId = searchParams.get('studentId') || '';

  const [students, setStudents] = useState<ProfileRoadmapStudentSummary[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId);
  const [selectedStudent, setSelectedStudent] = useState<ProfileRoadmapStudentSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'PROPOSALS' | 'SESSIONS'>('PROPOSALS');

  // Proposal Modal State (Create & Edit)
  const [showProposalModal, setShowProposalModal] = useState<boolean>(false);
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
  const [proposalTitle, setProposalTitle] = useState<string>('');
  const [proposalType, setProposalType] = useState<string>('GLOBAL_COMPETITION');
  const [proposalStatus, setProposalStatus] = useState<RoadmapItemStatusType>('PROPOSED');
  const [proposalPeriod, setProposalPeriod] = useState<string>('');
  const [proposalActions, setProposalActions] = useState<string>('');
  const [proposalOutputs, setProposalOutputs] = useState<string>('');
  const [proposalHtmlUrl, setProposalHtmlUrl] = useState<string | null>(null);
  const [proposalHtmlName, setProposalHtmlName] = useState<string | null>(null);
  const [proposalHtmlUploading, setProposalHtmlUploading] = useState<boolean>(false);
  const [proposalLoading, setProposalLoading] = useState<boolean>(false);
  const [proposalError, setProposalError] = useState<string | null>(null);

  // Interactive HTML Viewer Modal State
  const [viewerOpen, setViewerOpen] = useState<boolean>(false);
  const [viewerTitle, setViewerTitle] = useState<string>('');
  const [viewerUrl, setViewerUrl] = useState<string>('');
  const [viewerType, setViewerType] = useState<string | null>(null);
  const [viewerStatus, setViewerStatus] = useState<string | null>(null);

  // Session Logging Modal State
  const [showSessionModal, setShowSessionModal] = useState<boolean>(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [selectedProposalIdForSession, setSelectedProposalIdForSession] = useState<string>('');
  const [sessionDate, setSessionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sessionTopic, setSessionTopic] = useState<string>('');
  const [sessionDescription, setSessionDescription] = useState<string>('');
  const [sessionDuration, setSessionDuration] = useState<number>(60);
  const [sessionStatus, setSessionStatus] = useState<AttendanceStatusType>('PRESENT');
  const [sessionRemarks, setSessionRemarks] = useState<string>('');
  const [sessionAttachments, setSessionAttachments] = useState<SessionAttachmentItem[]>([]);
  const [sessionDocUploading, setSessionDocUploading] = useState<boolean>(false);
  const [sessionLoading, setSessionLoading] = useState<boolean>(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Filter for sessions tab
  const [sessionProposalFilter, setSessionProposalFilter] = useState<string>('ALL');

  const getDocDownloadUrl = (url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const rawEnv = (import.meta as any).env?.VITE_API_URL;
    const baseUrl = rawEnv ? rawEnv.replace(/\/+$/, '') : '';
    const token = localStorage.getItem('aptech_token');
    const full = baseUrl ? `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}` : url;
    return token ? `${full}${full.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : full;
  };

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

  // ----------------------------------------------------------------
  // Proposal Handlers (Create, Edit, Status, Delete)
  // ----------------------------------------------------------------
  const handleOpenCreateProposal = () => {
    setEditingProposalId(null);
    setProposalTitle('');
    setProposalType('GLOBAL_COMPETITION');
    setProposalStatus('PROPOSED');
    setProposalPeriod('');
    setProposalActions('');
    setProposalOutputs('');
    setProposalHtmlUrl(null);
    setProposalHtmlName(null);
    setProposalError(null);
    setShowProposalModal(true);
  };

  const handleOpenEditProposal = (item: ProfileRoadmapItem) => {
    setEditingProposalId(item.id);
    setProposalTitle(item.period);
    setProposalType(item.proposal_type || 'GLOBAL_COMPETITION');
    setProposalStatus(item.status);
    setProposalPeriod(item.session_date || item.period);
    setProposalActions(item.main_actions || '');
    setProposalOutputs(item.milestones_outputs || '');
    setProposalHtmlUrl(item.proposal_html_url || null);
    setProposalHtmlName(item.proposal_html_name || null);
    setProposalError(null);
    setShowProposalModal(true);
  };

  const handleProposalHtmlFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.html') && !file.name.toLowerCase().endsWith('.htm')) {
      setProposalError('Only HTML files (.html, .htm) are allowed for interactive proposals.');
      return;
    }

    setProposalHtmlUploading(true);
    setProposalError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/profile-roadmap/proposals/upload-html', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProposalHtmlUrl(res.data.proposal_html_url);
      setProposalHtmlName(res.data.proposal_html_name);
    } catch (err: any) {
      setProposalError(err.response?.data?.detail || 'Failed to upload proposal HTML file.');
    } finally {
      setProposalHtmlUploading(false);
      e.target.value = '';
    }
  };

  const handleSaveProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    if (!proposalTitle.trim()) {
      setProposalError('Please provide a proposal title / milestone name.');
      return;
    }

    setProposalLoading(true);
    setProposalError(null);

    try {
      if (editingProposalId) {
        // Update existing proposal
        await api.patch(`/profile-roadmap/items/${editingProposalId}`, {
          period: proposalTitle.trim(),
          main_actions: proposalActions.trim() || proposalTitle.trim(),
          milestones_outputs: proposalOutputs.trim() || null,
          status: proposalStatus,
          proposal_type: proposalType,
          proposal_html_url: proposalHtmlUrl,
          proposal_html_name: proposalHtmlName,
          session_date: proposalPeriod.trim() || null,
        });
      } else {
        // Create new proposal
        const currentCount = selectedStudent.items?.length || 0;
        await api.post(`/profile-roadmap/students/${selectedStudent.student_id}/items`, {
          period: proposalTitle.trim(),
          order_index: currentCount + 1,
          main_actions: proposalActions.trim() || proposalTitle.trim(),
          milestones_outputs: proposalOutputs.trim() || null,
          status: proposalStatus,
          proposal_type: proposalType,
          proposal_html_url: proposalHtmlUrl,
          proposal_html_name: proposalHtmlName,
          session_date: proposalPeriod.trim() || null,
        });
      }

      await loadStudentDetails(selectedStudent.student_id);
      setShowProposalModal(false);
    } catch (err: any) {
      setProposalError(err.response?.data?.detail || 'Failed to save proposal.');
    } finally {
      setProposalLoading(false);
    }
  };

  const handleQuickUpdateStatus = async (item: ProfileRoadmapItem, newStatus: RoadmapItemStatusType) => {
    if (!selectedStudent) return;
    try {
      await api.patch(`/profile-roadmap/items/${item.id}`, { status: newStatus });
      await loadStudentDetails(selectedStudent.student_id);
    } catch (err) {
      console.error('Failed to update proposal status', err);
    }
  };

  const handleDeleteProposal = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this proposal? Associated sessions will become General Sessions.')) {
      return;
    }
    if (!selectedStudent) return;

    try {
      await api.delete(`/profile-roadmap/items/${itemId}`);
      await loadStudentDetails(selectedStudent.student_id);
    } catch (err) {
      console.error('Failed to delete proposal', err);
    }
  };

  const handleOpenViewer = (item: ProfileRoadmapItem) => {
    if (!item.proposal_html_url) return;
    setViewerTitle(item.period);
    setViewerUrl(item.proposal_html_url);
    setViewerType(item.proposal_type || 'PROPOSAL');
    setViewerStatus(item.status);
    setViewerOpen(true);
  };

  // ----------------------------------------------------------------
  // Session Handlers (Log, Edit, Multi-doc upload, Delete)
  // ----------------------------------------------------------------
  const handleOpenAddSession = (presetProposalId?: string) => {
    setEditingSessionId(null);
    setSelectedProposalIdForSession(presetProposalId || '');
    const presetItem = presetProposalId ? selectedStudent?.items?.find((it) => it.id === presetProposalId) : null;
    let initialDate = new Date().toISOString().split('T')[0];
    if (presetItem?.session_date) {
      const match = presetItem.session_date.match(/\d{4}-\d{2}-\d{2}/);
      if (match) {
        initialDate = match[0];
      }
    }
    setSessionDate(initialDate);
    setSessionTopic('');
    setSessionDescription('');
    setSessionDuration(60);
    setSessionStatus('PRESENT');
    setSessionRemarks('');
    setSessionAttachments([]);
    setSessionError(null);
    setShowSessionModal(true);
  };

  const handleOpenEditSession = (session: ProfileSessionAttendance) => {
    setEditingSessionId(session.id);
    setSelectedProposalIdForSession(session.roadmap_item_id || '');
    setSessionDate(session.session_date);
    setSessionTopic(session.topic);
    setSessionDescription(session.description);
    setSessionDuration(session.duration_minutes || 60);
    setSessionStatus(session.status);
    setSessionRemarks(session.remarks || '');

    // Existing attachments
    let existingList: SessionAttachmentItem[] = [];
    if (session.attachments && session.attachments.length > 0) {
      existingList = session.attachments;
    } else if (session.document_url) {
      existingList = [{
        url: session.document_url,
        name: session.document_name || 'Session Document',
        type: session.document_type,
        size_bytes: session.document_size_bytes,
      }];
    }
    setSessionAttachments(existingList);
    setSessionError(null);
    setShowSessionModal(true);
  };

  const handleSessionDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Check if user accidentally selected an HTML file
    for (let i = 0; i < files.length; i++) {
      const name = files[i].name.toLowerCase();
      if (name.endsWith('.html') || name.endsWith('.htm')) {
        setSessionError('HTML files are reserved for Proposals. Please upload study materials (PDF, Word, Excel, PPT, or Images) for session logs.');
        e.target.value = '';
        return;
      }
    }

    setSessionDocUploading(true);
    setSessionError(null);

    const uploadedItems: SessionAttachmentItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await api.post('/profile-roadmap/sessions/upload-document', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploadedItems.push({
          url: res.data.document_url,
          name: res.data.document_name,
          type: res.data.document_type,
          size_bytes: res.data.document_size_bytes,
        });
      } catch (err: any) {
        setSessionError(err.response?.data?.detail || `Failed to upload ${file.name}`);
      }
    }

    setSessionAttachments((prev) => [...prev, ...uploadedItems]);
    setSessionDocUploading(false);
    e.target.value = '';
  };

  const handleRemoveSessionAttachment = (indexToRemove: number) => {
    setSessionAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    if (!sessionTopic.trim()) {
      setSessionError('Please specify the session topic / class agenda.');
      return;
    }
    if (!sessionDescription.trim()) {
      setSessionError('Please provide Minutes of Meeting (MoM) or what was taught.');
      return;
    }

    setSessionLoading(true);
    setSessionError(null);

    const payload = {
      roadmap_item_id: selectedProposalIdForSession || null,
      session_date: sessionDate,
      topic: sessionTopic.trim(),
      description: sessionDescription.trim(),
      duration_minutes: Number(sessionDuration),
      status: sessionStatus,
      remarks: sessionRemarks.trim() || null,
      attachments: sessionAttachments,
      document_url: sessionAttachments.length > 0 ? sessionAttachments[0].url : null,
      document_name: sessionAttachments.length > 0 ? sessionAttachments[0].name : null,
      document_type: sessionAttachments.length > 0 ? sessionAttachments[0].type : null,
      document_size_bytes: sessionAttachments.length > 0 ? sessionAttachments[0].size_bytes : null,
    };

    try {
      if (editingSessionId) {
        await api.patch(`/profile-roadmap/sessions/${editingSessionId}`, payload);
      } else {
        await api.post(`/profile-roadmap/students/${selectedStudent.student_id}/sessions`, payload);
      }

      await loadStudentDetails(selectedStudent.student_id);
      setShowSessionModal(false);
    } catch (err: any) {
      setSessionError(err.response?.data?.detail || 'Failed to save session attendance & MoM.');
    } finally {
      setSessionLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session attendance log?')) return;
    if (!selectedStudent) return;

    try {
      await api.delete(`/profile-roadmap/sessions/${sessionId}`);
      await loadStudentDetails(selectedStudent.student_id);
    } catch (err) {
      console.error('Failed to delete session', err);
    }
  };

  // Filter students for sidebar
  const filteredStudents = students.filter((s) => {
    const q = searchFilter.toLowerCase();
    return (
      s.student_name.toLowerCase().includes(q) ||
      s.student_email.toLowerCase().includes(q) ||
      (s.aptech_student_id && s.aptech_student_id.toLowerCase().includes(q))
    );
  });

  // Calculate student stats
  const proposalsList = selectedStudent?.items || [];
  const allSessions = selectedStudent?.sessions || [];
  const activeProposal = proposalsList.find((p) => p.status === 'APPROVED' || p.status === 'IN_PROGRESS');
  const totalHoursLogged = (allSessions.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0) / 60).toFixed(1);

  // Filter sessions by proposal
  const filteredSessions = allSessions.filter((s) => {
    if (sessionProposalFilter === 'ALL') return true;
    if (sessionProposalFilter === 'GENERAL') return !s.roadmap_item_id;
    return s.roadmap_item_id === sessionProposalFilter;
  });

  const getStatusBadge = (status: RoadmapItemStatusType) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Active / Approved</span>
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            <span>Needs Revision</span>
          </span>
        );
      case 'PROPOSED':
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock3 className="w-3.5 h-3.5" />
            <span>Proposal Under Review</span>
          </span>
        );
    }
  };

  const getProposalTypeBadge = (type?: string | null) => {
    const label = (type || 'COMPETITION').replace(/_/g, ' ');
    return (
      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-2">
              <Compass className="w-3.5 h-3.5" />
              <span>Mentorship &amp; Profile Building Tracker</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Dynamic Proposals &amp; Session Management
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Conduct discovery calls, share interactive visual proposals (.html) with parents, and log session Minutes of Meeting (MoM) as goals get approved.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleOpenCreateProposal}
              disabled={!selectedStudent}
              className="inline-flex items-center space-x-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs shadow-md transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>+ Create Proposal</span>
            </button>

            <button
              onClick={() => handleOpenAddSession()}
              disabled={!selectedStudent}
              className="inline-flex items-center space-x-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ Log Session &amp; MoM</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Student List & Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Student Selector (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4">
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div className="space-y-1.5 max-h-[240px] sm:max-h-[320px] lg:max-h-[560px] overflow-y-auto pr-1">
              {loading ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading students...</div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">No profile building students found.</div>
              ) : (
                filteredStudents.map((s) => {
                  const isSelected = s.student_id === selectedStudentId;
                  const studentActiveProposal = s.items?.find((p) => p.status === 'APPROVED' || p.status === 'IN_PROGRESS');
                  const sessionCount = s.sessions?.length || 0;

                  return (
                    <button
                      key={s.student_id}
                      onClick={() => handleSelectStudent(s.student_id)}
                      className={`w-full text-left p-3 rounded-xl transition-all border ${
                        isSelected
                          ? 'bg-amber-50/70 border-amber-300 shadow-xs'
                          : 'bg-white border-transparent hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{s.student_name}</p>
                          <p className="text-[11px] text-slate-500 truncate">{s.student_email}</p>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold flex-shrink-0">
                          {s.aptech_student_id || 'ID'}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100/80 pt-1.5">
                        <span className="truncate">
                          {studentActiveProposal ? (
                            <span className="text-emerald-700 font-semibold truncate">
                              ● {studentActiveProposal.period}
                            </span>
                          ) : (
                            <span className="text-slate-400">Consultation Phase</span>
                          )}
                        </span>
                        <span className="font-bold text-slate-700">{sessionCount} sessions</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Selected Student Workspace (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {selectedStudent ? (
            <>
              {/* Student Overview Header Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-lg font-bold text-slate-900">{selectedStudent.student_name}</h2>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        Profile Building Track
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Aptech ID: <strong className="text-slate-800">{selectedStudent.aptech_student_id}</strong> • Email: <strong className="text-slate-800">{selectedStudent.student_email}</strong>
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleOpenAddSession()}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Log Session</span>
                    </button>

                    <button
                      onClick={handleOpenCreateProposal}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>New Proposal</span>
                    </button>
                  </div>
                </div>

                {/* Quick KPI Stats Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Focus</div>
                    <div className="text-xs font-bold text-slate-900 truncate mt-1">
                      {activeProposal ? activeProposal.period : 'General Mentorship'}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Sessions</div>
                    <div className="text-base font-black text-slate-900 mt-0.5">
                      {allSessions.length} <span className="text-xs font-normal text-slate-500">conducted</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hours Logged</div>
                    <div className="text-base font-black text-amber-700 mt-0.5">
                      {totalHoursLogged} <span className="text-xs font-normal text-slate-500">hours</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Proposals</div>
                    <div className="text-base font-black text-blue-700 mt-0.5">
                      {proposalsList.length} <span className="text-xs font-normal text-slate-500">stages</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center space-x-2 border-b border-slate-200">
                <button
                  onClick={() => setActiveTab('PROPOSALS')}
                  className={`pb-3 px-4 text-xs font-bold flex items-center space-x-2 border-b-2 transition-all ${
                    activeTab === 'PROPOSALS'
                      ? 'border-amber-600 text-amber-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Proposals &amp; Action Plans</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">
                    {proposalsList.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('SESSIONS')}
                  className={`pb-3 px-4 text-xs font-bold flex items-center space-x-2 border-b-2 transition-all ${
                    activeTab === 'SESSIONS'
                      ? 'border-amber-600 text-amber-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span>Mentorship Sessions &amp; MoM</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">
                    {allSessions.length}
                  </span>
                </button>
              </div>

              {/* TAB 1: Proposals & Action Plans */}
              {activeTab === 'PROPOSALS' && (
                <div className="space-y-4">
                  {proposalsList.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                        <Compass className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">No Proposals Created Yet</h3>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        You can conduct discovery &amp; general mentorship sessions right away, or create a formal proposal (like Conrad Challenge, HOSA, or Research Paper) with an interactive HTML roadmap.
                      </p>
                      <button
                        onClick={handleOpenCreateProposal}
                        className="inline-flex items-center space-x-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-xs"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Create First Proposal</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {proposalsList.map((proposal, idx) => {
                        const sessionsUnderProposal = allSessions.filter((s) => s.roadmap_item_id === proposal.id);

                        return (
                          <div
                            key={proposal.id}
                            className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 hover:border-slate-300 transition-all space-y-4"
                          >
                            {/* Proposal Header */}
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-mono font-bold text-slate-400">#{idx + 1}</span>
                                  <h3 className="text-sm sm:text-base font-bold text-slate-900">{proposal.period}</h3>
                                  {getProposalTypeBadge(proposal.proposal_type)}
                                  {getStatusBadge(proposal.status)}
                                </div>
                                {proposal.session_date && (
                                  <p className="text-xs text-slate-500 flex items-center space-x-1">
                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Timeline: {proposal.session_date}</span>
                                  </p>
                                )}
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center space-x-2 flex-wrap">
                                {proposal.proposal_html_url ? (
                                  <button
                                    onClick={() => handleOpenViewer(proposal)}
                                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-lg text-xs font-bold shadow-xs transition-all"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>View Interactive Proposal (HTML)</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleOpenEditProposal(proposal)}
                                    className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-xs font-bold transition-colors"
                                  >
                                    <FileCode2 className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Attach HTML Proposal</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => handleOpenEditProposal(proposal)}
                                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors border border-slate-200 shadow-2xs"
                                  title="Edit proposal details, timeline, or replace HTML file"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Edit / Replace Proposal</span>
                                </button>

                                <button
                                  onClick={() => handleDeleteProposal(proposal.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                                  title="Delete proposal"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Scope & Deliverables */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                  Proposal Scope &amp; Main Actions
                                </div>
                                <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                                  {proposal.main_actions || 'No details provided.'}
                                </p>
                              </div>

                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                  Expected Deliverables &amp; Milestones
                                </div>
                                <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                                  {proposal.milestones_outputs || 'No deliverables recorded.'}
                                </p>
                              </div>
                            </div>

                            {/* Quick Status Changers & Sessions Info */}
                            <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-2 border-t border-slate-100">
                              <div className="flex flex-wrap items-center gap-2 text-slate-600">
                                <FolderOpen className="w-4 h-4 text-blue-600" />
                                <span>
                                  Sessions Conducted: <strong className="text-slate-900">{sessionsUnderProposal.length}</strong>
                                </span>
                                <button
                                  onClick={() => {
                                    setSessionProposalFilter(proposal.id);
                                    setActiveTab('SESSIONS');
                                  }}
                                  className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors ml-1"
                                >
                                  <FolderOpen className="w-3.5 h-3.5" />
                                  <span>View Sessions &amp; MoM ({sessionsUnderProposal.length})</span>
                                </button>
                                <button
                                  onClick={() => handleOpenAddSession(proposal.id)}
                                  className="text-xs font-bold text-blue-600 hover:underline ml-1"
                                >
                                  + Log Session
                                </button>
                              </div>

                              <div className="flex items-center space-x-1.5">
                                <span className="text-[11px] text-slate-400 font-medium">Quick Status:</span>
                                {proposal.status !== 'APPROVED' && (
                                  <button
                                    onClick={() => handleQuickUpdateStatus(proposal, 'APPROVED')}
                                    className="px-2 py-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md border border-emerald-200 transition-colors"
                                  >
                                    Mark Approved
                                  </button>
                                )}
                                {proposal.status !== 'COMPLETED' && (
                                  <button
                                    onClick={() => handleQuickUpdateStatus(proposal, 'COMPLETED')}
                                    className="px-2 py-1 text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors"
                                  >
                                    Mark Completed
                                  </button>
                                )}
                                {proposal.status !== 'PROPOSED' && (
                                  <button
                                    onClick={() => handleQuickUpdateStatus(proposal, 'PROPOSED')}
                                    className="px-2 py-1 text-[11px] font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-md border border-amber-200 transition-colors"
                                  >
                                    Set Under Review
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Mentorship Sessions & MoM Logs */}
              {activeTab === 'SESSIONS' && (
                <div className="space-y-4">
                  {/* Sessions Filter Header & Add Button */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-amber-600" />
                          <span>Mentorship Sessions &amp; Meeting Minutes (MoM)</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Filter sessions by proposal / initiative to isolate its specific log, or review general discovery notes.
                        </p>
                      </div>

                      <button
                        onClick={() => handleOpenAddSession(sessionProposalFilter !== 'ALL' && sessionProposalFilter !== 'GENERAL' ? sessionProposalFilter : undefined)}
                        className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span>
                          {sessionProposalFilter !== 'ALL' && sessionProposalFilter !== 'GENERAL'
                            ? '+ Log Session For This Proposal'
                            : '+ Log New Session'}
                        </span>
                      </button>
                    </div>

                    {/* Interactive Filter Pills */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1">
                        <Filter className="w-3 h-3 text-slate-400" />
                        <span>Filter by Proposal / Stage:</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          onClick={() => setSessionProposalFilter('ALL')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                            sessionProposalFilter === 'ALL'
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          <span>All Sessions</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                            sessionProposalFilter === 'ALL' ? 'bg-slate-800 text-slate-200' : 'bg-white text-slate-600'
                          }`}>
                            {allSessions.length}
                          </span>
                        </button>

                        <button
                          onClick={() => setSessionProposalFilter('GENERAL')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                            sessionProposalFilter === 'GENERAL'
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-amber-50 text-amber-800 border border-amber-200/60 hover:bg-amber-100'
                          }`}
                        >
                          <span>General Mentorship &amp; Discovery</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                            sessionProposalFilter === 'GENERAL' ? 'bg-amber-700 text-amber-100' : 'bg-white text-amber-800'
                          }`}>
                            {allSessions.filter((s) => !s.roadmap_item_id).length}
                          </span>
                        </button>

                        {proposalsList.map((p) => {
                          const count = allSessions.filter((s) => s.roadmap_item_id === p.id).length;
                          const isSelected = sessionProposalFilter === p.id;
                          return (
                            <button
                              key={p.id}
                              onClick={() => setSessionProposalFilter(p.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                                isSelected
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60'
                              }`}
                            >
                              <span className="truncate max-w-[200px]">{p.period}</span>
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                                isSelected ? 'bg-blue-700 text-blue-100' : 'bg-white text-slate-700'
                              }`}>
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Proposal Context Banner (When a specific proposal is chosen) */}
                  {sessionProposalFilter !== 'ALL' && sessionProposalFilter !== 'GENERAL' && (() => {
                    const activeP = proposalsList.find((p) => p.id === sessionProposalFilter);
                    if (!activeP) return null;
                    return (
                      <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-white border border-blue-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                        <div className="space-y-1 max-w-xl">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                              {activeP.proposal_type?.replace(/_/g, ' ') || 'PROPOSAL TRACK'}
                            </span>
                            <h4 className="text-sm font-bold text-slate-900">{activeP.period}</h4>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              activeP.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                              activeP.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                              activeP.status === 'REJECTED' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                              'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}>
                              {activeP.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                            {activeP.main_actions || 'No scope details recorded.'}
                          </p>
                        </div>

                        <div className="flex items-center space-x-2">
                          {activeP.proposal_html_url && (
                            <button
                              onClick={() => handleOpenViewer(activeP)}
                              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl text-xs font-bold shadow-xs transition-all"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>View Interactive Proposal (HTML)</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenAddSession(activeP.id)}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Log Session</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* General Mentorship Banner (When GENERAL is chosen) */}
                  {sessionProposalFilter === 'GENERAL' && (
                    <div className="bg-gradient-to-r from-amber-50/90 to-white border border-amber-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-900">
                            DISCOVERY &amp; CONSULTATION
                          </span>
                          <h4 className="text-sm font-bold text-slate-900">General Mentorship Sessions</h4>
                        </div>
                        <p className="text-xs text-slate-600">
                          Ad-hoc consultation, parent discovery calls, profile audit sessions, and background discussions not tied to a specific proposal.
                        </p>
                      </div>

                      <button
                        onClick={() => handleOpenAddSession()}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Log Discovery Session</span>
                      </button>
                    </div>
                  )}

                  {filteredSessions.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">No Sessions Found</h3>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        You can log general mentorship discussions, discovery notes, or sessions linked to an approved proposal.
                      </p>
                      <button
                        onClick={() => handleOpenAddSession()}
                        className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Log First Session</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredSessions.map((session) => {
                        const linkedProposal = proposalsList.find((p) => p.id === session.roadmap_item_id);

                        return (
                          <div
                            key={session.id}
                            className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 hover:border-slate-300 transition-all space-y-3"
                          >
                            {/* Session Header */}
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                                    {session.session_date}
                                  </span>

                                  {linkedProposal ? (
                                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      {linkedProposal.period}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                      General Mentorship Session
                                    </span>
                                  )}

                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                                    {session.duration_minutes || 60} mins
                                  </span>

                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
                                    {session.status}
                                  </span>
                                </div>

                                <h4 className="text-sm font-bold text-slate-900 mt-1">{session.topic}</h4>
                              </div>

                              <div className="flex items-center space-x-1.5">
                                <button
                                  onClick={() => handleOpenEditSession(session)}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                                  title="Edit session"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteSession(session.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                                  title="Delete session"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* MoM Notes */}
                            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 text-xs text-slate-800 space-y-2">
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                  What Was Taught / MoM Summary:
                                </div>
                                <div className="whitespace-pre-line leading-relaxed text-slate-700">
                                  {session.description}
                                </div>
                              </div>

                              {session.remarks && (
                                <div className="pt-2 border-t border-slate-200/60 text-[11px] text-amber-950 italic bg-amber-50/70 p-2.5 rounded-lg">
                                  <strong className="not-italic text-amber-950">Mentor Guidance: </strong>
                                  {session.remarks}
                                </div>
                              )}
                            </div>

                            {/* Attachments Section */}
                            {((session.attachments && session.attachments.length > 0) || session.document_url) && (
                              <div className="pt-2 border-t border-slate-100">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center space-x-1">
                                  <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Attached Reference Documents &amp; Notes:</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {(session.attachments && session.attachments.length > 0 ? session.attachments : [{
                                    url: session.document_url!,
                                    name: session.document_name || 'Attached Document',
                                    type: session.document_type,
                                    size_bytes: session.document_size_bytes,
                                  }]).map((doc, docIdx) => (
                                    <div
                                      key={docIdx}
                                      className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-xs font-medium text-blue-950"
                                    >
                                      <Paperclip className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                                      <span className="truncate max-w-[200px]">{doc.name}</span>
                                      {doc.size_bytes && (
                                        <span className="text-[10px] text-blue-700">
                                          ({(doc.size_bytes / 1024).toFixed(0)} KB)
                                        </span>
                                      )}
                                      <a
                                        href={getDocDownloadUrl(doc.url)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download={doc.name || 'session-doc'}
                                        className="text-blue-700 hover:text-blue-900 font-bold ml-1 hover:underline flex items-center space-x-0.5"
                                      >
                                        <Download className="w-3 h-3" />
                                        <span>Download</span>
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Faculty Name Footer */}
                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                              <span>
                                Conducted by: <strong className="text-slate-800">{session.marked_by_name || 'Faculty Mentor'}</strong>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400">
              <Compass className="w-12 h-12 mx-auto mb-3 opacity-30 text-amber-600" />
              <p className="text-sm font-semibold">Select a student from the left panel to manage their proposals and sessions.</p>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: Create / Edit Proposal Modal                          */}
      {/* ------------------------------------------------------------- */}
      {showProposalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingProposalId ? 'Edit Proposal & Replace HTML File' : 'Create New Proposal'}
                </h3>
              </div>
              <button
                onClick={() => setShowProposalModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProposal} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {proposalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{proposalError}</span>
                </div>
              )}

              {/* Proposal Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Proposal Title / Milestone Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Conrad Challenge 2026-27 or HOSA Surgical Tech Preparation"
                  value={proposalTitle}
                  onChange={(e) => setProposalTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                />
              </div>

              {/* Proposal Type & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Initiative Type</label>
                  <select
                    value={proposalType}
                    onChange={(e) => setProposalType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                  >
                    <option value="GLOBAL_COMPETITION">Global Competition (Conrad, HOSA, Olympiad)</option>
                    <option value="RESEARCH_PAPER">Research Paper &amp; Publication</option>
                    <option value="COMMUNITY_PROJECT">Community Initiative / NGO Project</option>
                    <option value="INTERNSHIP">Clinical Shadowing / Industry Internship</option>
                    <option value="ADMISSIONS_STRATEGY">Admissions Portfolio / Strategy</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Proposal Status</label>
                  <select
                    value={proposalStatus}
                    onChange={(e) => setProposalStatus(e.target.value as RoadmapItemStatusType)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                  >
                    <option value="PROPOSED">PROPOSED (Under Review by Parents)</option>
                    <option value="APPROVED">APPROVED (Active / Accepted)</option>
                    <option value="COMPLETED">COMPLETED (Finished)</option>
                    <option value="REJECTED">REJECTED (Needs Changes)</option>
                  </select>
                </div>
              </div>

              {/* Target Period */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Timeline / Period</label>
                <input
                  type="text"
                  placeholder="e.g. November 2026 - February 2027"
                  value={proposalPeriod}
                  onChange={(e) => setProposalPeriod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                />
              </div>

              {/* Interactive HTML Proposal Upload & Replace */}
              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-amber-950 flex items-center space-x-1.5">
                      <FileCode2 className="w-4 h-4 text-amber-600" />
                      <span>Interactive HTML Proposal Document (.html)</span>
                    </label>
                    <p className="text-[11px] text-amber-900 mt-0.5">
                      Upload or replace the visual, interactive roadmap file for this proposal.
                    </p>
                  </div>
                </div>

                {proposalHtmlUrl ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-amber-200">
                      <div className="flex items-center space-x-2 text-xs font-bold text-emerald-800">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <span className="truncate max-w-sm">{proposalHtmlName || 'interactive-proposal.html'}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setViewerTitle(proposalTitle || 'Proposal Preview');
                            setViewerUrl(proposalHtmlUrl);
                            setViewerOpen(true);
                          }}
                          className="px-2.5 py-1 text-xs font-bold bg-amber-500 text-slate-950 rounded-md hover:bg-amber-600"
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setProposalHtmlUrl(null);
                            setProposalHtmlName(null);
                          }}
                          className="text-xs text-rose-600 hover:underline px-1 font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between flex-wrap gap-2">
                      <span className="text-[11px] font-semibold text-amber-950">
                        Proposal change hui hai? Nayi HTML file upload karein:
                      </span>
                      <label className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{proposalHtmlUploading ? 'Uploading...' : 'Replace HTML File'}</span>
                        <input
                          type="file"
                          accept=".html,.htm"
                          onChange={handleProposalHtmlFileUpload}
                          disabled={proposalHtmlUploading}
                          className="hidden"
                        />
                      </label>
                    </div>
                    {proposalHtmlUploading && (
                      <p className="text-[11px] text-blue-700 font-semibold animate-pulse">Uploading replacement HTML file to storage...</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept=".html,.htm"
                      onChange={handleProposalHtmlFileUpload}
                      disabled={proposalHtmlUploading}
                      className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-600 file:text-white hover:file:bg-amber-700"
                    />
                    {proposalHtmlUploading && (
                      <p className="text-[11px] text-amber-800 mt-1">Uploading interactive proposal...</p>
                    )}
                  </div>
                )}
              </div>

              {/* Scope & Main Actions */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Scope, Objectives &amp; What We Plan To Do
                </label>
                <textarea
                  rows={3}
                  placeholder="Outline the core objective, mentor alignment, and preparation phases..."
                  value={proposalActions}
                  onChange={(e) => setProposalActions(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                />
              </div>

              {/* Expected Deliverables */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Expected Deliverables &amp; Output Milestones
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Round 1 Submission, Problem Statement Paper, Pitch Deck, Prototype Video..."
                  value={proposalOutputs}
                  onChange={(e) => setProposalOutputs(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowProposalModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={proposalLoading || proposalHtmlUploading}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  {proposalLoading ? 'Saving...' : editingProposalId ? 'Save Changes' : 'Create Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: Log / Edit Mentorship Session Modal                  */}
      {/* ------------------------------------------------------------- */}
      {showSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingSessionId ? 'Edit Session & MoM Log' : 'Log Mentorship Session & MoM'}
                </h3>
              </div>
              <button
                onClick={() => setShowSessionModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSession} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {sessionError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{sessionError}</span>
                </div>
              )}

              {/* Proposal Link Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Link To Proposal / Milestone (Optional)
                </label>
                <select
                  value={selectedProposalIdForSession}
                  onChange={(e) => setSelectedProposalIdForSession(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                >
                  <option value="">General Mentorship Session (No Proposal / Discovery)</option>
                  {proposalsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.period} ({p.status})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  If this meeting was for initial consultation or general discovery, leave as General Mentorship Session.
                </p>
              </div>

              {/* Date, Duration, Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Session Date *</label>
                  <input
                    type="date"
                    required
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    min={15}
                    max={360}
                    value={sessionDuration}
                    onChange={(e) => setSessionDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Attendance Status</label>
                  <select
                    value={sessionStatus}
                    onChange={(e) => setSessionStatus(e.target.value as AttendanceStatusType)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                  >
                    <option value="PRESENT">PRESENT</option>
                    <option value="ABSENT">ABSENT</option>
                    <option value="LATE">LATE</option>
                    <option value="EXCUSED">EXCUSED</option>
                  </select>
                </div>
              </div>

              {/* Session Topic */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Topic / Agenda Covered <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HOSA Theory Notes &amp; Guidelines Review, Conrad Idea Selection"
                  value={sessionTopic}
                  onChange={(e) => setSessionTopic(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                />
              </div>

              {/* What Was Taught / MoM */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Minutes of Meeting (MoM) &amp; What Was Taught <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Detail the discussion points, concepts covered, student understanding, questions addressed..."
                  value={sessionDescription}
                  onChange={(e) => setSessionDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                />
              </div>

              {/* Mentor Guidance / Homework */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mentor Guidance &amp; Next Action Items (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Action items for student before next session..."
                  value={sessionRemarks}
                  onChange={(e) => setSessionRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                />
              </div>

              {/* Multi-Document Attachments (NO HTML ALLOWED) */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <Paperclip className="w-4 h-4 text-blue-600" />
                    <span>Attach Study Materials &amp; Reference Documents</span>
                  </label>
                </div>
                <p className="text-[11px] text-slate-500">
                  Attach PDFs, Word (.docx), Excel (.xlsx), PPT (.pptx), or Images. Multiple files allowed. (HTML files are reserved for Proposals).
                </p>

                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg"
                  onChange={handleSessionDocUpload}
                  disabled={sessionDocUploading}
                  className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                />
                {sessionDocUploading && (
                  <p className="text-[11px] text-blue-600 mt-1 font-semibold">Uploading document(s)...</p>
                )}

                {sessionAttachments.length > 0 && (
                  <div className="pt-2 flex flex-wrap gap-2">
                    {sessionAttachments.map((att, idx) => (
                      <div
                        key={idx}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 font-medium"
                      >
                        <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                        <span className="truncate max-w-[180px]">{att.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSessionAttachment(idx)}
                          className="w-4 h-4 rounded-full bg-blue-200 hover:bg-rose-200 hover:text-rose-800 text-blue-800 flex items-center justify-center text-[10px]"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowSessionModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sessionLoading || sessionDocUploading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  {sessionLoading ? 'Saving...' : editingSessionId ? 'Save Changes' : 'Save Session Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: Interactive HTML Proposal Viewer Modal                */}
      {/* ------------------------------------------------------------- */}
      <InteractiveProposalModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        title={viewerTitle}
        proposalHtmlUrl={viewerUrl}
        proposalType={viewerType}
        status={viewerStatus}
      />
    </div>
  );
};
