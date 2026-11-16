import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Enrollment } from '../../types';
import {
  ClipboardList,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  RotateCw,
} from 'lucide-react';

export const AdminEnrollmentsPage: React.FC = () => {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchEnrollments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status_filter', statusFilter);
      const res = await api.get(`/enrollments?${params.toString()}`);
      setEnrollments(res.data);
    } catch (err) {
      console.error('Failed to load enrollments', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnrollments();
  }, [statusFilter]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    if (!window.confirm(`Change enrollment status to ${newStatus}?`)) return;
    try {
      await api.patch(`/enrollments/${id}/status`, { status: newStatus });
      fetchEnrollments();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update enrollment status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Enrollment Approvals</h1>
          <p className="text-xs text-slate-500 mt-1">
            Verify student admission payments and grant access to personalized course planners.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-700"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending Approval</option>
            <option value="ACTIVE">Active & Approved</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <button
            onClick={fetchEnrollments}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
            title="Refresh"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Student & ID</th>
                <th className="py-3.5 px-4">Course Track</th>
                <th className="py-3.5 px-4">Payment / Ref</th>
                <th className="py-3.5 px-4">Enrolled Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Approval Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading enrollments...
                  </td>
                </tr>
              ) : enrollments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No enrollments found for this filter.
                  </td>
                </tr>
              ) : (
                enrollments.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{e.student_name}</div>
                      <div className="text-[11px] text-brand-600 font-mono font-medium">{e.aptech_student_id}</div>
                      <div className="text-[10px] text-slate-400">{e.student_email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{e.course_name}</div>
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {e.course_code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      {e.payment_reference || <span className="text-slate-400 italic">None</span>}
                      {e.notes && <div className="text-[10px] text-slate-400 font-sans mt-0.5">{e.notes}</div>}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{e.enrolled_date}</td>
                    <td className="py-3.5 px-4">
                      {e.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active & Approved
                        </span>
                      ) : e.status === 'PENDING' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          Pending Verification
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {e.status}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      {e.status === 'PENDING' ? (
                        <button
                          onClick={() => handleUpdateStatus(e.id, 'ACTIVE')}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                        >
                          Approve Enrollment
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus(e.id, e.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}
                          className="px-2.5 py-1 text-xs font-semibold rounded border border-slate-300 hover:bg-slate-50 text-slate-700"
                        >
                          {e.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

