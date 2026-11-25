import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { StudentDetail, Course } from '../../types';
import {
  Users,
  Search,
  UserPlus,
  Mail,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Eye,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  RotateCw,
  ArrowUpCircle,
  Compass,
  Upload,
  Copy,
  Check,
  Link as LinkIcon,
  Clock,
  Calendar,
} from 'lucide-react';

export const AdminStudentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentDetail[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addSuccessMsg, setAddSuccessMsg] = useState<string | null>(null);
  const [addErrorMsg, setAddErrorMsg] = useState<string | null>(null);
  const [newActivationLink, setNewActivationLink] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [tableCopiedId, setTableCopiedId] = useState<string | null>(null);
  const [courseGroup, setCourseGroup] = useState<'EduQuest' | 'MBA Wizards' | 'Aptech' | 'ALL'>('EduQuest');
  const [courseSearch, setCourseSearch] = useState('');

  // Form fields
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    aptech_student_id: '',
    course_id: '',
    access_type: 'FULL' as 'FULL' | 'TRIAL',
    payment_reference: '',
    notes: '',
    track_type: 'COURSE' as 'COURSE' | 'PROFILE_BUILDING' | 'BOTH',
    profile_timeline: '',
    profile_start_date: '',
    profile_end_date: '',
  });
  const [excelFile, setExcelFile] = useState<File | null>(null);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status_filter', statusFilter);
      const res = await api.get(`/admin/students?${params.toString()}`);
      setStudents(res.data.items);
    } catch (err) {
      console.error('Failed to load students', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await api.get('/courses');
      setCourses(res.data);
      if (res.data.length > 0 && !formData.course_id) {
        setFormData((prev) => ({ ...prev, course_id: res.data[0].id }));
      }
    } catch (err) {
      console.error('Failed to load courses', err);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchCourses();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStudents();
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setAddErrorMsg(null);
    setAddSuccessMsg(null);
    setNewActivationLink(null);

    try {
      const computedTimeline = formData.profile_timeline || (formData.profile_start_date && formData.profile_end_date ? `${formData.profile_start_date} to ${formData.profile_end_date}` : undefined);
      const payloadToSend = {
        ...formData,
        course_id: formData.track_type === 'PROFILE_BUILDING' ? undefined : formData.course_id,
        profile_timeline: computedTimeline,
        profile_start_date: formData.profile_start_date || undefined,
        profile_end_date: formData.profile_end_date || undefined,
      };
      const res = await api.post('/admin/students', payloadToSend);
      const studentId = res.data.student_id;
      const activationUrl =
        res.data.activation_url ||
        (res.data.invitation_token ? `${window.location.origin}/activate?token=${res.data.invitation_token}` : null);
      if (activationUrl) {
        setNewActivationLink(activationUrl);
      }

      let roadmapMsg = '';
      if (excelFile && studentId) {
        try {
          const uploadData = new FormData();
          uploadData.append('student_id', studentId);
          uploadData.append('replace_existing', 'true');
          uploadData.append('file', excelFile);
          const roadmapRes = await api.post('/profile-roadmap/upload-excel', uploadData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          roadmapMsg = ` • Profile Execution Plan (${roadmapRes.data.items.length} months) successfully imported!`;
        } catch (uploadErr: any) {
          roadmapMsg = ` • Warning: Could not parse Excel roadmap: ${uploadErr.response?.data?.detail || uploadErr.message}`;
        }
      }

      setAddSuccessMsg(
        `Student created successfully! Invitation dispatched.${roadmapMsg}`
      );
      fetchStudents();
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        aptech_student_id: '',
        course_id: courses[0]?.id || '',
        access_type: 'FULL',
        payment_reference: '',
        notes: '',
        track_type: 'COURSE',
        profile_timeline: '',
        profile_start_date: '',
        profile_end_date: '',
      });
      setExcelFile(null);
    } catch (err: any) {
      setAddErrorMsg(err.response?.data?.detail || 'Failed to create student.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleResendInvite = async (studentId: string, email: string) => {
    try {
      const res = await api.post(`/admin/students/${studentId}/invite`);
      const link =
        res.data.activation_url ||
        `${window.location.origin}/activate?token=${res.data.invitation_token}`;
      try {
        await navigator.clipboard.writeText(link);
      } catch (e) {}
      alert(
        `Invitation re-sent successfully to ${email}!\n\nActivation Link copied to clipboard:\n${link}\n\nYou can also share this link directly with the student via WhatsApp or SMS.`
      );
      fetchStudents();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to resend invite');
    }
  };

  const handleUpgradeTrialToFull = async (studentId: string, fullName: string) => {
    if (!window.confirm(`Upgrade "${fullName}" from 20% Free Trial to FULL (100%) Enrolled access?`)) return;
    try {
      const res = await api.patch(`/admin/students/${studentId}/upgrade-access`);
      alert(res.data.message || 'Student upgraded to FULL access!');
      fetchStudents();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to upgrade student access.');
    }
  };

  const handleToggleSuspend = async (studentId: string, currentSuspended: boolean) => {
    const confirmMsg = currentSuspended
      ? 'Reinstate this student account?'
      : 'Suspend this student? They will be blocked from logging into the portal.';
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.patch(`/admin/students/${studentId}/status`, {
        is_suspended: !currentSuspended,
      });
      fetchStudents();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update account status');
    }
  };

  const handleDeleteStudent = async (studentId: string, fullName: string, email: string) => {
    const confirmed = window.confirm(
      `Permanently delete student "${fullName}" (${email})?\n\nThis will permanently remove their account, enrollments, study plans, and completion records. This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const res = await api.delete(`/admin/students/${studentId}`);
      alert(res.data.message || 'Student deleted successfully.');
      fetchStudents();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete student.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Student Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Review admissions, assign official course tracks, and dispatch activation tokens.
          </p>
        </div>
        <button
          onClick={() => {
            setShowAddModal(true);
            setAddErrorMsg(null);
            setAddSuccessMsg(null);
          }}
          className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-lg text-white bg-brand-600 hover:bg-brand-700 shadow-sm transition-colors"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Add Student & Invite
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search by name, email, or Aptech ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </form>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-700 w-full md:w-auto"
          >
            <option value="">All Account Statuses</option>
            <option value="ACTIVE">Active & Enrolled</option>
            <option value="PENDING">Pending Activation</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
          <button
            onClick={fetchStudents}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
            title="Refresh"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Student</th>
                <th className="py-3.5 px-4">Aptech ID</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Enrollments</th>
                <th className="py-3.5 px-4">Active Plans</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading student records...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No student records match the criteria.
                  </td>
                </tr>
              ) : (
                students.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{st.full_name}</div>
                      <div className="text-[11px] text-slate-400 flex items-center space-x-1 mt-0.5">
                        <Mail className="w-3 h-3" />
                        <span>{st.email}</span>
                        {st.phone && (
                          <>
                            <span className="text-slate-300">•</span>
                            <Phone className="w-3 h-3" />
                            <span>{st.phone}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-700">{st.aptech_student_id}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {st.is_suspended ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Suspended
                          </span>
                        ) : !st.has_activated ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Invite Sent (Pending)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active &amp; Verified
                          </span>
                        )}
                        {st.has_trial_enrollment && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            TRIAL (20%)
                          </span>
                        )}
                        {st.track_type && st.track_type !== 'COURSE' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            {st.track_type === 'BOTH' ? 'Course + Profile' : 'Profile Track'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">{st.enrollments_count} Course(s)</td>
                    <td className="py-3.5 px-4 font-semibold text-brand-700">{st.active_plans_count} Active</td>
                    <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {st.has_trial_enrollment && (
                        <button
                          onClick={() => handleUpgradeTrialToFull(st.id, st.full_name)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs"
                          title="Upgrade from 20% Free Trial to Full 100% Enrolled Access"
                        >
                          <ArrowUpCircle className="w-3 h-3" />
                          Upgrade to Full
                        </button>
                      )}
                      {st.active_plan_id && (
                        <button
                          onClick={() => navigate(`/admin/study-plans?planId=${st.active_plan_id}`)}
                          className="p-1.5 text-amber-600 hover:text-amber-800 rounded-md hover:bg-amber-50"
                          title="Inspect Student Syllabus Checklist"
                        >
                          <Eye className="w-4 h-4 inline" />
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/admin/profile-roadmap?studentId=${st.id}`)}
                        className="p-1.5 text-amber-600 hover:text-amber-800 rounded-md hover:bg-amber-50"
                        title="Manage Profile Building Roadmap & MoM"
                      >
                        <Compass className="w-4 h-4 inline" />
                      </button>
                      {!st.has_activated && (
                        <button
                          onClick={() => {
                            const link =
                              st.activation_url ||
                              (st.invitation_token
                                ? `${window.location.origin}/activate?token=${st.invitation_token}`
                                : null);
                            if (link) {
                              navigator.clipboard.writeText(link);
                              setTableCopiedId(st.id);
                              setTimeout(() => setTableCopiedId(null), 3000);
                            } else {
                              handleResendInvite(st.id, st.email);
                            }
                          }}
                          className={`p-1.5 rounded-md transition-colors ${
                            tableCopiedId === st.id
                              ? 'text-emerald-700 bg-emerald-100'
                              : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                          }`}
                          title={tableCopiedId === st.id ? 'Copied to Clipboard!' : 'Copy Activation Link'}
                        >
                          {tableCopiedId === st.id ? (
                            <Check className="w-4 h-4 inline" />
                          ) : (
                            <Copy className="w-4 h-4 inline" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleResendInvite(st.id, st.email)}
                        className="p-1.5 text-slate-500 hover:text-brand-600 rounded-md hover:bg-slate-100"
                        title="Resend Activation Invite & Copy Link"
                      >
                        <Mail className="w-4 h-4 inline" />
                      </button>
                      <button
                        onClick={() => handleToggleSuspend(st.id, st.is_suspended)}
                        className={`p-1.5 rounded-md hover:bg-slate-100 ${
                          st.is_suspended ? 'text-emerald-600' : 'text-amber-600 hover:text-amber-700'
                        }`}
                        title={st.is_suspended ? 'Unsuspend Student' : 'Suspend Student'}
                      >
                        {st.is_suspended ? (
                          <ShieldCheck className="w-4 h-4 inline" />
                        ) : (
                          <ShieldAlert className="w-4 h-4 inline" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteStudent(st.id, st.full_name, st.email)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 rounded-md hover:bg-rose-50"
                        title="Permanently Delete Student"
                      >
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Add New Student & Assign Course</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addSuccessMsg && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>{addSuccessMsg}</span>
              </div>
            )}

            {newActivationLink && (
              <div className="mt-3 p-3.5 bg-brand-50 border border-brand-200 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-brand-900 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0" />
                  <span>Direct Student Activation Link</span>
                </div>
                <p className="text-[11px] text-brand-800 leading-relaxed">
                  Email invitation dispatched. You can also copy and share this link directly with the student via WhatsApp / SMS:
                </p>
                <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-brand-200">
                  <input
                    type="text"
                    readOnly
                    value={newActivationLink}
                    className="flex-1 text-[11px] text-slate-800 bg-transparent border-none outline-none font-mono select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(newActivationLink);
                      setCopiedToken(true);
                      setTimeout(() => setCopiedToken(false), 3000);
                    }}
                    className="px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors flex-shrink-0"
                  >
                    {copiedToken ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedToken ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>
            )}

            {addErrorMsg && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                <span>{addErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleAddStudent} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="e.g. Priya Sharma"
                  className="mt-1 w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="student@example.com"
                    className="mt-1 w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Aptech Student ID *</label>
                  <input
                    type="text"
                    required
                    value={formData.aptech_student_id}
                    onChange={(e) => setFormData({ ...formData, aptech_student_id: e.target.value })}
                    placeholder="APT-DEL-2026-0042"
                    className="mt-1 w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Phone Number (optional)</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="mt-1 w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Track Type *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, track_type: 'COURSE' })}
                    className={`py-2 px-2 rounded-lg text-xs font-bold border transition-colors ${
                      formData.track_type === 'COURSE'
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Course Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, track_type: 'PROFILE_BUILDING' })}
                    className={`py-2 px-2 rounded-lg text-xs font-bold border transition-colors ${
                      formData.track_type === 'PROFILE_BUILDING'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Profile Building
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, track_type: 'BOTH' })}
                    className={`py-2 px-2 rounded-lg text-xs font-bold border transition-colors ${
                      formData.track_type === 'BOTH'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Both Tracks
                  </button>
                </div>
              </div>

              {/* Profile Building Engagement Timeline */}
              {(formData.track_type === 'PROFILE_BUILDING' || formData.track_type === 'BOTH') && (
                <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/90 space-y-2.5">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Mentorship &amp; Profile Building Timeline *</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Start Month / Date
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. November 2026"
                        value={formData.profile_start_date}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((prev) => ({
                            ...prev,
                            profile_start_date: val,
                            profile_timeline: prev.profile_end_date ? `${val} to ${prev.profile_end_date}` : val
                          }));
                        }}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        End Month / Target Date
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. December 2027"
                        value={formData.profile_end_date}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((prev) => ({
                            ...prev,
                            profile_end_date: val,
                            profile_timeline: prev.profile_start_date ? `${prev.profile_start_date} to ${val}` : val
                          }));
                        }}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium text-slate-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Timeline Label (Shown to student on Dashboard)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. November 2026 to December 2027"
                      value={formData.profile_timeline}
                      onChange={(e) => setFormData({ ...formData, profile_timeline: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* Upload Profile Execution Plan (.xlsx) when Profile Building or Both is selected */}
              {(formData.track_type === 'PROFILE_BUILDING' || formData.track_type === 'BOTH') && (
                <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/90 space-y-2">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900">
                    <Compass className="w-4 h-4 text-amber-600" />
                    <span>Upload Profile Execution Plan (.xlsx) <span className="font-normal text-amber-700">(Optional)</span></span>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xlsm"
                    onChange={(e) => setExcelFile(e.target.files ? e.target.files[0] : null)}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-amber-200 rounded-lg file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200"
                  />
                  <p className="text-[11px] text-amber-800/80 leading-normal">
                    Optional: You can leave this empty. Dynamic proposals, discovery sessions, and interactive HTML roadmaps can be created directly from the Profile Building section after adding the student.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Access Level *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, access_type: 'FULL' })}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition-colors ${
                      formData.access_type === 'FULL'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    FULL (100% Enrolled)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, access_type: 'TRIAL' })}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition-colors ${
                      formData.access_type === 'TRIAL'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    TRIAL (20% Preview)
                  </button>
                </div>
              </div>

              {formData.track_type === 'PROFILE_BUILDING' ? (
                <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start space-x-2">
                  <Compass className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold">Profile Building Track:</span>
                    <p className="mt-0.5 text-slate-600">
                      This student will follow a dedicated 12-month mentorship execution plan. Academic course selection is not required and will be skipped.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Approved Course Catalogue * (Select Group &amp; Search)
                  </label>

                  {/* Group Tabs: EduQuest | MBA Wizards | Aptech | All */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(['EduQuest', 'MBA Wizards', 'Aptech', 'ALL'] as const).map((grp) => {
                      const count =
                        grp === 'ALL'
                          ? courses.length
                          : courses.filter((c) => (c.category || 'Aptech') === grp).length;
                      return (
                        <button
                          key={grp}
                          type="button"
                          onClick={() => setCourseGroup(grp)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                            courseGroup === grp
                              ? 'bg-slate-900 text-amber-300 border-slate-900'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {grp === 'ALL' ? 'All' : grp} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Search Courses */}
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      value={courseSearch}
                      onChange={(e) => setCourseSearch(e.target.value)}
                      placeholder={`Search in ${courseGroup === 'ALL' ? 'all courses' : courseGroup} (name or code)...`}
                      className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  {/* Scrollable Filtered Course Picker */}
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50">
                    {courses
                      .filter((c) => {
                        const cat = c.category || 'Aptech';
                        if (courseGroup !== 'ALL' && cat !== courseGroup) return false;
                        if (courseSearch.trim()) {
                          const q = courseSearch.toLowerCase();
                          return (
                            c.name.toLowerCase().includes(q) ||
                            c.course_code.toLowerCase().includes(q)
                          );
                        }
                        return true;
                      })
                      .map((c) => {
                        const selected = formData.course_id === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, course_id: c.id })}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 transition-colors ${
                              selected
                                ? 'bg-amber-100/90 text-slate-950 font-bold'
                                : 'hover:bg-white text-slate-700'
                            }`}
                          >
                            <div className="truncate">
                              <span className="font-mono text-[10px] font-bold text-slate-600 mr-1.5">
                                [{c.course_code}]
                              </span>
                              <span>{c.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 whitespace-nowrap flex-shrink-0">
                              {c.total_learning_hours} hrs
                            </span>
                          </button>
                        );
                      })}
                    {courses.filter((c) => {
                      const cat = c.category || 'Aptech';
                      if (courseGroup !== 'ALL' && cat !== courseGroup) return false;
                      if (courseSearch.trim()) {
                        const q = courseSearch.toLowerCase();
                        return (
                          c.name.toLowerCase().includes(q) ||
                          c.course_code.toLowerCase().includes(q)
                        );
                      }
                      return true;
                    }).length === 0 && (
                      <div className="p-3 text-center text-[11px] text-slate-500">
                        No matching courses in {courseGroup}.
                      </div>
                    )}
                  </div>

                  {formData.course_id && (
                    <div className="mt-1.5 text-[11px] text-emerald-700 font-semibold">
                      Selected:{' '}
                      {courses.find((c) => c.id === formData.course_id)?.course_code} —{' '}
                      {courses.find((c) => c.id === formData.course_id)?.name}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Payment Reference</label>
                  <input
                    type="text"
                    value={formData.payment_reference}
                    onChange={(e) => setFormData({ ...formData, payment_reference: e.target.value })}
                    placeholder="TXN-APTECH-88912"
                    className="mt-1 w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Administrative Notes</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Weekend batch, Offline payment verified"
                    className="mt-1 w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              {addErrorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-start justify-between gap-2">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                    <span>{addErrorMsg}</span>
                  </div>
                  {(addErrorMsg.toLowerCase().includes('token') || addErrorMsg.toLowerCase().includes('expired') || addErrorMsg.toLowerCase().includes('authenticated')) && (
                    <a
                      href="/login"
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold whitespace-nowrap text-[11px]"
                    >
                      Login Again
                    </a>
                  )}
                </div>
              )}

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {addLoading ? 'Creating & Sending Invite...' : 'Create & Issue Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

