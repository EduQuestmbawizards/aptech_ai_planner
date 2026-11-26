import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { MyEnrolledCourse, CourseSyllabus, CapacityFeasibility } from '../../types';
import {
  CheckCircle2,
  AlertCircle,
  Calendar,
  Clock,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  BookOpen,
  ShieldCheck,
  Flag,
} from 'lucide-react';

const WEEKDAYS = [
  { id: 'MON', label: 'Mon' },
  { id: 'TUE', label: 'Tue' },
  { id: 'WED', label: 'Wed' },
  { id: 'THU', label: 'Thu' },
  { id: 'FRI', label: 'Fri' },
  { id: 'SAT', label: 'Sat' },
  { id: 'SUN', label: 'Sun' },
];

const DURATION_PRESETS = [
  { label: '1 Month', days: 30, desc: 'Very Fast Track' },
  { label: '2 Months', days: 60, desc: 'Intensive Prep' },
  { label: '3 Months', days: 90, desc: 'Balanced (Popular)' },
  { label: '4 Months', days: 120, desc: 'Steady Pace' },
  { label: '6 Months', days: 180, desc: 'Relaxed Pace' },
];

const toLocalIso = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDaysTo = (dateStr: string, days: number): string => {
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + days);
  return toLocalIso(d);
};

export const PlannerOnboardingWizard: React.FC = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [enrolledCourses, setEnrolledCourses] = useState<MyEnrolledCourse[]>([]);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>('');
  const [syllabus, setSyllabus] = useState<CourseSyllabus | null>(null);
  const [loading, setLoading] = useState(true);

  // Step 1: Course, Start Date & Target Date
  const [startDate, setStartDate] = useState<string>(() => toLocalIso(new Date()));
  const [selectedPresetDays, setSelectedPresetDays] = useState<number | 'custom'>(90);
  const [targetDate, setTargetDate] = useState<string>(() => addDaysTo(toLocalIso(new Date()), 90));

  // Step 2: Study Days, Hours & Comfort Level
  const [dailyHours, setDailyHours] = useState<number>(2.0);
  const [availableDays, setAvailableDays] = useState<string[]>(['MON', 'TUE', 'WED', 'THU', 'FRI']);
  const [preferredStyle, setPreferredStyle] = useState<string>('BALANCED');
  const [goalNote, setGoalNote] = useState<string>('Complete full syllabus with practice & revision');

  // Step 3: Feasibility Preview & Submit
  const [feasibility, setFeasibility] = useState<CapacityFeasibility | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const res = await api.get('/enrollments/my');
        const active: MyEnrolledCourse[] = (res.data.items || []).filter(
          (e: MyEnrolledCourse) => e.status === 'ACTIVE'
        );
        setEnrolledCourses(active);
        if (active.length > 0) {
          setSelectedEnrollmentId(active[0].enrollment_id);
          fetchSyllabus(active[0].course_id);
        }
      } catch (err) {
        console.error('Failed to load enrollments', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const fetchSyllabus = async (courseId: string) => {
    try {
      const res = await api.get(`/courses/${courseId}/syllabus`);
      setSyllabus(res.data);
    } catch (err) {
      console.error('Failed to load syllabus', err);
    }
  };

  const handleCourseChange = (enrollmentId: string) => {
    setSelectedEnrollmentId(enrollmentId);
    const item = enrolledCourses.find((e) => e.enrollment_id === enrollmentId);
    if (item) {
      fetchSyllabus(item.course_id);
    }
  };

  const handleSelectDurationPreset = (days: number) => {
    setSelectedPresetDays(days);
    setTargetDate(addDaysTo(startDate, days));
  };

  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart);
    if (selectedPresetDays !== 'custom') {
      setTargetDate(addDaysTo(newStart, selectedPresetDays));
    } else {
      const startMs = new Date(newStart).getTime();
      const endMs = new Date(targetDate).getTime();
      if (endMs <= startMs) {
        setTargetDate(addDaysTo(newStart, 30));
      }
    }
  };

  const handleTargetDateChange = (newTarget: string) => {
    setSelectedPresetDays('custom');
    setTargetDate(newTarget);
  };

  const toggleDay = (dayId: string) => {
    if (availableDays.includes(dayId)) {
      if (availableDays.length === 1) return;
      setAvailableDays(availableDays.filter((d) => d !== dayId));
    } else {
      setAvailableDays([...availableDays, dayId]);
    }
  };

  const runFeasibilityCheck = async (
    overrideDays = availableDays,
    overrideHours = dailyHours,
    overrideStartDate = startDate,
    overrideDate = targetDate
  ) => {
    setPreviewLoading(true);
    setErrorMsg(null);
    try {
      const startMs = new Date(overrideStartDate).getTime();
      const endMs = new Date(overrideDate).getTime();
      const reqDays = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 3600 * 24)));
      const res = await api.post('/plans/preview', {
        enrollment_id: selectedEnrollmentId,
        start_date: overrideStartDate,
        target_completion_date: overrideDate,
        requested_duration_days: reqDays,
        daily_study_hours: overrideHours,
        available_days: overrideDays,
        preferred_learning_style: preferredStyle,
        learning_goals: goalNote ? [goalNote] : [],
        known_topics: [],
        weak_topics: [],
      });
      setFeasibility(res.data);
      setStep(3);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Could not check schedule feasibility.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleGeneratePlan = async () => {
    setGenerateLoading(true);
    setErrorMsg(null);
    try {
      const startMs = new Date(startDate).getTime();
      const endMs = new Date(targetDate).getTime();
      const reqDays = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 3600 * 24)));
      await api.post('/plans/generate', {
        enrollment_id: selectedEnrollmentId,
        start_date: startDate,
        target_completion_date: targetDate,
        requested_duration_days: reqDays,
        daily_study_hours: dailyHours,
        available_days: availableDays,
        preferred_learning_style: preferredStyle,
        learning_goals: goalNote ? [goalNote] : [],
        known_topics: [],
        weak_topics: [],
      });
      navigate('/planner');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to generate your study plan.');
      setGenerateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (enrolledCourses.length === 0) {
    return (
      <div className="max-w-xl mx-auto bg-white p-8 rounded-3xl border border-amber-200 text-center space-y-3 shadow-sm">
        <BookOpen className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-extrabold text-slate-900">No Active Course Found</h2>
        <p className="text-xs text-slate-600">
          You need an approved active course enrollment before creating a study plan. Please contact your center admin.
        </p>
        <button
          type="button"
          onClick={() => navigate('/courses')}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 text-slate-950"
        >
          Go to My Courses
        </button>
      </div>
    );
  }

  const selectedCourse = enrolledCourses.find((e) => e.enrollment_id === selectedEnrollmentId);
  const weeklyHours = (availableDays.length * dailyHours).toFixed(1);
  const totalDays = Math.max(
    1,
    Math.ceil((new Date(targetDate).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24))
  );
  const approxMonths = Math.max(1, Math.round(totalDays / 30));

  return (
    <div className="max-w-3xl mx-auto space-y-5 py-2">
      {/* Simple 3-Step Header */}
      <div className="bg-slate-900 text-white p-5 sm:p-6 rounded-3xl border border-amber-500/30 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-black text-amber-300">
              Create Your Study Plan
            </h1>
            <p className="text-xs text-amber-100/80 mt-0.5">
              3 easy steps — choose your target time &amp; study days, then send to Admin for approval.
            </p>
          </div>
          <span className="text-xs font-extrabold bg-amber-400 text-slate-950 px-3 py-1 rounded-full self-start">
            Step {step} of 3
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { num: 1, title: '1. Course & Months' },
            { num: 2, title: '2. Days & Hours' },
            { num: 3, title: '3. Check & Send' },
          ].map((s) => (
            <div
              key={s.num}
              className={`py-2 px-3 rounded-xl text-center text-xs font-bold transition-all ${
                step === s.num
                  ? 'bg-amber-400 text-slate-950 shadow'
                  : step > s.num
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {s.title}
            </div>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STEP 1: Choose Course & Duration */}
      {step === 1 && (
        <div className="bg-white p-6 rounded-3xl border border-amber-200/70 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">1. Which course do you want to plan?</h2>
            <p className="text-xs text-slate-500 mt-0.5">Pick your course below.</p>
            <div className="grid grid-cols-1 gap-3 mt-3">
              {enrolledCourses.map((c) => (
                <button
                  key={c.enrollment_id}
                  type="button"
                  onClick={() => handleCourseChange(c.enrollment_id)}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    selectedEnrollmentId === c.enrollment_id
                      ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-400/40'
                      : 'border-slate-200 hover:border-amber-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded">
                      {c.course_code}
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      Total Syllabus: <span className="text-amber-700">{c.total_learning_hours} hrs</span>
                    </span>
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 mt-1.5">{c.course_name}</div>
                </button>
              ))}
            </div>
          </div>

          {syllabus && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
              <div className="font-bold text-slate-800">What is inside this course ({syllabus.modules.length} sections):</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {syllabus.modules.map((m) => (
                  <div key={m.id} className="bg-white px-3 py-2 rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="font-semibold text-slate-800 truncate pr-2">{m.title}</span>
                    <span className="text-[11px] font-bold text-amber-700 flex-shrink-0">{m.estimated_hours} hrs</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Start Date & Target Completion Date */}
          <div className="space-y-3">
            <h2 className="text-base font-extrabold text-slate-900">2. Set Class Start Date &amp; Target Completion Date</h2>
            <p className="text-xs text-slate-500">
              Classes kal ya past date me shuru hui theen? Start date me past date bhi choose kar sakte hain.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span>Batch / Class Start Date</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 shadow-2xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Defaults to Today, ya kal/past date select karein.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <Flag className="w-4 h-4 text-amber-600" />
                  <span>Target Completion Date</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={targetDate}
                  min={startDate}
                  onChange={(e) => handleTargetDateChange(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 shadow-2xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Preset click karein ya custom date pick karein.
                </span>
              </div>
            </div>

            {/* Quick Duration Presets */}
            <div className="space-y-1.5 pt-1">
              <div className="text-xs font-bold text-slate-700">
                Quick Duration Presets (Calculated from Start Date):
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {DURATION_PRESETS.map((p) => (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => handleSelectDurationPreset(p.days)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      selectedPresetDays === p.days
                        ? 'bg-slate-900 text-white border-amber-400 ring-2 ring-amber-400/50'
                        : 'bg-slate-50 text-slate-800 border-slate-200 hover:border-amber-300'
                    }`}
                  >
                    <div className={`text-sm font-black ${selectedPresetDays === p.days ? 'text-amber-300' : 'text-slate-900'}`}>
                      {p.label}
                    </div>
                    <div className={`text-[11px] mt-0.5 ${selectedPresetDays === p.days ? 'text-slate-300' : 'text-slate-500'}`}>
                      {p.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-700 flex-shrink-0" />
              <span>
                Plan Timeline: <strong>{startDate}</strong> se <strong>{targetDate}</strong> tak ({totalDays} days / {approxMonths} months).
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl text-xs font-extrabold shadow-md inline-flex items-center"
            >
              Next: Pick Days &amp; Hours
              <ArrowRight className="ml-2 w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Days & Daily Hours */}
      {step === 2 && (
        <div className="bg-white p-6 rounded-3xl border border-amber-200/70 shadow-sm space-y-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Which days can you study / attend class?</h2>
                <p className="text-xs text-slate-500 mt-0.5">Tap days to select or unselect them.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setAvailableDays(['MON', 'TUE', 'WED', 'THU', 'FRI'])}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  Mon–Fri
                </button>
                <button
                  type="button"
                  onClick={() => setAvailableDays(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'])}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  Mon–Sat
                </button>
                <button
                  type="button"
                  onClick={() => setAvailableDays(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  All 7 Days
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 mt-3">
              {WEEKDAYS.map((day) => {
                const selected = availableDays.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleDay(day.id)}
                    className={`py-3 rounded-xl text-xs font-extrabold border transition-all ${
                      selected
                        ? 'bg-slate-900 text-amber-300 border-amber-400 shadow-sm'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              How many hours can you study on each selected day?
            </h2>
            <div className="flex flex-wrap gap-2 mt-3">
              {[1, 1.5, 2, 2.5, 3, 4, 5, 6].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setDailyHours(h)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-all ${
                    dailyHours === h
                      ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-amber-300'
                  }`}
                >
                  {h} hr{h === 1 ? '' : 's'} / day
                </button>
              ))}
            </div>
            <input
              type="range"
              min="1"
              max="8"
              step="0.5"
              value={dailyHours}
              onChange={(e) => setDailyHours(parseFloat(e.target.value))}
              className="mt-4 w-full accent-amber-500"
            />
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-700" />
              <span>
                Your Study Routine: <strong>{availableDays.length} days/week</strong> × <strong>{dailyHours} hrs/day</strong> ={' '}
                <strong className="text-amber-800">{weeklyHours} hours/week</strong>
              </span>
            </div>
            <span className="text-[11px] font-semibold text-amber-800">
              Course needs {selectedCourse?.total_learning_hours || 0} total hrs
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">How do you prefer to study?</label>
              <select
                value={preferredStyle}
                onChange={(e) => setPreferredStyle(e.target.value)}
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 font-semibold"
              >
                <option value="BALANCED">Balanced (Reading + Practice + Revision)</option>
                <option value="PROJECT_BASED">Practice &amp; Mock Tests Heavy</option>
                <option value="THEORY_FIRST">Understand Concepts Slowly First</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Your Note / Goal (Optional for Admin)</label>
              <input
                type="text"
                value={goalNote}
                onChange={(e) => setGoalNote(e.target.value)}
                placeholder="e.g., Target UCAT exam in 3 months"
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl text-slate-900"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 inline-flex items-center"
            >
              <ArrowLeft className="mr-1.5 w-4 h-4" />
              Back
            </button>
            <button
              type="button"
              disabled={previewLoading}
              onClick={() => runFeasibilityCheck()}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl text-xs font-extrabold shadow-md inline-flex items-center disabled:opacity-50"
            >
              {previewLoading ? 'Checking Plan...' : 'Next: Check If Plan Fits'}
              {!previewLoading && <ArrowRight className="ml-2 w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Feasibility Check & Send to Admin */}
      {step === 3 && feasibility && (
        <div className="bg-white p-6 rounded-3xl border border-amber-200/70 shadow-sm space-y-5">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Final Check Before Sending to Admin</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              We checked whether {selectedCourse?.course_code} ({feasibility.total_syllabus_hours} hrs) fits cleanly in your chosen timeline.
            </p>
          </div>

          {feasibility.is_feasible ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start space-x-3 text-emerald-900">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs space-y-1">
                <div className="font-extrabold text-sm">Great! Your Plan is Realistic &amp; Easy to Follow</div>
                <p>
                  This course needs <strong>{feasibility.total_syllabus_hours} hours</strong>, and with your schedule you have{' '}
                  <strong>{feasibility.total_available_hours} hours</strong> available from <strong>{startDate}</strong> until <strong>{targetDate}</strong>.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-3 text-rose-900">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-6 h-6 text-rose-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs space-y-1">
                  <div className="font-extrabold text-sm">Too Tight! Not Enough Study Hours Selected</div>
                  <p>
                    Course needs <strong>{feasibility.total_syllabus_hours} hours</strong>, but your current choice only gives{' '}
                    <strong>{feasibility.total_available_hours} hours</strong>.
                  </p>
                  {feasibility.suggestions.map((s, idx) => (
                    <div key={idx} className="text-[11px] font-medium text-rose-800">• {s}</div>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pl-9">
                <button
                  type="button"
                  onClick={() => {
                    const nextHours = Math.min(8, dailyHours + 1);
                    setDailyHours(nextHours);
                    runFeasibilityCheck(availableDays, nextHours, startDate, targetDate);
                  }}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-extrabold bg-white border border-rose-300 text-rose-800 hover:bg-rose-100"
                >
                  Quick Fix: +1 hr/day ({Math.min(8, dailyHours + 1)} hrs)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const newTarget = addDaysTo(targetDate, 30);
                    setSelectedPresetDays('custom');
                    setTargetDate(newTarget);
                    runFeasibilityCheck(availableDays, dailyHours, startDate, newTarget);
                  }}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-extrabold bg-white border border-rose-300 text-rose-800 hover:bg-rose-100"
                >
                  Quick Fix: Add +1 Month
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="text-[10px] text-slate-500 font-bold uppercase">Course Needs</div>
              <div className="text-lg font-black text-slate-900 mt-0.5">{feasibility.total_syllabus_hours} hrs</div>
            </div>
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200">
              <div className="text-[10px] text-amber-800 font-bold uppercase">Your Available Time</div>
              <div className="text-lg font-black text-amber-700 mt-0.5">{feasibility.total_available_hours} hrs</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="text-[10px] text-slate-500 font-bold uppercase">Study Routine</div>
              <div className="text-sm font-black text-slate-900 mt-1">
                {availableDays.length} days/wk • {dailyHours} hrs/day
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900 text-amber-200 text-xs flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>What happens next?</strong> Your day-by-day schedule will be created and sent to your{' '}
              <strong>Admin / Teacher</strong>. Once they review feasibility and click <strong>Approve</strong>, your classes will follow this timetable!
            </span>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 inline-flex items-center"
            >
              <ArrowLeft className="mr-1.5 w-4 h-4" />
              Change Days or Hours
            </button>
            <button
              type="button"
              disabled={generateLoading}
              onClick={handleGeneratePlan}
              className="px-6 py-3 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 rounded-xl text-xs sm:text-sm font-black shadow-lg shadow-amber-500/20 inline-flex items-center disabled:opacity-50"
            >
              {generateLoading ? (
                'Building Schedule & Sending to Admin...'
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create Schedule &amp; Send to Admin
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
