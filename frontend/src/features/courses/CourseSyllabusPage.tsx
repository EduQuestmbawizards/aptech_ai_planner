import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { CourseSyllabus, MyEnrolledCourse } from '../../types';
import { getCourseBrand } from '../../utils/courseHelper';
import {
  BookOpen,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Clock,
  Layers,
} from 'lucide-react';

export const CourseSyllabusPage: React.FC = () => {
  const [enrolledCourses, setEnrolledCourses] = useState<MyEnrolledCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [syllabus, setSyllabus] = useState<CourseSyllabus | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchEnrollments = async () => {
      try {
        setLoading(true);
        const res = await api.get('/enrollments/my');
        const items = res.data.items;
        setEnrolledCourses(items);
        if (items.length > 0) {
          setSelectedCourseId(items[0].course_id);
          loadSyllabus(items[0].course_id);
        }
      } catch (err) {
        console.error('Failed to load enrolled courses', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEnrollments();
  }, []);

  const loadSyllabus = async (courseId: string) => {
    try {
      const res = await api.get(`/courses/${courseId}/syllabus`);
      setSyllabus(res.data);
      const exp: Record<string, boolean> = {};
      res.data.modules.forEach((m: any) => {
        exp[m.id] = true;
      });
      setExpandedModules(exp);
    } catch (err) {
      console.error('Failed to load syllabus', err);
    }
  };

  const toggleModule = (id: string) => {
    setExpandedModules((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const currentCourse = enrolledCourses.find((c) => c.course_id === selectedCourseId);
  const brandName = getCourseBrand(
    syllabus?.category || (currentCourse as any)?.category,
    syllabus?.name || currentCourse?.course_name,
    syllabus?.course_code || currentCourse?.course_code
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">{brandName} Course Syllabus</h1>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative {brandName} curriculum hierarchy, accredited learning hours, and approved study resources.
          </p>
        </div>

        {enrolledCourses.length > 1 && (
          <select
            value={selectedCourseId}
            onChange={(e) => {
              setSelectedCourseId(e.target.value);
              loadSyllabus(e.target.value);
            }}
            className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:ring-2 focus:ring-brand-500"
          >
            {enrolledCourses.map((c) => (
              <option key={c.course_id} value={c.course_id}>
                {c.course_name}
              </option>
            ))}
          </select>
        )}
      </div>

      {syllabus && (
        <div className="space-y-4">
          {/* Syllabus Meta Header */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-50 text-brand-700 font-bold border border-brand-200">
                  {syllabus.course_code}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                  {brandName} Authorised Course
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-1">{syllabus.name}</h2>
              <div className="text-xs text-slate-500 mt-0.5">
                Official Duration: {syllabus.official_duration_value} {syllabus.official_duration_unit} • Total Accredited Hours: {syllabus.total_learning_hours} hrs
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-slate-400">Curriculum Version</span>
              <div className="text-sm font-bold text-slate-800">{syllabus.syllabus_version}</div>
            </div>
          </div>

          {/* Modules Accordion */}
          <div className="space-y-3">
            {syllabus.modules.map((module, mIdx) => (
              <div key={module.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleModule(module.id)}
                  className="w-full text-left p-4 sm:p-5 bg-slate-50/70 hover:bg-slate-100 flex items-center justify-between transition-colors"
                >
                  <div>
                    <span className="text-[10px] font-mono font-bold text-brand-700 uppercase tracking-wider mr-2">
                      Module {mIdx + 1}
                    </span>
                    <span className="text-sm font-bold text-slate-900">{module.title}</span>
                    {module.description && (
                      <p className="text-xs text-slate-500 mt-1">{module.description}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-3 text-xs text-slate-500 flex-shrink-0 ml-4">
                    <span className="font-semibold text-brand-700 bg-white px-2 py-1 rounded-md border border-slate-200">
                      {module.estimated_hours} hrs
                    </span>
                    {expandedModules[module.id] ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {expandedModules[module.id] && (
                  <div className="p-4 sm:p-5 divide-y divide-slate-100 space-y-4">
                    {module.topics.map((topic, tIdx) => (
                      <div key={topic.id} className="pt-4 first:pt-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="font-bold text-xs text-slate-900">
                            {tIdx + 1}. {topic.title}
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                              {topic.difficulty}
                            </span>
                            <span className="text-xs font-semibold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                              {topic.estimated_hours} hrs
                            </span>
                          </div>
                        </div>

                        {topic.description && (
                          <p className="text-xs text-slate-500 mt-1.5">{topic.description}</p>
                        )}

                        {topic.subtopics && topic.subtopics.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
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

                        {topic.resources && topic.resources.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-2">
                            {topic.resources.map((res, rIdx) => (
                              <a
                                key={rIdx}
                                href={res.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center px-2.5 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 text-[11px] font-medium transition-colors"
                              >
                                <FileText className="w-3 h-3 mr-1" />
                                {res.title}
                                <ExternalLink className="w-2.5 h-2.5 ml-1 opacity-70" />
                              </a>
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
      )}
    </div>
  );
};

