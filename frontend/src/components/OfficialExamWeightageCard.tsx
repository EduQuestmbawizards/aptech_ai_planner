import React, { useState } from 'react';
import {
  AP_MICRO_WEIGHTAGE,
  AP_MACRO_WEIGHTAGE,
  APUnitWeightage,
} from '../utils/courseHelper';
import {
  Award,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  TrendingUp,
  BookOpen,
} from 'lucide-react';

interface OfficialExamWeightageCardProps {
  courseCode?: string;
  courseName?: string;
}

export const OfficialExamWeightageCard: React.FC<OfficialExamWeightageCardProps> = ({
  courseCode,
  courseName,
}) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'MICRO' | 'MACRO'>('ALL');
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);

  const isEconCourse =
    !courseCode ||
    courseCode.includes('ECON') ||
    courseCode.includes('AP-MIC') ||
    courseCode.includes('AP-MAC') ||
    (courseName && /micro|macro|economic/i.test(courseName));

  if (!isEconCourse) return null;

  const displayUnits: APUnitWeightage[] =
    activeTab === 'ALL'
      ? [...AP_MICRO_WEIGHTAGE, ...AP_MACRO_WEIGHTAGE]
      : activeTab === 'MICRO'
      ? AP_MICRO_WEIGHTAGE
      : AP_MACRO_WEIGHTAGE;

  return (
    <div className="bg-white rounded-3xl border border-amber-200/90 shadow-sm overflow-hidden space-y-0">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 text-white p-5 sm:p-6 border-b border-amber-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center text-[10px] font-mono font-bold tracking-widest uppercase bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
                <Award className="w-3.5 h-3.5 mr-1 text-amber-400" />
                Official College Board CED Curriculum
              </span>
              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
                Exam Weightage Guide
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
              <span>AP Economics Unit Weightage &amp; High-Yield Focus</span>
            </h3>
            <p className="text-xs text-amber-100/70 max-w-2xl">
              Official multiple-choice section weighting sourced directly from College Board Course &amp; Exam Descriptions (CED).
            </p>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-center">
            <a
              href="https://apstudents.collegeboard.org/courses/ap-microeconomics"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-xs"
            >
              <span>AP Micro</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>
            <a
              href="https://apstudents.collegeboard.org/courses/ap-macroeconomics"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-xs"
            >
              <span>AP Macro</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 sm:gap-2 pt-4 mt-4 border-t border-slate-800 overflow-x-auto pb-1 max-w-full">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'ALL'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            All 12 Units (Combined Track)
          </button>
          <button
            onClick={() => setActiveTab('MICRO')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'MICRO'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            AP Microeconomics (Units 1–6)
          </button>
          <button
            onClick={() => setActiveTab('MACRO')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'MACRO'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            AP Macroeconomics (Units 1–6)
          </button>
        </div>
      </div>

      {/* Grid of Unit Cards */}
      <div className="p-4 sm:p-5 bg-slate-50/60">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {displayUnits.map((unit) => {
            const isMicro = unit.track === 'Microeconomics';
            const unitKey = `${unit.track}-Unit${unit.unitNumber}`;
            const isExpanded = expandedUnit === unitKey;

            return (
              <div
                key={unitKey}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-amber-400/80 p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        isMicro
                          ? 'bg-amber-100/90 text-amber-900 border-amber-300'
                          : 'bg-indigo-100/90 text-indigo-900 border-indigo-300'
                      }`}
                    >
                      {unit.track}
                    </span>

                    <span
                      className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border shadow-2xs ${
                        unit.isHighYield
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                      title="College Board Multiple-Choice Exam Weighting"
                    >
                      {unit.weightage} Weight
                    </span>
                  </div>

                  <h4 className="font-extrabold text-slate-900 text-sm leading-snug">
                    Unit {unit.unitNumber}: {unit.title}
                  </h4>

                  {unit.isHighYield && (
                    <div className="mt-1 flex items-center text-[10px] font-bold text-emerald-700">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      <span>High-Yield Exam Focus (20%+ Weight)</span>
                    </div>
                  )}

                  {/* Core Topics Checklist */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Core Exam Concepts:
                    </div>
                    <ul className="text-[11px] text-slate-600 space-y-0.5">
                      {(isExpanded ? unit.coreTopics : unit.coreTopics.slice(0, 2)).map(
                        (topic, i) => (
                          <li key={i} className="flex items-start space-x-1.5">
                            <span className="text-amber-500 font-black">•</span>
                            <span className="leading-tight">{topic}</span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setExpandedUnit(isExpanded ? null : unitKey)}
                    className="text-[11px] font-bold text-amber-700 hover:text-amber-800 inline-flex items-center space-x-0.5"
                  >
                    <span>{isExpanded ? 'Show Less' : `+${unit.coreTopics.length - 2} more concepts`}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                  <span className="text-[10px] font-mono text-slate-400">
                    College Board CED
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
