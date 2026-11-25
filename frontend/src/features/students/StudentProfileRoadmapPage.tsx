import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { ProfileRoadmapStudentSummary, ProfileRoadmapItem, RoadmapItemStatusType } from '../../types';
import {
  Compass,
  CheckCircle2,
  Clock,
  Calendar,
  Sparkles,
  BookOpen,
  FileText,
  Target,
  AlertCircle,
  CalendarCheck,
  Download,
  Paperclip,
  Layers,
  CheckCircle,
  Clock3,
  XCircle,
  Filter,
  FolderOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { InteractiveProposalModal } from '../../components/InteractiveProposalModal';

const getDocDownloadUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const rawEnv = (import.meta as any).env?.VITE_API_URL;
  const baseUrl = rawEnv ? rawEnv.replace(/\/+$/, '') : '';
  const token = localStorage.getItem('aptech_token');
  const full = baseUrl ? `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}` : url;
  return token ? `${full}${full.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : full;
};

export const StudentProfileRoadmapPage: React.FC = () => {
  const [data, setData] = useState<ProfileRoadmapStudentSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Proposal Section Filter
  const [proposalFilter, setProposalFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');

  // Sessions Proposal Filter (Filter sessions by selected proposal)
  const [sessionProposalFilter, setSessionProposalFilter] = useState<string>('ALL');

  // Interactive HTML Proposal Viewer Modal State
  const [viewerOpen, setViewerOpen] = useState<boolean>(false);
  const [viewerTitle, setViewerTitle] = useState<string>('');
  const [viewerUrl, setViewerUrl] = useState<string>('');
  const [viewerType, setViewerType] = useState<string | null>(null);
  const [viewerStatus, setViewerStatus] = useState<string | null>(null);

  const fetchMyRoadmap = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/profile-roadmap/my');
      setData(res.data);
    } catch (err: any) {
      console.error('Failed to load profile roadmap', err);
      setError(err.response?.data?.detail || 'Failed to load your profile roadmap.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyRoadmap();
  }, []);

  const handleOpenViewer = (item: ProfileRoadmapItem) => {
    if (!item.proposal_html_url) return;
    setViewerTitle(item.period);
    setViewerUrl(item.proposal_html_url);
    setViewerType(item.proposal_type || 'PROPOSAL');
    setViewerStatus(item.status);
    setViewerOpen(true);
  };

  const handleSelectProposalFilter = (proposalId: string) => {
    setSessionProposalFilter(proposalId);
    const element = document.getElementById('sessions-log-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Loading your Profile Building Roadmap &amp; Proposals...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center max-w-lg mx-auto mt-10">
        <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Roadmap Unavailable</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">{error || 'Could not find your profile execution plan.'}</p>
        <button
          onClick={fetchMyRoadmap}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  const { stats, items, sessions } = data;
  const allSessions = sessions || [];

  // Filter proposals
  const filteredProposals = items.filter((item) => {
    if (proposalFilter === 'COMPLETED') return item.status === 'COMPLETED';
    if (proposalFilter === 'ACTIVE') return item.status === 'APPROVED' || item.status === 'IN_PROGRESS' || item.status === 'PROPOSED';
    return true;
  });

  // Filter sessions by selected proposal
  const filteredSessions = allSessions.filter((sess) => {
    if (sessionProposalFilter === 'ALL') return true;
    if (sessionProposalFilter === 'GENERAL') return !sess.roadmap_item_id;
    return sess.roadmap_item_id === sessionProposalFilter;
  });

  // Proposal being viewed in session filter
  const currentFilteredProposal = items.find((p) => p.id === sessionProposalFilter);

  // Proposal with HTML for hero shortcut
  const proposalWithHtml = items.find((i) => i.proposal_html_url && (i.status === 'APPROVED' || i.status === 'IN_PROGRESS')) ||
    items.find((i) => i.proposal_html_url);

  const activeFocusItem = items.find((i) => i.status === 'APPROVED' || i.status === 'IN_PROGRESS') ||
    items.find((i) => i.status === 'PROPOSED');

  const getStatusBadge = (status: RoadmapItemStatusType) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Active / In Progress</span>
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
            <span>Under Revision</span>
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
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-amber-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden border border-amber-500/20">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
              <Compass className="w-3.5 h-3.5 mr-1.5" />
              Strategic Profile Building Track
            </div>

            {proposalWithHtml && (
              <button
                onClick={() => handleOpenViewer(proposalWithHtml)}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20 transition-all transform hover:-translate-y-0.5"
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>View Interactive Proposal (HTML)</span>
              </button>
            )}
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Profile Building &amp; Mentorship Journey
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1.5 leading-relaxed">
              Curated roadmap tracking global competitions, research initiatives, and milestones with your faculty mentors.
            </p>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-700/60">
            <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-xl border border-white/10">
              <div className="text-[11px] text-slate-400 font-medium">Sessions Logged</div>
              <div className="text-xl font-black text-amber-300 mt-0.5">
                {allSessions.length} Classes
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-xl border border-white/10">
              <div className="text-[11px] text-slate-400 font-medium">Mentorship Time</div>
              <div className="text-xl font-black text-blue-300 mt-0.5">
                {(stats.total_session_minutes / 60).toFixed(1)} hrs
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-xl border border-white/10">
              <div className="text-[11px] text-slate-400 font-medium">Proposals / Initiatives</div>
              <div className="text-xl font-black text-emerald-400 mt-0.5">
                {items.length} Stages
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-xl border border-white/10">
              <div className="text-[11px] text-slate-400 font-medium">Active Focus</div>
              <div className="text-xs font-bold text-slate-200 mt-1 truncate">
                {activeFocusItem ? activeFocusItem.period : 'Consultation Phase'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 1: Strategic Proposals & Action Plans                  */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-amber-600" />
              <h2 className="text-base font-bold text-slate-900">
                Strategic Proposals &amp; Execution Plans ({items.length})
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Initiatives designed specifically for your target universities and academic interests.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
            <button
              onClick={() => setProposalFilter('ALL')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                proposalFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setProposalFilter('ACTIVE')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                proposalFilter === 'ACTIVE'
                  ? 'bg-white text-amber-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active / Proposed
            </button>
            <button
              onClick={() => setProposalFilter('COMPLETED')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                proposalFilter === 'COMPLETED'
                  ? 'bg-white text-emerald-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Completed
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="bg-white p-10 text-center rounded-2xl border border-dashed border-slate-300 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-2">
              <Compass className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Discovery &amp; Consultation in Progress</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Your mentors are actively curating your strategic competitions and proposals based on initial discussions. Check your session log below for meeting notes!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProposals.map((item, idx) => {
              const sessionsCount = allSessions.filter((s) => s.roadmap_item_id === item.id).length;

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 hover:border-slate-300 transition-all space-y-3"
                >
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-400">#{idx + 1}</span>
                        <h3 className="text-base font-bold text-slate-900">{item.period}</h3>
                        {getProposalTypeBadge(item.proposal_type)}
                        {getStatusBadge(item.status)}
                      </div>
                      {item.session_date && (
                        <p className="text-xs text-slate-500 flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Target Timeline: {item.session_date}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 flex-wrap">
                      {item.proposal_html_url && (
                        <button
                          onClick={() => handleOpenViewer(item)}
                          className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-lg text-xs font-bold shadow-xs transition-all flex-shrink-0"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>View Interactive Proposal (HTML)</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleSelectProposalFilter(item.id)}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-xs font-bold border border-blue-200 transition-colors"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
                        <span>View Sessions ({sessionsCount})</span>
                      </button>
                    </div>
                  </div>

                  {/* Scope & Deliverables */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Initiative Scope &amp; Focus Area
                      </div>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                        {item.main_actions}
                      </p>
                    </div>

                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Expected Deliverables &amp; Output
                      </div>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                        {item.milestones_outputs || 'Deliverables and outputs are being finalized.'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 2: Mentorship Sessions Filtered by Proposal            */}
      {/* ------------------------------------------------------------- */}
      <div id="sessions-log-section" className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-5 scroll-mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <CalendarCheck className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">
                Mentorship Sessions &amp; MoM Discussion Log ({allSessions.length})
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any Proposal below to filter and read its specific meeting Minutes of Meeting (MoM) and study notes.
            </p>
          </div>
        </div>

        {/* PROPOSAL SELECTOR PILLS (Enhanced Readability) */}
        <div className="space-y-2">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Select Proposal / Track To View Sessions:</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* All Sessions Button */}
            <button
              onClick={() => setSessionProposalFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center space-x-1.5 ${
                sessionProposalFilter === 'ALL'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>All Sessions</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${sessionProposalFilter === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {allSessions.length}
              </span>
            </button>

            {/* General Mentorship Sessions */}
            <button
              onClick={() => setSessionProposalFilter('GENERAL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center space-x-1.5 ${
                sessionProposalFilter === 'GENERAL'
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                  : 'bg-amber-50/60 text-amber-900 border-amber-200 hover:bg-amber-100'
              }`}
            >
              <span>General Consultation &amp; Discovery</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${sessionProposalFilter === 'GENERAL' ? 'bg-amber-600 text-slate-950 font-black' : 'bg-amber-100 text-amber-800'}`}>
                {allSessions.filter((s) => !s.roadmap_item_id).length}
              </span>
            </button>

            {/* Each Specific Proposal */}
            {items.map((prop) => {
              const count = allSessions.filter((s) => s.roadmap_item_id === prop.id).length;
              const isSelected = sessionProposalFilter === prop.id;

              return (
                <button
                  key={prop.id}
                  onClick={() => setSessionProposalFilter(prop.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center space-x-1.5 ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-blue-50/60 text-blue-900 border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  <span className="truncate max-w-[220px]">{prop.period}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isSelected ? 'bg-blue-700 text-white font-black' : 'bg-blue-100 text-blue-800'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Proposal Overview Banner (When a specific proposal is chosen) */}
        {currentFilteredProposal && (
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50/50 to-blue-50 p-4 rounded-2xl border border-blue-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                  {currentFilteredProposal.proposal_type?.replace(/_/g, ' ') || 'PROPOSAL TRACK'}
                </span>
                <h3 className="text-sm font-bold text-slate-900">{currentFilteredProposal.period}</h3>
                {getStatusBadge(currentFilteredProposal.status)}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Showing all mentorship sessions and MoM notes recorded specifically for this initiative.
              </p>
            </div>

            {currentFilteredProposal.proposal_html_url && (
              <button
                onClick={() => handleOpenViewer(currentFilteredProposal)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-lg text-xs font-bold shadow-xs transition-all flex-shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>View Interactive Proposal (HTML)</span>
              </button>
            )}
          </div>
        )}

        {/* Filtered Sessions Cards List */}
        {filteredSessions.length > 0 ? (
          <div className="space-y-3.5">
            {filteredSessions.map((sess) => {
              const linkedProposal = items.find((p) => p.id === sess.roadmap_item_id);

              const allAtts = sess.attachments && sess.attachments.length > 0
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
                  className="bg-slate-50/70 hover:bg-slate-50 border border-slate-200/80 rounded-xl p-4 sm:p-5 transition-all space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/60">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 flex items-center font-mono">
                        <Calendar className="w-3.5 h-3.5 mr-1 text-slate-500" />
                        {sess.session_date}
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
                        ⏱️ {sess.duration_minutes || 60} mins
                      </span>

                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                        {sess.status}
                      </span>
                    </div>

                    {sess.marked_by_name && (
                      <span className="text-[11px] text-slate-500 font-medium">
                        Mentor: <strong className="text-slate-800 font-bold">{sess.marked_by_name}</strong>
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{sess.topic}</h3>
                    <p className="text-xs text-slate-700 mt-1.5 whitespace-pre-line leading-relaxed">
                      {sess.description}
                    </p>

                    {sess.remarks && (
                      <div className="text-[11px] text-slate-700 bg-amber-50/80 p-2.5 rounded-lg border border-amber-200/60 mt-2.5 italic">
                        <span className="font-bold not-italic text-amber-950">Mentor Guidance: </span>
                        {sess.remarks}
                      </div>
                    )}

                    {/* Attached Documents */}
                    {allAtts.length > 0 && (
                      <div className="mt-3.5 pt-2.5 border-t border-slate-200/60 space-y-1.5">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
                          <Paperclip className="w-3 h-3 text-blue-600" />
                          <span>Session Documents ({allAtts.length}):</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {allAtts.map((att, attIdx) => (
                            <div
                              key={attIdx}
                              className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-xs font-medium text-blue-950"
                            >
                              <Paperclip className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                              <span className="truncate max-w-[200px]">{att.name}</span>
                              {att.size_bytes && (
                                <span className="text-[10px] text-blue-700">
                                  ({(att.size_bytes / 1024).toFixed(0)} KB)
                                </span>
                              )}
                              <a
                                href={getDocDownloadUrl(att.url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={att.name || 'document'}
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
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-10 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 space-y-1">
            <p className="font-semibold text-slate-600">No sessions recorded under this selection.</p>
            <p>Sessions will appear here once conducted by your mentors.</p>
          </div>
        )}
      </div>

      {/* Interactive HTML Proposal Viewer Modal */}
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

export default StudentProfileRoadmapPage;
