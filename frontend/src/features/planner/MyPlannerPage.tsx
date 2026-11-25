import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useStudyTimer } from '../../context/StudyTimerContext';
import { StudyPlan, StudyTask, StudyPlanVersionSnapshot } from '../../types';
import {
  Compass,
  RotateCw,
  Calendar,
  CheckCircle2,
  Clock,
  Flag,
  Sliders,
  X,
  Check,
  Play,
  FileSpreadsheet,
  Search,
  AlertTriangle,
  ShieldCheck,
  Hourglass,
  Sparkles,
  Lock,
  CheckSquare,
  Square,
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

export const MyPlannerPage: React.FC = () => {
  const navigate = useNavigate();
  const { startTimer, lastSavedAt, triggerDataRefresh } = useStudyTimer();

  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

  // Filters & search
  const [statusTab, setStatusTab] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllTasks, setShowAllTasks] = useState(false);

  // Edit Days / Hours / Target Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustDays, setAdjustDays] = useState<string[]>(['MON', 'TUE', 'WED', 'THU', 'FRI']);
  const [adjustHours, setAdjustHours] = useState<number>(2.0);
  const [adjustTargetDate, setAdjustTargetDate] = useState<string>('');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [cancelEditLoading, setCancelEditLoading] = useState(false);

  // Old Plans / Version History Modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<StudyPlanVersionSnapshot[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  const fetchPlan = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const res = await api.get<StudyPlan | null>('/plans/current');
      if (res.data && res.data.id) {
        setPlan(res.data);

        const detailRes = await api.get(`/plans/${res.data.id}`);
        setTasks(detailRes.data.tasks || []);

        if (res.data.available_days && res.data.available_days.length > 0) {
          setAdjustDays(res.data.available_days);
        }
        if (res.data.daily_study_hours) {
          setAdjustHours(res.data.daily_study_hours);
        }
        if (res.data.target_completion_date) {
          setAdjustTargetDate(res.data.target_completion_date);
        }
      } else {
        setPlan(null);
        setTasks([]);
      }
    } catch {
      setPlan(null);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlan(true);
  }, [fetchPlan]);

  useEffect(() => {
    if (lastSavedAt > 0) {
      fetchPlan(false);
    }
  }, [lastSavedAt, fetchPlan]);

  const toggleAdjustDay = (code: string) => {
    if (adjustDays.includes(code)) {
      if (adjustDays.length === 1) return;
      setAdjustDays(adjustDays.filter((d) => d !== code));
    } else {
      setAdjustDays([...adjustDays, code]);
    }
  };

  const applyMonthsPresetToModal = (months: number) => {
    const d = new Date();
    d.setDate(d.getDate() + months * 30);
    setAdjustTargetDate(d.toISOString().split('T')[0]);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan || adjustDays.length === 0) return;
    setAdjustLoading(true);
    try {
      const res = await api.patch(`/plans/${plan.id}/adjust`, {
        available_days: adjustDays,
        daily_study_hours: adjustHours,
        target_completion_date: adjustTargetDate || undefined,
      });
      alert(res.data.message || 'Your edit request has been submitted!');
      setShowAdjustModal(false);
      await fetchPlan(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update schedule.');
    } finally {
      setAdjustLoading(false);
    }
  };

  const handleCancelPendingEdit = async () => {
    if (!plan) return;
    if (!window.confirm('Cancel your pending edit request? Your current approved plan will continue unchanged.')) return;
    setCancelEditLoading(true);
    try {
      const res = await api.delete(`/plans/${plan.id}/pending-edit`);
      alert(res.data.message || 'Pending edit cancelled.');
      await fetchPlan(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to cancel pending edit.');
    } finally {
      setCancelEditLoading(false);
    }
  };

  const openHistoryModal = async () => {
    if (!plan) return;
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const res = await api.get<StudyPlanVersionSnapshot[]>(`/plans/${plan.id}/history`);
      setHistoryItems(res.data);
      if (res.data.length > 0) {
        setExpandedHistoryId(res.data[0].id);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Could not load old plans history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!plan) return;
    if (
      !window.confirm(
        'Move missed/overdue tasks to your next open study dates? Your completed tasks will stay safe.'
      )
    ) {
      return;
    }
    setRescheduleLoading(true);
    try {
      const res = await api.post(`/plans/${plan.id}/reschedule`);
      alert(res.data.message || 'Missed tasks moved to upcoming study days!');
      await fetchPlan(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Could not reschedule missed tasks.');
    } finally {
      setRescheduleLoading(false);
    }
  };

  const handleDownloadScheduleCsv = async () => {
    if (!plan) return;
    setExportLoading(true);
    try {
      const res = await api.get(`/plans/${plan.id}/export`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${plan.course_code}_Study_Schedule.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to download schedule file.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleMarkTaskComplete = async (task: StudyTask) => {
    if (task.status === 'COMPLETED') {
      return; // Permanently locked once completed
    }
    const ok = window.confirm(
      `Mark "${task.title}" as Completed?\n\nOnce ticked, this topic is permanently locked for Teacher & Parent verification and cannot be unchecked.`
    );
    if (!ok) return;

    setCompletingTaskId(task.id);
    try {
      await api.patch(`/tasks/${task.id}/status`, { status: 'COMPLETED' });
      triggerDataRefresh();
      await fetchPlan(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to mark topic complete.');
    } finally {
      setCompletingTaskId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-amber-200 shadow-sm max-w-lg mx-auto space-y-4">
        <Compass className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-extrabold text-slate-900">No Study Plan Yet</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          Pick how many months you need (for example 2, 3, or 4 months) and which days you want to study. Your schedule will be created and sent to Admin for quick approval!
        </p>
        <button
          type="button"
          onClick={() => navigate('/planner/onboarding')}
          className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl text-xs font-extrabold shadow-sm"
        >
          Create My Study Plan (3 Easy Steps)
        </button>
      </div>
    );
  }

  const filteredTasks = tasks.filter((t) => {
    if (statusTab === 'PENDING' && t.status === 'COMPLETED') return false;
    if (statusTab === 'COMPLETED' && t.status !== 'COMPLETED') return false;
    if (statusTab === 'MISSED' && t.status !== 'MISSED') return false;
    if (typeFilter && t.task_type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDate = (t.scheduled_date || '').includes(q);
      if (!matchTitle && !matchDate) return false;
    }
    return true;
  });

  const visibleTasks = showAllTasks ? filteredTasks : filteredTasks.slice(0, 30);
  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;
  const pendingCount = tasks.length - completedCount;
  const missedCount = tasks.filter((t) => t.status === 'MISSED').length;
  const isTrialPlan = plan.access_type === 'TRIAL';
  const unlockedCount = plan.unlocked_tasks_count ?? tasks.length;

  return (
    <div className="space-y-6">
      {/* 0. Free Trial (20% Access) Banner */}
      {isTrialPlan && (
        <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <Lock className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-extrabold flex items-center gap-2">
                <span>Free Trial Preview — 20% Classes Unlocked ({unlockedCount} of {tasks.length})</span>
              </div>
              <p className="text-xs text-indigo-100 mt-0.5">
                You are previewing the first 20% of your study schedule. Remaining 80% classes, Excel/CSV export, and Invoice PDF are locked until full enrollment.
              </p>
            </div>
          </div>
          <span className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-amber-400 text-slate-950 self-start sm:self-center whitespace-nowrap shadow-sm">
            Enroll for 100% Access
          </span>
        </div>
      )}

      {/* 1. Admin Approval Status Banner */}
      {plan.approval_status === 'PENDING_APPROVAL' && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/30 text-amber-800 flex items-center justify-center flex-shrink-0">
              <Hourglass className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-extrabold text-amber-950">
                Waiting for Admin / Teacher Approval
              </div>
              <p className="text-xs text-amber-900 mt-0.5">
                Your {plan.course_code} plan has been sent to the Admin. They will check if the timing is feasible and approve your classes soon.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-amber-200 text-amber-950 self-start sm:self-center whitespace-nowrap">
            Pending Review
          </span>
        </div>
      )}

      {plan.approval_status === 'APPROVED' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs font-extrabold text-emerald-900">
                Approved by Admin — Your Class &amp; Study Schedule is Active!
              </div>
              {plan.admin_review_note && (
                <p className="text-xs text-emerald-800 mt-0.5">
                  <strong>Admin Note:</strong> {plan.admin_review_note}
                </p>
              )}
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-200/80 text-emerald-900 self-start sm:self-center">
            Approved ✓
          </span>
        </div>
      )}

      {plan.approval_status === 'CHANGES_REQUESTED' && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs sm:text-sm font-extrabold text-rose-900">
                Admin Requested Changes to Your Schedule
              </div>
              <p className="text-xs text-rose-800 mt-0.5">
                <strong>Admin Feedback:</strong>{' '}
                {plan.admin_review_note || 'Please adjust your study days, daily hours, or target completion date and re-submit.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAdjustModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-sm self-start sm:self-center whitespace-nowrap"
          >
            Fix &amp; Re-Send to Admin
          </button>
        </div>
      )}

      {/* Pending Plan Edit Banner (when approved plan has an edit awaiting Admin approval) */}
      {plan.has_pending_edit && plan.pending_edit_data && (
        <div
          className={`rounded-2xl p-4 sm:p-5 border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            plan.pending_edit_data.edit_status === 'CHANGES_REQUESTED'
              ? 'bg-rose-50 border-rose-300'
              : 'bg-sky-50 border-sky-300'
          }`}
        >
          <div className="flex items-start space-x-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                plan.pending_edit_data.edit_status === 'CHANGES_REQUESTED'
                  ? 'bg-rose-200 text-rose-800'
                  : 'bg-sky-200 text-sky-800'
              }`}
            >
              <Hourglass className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-extrabold text-slate-900">
                {plan.pending_edit_data.edit_status === 'CHANGES_REQUESTED'
                  ? 'Admin Requested Changes to Your Edit Request'
                  : 'Plan Edit Sent to Admin for Approval'}
              </div>
              <p className="text-xs text-slate-700 mt-0.5">
                Requested: <strong>{plan.pending_edit_data.available_days.join(', ')}</strong> •{' '}
                <strong>{plan.pending_edit_data.daily_study_hours} hrs/day</strong> • Target{' '}
                <strong>{plan.pending_edit_data.target_completion_date || plan.target_completion_date}</strong> • Only{' '}
                <strong>
                  {plan.pending_edit_data.remaining_tasks_count} not-completed topics ({plan.pending_edit_data.remaining_hours} hrs)
                </strong>{' '}
                will change. Your current approved plan stays active until Admin approves!
              </p>
              {plan.pending_edit_data.admin_feedback && (
                <p className="text-xs text-rose-800 mt-1 font-semibold">
                  Admin Feedback: {plan.pending_edit_data.admin_feedback}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowAdjustModal(true)}
              className="px-3 py-1.5 rounded-xl text-[11px] font-extrabold bg-slate-900 text-amber-300 hover:bg-slate-800"
            >
              Update Request
            </button>
            <button
              type="button"
              onClick={handleCancelPendingEdit}
              disabled={cancelEditLoading}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {cancelEditLoading ? 'Cancelling...' : 'Cancel Edit'}
            </button>
          </div>
        </div>
      )}

      {/* 2. Top Summary Card & Action Buttons */}
      <div className="bg-white rounded-3xl p-6 border border-amber-200/70 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-md border border-amber-300">
                {plan.course_code}
              </span>
              <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                Version v{plan.version_number || 1}
              </span>
              <span className="text-xs text-slate-500 font-medium">Syllabus {plan.syllabus_version}</span>
              {plan.feasibility && (
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    plan.feasibility.is_feasible
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {plan.feasibility.is_feasible
                    ? `Feasible Pace (${plan.feasibility.capacity_ratio}x)`
                    : 'Tight Pace — Needs More Hours/Days'}
                </span>
              )}
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 mt-2 tracking-tight">{plan.title}</h1>
          </div>

          {/* Easy-to-Understand Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdjustModal(true)}
              className="inline-flex items-center px-3.5 py-2 text-xs font-extrabold rounded-xl text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-sm"
            >
              <Sliders className="w-3.5 h-3.5 mr-1.5" />
              Edit Days / Hours
            </button>

            <button
              type="button"
              onClick={handleReschedule}
              disabled={rescheduleLoading}
              className="inline-flex items-center px-3.5 py-2 text-xs font-bold rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${rescheduleLoading ? 'animate-spin' : ''}`} />
              {rescheduleLoading ? 'Moving...' : 'Move Missed Tasks'}
            </button>

            {isTrialPlan ? (
              <div
                className="relative inline-flex items-center px-3.5 py-2 text-xs font-bold rounded-xl text-slate-500 bg-slate-100 border border-slate-200 cursor-not-allowed select-none overflow-hidden"
                title="Schedule download is locked for Free Trial accounts. Enroll to unlock."
              >
                <span className="inline-flex items-center blur-[1.5px] opacity-60">
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
                  Download Excel / CSV
                </span>
                <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 text-[10px] font-extrabold">
                  <Lock className="w-2.5 h-2.5" />
                  Locked
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDownloadScheduleCsv}
                disabled={exportLoading}
                className="inline-flex items-center px-3.5 py-2 text-xs font-bold rounded-xl text-amber-900 bg-amber-50 border border-amber-300 hover:bg-amber-100 disabled:opacity-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-amber-700" />
                {exportLoading ? 'Exporting...' : 'Download Excel / CSV'}
              </button>
            )}

            <button
              type="button"
              onClick={openHistoryModal}
              className="inline-flex items-center px-3 py-2 text-xs font-bold rounded-xl text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200"
            >
              <History className="w-3.5 h-3.5 mr-1 text-slate-600" />
              Old Plans{(plan.versions_count || 0) > 0 ? ` (${plan.versions_count})` : ''}
            </button>

            <button
              type="button"
              onClick={() => navigate('/planner/onboarding')}
              className="inline-flex items-center px-3 py-2 text-xs font-bold rounded-xl text-slate-700 hover:bg-slate-100 border border-slate-200"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-600" />
              New Plan
            </button>
          </div>
        </div>

        {/* Simple Info Strip: Plain Language Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Timeline</span>
            <div className="font-bold text-slate-900 mt-0.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              {plan.start_date} → {plan.target_completion_date}
            </div>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Your Study Days</span>
            <div className="font-bold text-slate-900 mt-0.5">
              {(plan.available_days && plan.available_days.length > 0
                ? plan.available_days.join(', ')
                : 'Mon - Sat')}
            </div>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Daily Study Speed</span>
            <div className="font-bold text-amber-700 mt-0.5 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {plan.daily_study_hours || 2} hrs/day ({plan.total_scheduled_hours} hrs total)
            </div>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Topics Progress</span>
            <div className="font-bold text-emerald-700 mt-0.5">
              {completedCount} of {tasks.length} Done ({pendingCount} Left)
            </div>
          </div>
        </div>
      </div>

      {/* 3. Milestones Roadmap */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
        <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-4 flex items-center">
          <Flag className="w-4 h-4 text-amber-600 mr-2" />
          Step-by-Step Section Goals (Milestones)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {plan.milestones.map((m, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 hover:border-amber-300 transition-all"
            >
              <div className="text-[10px] font-mono font-bold text-amber-700 uppercase">Week {m.target_week}</div>
              <div className="text-xs font-bold text-slate-900 mt-1 line-clamp-2">{m.title}</div>
              <div className="text-[11px] text-slate-500 mt-2 flex items-center justify-between">
                <span>By {m.target_date}</span>
                {m.is_completed ? (
                  <span className="text-emerald-600 font-bold flex items-center text-[10px]">
                    <CheckCircle2 className="w-3 h-3 mr-0.5" /> Done
                  </span>
                ) : (
                  <span className="text-slate-400 text-[10px]">Target</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Full Day-by-Day Interactive Syllabus Checklist */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="bg-slate-900 text-white rounded-2xl p-4 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-extrabold text-amber-300 uppercase tracking-wider">
              <Lock className="w-3.5 h-3.5" />
              Verified Class &amp; Topic Checklist
            </div>
            <p className="text-[11px] text-slate-300">
              Tick each topic once taught in class. Completed ticks are <strong className="text-amber-200">permanently locked</strong> and visible to your Teacher/Admin &amp; Parents.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <div className="text-sm font-black text-amber-300">
                {completedCount} / {tasks.length} Topics
              </div>
              <div className="text-[10px] text-slate-400">
                {tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0}% Syllabus Covered
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Your Day-by-Day Study Schedule ({filteredTasks.length} Classes / Tasks)
            </h2>
            <p className="text-xs text-slate-500">
              Tick the checklist box when you finish a topic, or click <strong>Timer</strong> to study live.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Status Pills */}
            <div className="flex bg-amber-50 p-1 rounded-xl border border-amber-200/70 text-xs">
              {[
                { key: 'ALL', label: `All (${tasks.length})` },
                { key: 'PENDING', label: `To Do (${pendingCount})` },
                { key: 'COMPLETED', label: `Done (${completedCount})` },
                ...(missedCount > 0 ? [{ key: 'MISSED', label: `Missed (${missedCount})` }] : []),
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusTab(tab.key)}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    statusTab === tab.key
                      ? 'bg-slate-900 text-amber-300 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search topic or date..."
                className="text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-xl px-2.5 py-1.5 bg-white text-slate-700 font-medium"
            >
              <option value="">All Types</option>
              <option value="TOPIC">Topic Study</option>
              <option value="PRACTICE">Practice / Lab</option>
              <option value="REVISION">Revision</option>
              <option value="PROJECT">Project</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 text-center">Tick</th>
                <th className="py-3 px-4">Study Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">What to Study</th>
                <th className="py-3 px-4">Time Needed</th>
                <th className="py-3 px-4">Logged</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleTasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No tasks match your filter.
                  </td>
                </tr>
              ) : (
                visibleTasks.map((t) => {
                  const isDone = t.status === 'COMPLETED';
                  const isLocked = Boolean(t.is_locked);
                  if (isLocked) {
                    return (
                      <tr key={t.id} className="bg-slate-50/90 select-none">
                        <td className="py-3 px-3 text-center">
                          <span
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-200 text-slate-500"
                            title="Enroll to unlock"
                          >
                            <Lock className="w-3.5 h-3.5" />
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-400 whitespace-nowrap blur-[2px]">
                          {t.scheduled_date}
                        </td>
                        <td className="py-3 px-4 blur-[2px]">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-500 font-bold">
                            {t.task_type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-400 blur-[3px] pointer-events-none">
                            Protected Class Topic Content — Enroll to View
                          </div>
                          <div className="text-[11px] font-bold text-indigo-700 mt-0.5 flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            Enroll to unlock remaining 80% classes
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap blur-[2px]">{t.estimated_duration_hours} hrs</td>
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap blur-[2px]">0 hrs</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                            <Lock className="w-2.5 h-2.5" />
                            Trial Locked
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            <Lock className="w-3 h-3 mr-1" />
                            Enroll to Unlock
                          </span>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={t.id} className={isDone ? 'bg-emerald-50/40' : 'hover:bg-amber-50/30'}>
                      <td className="py-3 px-3 text-center">
                        {isDone ? (
                          <span
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-300"
                            title="Completed & Permanently Locked"
                          >
                            <CheckSquare className="w-4 h-4" />
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleMarkTaskComplete(t)}
                            disabled={completingTaskId === t.id}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-slate-300 text-slate-400 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Tick to mark topic permanently complete"
                          >
                            <Square className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">
                        {t.scheduled_date}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                          {t.task_type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className={`font-bold ${isDone ? 'text-emerald-900' : 'text-slate-900'}`}>
                          {t.title}
                        </div>
                        {isDone && t.completed_at ? (
                          <div className="text-[10px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            Verified complete on {new Date(t.completed_at).toLocaleString()}
                          </div>
                        ) : t.description ? (
                          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{t.description}</div>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{t.estimated_duration_hours} hrs</td>
                      <td className="py-3 px-4 font-bold text-amber-700 whitespace-nowrap">{t.actual_duration_hours} hrs</td>
                      <td className="py-3 px-4">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <Lock className="w-2.5 h-2.5" />
                            Completed (Locked)
                          </span>
                        ) : t.status === 'MISSED' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            Missed
                          </span>
                        ) : t.status === 'RESCHEDULED' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">
                            Moved
                          </span>
                        ) : t.status === 'IN_PROGRESS' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                            Studying
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {isDone ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Lock className="w-3 h-3 mr-1" />
                            Verified
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                startTimer({
                                  id: t.id,
                                  title: t.title,
                                  task_type: t.task_type,
                                  estimated_duration_hours: t.estimated_duration_hours,
                                })
                              }
                              className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-amber-300"
                            >
                              <Play className="w-3 h-3 mr-1" />
                              Timer
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMarkTaskComplete(t)}
                              disabled={completingTaskId === t.id}
                              className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              <Check className="w-3 h-3 mr-1" />
                              {completingTaskId === t.id ? '...' : 'Complete'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredTasks.length > 30 && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setShowAllTasks(!showAllTasks)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200"
            >
              {showAllTasks
                ? 'Show First 30 Tasks'
                : `Show All ${filteredTasks.length} Scheduled Tasks`}
            </button>
          </div>
        )}
      </div>

      {/* Adjust Days / Hours / Target Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-amber-200 overflow-hidden">
            <div className="flex items-center justify-between p-5 bg-slate-900 text-white border-b-2 border-amber-400">
              <div className="flex items-center space-x-2.5">
                <Sliders className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="text-sm font-extrabold text-amber-300">Change Study Days, Hours or Months</h3>
                  <p className="text-[11px] text-slate-300">
                    {plan.approval_status === 'APPROVED'
                      ? 'Changes go to Admin for approval. Completed topics stay locked.'
                      : 'Completed topics will stay safe.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-950">
                <strong>Only Not-Completed Topics Change:</strong> {completedCount} completed topic
                {completedCount === 1 ? '' : 's'} will stay untouched. Only the remaining{' '}
                <strong>{pendingCount} uncompleted topics</strong> will be distributed across your new days and hours.
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Quick Target Duration (or pick exact date below)
                </label>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[2, 3, 4, 6].map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => applyMonthsPresetToModal(m)}
                      className="py-1.5 rounded-lg text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200"
                    >
                      {m} Months
                    </button>
                  ))}
                </div>
                <input
                  type="date"
                  value={adjustTargetDate}
                  onChange={(e) => setAdjustTargetDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Select Study Days
                </label>
                <div className="grid grid-cols-7 gap-1.5">
                  {ALL_DAYS.map((d) => {
                    const isSelected = adjustDays.includes(d.code);
                    return (
                      <button
                        type="button"
                        key={d.code}
                        onClick={() => toggleAdjustDay(d.code)}
                        className={`py-2 text-xs font-bold rounded-xl border transition-all text-center ${
                          isSelected
                            ? 'bg-slate-900 text-amber-300 border-amber-400 shadow-xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Max Hours Per Study Day: <span className="text-amber-700 font-black">{adjustHours} hrs/day</span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="8"
                  step="0.5"
                  value={adjustHours}
                  onChange={(e) => setAdjustHours(parseFloat(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Remaining uncompleted hours spread evenly up to your target date. Large topics (e.g. 4 hrs) split automatically across multiple days.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustLoading}
                  className="px-4 py-2 text-xs font-extrabold rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-sm disabled:opacity-50"
                >
                  {adjustLoading
                    ? 'Sending...'
                    : plan.approval_status === 'APPROVED'
                    ? 'Send Edit to Admin for Approval'
                    : 'Save & Send for Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Old Plans / Version History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col border border-amber-200 overflow-hidden">
            <div className="flex items-center justify-between p-5 bg-slate-900 text-white border-b-2 border-amber-400">
              <div className="flex items-center space-x-2.5">
                <History className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="text-sm font-extrabold text-amber-300">Old Plans &amp; Saved History</h3>
                  <p className="text-[11px] text-slate-300">
                    Read-only record of your previous plans before edits or replacements.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {historyLoading ? (
                <div className="py-12 text-center text-xs text-slate-500">Loading saved plan history...</div>
              ) : historyItems.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-200">
                  <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-800">No old plans saved yet</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Whenever Admin approves an edited plan or you generate a new plan, your previous plan is automatically saved here for future reference.
                  </p>
                </div>
              ) : (
                historyItems.map((item) => {
                  const isExpanded = expandedHistoryId === item.id;
                  return (
                    <div key={item.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                      <button
                        type="button"
                        onClick={() => setExpandedHistoryId(isExpanded ? null : item.id)}
                        className="w-full p-4 bg-slate-50 hover:bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left transition-colors"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-900 text-amber-300">
                              {item.source_type === 'ARCHIVED_PLAN' ? 'Previous Plan' : `Old Version v${item.version_number}`}
                            </span>
                            <span className="text-xs font-extrabold text-slate-900">{item.title}</span>
                          </div>
                          <div className="text-[11px] text-slate-600 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                            <span>Timeline: {item.start_date} → {item.target_completion_date}</span>
                            <span>Pace: {item.daily_study_hours} hrs/day ({item.available_days.join(', ')})</span>
                            <span>Completed: {item.completed_tasks}/{item.total_tasks} topics</span>
                          </div>
                          {item.archived_reason && (
                            <div className="text-[11px] text-amber-800 mt-1 font-medium">{item.archived_reason}</div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-xs font-bold text-slate-600 self-end sm:self-center">
                          <span>Saved {new Date(item.created_at).toLocaleDateString()}</span>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-4 border-t border-slate-200 overflow-x-auto max-h-72 overflow-y-auto">
                          <table className="w-full text-left text-[11px] border-collapse">
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
                                  <td className="py-1.5 pr-3 font-mono text-slate-700 whitespace-nowrap">{st.scheduled_date}</td>
                                  <td className="py-1.5 pr-3 text-slate-900 font-medium">{st.title}</td>
                                  <td className="py-1.5 pr-3 text-slate-600">{st.estimated_duration_hours}h</td>
                                  <td className="py-1.5">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        st.status === 'COMPLETED'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-slate-100 text-slate-600'
                                      }`}
                                    >
                                      {st.status}
                                    </span>
                                  </td>
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

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-amber-300 hover:bg-slate-800"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
