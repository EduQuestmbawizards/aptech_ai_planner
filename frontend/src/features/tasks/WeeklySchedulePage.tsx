import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { StudyTask } from '../../types';
import { Calendar, ChevronLeft, ChevronRight, CheckCircle2, Clock } from 'lucide-react';

export const WeeklySchedulePage: React.FC = () => {
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tasks');
      setTasks(res.data);
    } catch (err) {
      console.error('Failed to load tasks', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Compute dates for the selected week
  const today = new Date();
  const currentMonday = new Date(today);
  const day = currentMonday.getDay();
  const diff = currentMonday.getDate() - day + (day === 0 ? -6 : 1) + weekOffset * 7;
  currentMonday.setDate(diff);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentMonday);
    d.setDate(currentMonday.getDate() + i);
    return d;
  });

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Weekly Schedule</h1>
          <p className="text-xs text-slate-500 mt-1">
            Visual breakdown of allocated topics and practice sessions for the week.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setWeekOffset(weekOffset - 1)}
            className="p-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-600 shadow-xs"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs"
          >
            Current Week
          </button>
          <button
            onClick={() => setWeekOffset(weekOffset + 1)}
            className="p-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-600 shadow-xs"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 7-Day Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {weekDays.map((d, idx) => {
          const dateStr = d.toISOString().split('T')[0];
          const isToday = new Date().toISOString().split('T')[0] === dateStr;
          const dayTasks = tasks.filter((t) => t.scheduled_date === dateStr);

          return (
            <div
              key={dateStr}
              className={`rounded-2xl border p-3 flex flex-col min-h-[160px] sm:min-h-[220px] lg:min-h-[300px] transition-all ${
                isToday
                  ? 'bg-brand-50/40 border-brand-300 ring-2 ring-brand-500/20'
                  : 'bg-white border-slate-200/80'
              }`}
            >
              <div className="border-b border-slate-100 pb-2 mb-2 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">{dayNames[idx]}</div>
                  <div className={`text-sm font-extrabold ${isToday ? 'text-brand-700' : 'text-slate-800'}`}>
                    {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                {dayTasks.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {dayTasks.length}
                  </span>
                )}
              </div>

              <div className="space-y-2 flex-1 overflow-y-auto">
                {dayTasks.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center p-2 text-[11px] text-slate-400 italic">
                    Rest or revision day
                  </div>
                ) : (
                  dayTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                        task.status === 'COMPLETED'
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                          : 'bg-white border-slate-200 hover:border-brand-300 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-100 font-bold">
                          {task.task_type}
                        </span>
                        {task.status === 'COMPLETED' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <span className="text-[10px] text-slate-400">{task.estimated_duration_hours}h</span>
                        )}
                      </div>
                      <div className="font-semibold text-slate-900 text-[11px] line-clamp-2 leading-tight">
                        {task.title}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

