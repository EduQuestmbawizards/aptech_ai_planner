import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { ProfileRoadmapStudentSummary, ProfileRoadmapItem } from '../../types';
import {
  Compass,
  CheckCircle2,
  Clock,
  Calendar,
  Sparkles,
  Award,
  BookOpen,
  ArrowRight,
  FileText,
  Target,
  GraduationCap,
  TrendingUp,
  AlertCircle,
  MessageSquareQuote,
  Check,
} from 'lucide-react';

export const StudentProfileRoadmapPage: React.FC = () => {
  const [data, setData] = useState<ProfileRoadmapStudentSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'COMPLETED' | 'UPCOMING'>('ALL');

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

  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Loading your Profile Building Roadmap...</p>
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

  const { stats, items } = data;
  const filteredItems = items.filter((item) => {
    if (filter === 'COMPLETED') return item.status === 'COMPLETED';
    if (filter === 'UPCOMING') return item.status !== 'COMPLETED';
    return true;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-amber-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden border border-amber-500/20">
        <div className="relative z-10">
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 mb-3">
            <Compass className="w-3.5 h-3.5 mr-1.5" />
            12-Month Mentorship Execution Plan
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Profile Building &amp; Mentorship Roadmap
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1.5 leading-relaxed">
            Personalized long-term roadmap tracking research papers, clinical shadowing, community projects, national competitions, and admissions milestones.
          </p>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-700/60">
            <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-xl border border-white/10">
              <div className="text-[11px] text-slate-400 font-medium">Sessions Completed</div>
              <div className="text-xl font-black text-amber-300 mt-0.5">
                {stats.completed} of {stats.total_items}
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-xl border border-white/10">
              <div className="text-[11px] text-slate-400 font-medium">Progress Dial</div>
              <div className="text-xl font-black text-emerald-400 mt-0.5">
                {stats.completion_percentage}%
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-xl border border-white/10">
              <div className="text-[11px] text-slate-400 font-medium">Mentorship Time</div>
              <div className="text-xl font-black text-blue-300 mt-0.5">
                {(stats.total_session_minutes / 60).toFixed(1)} hrs
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-xl border border-white/10">
              <div className="text-[11px] text-slate-400 font-medium">Active Milestone</div>
              <div className="text-xs font-bold text-slate-200 mt-1 truncate">
                {items.find((i) => i.status === 'IN_PROGRESS')?.period ||
                  items.find((i) => i.status === 'PENDING')?.period ||
                  'Completed!'}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 w-full bg-white/10 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-400 to-emerald-400 h-2 rounded-full transition-all duration-500"
              style={{ width: `${stats.completion_percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              filter === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Milestones ({items.length})
          </button>
          <button
            onClick={() => setFilter('COMPLETED')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              filter === 'COMPLETED'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Completed Sessions with MoM ({stats.completed})
          </button>
          <button
            onClick={() => setFilter('UPCOMING')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              filter === 'UPCOMING'
                ? 'bg-white text-amber-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Upcoming ({items.length - stats.completed})
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium flex items-center">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 mr-1.5" />
          Minutes of Meeting (MoM) logged by your faculty mentors
        </div>
      </div>

      {/* Month-By-Month Timeline / Cards */}
      {items.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
            <Compass className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Your Plan is Being Curated</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Your admission mentor is finalizing your 12-month profile building curriculum. It will appear here shortly!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item, idx) => {
            const isCompleted = item.status === 'COMPLETED';
            const isInProgress = item.status === 'IN_PROGRESS';

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border p-5 transition-all shadow-sm ${
                  isCompleted
                    ? 'border-emerald-200/90 shadow-emerald-500/5'
                    : isInProgress
                    ? 'border-blue-300 shadow-blue-500/5 ring-1 ring-blue-300/50'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shadow-xs ${
                        isCompleted
                          ? 'bg-emerald-600 text-white'
                          : isInProgress
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {item.order_index}
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        {item.period}
                      </h3>
                      <div className="text-[11px] text-slate-400 font-medium">
                        Milestone Stage {item.order_index} of {items.length}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : isInProgress
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />}
                    {isInProgress && <Clock className="w-3.5 h-3.5 mr-1 text-blue-600" />}
                    {item.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Main Actions */}
                <div className="mt-4">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Key Actions &amp; Focus Area
                  </div>
                  <p className="text-xs sm:text-sm text-slate-800 font-medium whitespace-pre-line leading-relaxed">
                    {item.main_actions}
                  </p>
                </div>

                {/* Milestones / Outputs */}
                {item.milestones_outputs && (
                  <div className="mt-3.5 p-3 bg-amber-50/60 border border-amber-200/70 rounded-xl">
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900 mb-1">
                      <Target className="w-3.5 h-3.5 text-amber-600" />
                      <span>Expected Deliverables &amp; Outputs:</span>
                    </div>
                    <p className="text-xs text-amber-950 font-medium whitespace-pre-line leading-relaxed">
                      {item.milestones_outputs}
                    </p>
                  </div>
                )}

                {/* Completed Session MoM Card */}
                {isCompleted && item.meeting_notes && (
                  <div className="mt-4 p-4 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 border border-emerald-200 rounded-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-emerald-200/60">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                          <MessageSquareQuote className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-emerald-950">
                            {item.meeting_topic || 'Mentorship Session Log'}
                          </div>
                          <div className="text-[10px] text-emerald-700 font-semibold">
                            Minutes of Meeting (MoM) &amp; Instructor Discussion
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 text-xs text-emerald-800 font-medium">
                        {item.session_date && (
                          <span className="flex items-center">
                            <Calendar className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                            {item.session_date}
                          </span>
                        )}
                        {item.session_duration_minutes && (
                          <span className="flex items-center">
                            <Clock className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                            {item.session_duration_minutes} mins
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-slate-800 bg-white/90 p-3 rounded-lg border border-emerald-100 whitespace-pre-line leading-relaxed shadow-xs">
                      {item.meeting_notes}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default StudentProfileRoadmapPage;

