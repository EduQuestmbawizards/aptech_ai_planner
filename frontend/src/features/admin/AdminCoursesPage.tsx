import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Course, CourseSyllabus } from '../../types';
import {
  BookOpen,
  Upload,
  Clock,
  Layers,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  FileText,
  X,
  Search,
} from 'lucide-react';

const COURSE_GROUPS = ['ALL', 'EduQuest', 'MBA Wizards', 'Aptech'] as const;
type CourseGroup = (typeof COURSE_GROUPS)[number];

export const AdminCoursesPage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState<CourseGroup>('ALL');
  const [courseSearch, setCourseSearch] = useState('');
  const [selectedCourseSyllabus, setSelectedCourseSyllabus] = useState<CourseSyllabus | null>(null);
  const [syllabusLoading, setSyllabusLoading] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  // Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ imported_count: number; skipped_count: number; details: string[] } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const res = await api.get('/courses');
      setCourses(res.data);
    } catch (err) {
      console.error('Failed to load courses', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleInspectSyllabus = async (courseId: string) => {
    try {
      setSyllabusLoading(true);
      const res = await api.get(`/courses/${courseId}/syllabus`);
      setSelectedCourseSyllabus(res.data);
      // expand all modules by default
      const exp: Record<string, boolean> = {};
      res.data.modules.forEach((m: any) => {
        exp[m.id] = true;
      });
      setExpandedModules(exp);
    } catch (err) {
      console.error('Failed to load syllabus', err);
    } finally {
      setSyllabusLoading(false);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      setImportError('Please select a JSON file.');
      return;
    }

    setImportLoading(true);
    setImportError(null);
    setImportResult(null);

    const formData = new FormData();
    formData.append('file', importFile);

    try {
      const res = await api.post('/courses/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(res.data);
      fetchCourses();
    } catch (err: any) {
      setImportError(err.response?.data?.detail || 'Course import failed. Please verify JSON schema.');
    } finally {
      setImportLoading(false);
    }
  };

  const toggleModule = (id: string) => {
    setExpandedModules((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const normalizedCategory = (c: Course) => {
    const cat = (c.category || '').trim();
    if (cat === 'EduQuest' || cat === 'MBA Wizards' || cat === 'Aptech') return cat;
    return 'Aptech';
  };

  const groupCounts: Record<CourseGroup, number> = {
    ALL: courses.length,
    EduQuest: courses.filter((c) => normalizedCategory(c) === 'EduQuest').length,
    'MBA Wizards': courses.filter((c) => normalizedCategory(c) === 'MBA Wizards').length,
    Aptech: courses.filter((c) => normalizedCategory(c) === 'Aptech').length,
  };

  const filteredCourses = courses.filter((c) => {
    if (groupFilter !== 'ALL' && normalizedCategory(c) !== groupFilter) return false;
    if (courseSearch.trim()) {
      const q = courseSearch.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.course_code.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Approved Course Catalogue</h1>
          <p className="text-xs text-slate-500 mt-1">
            Grouped syllabi for EduQuest, MBA Wizards, and Aptech Learning ({courses.length} total courses).
          </p>
        </div>
        <button
          onClick={() => {
            setShowImportModal(true);
            setImportResult(null);
            setImportError(null);
          }}
          className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-lg text-white bg-brand-600 hover:bg-brand-700 shadow-sm transition-colors"
        >
          <Upload className="w-4 h-4 mr-2" />
          Import Course JSON
        </button>
      </div>

      {/* Group Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {COURSE_GROUPS.map((grp) => (
            <button
              key={grp}
              type="button"
              onClick={() => setGroupFilter(grp)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                groupFilter === grp
                  ? 'bg-slate-900 text-amber-300 shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {grp === 'ALL' ? 'All Courses' : grp} ({groupCounts[grp]})
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={courseSearch}
            onChange={(e) => setCourseSearch(e.target.value)}
            placeholder="Search course name, code, or domain..."
            className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      {/* Courses List */}
      {loading ? (
        <div className="flex justify-center items-center h-40 bg-white rounded-2xl border border-slate-200">
          <div className="w-7 h-7 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500">
          No courses match &ldquo;{courseSearch}&rdquo; in {groupFilter === 'ALL' ? 'any catalogue' : groupFilter}.
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredCourses.map((course) => {
          const cat = normalizedCategory(course);
          return (
          <div
            key={course.id}
            className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm hover:border-brand-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-brand-50 text-brand-700 border border-brand-200">
                    {course.course_code}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      cat === 'EduQuest'
                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : cat === 'MBA Wizards'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {cat}
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Version {course.syllabus_version}
                </span>
              </div>
              <h2 className="text-sm font-bold text-slate-900 mt-2.5 leading-snug">{course.name}</h2>
              <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{course.description}</p>

              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 text-center">
                <div className="bg-slate-50 p-2 rounded-lg">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Official Duration</div>
                  <div className="text-xs font-bold text-slate-800 mt-0.5">
                    {course.official_duration_value} {course.official_duration_unit}
                  </div>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Total Hours</div>
                  <div className="text-xs font-bold text-brand-700 mt-0.5">{course.total_learning_hours} hrs</div>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Modules</div>
                  <div className="text-xs font-bold text-slate-800 mt-0.5">{course.modules_count || 0} Modules</div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 flex justify-end">
              <button
                onClick={() => handleInspectSyllabus(course.id)}
                className="inline-flex items-center text-xs font-semibold text-brand-600 hover:text-brand-800"
              >
                Inspect Curriculum Hierarchy
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </button>
            </div>
          </div>
          );
        })}
      </div>
      )}

      {/* Syllabus Viewer Modal */}
      {selectedCourseSyllabus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-100 overflow-y-auto max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-50 text-brand-700 font-semibold">
                  {selectedCourseSyllabus.course_code}
                </span>
                <h2 className="text-base font-bold text-slate-900 mt-1">{selectedCourseSyllabus.name}</h2>
              </div>
              <button
                onClick={() => setSelectedCourseSyllabus(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {selectedCourseSyllabus.modules.map((module, mIdx) => (
                <div key={module.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <button
                    onClick={() => toggleModule(module.id)}
                    className="w-full text-left p-4 bg-slate-50/80 hover:bg-slate-100 flex items-center justify-between transition-colors"
                  >
                    <div>
                      <span className="text-[10px] font-mono font-bold text-slate-500 uppercase mr-2">
                        Module {mIdx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-800">{module.title}</span>
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-slate-500">
                      <span className="font-semibold text-brand-700">{module.estimated_hours} hrs</span>
                      {expandedModules[module.id] ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {expandedModules[module.id] && (
                    <div className="p-4 divide-y divide-slate-100 bg-white">
                      {module.topics.map((topic, tIdx) => (
                        <div key={topic.id} className="py-3 first:pt-0 last:pb-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-900">
                              {tIdx + 1}. {topic.title}
                            </span>
                            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              {topic.estimated_hours} hrs
                            </span>
                          </div>
                          {topic.description && (
                            <p className="text-[11px] text-slate-500 mt-1">{topic.description}</p>
                          )}
                          {topic.subtopics && topic.subtopics.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {topic.subtopics.map((st, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700"
                                >
                                  {st}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Import JSON Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Import Course Syllabus JSON</h2>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {importResult && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg space-y-1">
                <div className="font-bold">
                  Imported: {importResult.imported_count} | Skipped: {importResult.skipped_count}
                </div>
                {importResult.details.map((d, i) => (
                  <div key={i} className="text-[11px] text-emerald-700">
                    • {d}
                  </div>
                ))}
              </div>
            )}

            {importError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            <form onSubmit={handleImportSubmit} className="space-y-4 mt-4">
              <p className="text-xs text-slate-500">
                Select a valid structured JSON file containing official course, module, and topic hours.
              </p>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-brand-500 transition-colors">
                <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={importLoading || !importFile}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {importLoading ? 'Validating & Importing...' : 'Upload & Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

