import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AdminUser } from '../../types';
import {
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  Trash2,
  Crown,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  Eye,
  EyeOff,
  RefreshCw,
  Sparkles,
  Lock,
  Mail,
  User,
  Power
} from 'lucide-react';

export const AdminManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add Admin Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Status toggle state
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const isCurrentUserSuperAdmin =
    currentUser?.role === 'SUPER_ADMIN' ||
    currentUser?.email?.toLowerCase() === 'ankitk629990@gmail.com';

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<AdminUser[]>('/admin/admins');
      setAdmins(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load administrator accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isCurrentUserSuperAdmin) {
      fetchAdmins();
    } else {
      setLoading(false);
    }
  }, [isCurrentUserSuperAdmin]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!addName.trim()) {
      setAddError('Full name is required.');
      return;
    }
    if (!addEmail.trim() || !addEmail.includes('@')) {
      setAddError('A valid email address is required.');
      return;
    }
    if (addPassword.length < 6) {
      setAddError('Password must be at least 6 characters.');
      return;
    }

    try {
      setAddLoading(true);
      const res = await api.post('/admin/admins', {
        full_name: addName.trim(),
        email: addEmail.trim().toLowerCase(),
        password: addPassword
      });

      setSuccess(`Administrator account for '${res.data.full_name}' created successfully.`);
      setShowAddModal(false);
      setAddName('');
      setAddEmail('');
      setAddPassword('');
      fetchAdmins();
    } catch (err: any) {
      setAddError(err?.response?.data?.detail || 'Failed to create administrator account.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!deleteTarget) return;

    try {
      setDeleteLoading(true);
      setError(null);
      await api.delete(`/admin/admins/${deleteTarget.id}`);
      setSuccess(`Administrator '${deleteTarget.full_name}' was removed successfully.`);
      setDeleteTarget(null);
      fetchAdmins();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to delete administrator.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleToggleStatus = async (admin: AdminUser) => {
    if (!isCurrentUserSuperAdmin) {
      setError('Only Super Administrator has authority to change account status.');
      return;
    }
    if (admin.role === 'SUPER_ADMIN' || admin.email.toLowerCase() === 'ankitk629990@gmail.com') {
      setError('Super Administrator cannot be suspended or deactivated.');
      return;
    }

    try {
      setStatusUpdatingId(admin.id);
      setError(null);
      const newSuspendedState = !admin.is_suspended;
      await api.patch(`/admin/admins/${admin.id}/status`, {
        is_suspended: newSuspendedState,
        is_active: !newSuspendedState
      });
      setSuccess(`Administrator '${admin.full_name}' status updated to ${newSuspendedState ? 'Suspended' : 'Active'}.`);
      fetchAdmins();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to update administrator status.');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const filteredAdmins = admins.filter((a) => {
    const q = searchQuery.toLowerCase();
    return (
      a.full_name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q)
    );
  });

  const superAdminCount = admins.filter(
    (a) => a.role === 'SUPER_ADMIN' || a.email.toLowerCase() === 'ankitk629990@gmail.com'
  ).length;

  const activeAdminCount = admins.filter(
    (a) => a.is_active && !a.is_suspended
  ).length;

  if (!isCurrentUserSuperAdmin) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <div className="w-16 h-16 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Access Restricted</h2>
        <p className="text-slate-600 max-w-md mx-auto mb-6 text-sm">
          Only the Super Administrator has authority to view, create, or manage administrator and faculty accounts.
        </p>
        <button
          onClick={() => navigate('/admin')}
          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition-all shadow-md"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20">
            <Crown className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Administrator Management</h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                Super Admin Control
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Manage faculty administrators, oversee staff privileges, and control platform access.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchAdmins()}
            disabled={loading}
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm rounded-xl shadow-md shadow-amber-500/20 transition-all hover:scale-[1.01]"
          >
            <UserPlus className="w-4 h-4 text-slate-950" />
            <span>Add Administrator</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between text-sm shadow-sm animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center justify-between text-sm shadow-sm animate-in fade-in">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{admins.length}</div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Admins</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center">
            <Crown className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{superAdminCount}</div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Super Admin (Master)</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{activeAdminCount}</div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Active Staff</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search administrators by name or email..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
          />
        </div>
        <div className="text-xs font-semibold text-slate-500">
          Showing <span className="font-bold text-slate-900">{filteredAdmins.length}</span> of {admins.length}
        </div>
      </div>

      {/* Administrators Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm text-slate-500 font-medium">Loading administrators...</p>
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div className="py-16 text-center">
            <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Administrators Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery ? 'No administrators match your search query.' : 'Click "Add Administrator" above to create an account.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-bold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Administrator</th>
                  <th className="px-6 py-4">Role & Privilege</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Created Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAdmins.map((adm) => {
                  const isSuper =
                    adm.role === 'SUPER_ADMIN' ||
                    adm.email.toLowerCase() === 'ankitk629990@gmail.com';
                  const isSelf = adm.id === currentUser?.id;

                  return (
                    <tr key={adm.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-sm ${
                              isSuper
                                ? 'bg-gradient-to-tr from-amber-400 to-amber-200 text-slate-950 border border-amber-400'
                                : 'bg-slate-800 text-white'
                            }`}
                          >
                            {adm.full_name?.charAt(0) || 'A'}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900">{adm.full_name}</span>
                              {isSelf && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                                  You
                                </span>
                              )}
                              {isSuper && (
                                <Crown className="w-4 h-4 text-amber-500 fill-amber-400" />
                              )}
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">{adm.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {isSuper ? (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-500/20 to-amber-300/30 text-amber-900 border border-amber-400/60 shadow-sm">
                            <Crown className="w-3.5 h-3.5 text-amber-600" />
                            <span>SUPER ADMIN</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                            <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                            <span>Administrator</span>
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {isSuper ? (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Permanent Active</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(adm)}
                            disabled={!isCurrentUserSuperAdmin || statusUpdatingId === adm.id}
                            className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                              adm.is_suspended
                                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            } ${!isCurrentUserSuperAdmin ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                            title={
                              isCurrentUserSuperAdmin
                                ? 'Click to toggle status'
                                : 'Only Super Admin can modify status'
                            }
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                adm.is_suspended ? 'bg-rose-500' : 'bg-emerald-500'
                              }`}
                            ></span>
                            <span>{adm.is_suspended ? 'Suspended' : 'Active'}</span>
                            {statusUpdatingId === adm.id && (
                              <RefreshCw className="w-3 h-3 animate-spin text-slate-500" />
                            )}
                          </button>
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                        {adm.created_at ? new Date(adm.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }) : 'System Seeded'}
                      </td>

                      <td className="px-6 py-4 text-right">
                        {isSuper ? (
                          <span
                            className="inline-flex items-center space-x-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/80"
                            title="Protected account"
                          >
                            <Lock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Protected</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              if (!isCurrentUserSuperAdmin) {
                                setError('Only Super Administrator (Ankit) has authority to delete other administrators.');
                                return;
                              }
                              setDeleteTarget(adm);
                            }}
                            disabled={!isCurrentUserSuperAdmin || isSelf}
                            className={`inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                              isCurrentUserSuperAdmin && !isSelf
                                ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
                                : 'text-slate-300 cursor-not-allowed'
                            }`}
                            title={
                              isSelf
                                ? 'Cannot delete self'
                                : isCurrentUserSuperAdmin
                                ? 'Delete administrator'
                                : 'Super Admin permission required to delete'
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete</span>
                          </button>
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

      {/* Add Administrator Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-amber-300">Add Administrator</h3>
                  <p className="text-[11px] text-slate-300">Create new staff account with admin rights</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="p-6 space-y-4">
              {addError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    required
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="e.g. rahul.aptech@gmail.com"
                    required
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    required
                    minLength={6}
                    className="w-full pl-9 pr-10 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">This will be their initial login password.</p>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="inline-flex items-center space-x-2 px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all"
                >
                  {addLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <UserPlus className="w-4 h-4 text-slate-950" />
                  )}
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden p-6 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black text-slate-900 text-center">Confirm Administrator Deletion</h3>
            <p className="text-xs text-slate-500 text-center mt-2 leading-relaxed">
              Are you sure you want to permanently delete administrator{' '}
              <strong className="text-slate-900 font-bold">{deleteTarget.full_name}</strong> (
              <span className="font-mono text-slate-700">{deleteTarget.email}</span>)?
              This action cannot be undone.
            </p>

            <div className="mt-6 flex items-center justify-center space-x-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAdmin}
                disabled={deleteLoading}
                className="inline-flex items-center space-x-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all"
              >
                {deleteLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Trash2 className="w-4 h-4 text-white" />
                )}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
