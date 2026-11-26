import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { AdminStudyPlan, StudyTask, StudyPlanVersionSnapshot } from '../../types';
import { getEconomicsTrackLabel } from '../../utils/courseHelper';
import {
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Eye,
  FileSpreadsheet,
  X,
  ThumbsUp,
  MessageSquareWarning,
  Sliders,
  Lock,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const ALL_DAYS = [
  { code: 'MON', label: 'Mon' },
  { code: 'TUE', label: 'Tue' },
  { code: 'WED', label: 'Wed' },
  { code: 'THU', label: 'Thu' },
  { code: 'FRI', label: 'Fri' },
  { code: 'SAT', label: 'Sat' },
  { code: 'SUN', label: 'Sun' },
];

export const AdminStudyPlansPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [plans, setPlans] = useState<AdminStudyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Inspect & Review Modal state
  const [selectedPlan, setSelectedPlan] = useState<(AdminStudyPlan & { tasks?: StudyTask[] }) | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [overrideDays, setOverrideDays] = useState<string[]>([]);
  const [overrideHours, setOverrideHours] = useState<number>(2);
  const [overrideTargetDate, setOverrideTargetDate] = useState<string>('');
  const [enableOverride, setEnableOverride] = useState(false);
  const [modalTab, setModalTab] = useState<'REVIEW' | 'HISTORY'>('REVIEW');
  const [planHistory, setPlanHistory] = useState<StudyPlanVersionSnapshot[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/study-plans', {
        params: {
          approval_status: statusFilter,
          search: searchQuery.trim() || undefined,
        },
      });
      setPlans(res.data.items || []);
    } catch (err) {
      console.error('Failed to fetch student study plans', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const openInspectModal = useCallback(async (plan: AdminStudyPlan) => {
    setSelectedPlan(plan);
    setModalTab('REVIEW');
    setPlanHistory([]);
    setExpandedHistoryId(null);
    setReviewNote(plan.admin_review_note || '');
    setOverrideDays(
      plan.has_pending_edit && plan.pending_edit_data
        ? plan.pending_edit_data.available_days
        : plan.available_days || ['MON', 'TUE', 'WED', 'THU', 'FRI']
    );
    setOverrideHours(
      plan.has_pending_edit && plan.pending_edit_data
        ? plan.pending_edit_data.daily_study_hours
        : plan.daily_study_hours || 2
    );
    setOverrideTargetDate(
      (plan.has_pending_edit && plan.pending_edit_data?.target_completion_date) || plan.target_completion_date
    );
    setEnableOverride(false);
    setDetailLoading(true);
    setHistoryLoading(true);
    try {
      const [detailRes, histRes] = await Promise.allSettled([
        api.get(`/admin/study-plans/${plan.id}`),
        api.get<StudyPlanVersionSnapshot[]>(`/plans/${plan.id}/history`),
      ]);
      if (detailRes.status === 'fulfilled') {
        setSelectedPlan(detailRes.value.data);
      }
      if (histRes.status === 'fulfilled') {
        setPlanHistory(histRes.value.data || []);
        if (histRes.value.data && histRes.value.data.length > 0) {
          setExpandedHistoryId(histRes.value.data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load plan detail', err);
    } finally {
      setDetailLoading(false);
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    const planIdParam = searchParams.get('planId');
    if (planIdParam && plans.length > 0) {
      const match = plans.find((p) => p.id === planIdParam);
      if (match) {
        openInspectModal(match);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, plans, openInspectModal, setSearchParams]);

  const handleReviewSubmit = async (
    planId: string,
    decision: 'APPROVED' | 'CHANGES_REQUESTED',
    customNote?: string,
    withOverrides = false
  ) => {
    setActionLoadingId(planId);
    try {
      const payload: any = {
        approval_status: decision,
        admin_review_note: customNote !== undefined ? customNote : reviewNote || undefined,
      };
      if (withOverrides && enableOverride) {
        payload.available_days = overrideDays;
        payload.daily_study_hours = overrideHours;
        payload.target_completion_date = overrideTargetDate;
      }
      const res = await api.patch(`/admin/study-plans/${planId}/review`, payload);
      alert(res.data.message || 'Plan review saved!');
      setSelectedPlan(null);
      await fetchPlans();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to review study plan.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleEditReviewSubmit = async (
    planId: string,
    decision: 'APPROVED' | 'CHANGES_REQUESTED',
    withOverrides = false
  ) => {
    setActionLoadingId(planId);
    try {
      const payload: any = {
        decision,
        admin_review_note: reviewNote || undefined,
      };
      if (withOverrides && enableOverride) {
        payload.available_days = overrideDays;
        payload.daily_study_hours = overrideHours;
        payload.target_completion_date = overrideTargetDate;
      }
      const res = await api.patch(`/admin/study-plans/${planId}/review-edit`, payload);
      alert(res.data.message || 'Edit decision saved!');
      setSelectedPlan(null);
      await fetchPlans();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to review plan edit.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAdminCompleteTask = async (task: StudyTask) => {
    if (!selectedPlan || task.status === 'COMPLETED') return;
    if (
      !window.confirm(
        `Mark "${task.title}" as Completed for ${selectedPlan.student_name}?\n\nOnce marked complete, it is permanently locked and immediately reflected on the student's planner.`
      )
    ) {
      return;
    }
    setCompletingTaskId(task.id);
    try {
      const res = await api.patch(
        `/admin/study-plans/${selectedPlan.id}/tasks/${task.id}/complete`
      );
      const updatedTask: StudyTask = res.data.task;
      setSelectedPlan((prev) =>
        prev
          ? {
              ...prev,
              completed_tasks: res.data.completed_tasks ?? prev.completed_tasks + 1,
              tasks: (prev.tasks || []).map((t) =>
                t.id === updatedTask.id ? updatedTask : t
              ),
            }
          : prev
      );
      await fetchPlans();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to mark topic as completed.');
    } finally {
      setCompletingTaskId(null);
    }
  };

  const handleExportCsv = async (plan: AdminStudyPlan) => {
    try {
      const res = await api.get(`/plans/${plan.id}/export`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${plan.course_code}_${plan.aptech_student_id}_Schedule.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to download CSV.');
    }
  };

  const toggleOverrideDay = (code: string) => {
    if (overrideDays.includes(code)) {
      if (overrideDays.length === 1) return;
      setOverrideDays(overrideDays.filter((d) => d !== code));
    } else {
      setOverrideDays([...overrideDays, code]);
    }
  };

  const pendingCount = plans.filter(
    (p) => p.approval_status === 'PENDING_APPROVAL' || Boolean(p.has_pending_edit)
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-amber-600" />
            Student Study Plan Approvals
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review student-submitted schedules (2, 3, 4 months, etc.), check feasibility, approve classes, or request changes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student or course..."
              className="text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 sm:gap-2 bg-amber-50/80 p-1.5 rounded-2xl border border-amber-200/60 w-full sm:w-fit overflow-x-auto">
        {[
          { key: 'ALL', label: 'All Plans' },
          { key: 'PENDING_APPROVAL', label: `Pending Review${statusFilter === 'ALL' && pendingCount > 0 ? ` (${pendingCount})` : ''}` },
          { key: 'APPROVED', label: 'Approved' },
          { key: 'CHANGES_REQUESTED', label: 'Changes Requested' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              statusFilter === tab.key
                ? 'bg-slate-900 text-amber-300 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Plans List */}
      {loading ? (
        <div className="flex justify-center items-center h-48 bg-white rounded-2xl border border-slate-200">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : plans.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
          <CalendarCheck className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <div className="text-sm font-bold text-slate-800">No Study Plans Found</div>
          <p className="text-xs text-slate-500 mt-1">
            When students build their schedules in the Study Planner, they will appear here for your feasibility review.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {plans.map((p) => {
            const approxMonths = Math.max(1, Math.round((p.duration_days || 90) / 30));
            const isFeasible = p.feasibility?.is_feasible ?? true;

            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:border-amber-300 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                      {p.course_code}
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {p.aptech_student_id}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-300">
                      v{p.version_number || 1}
                    </span>

                    {p.has_pending_edit && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 text-sky-900 border border-sky-300">
                        <Clock className="w-3 h-3 mr-1" />
                        Edit Request Pending
                      </span>
                    )}

                    {p.approval_status === 'PENDING_APPROVAL' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending Admin Approval
                      </span>
                    ) : p.approval_status === 'APPROVED' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Approved
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Changes Requested
                      </span>
                    )}

                    {p.feasibility && (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          isFeasible
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {isFeasible
                          ? `Feasible (${p.feasibility.total_available_hours}h avail / ${p.feasibility.total_syllabus_hours}h req)`
                          : `Deficit! (${p.feasibility.total_available_hours}h avail / ${p.feasibility.total_syllabus_hours}h req)`}
                      </span>
                    )}
                  </div>

                  <div>
                    <h2 className="text-sm md:text-base font-extrabold text-slate-900">
                      {p.student_name} — <span className="text-amber-700">{p.course_name}</span>
                    </h2>
                    <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span>
                        <strong>Requested Duration:</strong> ~{approxMonths} Month{approxMonths > 1 ? 's' : ''} ({p.start_date} → {p.target_completion_date})
                      </span>
                      <span>
                        <strong>Days:</strong> {(p.available_days || []).join(', ')}
                      </span>
                      <span>
                        <strong>Pace:</strong> {p.daily_study_hours || 2} hrs/day ({p.total_tasks} tasks)
                      </span>
                    </div>

                    {/* Verified Checklist Progress */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px]">
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                        <Lock className="w-3 h-3" />
                        Checklist: {p.completed_tasks} / {p.total_tasks} Topics Done ({p.completion_percent ?? (p.total_tasks > 0 ? Math.round((p.completed_tasks / p.total_tasks) * 100) : 0)}%)
                      </span>
                      {p.last_completed_task_title && (
                        <span className="text-slate-500">
                          Last verified: <strong className="text-slate-700">{p.last_completed_task_title}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {p.admin_review_note && (
                    <div className="text-[11px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700">
                      <strong>Review Note:</strong> {p.admin_review_note}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => openInspectModal(p)}
                    className="inline-flex items-center px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-amber-300 shadow-xs"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1.5" />
                    Inspect &amp; Review
                  </button>

                  {p.approval_status !== 'APPROVED' && (
                    <button
                      type="button"
                      disabled={actionLoadingId === p.id}
                      onClick={() =>
                        handleReviewSubmit(
                          p.id,
                          'APPROVED',
                          `Approved ${approxMonths}-month schedule (${(p.available_days || []).join(', ')}, ${p.daily_study_hours || 2} hrs/day).`
                        )
                      }
                      className="inline-flex items-center px-3 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs disabled:opacity-50"
                    >
                      <ThumbsUp className="w-3.5 h-3.5 mr-1.5" />
                      Approve
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleExportCsv(p)}
                    className="inline-flex items-center px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300"
                    title="Download Excel / CSV timetable"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-amber-700" />
                    CSV
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inspect & Review Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6">
          <div className="min-h-full flex items-center justify-center py-6 sm:py-10">
            <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-amber-200 overflow-hidden my-auto">
              <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-start justify-between border-b-2 border-amber-400 sticky top-0 z-30 shadow-md">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded bg-amber-400 text-slate-950">
                      {selectedPlan.course_code}
                    </span>
                    <span className="text-xs text-amber-200 font-mono">{selectedPlan.aptech_student_id}</span>
                  </div>
                  <h2 className="text-lg font-black text-white mt-1.5">
                    {selectedPlan.student_name} — {selectedPlan.title}
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {selectedPlan.start_date} → {selectedPlan.target_completion_date} • {(selectedPlan.available_days || []).join(', ')} • {selectedPlan.daily_study_hours} hrs/day
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPlan(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 sm:p-6 space-y-5">
              {/* Modal Tabs: Review vs Old Plans History */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                <button
                  type="button"
                  onClick={() => setModalTab('REVIEW')}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-colors ${
                    modalTab === 'REVIEW'
                      ? 'bg-slate-900 text-amber-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Current Plan &amp; Review
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('HISTORY')}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-colors ${
                    modalTab === 'HISTORY'
                      ? 'bg-slate-900 text-amber-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  Old Plans / History ({planHistory.length})
                </button>
              </div>

              {modalTab === 'HISTORY' ? (
                <div className="space-y-4">
                  {historyLoading ? (
                    <div className="py-10 text-center text-xs text-slate-500">Loading saved plan history...</div>
                  ) : planHistory.length === 0 ? (
                    <div className="py-10 text-center bg-slate-50 rounded-2xl border border-slate-200">
                      <History className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                      <div className="text-sm font-bold text-slate-800">No old plans saved yet</div>
                      <p className="text-xs text-slate-500 mt-1">
                        When an edited plan is approved or the student generates a new plan, the previous version is automatically archived here.
                      </p>
                    </div>
                  ) : (
                    planHistory.map((item) => {
                      const isExpanded = expandedHistoryId === item.id;
                      return (
                        <div key={item.id} className="border border-slate-200 rounded-2xl overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedHistoryId(isExpanded ? null : item.id)}
                            className="w-full p-4 bg-slate-50 hover:bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left"
                          >
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-900 text-amber-300">
                                  {item.source_type === 'ARCHIVED_PLAN' ? 'Previous Plan' : `Old Version v${item.version_number}`}
                                </span>
                                <span className="text-xs font-extrabold text-slate-900">{item.title}</span>
                              </div>
                              <div className="text-[11px] text-slate-600 mt-1 flex flex-wrap gap-x-3">
                                <span>{item.start_date} → {item.target_completion_date}</span>
                                <span>{item.daily_study_hours} hrs/day ({item.available_days.join(', ')})</span>
                                <span>Completed: {item.completed_tasks}/{item.total_tasks}</span>
                              </div>
                              {item.archived_reason && (
                                <div className="text-[11px] text-amber-800 mt-1 font-medium">{item.archived_reason}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                              <span>{new Date(item.created_at).toLocaleDateString()}</span>
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="p-4 border-t border-slate-200 overflow-x-auto">
                              <table className="w-full text-left text-[11px]">
                                <thead>
                                  <tr className="text-slate-500 border-b border-slate-200">
                                    <th className="py-1.5 pr-3">Date</th>
                                    <th className="py-1.5 pr-3">Topic</th>
                                    <th className="py-1.5 pr-3">Est. Hrs</th>
                                    <th className="py-1.5">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {item.snapshot_tasks.map((st, idx) => (
                                    <tr key={`${st.id}-${idx}`}>
                                      <td className="py-1.5 pr-3 font-mono">{st.scheduled_date}</td>
                                      <td className="py-1.5 pr-3 font-medium text-slate-900">{st.title}</td>
                                      <td className="py-1.5 pr-3">{st.estimated_duration_hours}h</td>
                                      <td className="py-1.5">{st.status}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
              <>
              {/* Pending Edit Request Comparison Box */}
              {selectedPlan.has_pending_edit && selectedPlan.pending_edit_data && (
                <div className="p-4 rounded-2xl border-2 border-sky-300 bg-sky-50 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-extrabold text-sky-950">
                      Student Requested a Schedule Edit (Pending Your Approval)
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-200 text-sky-900">
                      Only {selectedPlan.pending_edit_data.remaining_tasks_count} Not-Completed Topics ({selectedPlan.pending_edit_data.remaining_hours} hrs) Affected
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-white/90 rounded-xl p-3 border border-sky-200">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Current Approved Plan (v{selectedPlan.version_number || 1})</div>
                      <div className="mt-1 font-semibold text-slate-800">
                        Days: {(selectedPlan.available_days || []).join(', ')} • {selectedPlan.daily_study_hours} hrs/day
                      </div>
                      <div className="text-slate-600">Target End: {selectedPlan.target_completion_date}</div>
                    </div>
                    <div className="bg-white rounded-xl p-3 border-2 border-sky-400">
                      <div className="text-[10px] font-bold uppercase text-sky-700">Requested New Schedule</div>
                      <div className="mt-1 font-extrabold text-slate-900">
                        Days: {selectedPlan.pending_edit_data.available_days.join(', ')} • {selectedPlan.pending_edit_data.daily_study_hours} hrs/day
                      </div>
                      <div className="text-slate-700">
                        Target End: {selectedPlan.pending_edit_data.target_completion_date || selectedPlan.target_completion_date}{' '}
                        {selectedPlan.pending_edit_data.estimated_finish_date && (
                          <span className="text-sky-800 font-semibold">
                            (Est. finish: {selectedPlan.pending_edit_data.estimated_finish_date})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {selectedPlan.pending_edit_data.feasibility && (
                    <div
                      className={`text-xs font-bold px-3 py-2 rounded-xl border ${
                        selectedPlan.pending_edit_data.feasibility.is_feasible
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}
                    >
                      Remaining-Topics Feasibility ({selectedPlan.pending_edit_data.feasibility.capacity_ratio}x):{' '}
                      {selectedPlan.pending_edit_data.feasibility.total_available_hours}h available vs{' '}
                      {selectedPlan.pending_edit_data.feasibility.total_syllabus_hours}h remaining required
                    </div>
                  )}
                </div>
              )}

              {/* Feasibility Evaluation Box */}
              {selectedPlan.feasibility && (
                <div
                  className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
                    selectedPlan.feasibility.is_feasible
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="font-extrabold text-sm">
                    {selectedPlan.feasibility.is_feasible
                      ? `✅ Feasibility Check Passed (${selectedPlan.feasibility.capacity_ratio}x Capacity)`
                      : `⚠️ Feasibility Warning (${selectedPlan.feasibility.capacity_ratio}x Capacity)`}
                  </div>
                  <div>
                    Course Requirement: <strong>{selectedPlan.feasibility.total_syllabus_hours} hrs</strong> | Student Available:{' '}
                    <strong>{selectedPlan.feasibility.total_available_hours} hrs</strong>
                  </div>
                  {selectedPlan.feasibility.warnings.map((w, i) => (
                    <div key={i}>• {w}</div>
                  ))}
                  {selectedPlan.feasibility.suggestions.map((s, i) => (
                    <div key={i} className="font-medium">• {s}</div>
                  ))}
                </div>
              )}

              {/* Optional Admin Schedule Override */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                <label className="flex items-center space-x-2 text-xs font-extrabold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableOverride}
                    onChange={(e) => setEnableOverride(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <Sliders className="w-3.5 h-3.5 text-amber-600" />
                  <span>Adjust Student&apos;s Days / Hours / End Date before Approving</span>
                </label>

                {enableOverride && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                    <div>
                      <span className="block text-[11px] font-bold text-slate-600 mb-1">Class Days</span>
                      <div className="flex flex-wrap gap-1">
                        {ALL_DAYS.map((d) => (
                          <button
                            type="button"
                            key={d.code}
                            onClick={() => toggleOverrideDay(d.code)}
                            className={`px-2 py-1 rounded text-[11px] font-bold border ${
                              overrideDays.includes(d.code)
                                ? 'bg-slate-900 text-amber-300 border-amber-400'
                                : 'bg-white text-slate-600 border-slate-300'
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="block text-[11px] font-bold text-slate-600 mb-1">Daily Hours ({overrideHours} hrs)</span>
                      <input
                        type="range"
                        min="1"
                        max="8"
                        step="0.5"
                        value={overrideHours}
                        onChange={(e) => setOverrideHours(parseFloat(e.target.value))}
                        className="w-full accent-amber-500 mt-1"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] font-bold text-slate-600 mb-1">Target Completion Date</span>
                      <input
                        type="date"
                        value={overrideTargetDate}
                        onChange={(e) => setOverrideTargetDate(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Admin Note & Decision Buttons */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  Admin Feedback / Class Note for Student
                </label>
                <textarea
                  rows={2}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="e.g., Approved! Your 3-month UCAT batch runs Mon-Fri 2 hrs/day. OR: Please switch to 4 months or 3 hrs/day."
                  className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportCsv(selectedPlan)}
                    className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-1.5 text-amber-700" />
                    Download Excel / CSV
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    {selectedPlan.has_pending_edit ? (
                      <>
                        <button
                          type="button"
                          disabled={actionLoadingId === selectedPlan.id}
                          onClick={() => handleEditReviewSubmit(selectedPlan.id, 'CHANGES_REQUESTED', false)}
                          className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
                        >
                          <MessageSquareWarning className="w-4 h-4 mr-1.5" />
                          Request Changes on Edit
                        </button>
                        <button
                          type="button"
                          disabled={actionLoadingId === selectedPlan.id}
                          onClick={() => handleEditReviewSubmit(selectedPlan.id, 'APPROVED', true)}
                          className="inline-flex items-center px-5 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50"
                        >
                          <ThumbsUp className="w-4 h-4 mr-1.5" />
                          {enableOverride ? 'Adjust & Approve Edit (Save Old Plan)' : 'Approve Edited Plan (Save Old Plan)'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={actionLoadingId === selectedPlan.id}
                          onClick={() => handleReviewSubmit(selectedPlan.id, 'CHANGES_REQUESTED', undefined, false)}
                          className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
                        >
                          <MessageSquareWarning className="w-4 h-4 mr-1.5" />
                          Request Changes
                        </button>

                        <button
                          type="button"
                          disabled={actionLoadingId === selectedPlan.id}
                          onClick={() => handleReviewSubmit(selectedPlan.id, 'APPROVED', undefined, true)}
                          className="inline-flex items-center px-5 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50"
                        >
                          <ThumbsUp className="w-4 h-4 mr-1.5" />
                          {enableOverride ? 'Adjust & Approve Plan' : 'Approve Study Plan'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Day-by-Day Schedule & Verified Checklist Preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                    Syllabus Checklist &amp; Timetable ({selectedPlan.completed_tasks} / {selectedPlan.tasks?.length || selectedPlan.total_tasks} Topics Verified)
                  </h3>
                  <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Completed ticks are permanently locked
                  </span>
                </div>
                {detailLoading ? (
                  <div className="py-6 text-center text-xs text-slate-500">Loading timetable...</div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-xs">
                    <table className="w-full text-left text-xs text-slate-700 min-w-[620px]">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Topic / Session</th>
                          <th className="py-2.5 px-3">Hours</th>
                          <th className="py-2.5 px-3">Verified / Lock Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(selectedPlan.tasks || []).map((t) => {
                          const isDone = t.status === 'COMPLETED';
                          return (
                            <tr key={t.id} className={isDone ? 'bg-emerald-50/40' : ''}>
                              <td className="py-2 px-3 font-mono font-bold whitespace-nowrap">{t.scheduled_date}</td>
                              <td className="py-2 px-3">{t.task_type}</td>
                              <td className="py-2 px-3 font-semibold text-slate-900">
                                <div className="flex items-center flex-wrap gap-1">
                                  <span>{t.title}</span>
                                  {getEconomicsTrackLabel(t) && (
                                    <span
                                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                        getEconomicsTrackLabel(t) === 'Microeconomics'
                                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                                          : getEconomicsTrackLabel(t) === 'Macroeconomics'
                                          ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                                          : 'bg-slate-100 text-slate-800 border-slate-300'
                                      }`}
                                    >
                                      ({getEconomicsTrackLabel(t)})
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">{t.estimated_duration_hours} hrs</td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                {isDone ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <Lock className="w-2.5 h-2.5" />
                                    Done • {t.scheduled_date}
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-semibold text-slate-500">{t.status}</span>
                                    <button
                                      type="button"
                                      disabled={completingTaskId === t.id}
                                      onClick={() => handleAdminCompleteTask(t)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs disabled:opacity-50"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                      {completingTaskId === t.id ? 'Saving...' : 'Mark Complete'}
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              </>
              )}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

