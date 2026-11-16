import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { MyEnrolledCourse } from '../../types';
import {
  ArrowRight,
  BookOpen,
  Compass,
  FileDown,
  Info,
  X,
  CheckCircle2,
  Calendar,
  Receipt,
  Layers,
  Lock,
} from 'lucide-react';

export const MyCoursesPage: React.FC = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<MyEnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Course Details Modal state
  const [selectedEnrolled, setSelectedEnrolled] = useState<MyEnrolledCourse | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        const enrRes = await api.get('/enrollments/my');
        setCourses(enrRes.data.items || []);
      } catch (err) {
        console.error('Failed to load courses', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  const handleDownloadInvoice = async (course: MyEnrolledCourse) => {
    setDownloadingId(course.enrollment_id);
    try {
      const response = await api.get(`/enrollments/${course.enrollment_id}/invoice/pdf`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const invoiceSlug = course.invoice_number || course.enrollment_id.slice(0, 8);
      link.setAttribute('download', `Aptech_Invoice_${course.course_code}_${invoiceSlug}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to download invoice PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
            My Enrolled Courses
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Inspect complete course details, download official admission invoices, or launch your study plan.
          </p>
        </div>
        <div className="inline-flex items-center px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 self-start">
          {courses.length} Active Enrollment{courses.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Enrolled Courses Grid */}
      {courses.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
          <BookOpen className="w-10 h-10 text-amber-500 mx-auto mb-2" />
          <h2 className="text-sm font-bold text-slate-900">No Enrolled Courses Yet</h2>
          <p className="text-xs text-slate-500 mt-1">
            Once your Aptech center admin approves your admission, your enrolled courses and invoices will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {courses.map((c) => (
            <div
              key={c.enrollment_id}
              className="bg-white p-6 rounded-2xl border border-amber-200/70 shadow-sm hover:shadow-md hover:border-amber-400/70 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-md border border-amber-300">
                      {c.course_code}
                    </span>
                    {c.syllabus_version && (
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {c.syllabus_version}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {c.access_type === 'TRIAL' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-indigo-800 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                        <Lock className="w-2.5 h-2.5" />
                        FREE TRIAL (20%)
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        {c.status}
                      </span>
                    )}
                  </div>
                </div>

                <h2 className="text-base md:text-lg font-extrabold text-slate-900 mt-3 leading-snug">
                  {c.course_name}
                </h2>
                {c.description && (
                  <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                    {c.description}
                  </p>
                )}

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-3.5 border-t border-slate-100">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Duration</span>
                    <div className="font-bold text-slate-800 mt-0.5">
                      {c.official_duration_value} {c.official_duration_unit}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Total Hours</span>
                    <div className="font-bold text-amber-700 mt-0.5">{c.total_learning_hours} hrs</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Curriculum</span>
                    <div className="font-bold text-slate-800 mt-0.5">
                      {c.modules_count ?? 0} Mod • {c.topics_count ?? 0} Topics
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Enrolled On</span>
                    <div className="font-bold text-slate-800 mt-0.5">{c.enrolled_date}</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedEnrolled(c)}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 transition-colors"
                  >
                    <Info className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                    Details
                  </button>

                  {c.access_type === 'TRIAL' ? (
                    <div
                      className="inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed select-none"
                      title="Invoice download is locked for Free Trial accounts. Enroll to unlock."
                    >
                      <span className="inline-flex items-center blur-[1.5px] opacity-60">
                        <FileDown className="w-3.5 h-3.5 mr-1.5" />
                        Download Invoice
                      </span>
                      <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 text-[10px] font-extrabold">
                        <Lock className="w-2.5 h-2.5" />
                        Locked
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDownloadInvoice(c)}
                      disabled={downloadingId === c.enrollment_id}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 transition-colors disabled:opacity-50"
                    >
                      <FileDown className="w-3.5 h-3.5 mr-1.5 text-amber-700" />
                      {downloadingId === c.enrollment_id ? 'Preparing PDF...' : 'Download Invoice'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => navigate('/syllabus')}
                    className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    <BookOpen className="w-3.5 h-3.5 mr-1" />
                    Syllabus
                  </button>
                </div>

                {c.has_active_plan ? (
                  <button
                    type="button"
                    onClick={() => navigate('/planner')}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl text-xs font-extrabold shadow-sm flex items-center"
                  >
                    <Compass className="w-3.5 h-3.5 mr-1.5" />
                    Open Study Plan
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate('/planner/onboarding')}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl text-xs font-extrabold shadow-sm flex items-center"
                  >
                    Configure Planner
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Enrolled Course Details & Invoice Modal */}
      {selectedEnrolled && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-amber-200">
            <div className="bg-slate-900 text-white p-6 flex items-start justify-between border-b-2 border-amber-400">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded bg-amber-400 text-slate-950">
                    {selectedEnrolled.course_code}
                  </span>
                  <span className="text-[11px] text-amber-200 font-mono">
                    {selectedEnrolled.invoice_number}
                  </span>
                </div>
                <h2 className="text-lg font-black text-white mt-2">{selectedEnrolled.course_name}</h2>
                <p className="text-xs text-amber-200/80 mt-0.5">
                  {selectedEnrolled.category || 'Aptech Career Track'} • Difficulty: {selectedEnrolled.difficulty_level || 'INTERMEDIATE'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEnrolled(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {selectedEnrolled.description && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Course Overview
                  </h3>
                  <p className="text-xs text-slate-700 leading-relaxed">{selectedEnrolled.description}</p>
                </div>
              )}

              {/* Enrollment & Payment Info */}
              <div className="bg-amber-50/70 rounded-2xl p-4 border border-amber-200/80 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-amber-800 flex items-center gap-1">
                    <Receipt className="w-3 h-3" /> Invoice No
                  </span>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">
                    {selectedEnrolled.invoice_number || 'Generated'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-amber-800 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Enrolled Date
                  </span>
                  <div className="font-bold text-slate-900 mt-0.5">{selectedEnrolled.enrolled_date}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-amber-800">Payment Ref</span>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">
                    {selectedEnrolled.payment_reference || 'Verified at Center'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-amber-800">Valid Until</span>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {selectedEnrolled.valid_until || 'Course Completion'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-amber-800">Official Duration</span>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {selectedEnrolled.official_duration_value} {selectedEnrolled.official_duration_unit}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-amber-800">Accredited Hours</span>
                  <div className="font-bold text-amber-700 mt-0.5">
                    {selectedEnrolled.total_learning_hours} hrs
                  </div>
                </div>
              </div>

              {/* Prerequisites */}
              {selectedEnrolled.prerequisites && selectedEnrolled.prerequisites.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Prerequisites
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedEnrolled.prerequisites.map((p, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 mr-1.5" />
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Module Breakdown */}
              {selectedEnrolled.modules_summary && selectedEnrolled.modules_summary.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-600" />
                    Included Curriculum Modules ({selectedEnrolled.modules_count})
                  </h3>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {selectedEnrolled.modules_summary.map((m, idx) => (
                      <div key={idx} className="px-4 py-2.5 bg-white flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                            {m.module_code}
                          </span>
                          <span className="font-semibold text-slate-800 truncate">{m.title}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium flex-shrink-0 ml-2">
                          {m.topics_count} topics • <strong className="text-slate-700">{m.estimated_hours} hrs</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Footer Buttons */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                {selectedEnrolled.access_type === 'TRIAL' ? (
                  <div
                    className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-extrabold bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed select-none"
                    title="Invoice download is locked for Free Trial accounts. Enroll to unlock."
                  >
                    <span className="inline-flex items-center blur-[1.5px] opacity-60">
                      <FileDown className="w-4 h-4 mr-1.5" />
                      Download Official Invoice (PDF)
                    </span>
                    <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-amber-300 text-[10px] font-extrabold">
                      <Lock className="w-3 h-3" />
                      Enroll to Unlock
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDownloadInvoice(selectedEnrolled)}
                    disabled={downloadingId === selectedEnrolled.enrollment_id}
                    className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-extrabold bg-slate-900 hover:bg-slate-800 text-amber-300 shadow-sm disabled:opacity-50"
                  >
                    <FileDown className="w-4 h-4 mr-1.5" />
                    {downloadingId === selectedEnrolled.enrollment_id ? 'Downloading...' : 'Download Official Invoice (PDF)'}
                  </button>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEnrolled(null);
                      navigate('/syllabus');
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    Full Syllabus
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const hasPlan = selectedEnrolled.has_active_plan;
                      setSelectedEnrolled(null);
                      navigate(hasPlan ? '/planner' : '/planner/onboarding');
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-sm"
                  >
                    {selectedEnrolled.has_active_plan ? 'Open Study Plan' : 'Create Study Plan'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
