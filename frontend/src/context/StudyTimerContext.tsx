import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export interface TimerTaskSummary {
  id: string;
  title: string;
  task_type?: string;
  estimated_duration_hours?: number;
}

interface PersistedTimerState {
  activeTask: TimerTaskSummary | null;
  accumulatedSeconds: number;
  startedAtMs: number | null;
  isRunning: boolean;
}

interface StudyTimerContextValue {
  activeTask: TimerTaskSummary | null;
  elapsedSeconds: number;
  isRunning: boolean;
  saving: boolean;
  lastSavedAt: number;
  notification: string | null;
  clearNotification: () => void;
  startTimer: (task: TimerTaskSummary) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  saveTimerSession: (markComplete?: boolean) => Promise<boolean>;
  triggerDataRefresh: () => void;
}

const STORAGE_KEY = 'aptech_study_timer_state';

const StudyTimerContext = createContext<StudyTimerContextValue | undefined>(undefined);

const readStoredState = (): PersistedTimerState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { activeTask: null, accumulatedSeconds: 0, startedAtMs: null, isRunning: false };
    }
    const parsed = JSON.parse(raw) as PersistedTimerState;
    return {
      activeTask: parsed.activeTask || null,
      accumulatedSeconds: parsed.accumulatedSeconds || 0,
      startedAtMs: parsed.startedAtMs || null,
      isRunning: Boolean(parsed.isRunning && parsed.activeTask),
    };
  } catch {
    return { activeTask: null, accumulatedSeconds: 0, startedAtMs: null, isRunning: false };
  }
};

export const formatTimerClock = (totalSeconds: number): string => {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return [hrs, mins, secs].map((n) => String(n).padStart(2, '0')).join(':');
};

export const StudyTimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PersistedTimerState>(() => readStoredState());
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() => {
    const initial = readStoredState();
    if (initial.isRunning && initial.startedAtMs) {
      return initial.accumulatedSeconds + Math.max(0, Math.floor((Date.now() - initial.startedAtMs) / 1000));
    }
    return initial.accumulatedSeconds;
  });
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number>(0);
  const [notification, setNotification] = useState<string | null>(null);

  // Persist to localStorage whenever timer state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore storage quota errors
    }
  }, [state]);

  // Live tick every second when running
  useEffect(() => {
    const computeElapsed = () => {
      if (state.isRunning && state.startedAtMs) {
        return state.accumulatedSeconds + Math.max(0, Math.floor((Date.now() - state.startedAtMs) / 1000));
      }
      return state.accumulatedSeconds;
    };

    setElapsedSeconds(computeElapsed());

    if (!state.isRunning) return;

    const interval = setInterval(() => {
      setElapsedSeconds(computeElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [state.isRunning, state.startedAtMs, state.accumulatedSeconds]);

  // Auto-hide notifications after 5s
  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 5000);
    return () => clearTimeout(t);
  }, [notification]);

  const clearNotification = useCallback(() => setNotification(null), []);
  const triggerDataRefresh = useCallback(() => setLastSavedAt(Date.now()), []);

  const startTimer = useCallback((task: TimerTaskSummary) => {
    setState((prev) => {
      // If resuming the same task
      if (prev.activeTask?.id === task.id) {
        if (prev.isRunning) return prev;
        return {
          ...prev,
          isRunning: true,
          startedAtMs: Date.now(),
        };
      }
      // Starting a fresh task timer
      return {
        activeTask: task,
        accumulatedSeconds: 0,
        startedAtMs: Date.now(),
        isRunning: true,
      };
    });

    // Best-effort mark task IN_PROGRESS if starting
    api.patch(`/tasks/${task.id}/status`, { status: 'IN_PROGRESS' }).catch(() => {});
  }, []);

  const pauseTimer = useCallback(() => {
    setState((prev) => {
      if (!prev.isRunning || !prev.startedAtMs) return prev;
      const extra = Math.max(0, Math.floor((Date.now() - prev.startedAtMs) / 1000));
      return {
        ...prev,
        accumulatedSeconds: prev.accumulatedSeconds + extra,
        startedAtMs: null,
        isRunning: false,
      };
    });
  }, []);

  const resumeTimer = useCallback(() => {
    setState((prev) => {
      if (!prev.activeTask || prev.isRunning) return prev;
      return {
        ...prev,
        isRunning: true,
        startedAtMs: Date.now(),
      };
    });
  }, []);

  const resetTimer = useCallback(() => {
    setState({
      activeTask: null,
      accumulatedSeconds: 0,
      startedAtMs: null,
      isRunning: false,
    });
    setElapsedSeconds(0);
  }, []);

  const saveTimerSession = useCallback(
    async (markComplete = false): Promise<boolean> => {
      if (!state.activeTask) return false;

      const currentElapsed =
        state.isRunning && state.startedAtMs
          ? state.accumulatedSeconds + Math.max(0, Math.floor((Date.now() - state.startedAtMs) / 1000))
          : state.accumulatedSeconds;

      setSaving(true);
      try {
        // Log live timer duration if at least 5 seconds elapsed (minimum 1 min credit)
        if (currentElapsed >= 5) {
          const minutesToLog = Math.max(1, Math.round(currentElapsed / 60));
          await api.post(`/tasks/${state.activeTask.id}/study-session`, {
            duration_minutes: minutesToLog,
            notes: `Live Study Timer session (${formatTimerClock(currentElapsed)})`,
          });
        }

        if (markComplete) {
          await api.patch(`/tasks/${state.activeTask.id}/status`, {
            status: 'COMPLETED',
          });
          setNotification(
            currentElapsed >= 5
              ? `Completed "${state.activeTask.title}" and logged live study time!`
              : `Completed "${state.activeTask.title}" and auto-logged study hours!`
          );
        } else if (currentElapsed >= 5) {
          const mins = Math.max(1, Math.round(currentElapsed / 60));
          setNotification(`Saved ${mins} min study session for "${state.activeTask.title}"!`);
        } else {
          setNotification('Timer must run at least 5 seconds before saving.');
          setSaving(false);
          return false;
        }

        setState({
          activeTask: null,
          accumulatedSeconds: 0,
          startedAtMs: null,
          isRunning: false,
        });
        setElapsedSeconds(0);
        setLastSavedAt(Date.now());
        return true;
      } catch (err: any) {
        setNotification(err.response?.data?.detail || 'Failed to save study session.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [state]
  );

  return (
    <StudyTimerContext.Provider
      value={{
        activeTask: state.activeTask,
        elapsedSeconds,
        isRunning: state.isRunning,
        saving,
        lastSavedAt,
        notification,
        clearNotification,
        startTimer,
        pauseTimer,
        resumeTimer,
        resetTimer,
        saveTimerSession,
        triggerDataRefresh,
      }}
    >
      {children}
    </StudyTimerContext.Provider>
  );
};

export const useStudyTimer = (): StudyTimerContextValue => {
  const ctx = useContext(StudyTimerContext);
  if (!ctx) {
    throw new Error('useStudyTimer must be used within a StudyTimerProvider');
  }
  return ctx;
};

