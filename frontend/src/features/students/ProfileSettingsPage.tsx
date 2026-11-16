import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { User, ShieldCheck, Lock, CheckCircle2, AlertCircle } from 'lucide-react';

export const ProfileSettingsPage: React.FC = () => {
  const { user, refreshUser } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (password.length < 8) {
      setMsg({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }

    if (password !== confirmPassword) {
      setMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setLoading(true);
    try {
      // User can reset password
      await api.post('/auth/forgot-password', { email: user?.email });
      setMsg({
        type: 'success',
        text: 'A secure single-use password update link has been dispatched to your email address.',
      });
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to initiate password update.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Profile & Credentials</h1>
        <p className="text-xs text-slate-500 mt-1">
          Review your official Aptech student identity record and account credentials.
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-600 text-white flex items-center justify-center font-bold text-xl shadow-md">
            {user?.full_name?.charAt(0) || 'S'}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{user?.full_name}</h2>
            <div className="text-xs font-mono font-semibold text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full inline-block mt-1 border border-brand-200">
              {user?.aptech_student_id || 'ID Pending'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-100 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Email Address</span>
            <div className="font-semibold text-slate-800 mt-0.5">{user?.email}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Account Role</span>
            <div className="font-semibold text-slate-800 mt-0.5">{user?.role}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Enrollment Status</span>
            <div className="font-semibold text-emerald-700 mt-0.5 flex items-center">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              Verified & Active
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Access Permission</span>
            <div className="font-semibold text-slate-800 mt-0.5">Approved Catalogue Only</div>
          </div>
        </div>
      </div>

      {/* Security Update Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center space-x-2">
          <Lock className="w-4 h-4 text-brand-600" />
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Account Password Management</h2>
        </div>
        <p className="text-xs text-slate-500">
          Passwords are cryptographically secured using Argon2id with memory-hard cost parameters.
        </p>

        {msg && (
          <div
            className={`p-3 text-xs rounded-xl flex items-start space-x-2 ${
              msg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {msg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <p className="text-xs text-slate-600">
            Clicking below will dispatch a verified single-use password update link to your registered email (<strong>{user?.email}</strong>).
          </p>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm disabled:opacity-50"
          >
            {loading ? 'Dispatching Link...' : 'Send Password Reset Link'}
          </button>
        </form>
      </div>
    </div>
  );
};

