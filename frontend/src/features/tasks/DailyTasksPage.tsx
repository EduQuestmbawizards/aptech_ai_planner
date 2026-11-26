import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../../services/api';
import { StudyTask } from '../../types';
import { useStudyTimer } from '../../context/StudyTimerContext';
import {
  ListTodo,
  CheckCircle2,
  Clock,
  PlayCircle,
  Timer,
  X,
  Bot,
  Lock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const DailyTasksPage: React.FC = () => {
  const navigate = useNavigate();
  const { startTimer, activeTask: timerTask, lastSavedAt, triggerDataRefresh } = useStudyTimer();

  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDateTab, setActiveDateTab] = useState<'today' | 'all'>('today');

  // Study Session / Log Time Modal
  const [selectedTask, setSelectedTask] = useState<StudyTask | null>(null);
  const [sessionMinutes, setSessionMinutes] = useState<number>(60);
  const [sessionNotes, setSessionNotes] = useState<string>('');
  const [sessionLoading, setSessionLoading] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const url = activeDateTab === 'today' ? '/tasks/today' : '/tasks';
      const res = await api.get(url);
      setTasks(res.data);
    } catch (err) {
      console.error('Failed to load tasks', err);
    } finally {
      setLoading(false);
    }
  }, [activeDateTab]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (lastSavedAt > 0) {
      fetchTasks();
    }
  }, [lastSavedAt, fetchTasks]);

  const handleToggleStatus = async (task: StudyTask, newStatus: string) => {
    if (task.status === 'COMPLETED') {
      return; // Permanently locked once completed
    }
    if (newStatus === 'COMPLETED') {
      const ok = window.confirm(
        `Mark "${task.title}" as Completed?\n\nOnce marked complete, this topic is permanently locked for teacher & parent tracking and cannot be undone.`
      );
      if (!ok) return;
    }
    try {
      await api.patch(`/tasks/${task.id}/status`, {
        status: newStatus,
      });
      triggerDataRefresh();
      fetchTasks();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update task status');
    }
  };

  const handleLogStudySession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    setSessionLoading(true);
    try {
      await api.post(`/tasks/${selectedTask.id}/study-session`, {
        duration_minutes: sessionMinutes,
        notes: sessionNotes,
      });
      setSelectedTask(null);
      setSessionNotes('');
      triggerDataRefresh();
      fetchTasks();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to log study session');
    } finally {
      setSessionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Daily Task Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Focus on today's scheduled curriculum items and log verified study sessions.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-amber-50/80 p-1.5 rounded-2xl border border-amber-200/60">
          <button
            onClick={() => setActiveDateTab('today')}
            className={`px-4 py-2 rounded-xl text-xs transition-all ${
              activeDateTab === 'today'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-600 hover:text-slate-900 font-semibold'
            }`}
          >
            Today's Agenda
          </button>
          <button
            onClick={() => setActiveDateTab('all')}
            className={`px-4 py-2 rounded-xl text-xs transition-all ${
              activeDateTab === 'all'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-600 hover:text-slate-900 font-semibold'
            }`}
          >
            All Upcoming
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center items-center h-48 bg-white rounded-xl border border-slate-200">
            <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-10 text-center bg-white rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto">
              <ListTodo className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {activeDateTab === 'today' ? 'No Study Tasks Scheduled for Today' : 'No Tasks Found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              {activeDateTab === 'today'
                ? 'Your AI study plan only schedules tasks on your preferred study days. Today might be a non-study day according to your onboarding preferences.'
                : 'No upcoming tasks found in your active study plan.'}
            </p>
            {activeDateTab === 'today' && (
              <button
                type="button"
                onClick={() => setActiveDateTab('all')}
                className="mt-2 inline-flex items-center px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 hover:from-amber-300 hover:to-amber-500 transition-all shadow-md shadow-amber-500/20"
              >
                View All Upcoming Tasks →
              </button>
            )}
          </div>
        ) : (
          tasks.map((task) => {
            const isCompleted = task.status === 'COMPLETED';
            const isInProgress = task.status === 'IN_PROGRESS';

            return (
              <div
                key={task.id}
                className={`p-5 rounded-2xl border transition-all ${
                  isCompleted
                    ? 'bg-slate-50/70 border-slate-200 opacity-80'
                    : 'bg-white border-slate-200/90 shadow-sm hover:border-brand-300'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-50 text-brand-700 font-bold border border-brand-200">
                        {task.task_type}
                      </span>
                      {task.topic_code && (
                        <span className="text-[10px] font-mono text-slate-400 font-medium">{task.topic_code}</span>
                      )}
                      <span className="text-xs text-slate-400">• Scheduled for {task.scheduled_date}</span>
                    </div>

                    <h2
                      className={`text-sm font-bold ${
                        isCompleted ? 'line-through text-slate-500' : 'text-slate-900'
                      }`}
                    >
                      {task.title}
                    </h2>
                    <p className="text-xs text-slate-500">{task.description}</p>

                    <div className="flex items-center space-x-4 pt-1 text-[11px] text-slate-500 font-medium">
                      <span>Est: {task.estimated_duration_hours} hrs</span>
                      <span>•</span>
                      <span className="font-semibold text-brand-700">Actual: {task.actual_duration_hours} hrs logged</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                    {!isCompleted && (
                      <button
                        type="button"
                        onClick={() =>
                          startTimer({
                            id: task.id,
                            title: task.title,
                            task_type: task.task_type,
                            estimated_duration_hours: task.estimated_duration_hours,
                          })
                        }
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg inline-flex items-center shadow-xs transition-colors ${
                          timerTask?.id === task.id
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-900 hover:bg-slate-800 text-amber-300'
                        }`}
                        title="Start Live Study Timer for this topic"
                      >
                        <Timer className="w-3.5 h-3.5 mr-1" />
                        {timerTask?.id === task.id ? 'Timing...' : 'Timer'}
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedTask(task)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 inline-flex items-center shadow-xs"
                      title="Log study time session"
                    >
                      <Clock className="w-3.5 h-3.5 mr-1 text-slate-500" />
                      Log Time
                    </button>

                    <button
                      onClick={() => navigate('/ai-assistant')}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-brand-200 bg-brand-50 hover:bg-brand-100 text-brand-700 inline-flex items-center"
                      title="Ask AI Learning Assistant about this topic"
                    >
                      <Bot className="w-3.5 h-3.5" />
                    </button>

                    {isCompleted ? (
                      <span
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center"
                        title="Completed topics are permanently locked"
                      >
                        <Lock className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        Completed &amp; Locked
                      </span>
                    ) : isInProgress ? (
                      <button
                        onClick={() => handleToggleStatus(task, 'COMPLETED')}
                        className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 hover:bg-brand-700 text-white shadow-sm inline-flex items-center"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                        Mark Done
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleStatus(task, 'IN_PROGRESS')}
                        className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-sm inline-flex items-center"
                      >
                        <PlayCircle className="w-4 h-4 mr-1.5" />
                        Start
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Log Study Session Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Record Verified Study Session</h2>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLogStudySession} className="space-y-4 mt-4 text-xs">
              <div>
                <span className="text-slate-400">Target Task:</span>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{selectedTask.title}</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Duration in Minutes *</label>
                <input
                  type="number"
                  min="5"
                  max="480"
                  required
                  value={sessionMinutes}
                  onChange={(e) => setSessionMinutes(parseInt(e.target.value) || 0)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
                <div className="flex space-x-2 mt-2">
                  {[30, 45, 60, 90, 120].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setSessionMinutes(mins)}
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold"
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Session Notes & Observations</label>
                <textarea
                  rows={3}
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="Notes on code implementation, challenges faced, or key concepts learned..."
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sessionLoading}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold shadow-sm disabled:opacity-50"
                >
                  {sessionLoading ? 'Recording Session...' : 'Save Study Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

