import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Course } from '../../types';
import { Lock, Mail, AlertCircle, ArrowRight, Sparkles, Search, X, User as UserIcon, Phone, BookOpen, CheckCircle2 } from 'lucide-react';

type CourseBrand = 'EduQuest' | 'MBA Wizards' | 'Aptech';

const getCourseBrand = (c: Course): CourseBrand => {
  const cat = (c.category || '').toLowerCase();
  if (cat.includes('eduquest')) return 'EduQuest';
  if (cat.includes('mba')) return 'MBA Wizards';
  return 'Aptech';
};

export const LoginPage: React.FC = () => {
  const { login, trialSignup } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Free Trial Signup Modal state
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [trialBrand, setTrialBrand] = useState<CourseBrand>('EduQuest');
  const [courseSearch, setCourseSearch] = useState('');
  const [trialForm, setTrialForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    course_id: '',
  });
  const [trialError, setTrialError] = useState<string | null>(null);
  const [trialLoading, setTrialLoading] = useState(false);

  useEffect(() => {
    if (showTrialModal && courses.length === 0) {
      setCoursesLoading(true);
      api
        .get<Course[]>('/courses')
        .then((res) => setCourses(res.data || []))
        .catch(() => setTrialError('Could not load courses list. Please try again.'))
        .finally(() => setCoursesLoading(false));
    }
  }, [showTrialModal, courses.length]);

  const brandCounts = useMemo(() => {
    const counts: Record<CourseBrand, number> = { EduQuest: 0, 'MBA Wizards': 0, Aptech: 0 };
    courses.forEach((c) => {
      counts[getCourseBrand(c)] += 1;
    });
    return counts;
  }, [courses]);

  const filteredTrialCourses = useMemo(() => {
    const q = courseSearch.trim().toLowerCase();
    return courses.filter((c) => {
      if (getCourseBrand(c) !== trialBrand) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.course_code.toLowerCase().includes(q) ||
        (c.category || '').toLowerCase().includes(q)
      );
    });
  }, [courses, trialBrand, courseSearch]);

  const handleTrialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrialError(null);
    if (!trialForm.course_id) {
      setTrialError('Please select a course for your 20% Free Trial.');
      return;
    }
    setTrialLoading(true);
    try {
      await trialSignup({
        full_name: trialForm.full_name,
        email: trialForm.email,
        password: trialForm.password,
        phone: trialForm.phone || undefined,
        course_id: trialForm.course_id,
      });
      setShowTrialModal(false);
      navigate('/dashboard');
    } catch (err: any) {
      setTrialError(err.response?.data?.detail || 'Could not start free trial. Please check your details.');
    } finally {
      setTrialLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await login(email, password);
      if (user.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 'Failed to sign in. Please verify your credentials or invitation link.'
      );
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (type: 'admin' | 'student') => {
    if (type === 'admin') {
      setEmail('admin@aptech.edu');
      setPassword('AptechAdmin@2026!');
    } else {
      setEmail('student.demo@aptech.edu');
      setPassword('StudentDemo@2026!');
    }
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-white p-4 sm:p-5 rounded-3xl shadow-2xl shadow-amber-500/20 border-2 border-amber-400/40 hover:scale-105 transition-transform duration-300">
            <img
              src="/aptech-logo.png"
              alt="Aptech Learning"
              className="h-20 sm:h-24 w-auto object-contain"
            />
          </div>
        </div>
        <h2 className="mt-6 text-center text-2xl sm:text-3xl font-black text-amber-300 tracking-tight uppercase">
          AI Career & Study Planner
        </h2>
        <p className="mt-1.5 text-center text-xs text-amber-200/90 font-medium tracking-wide">
          Unleash Your Potential — Sign in to access your personalized curriculum
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-3xl border border-amber-100 sm:px-10">
          {/* Notice about invitation-only access */}
          <div className="mb-6 p-3 bg-amber-50/80 border border-amber-200/90 rounded-xl flex items-start space-x-2 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <span>
              <strong>Invitation Only:</strong> Accounts are granted upon verified Aptech course admission. Public signup is disabled.
            </span>
          </div>

          {error && (
            <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Email Address
              </label>
              <div className="mt-1.5 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@aptech.edu"
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <Link to="/forgot-password" className="text-xs font-semibold text-amber-600 hover:text-amber-700">
                  Forgot?
                </Link>
              </div>
              <div className="mt-1.5 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3 px-4 rounded-xl shadow-lg shadow-amber-500/25 text-sm font-extrabold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-all disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In to Portal'}
              {!loading && <ArrowRight className="ml-2 w-4 h-4" />}
            </button>
          </form>

          {/* Free Trial CTA */}
          <div className="mt-5 pt-5 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setTrialError(null);
                setShowTrialModal(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100/80 text-indigo-800 text-xs font-extrabold transition-colors"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              New Student? Start Free Trial (20% Planner Preview)
            </button>
            <p className="mt-1.5 text-[11px] text-center text-slate-500">
              Preview your personalized study planner for 20% of any course before enrolling.
            </p>
          </div>

          {/* Quick Development Credentials Autofill */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-500 text-center uppercase tracking-wider mb-2.5">
              Quick Test Credentials
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillCredentials('student')}
                className="py-2 px-3 bg-amber-50 hover:bg-amber-100/90 text-amber-900 border border-amber-200/80 rounded-xl text-xs font-bold text-center transition-colors"
              >
                Demo Student
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('admin')}
                className="py-2 px-3 bg-amber-50 hover:bg-amber-100/90 text-amber-900 border border-amber-200/80 rounded-xl text-xs font-bold text-center transition-colors"
              >
                Admin User
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Free Trial Signup Modal */}
      {showTrialModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="text-base font-extrabold">Start Your Free Trial (20% Preview)</h3>
                  <p className="text-xs text-indigo-100">Generate your AI study planner & preview the first 20% classes free</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTrialModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTrialSubmit} className="p-6 space-y-4">
              {trialError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                  <span>{trialError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Full Name *
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={trialForm.full_name}
                      onChange={(e) => setTrialForm({ ...trialForm, full_name: e.target.value })}
                      placeholder="Aarav Sharma"
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Phone (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      value={trialForm.phone}
                      onChange={(e) => setTrialForm({ ...trialForm, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={trialForm.email}
                      onChange={(e) => setTrialForm({ ...trialForm, email: e.target.value })}
                      placeholder="you@example.com"
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Create Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={trialForm.password}
                      onChange={(e) => setTrialForm({ ...trialForm, password: e.target.value })}
                      placeholder="Min 6 characters"
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Grouped Course Picker */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Course to Preview *
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(['EduQuest', 'MBA Wizards', 'Aptech'] as CourseBrand[]).map((brand) => (
                    <button
                      key={brand}
                      type="button"
                      onClick={() => setTrialBrand(brand)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        trialBrand === brand
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {brand} ({brandCounts[brand]})
                    </button>
                  ))}
                </div>

                <div className="relative mb-2">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    placeholder={`Search ${trialBrand} courses...`}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {coursesLoading ? (
                    <div className="p-4 text-center text-xs text-slate-500">Loading courses...</div>
                  ) : filteredTrialCourses.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">No matching courses found.</div>
                  ) : (
                    filteredTrialCourses.map((c) => {
                      const selected = trialForm.course_id === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setTrialForm({ ...trialForm, course_id: c.id })}
                          className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 transition-colors ${
                            selected ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                              <span className="text-xs font-bold truncate">{c.name}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 ml-5">
                              {c.course_code} • {c.total_learning_hours}h
                            </p>
                          </div>
                          {selected && <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTrialModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={trialLoading}
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  {trialLoading ? 'Creating Trial...' : 'Start Free Trial & Open Dashboard'}
                  {!trialLoading && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

