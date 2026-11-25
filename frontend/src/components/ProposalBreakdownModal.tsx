import React from 'react';
import {
  X,
  Sparkles,
  Calendar,
  Clock,
  Target,
  BookOpen,
  CheckCircle2,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { ProfileRoadmapItem } from '../types';

interface ProposalBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: ProfileRoadmapItem | null;
  onViewHtml: (proposal: ProfileRoadmapItem) => void;
}

export const ProposalBreakdownModal: React.FC<ProposalBreakdownModalProps> = ({
  isOpen,
  onClose,
  proposal,
  onViewHtml,
}) => {
  if (!isOpen || !proposal) return null;

  const bp = proposal.ai_blueprint;
  const rawActions = proposal.main_actions || '';
  const rawOutputs = proposal.milestones_outputs || '';

  const title = bp?.title || proposal.period;
  const category = bp?.category || (proposal.proposal_type || 'GLOBAL_COMPETITION').replace(/_/g, ' ');
  const priority = bp?.priority || proposal.priority || 'NORMAL';
  const timeline = bp?.target_timeline || proposal.target_timeline || proposal.session_date || 'Target Academic Cycle';
  const duration = bp?.estimated_duration || '4-8 Weeks';
  const focusArea = bp?.focus_area || rawActions;

  const actionPlan: string[] =
    bp?.action_plan && bp.action_plan.length > 0
      ? bp.action_plan
      : rawActions
          .split('\n')
          .map((s) => s.trim().replace(/^[-•* \t]+/, ''))
          .filter(Boolean);

  const deliverables: string[] =
    bp?.deliverables && bp.deliverables.length > 0
      ? bp.deliverables
      : rawOutputs
      ? rawOutputs
          .split('\n')
          .map((s) => s.trim().replace(/^[-•* \t]+/, ''))
          .filter(Boolean)
      : ['Milestone execution output dossier'];

  const facultyNotes = bp?.faculty_mentorship_notes || proposal.feedback_notes || null;

  const priorityBadgeStyle =
    priority === 'HIGH'
      ? 'bg-rose-500/20 text-rose-300 border-rose-400/40'
      : priority === 'MEDIUM'
      ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
      : 'bg-blue-500/20 text-blue-300 border-blue-400/40';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-amber-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in duration-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 text-white p-5 sm:p-6 flex items-start justify-between gap-4 border-b border-amber-500/20">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${priorityBadgeStyle}`}>
                {priority} Priority
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30 uppercase">
                {category}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-slate-300 border border-white/15">
                Status: {proposal.status.replace('_', ' ')}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {title}
            </h2>
            <div className="flex flex-wrap items-center gap-4 mt-2.5 text-xs text-amber-200/90 font-medium">
              <span className="flex items-center">
                <Calendar className="w-4 h-4 mr-1.5 text-amber-400" />
                Target Timeline: <strong className="text-white ml-1">{timeline}</strong>
              </span>
              <span className="flex items-center">
                <Clock className="w-4 h-4 mr-1.5 text-amber-400" />
                Estimated Duration: <strong className="text-white ml-1">{duration}</strong>
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* Card 1: Focus Area & Scope (Kis Section me kya hai) */}
          <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200/90 shadow-2xs">
            <div className="text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
              <Target className="w-4 h-4 text-amber-600" />
              <span>1. Initiative Scope &amp; Focus Area (Kis Section me kya hai)</span>
            </div>
            <p className="text-xs sm:text-sm text-amber-950 font-medium leading-relaxed whitespace-pre-line">
              {focusArea}
            </p>
          </div>

          {/* Card 2: Step-by-Step Action Plan (Kya karna hai) */}
          <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span>2. Execution Action Plan (Kya karna hai — Step-by-Step)</span>
            </div>
            <div className="space-y-2">
              {actionPlan.map((step, sIdx) => (
                <div
                  key={sIdx}
                  className="flex items-start space-x-2.5 text-xs text-slate-800 bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs hover:border-amber-300 transition-colors"
                >
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                    {sIdx + 1}
                  </span>
                  <p className="font-medium leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: Expected Deliverables & Milestones */}
          <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/90 shadow-2xs">
            <div className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>3. Expected Deliverables &amp; Output Milestones</span>
            </div>
            <div className="space-y-2">
              {deliverables.map((deliv, dIdx) => (
                <div
                  key={dIdx}
                  className="flex items-start space-x-2.5 text-xs text-emerald-950 bg-white/95 p-2.5 rounded-xl border border-emerald-100 shadow-2xs"
                >
                  <span className="w-4 h-4 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                    ✓
                  </span>
                  <span className="font-semibold leading-relaxed">{deliv}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 4: Mentorship & Faculty Review Notes */}
          {facultyNotes && (
            <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200/90 text-xs text-blue-950 space-y-1">
              <div className="font-bold text-blue-900 flex items-center space-x-1.5 uppercase text-[10px] tracking-wider">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Faculty Mentorship Review Focus:</span>
              </div>
              <p className="font-medium text-slate-800 leading-relaxed whitespace-pre-line">
                {facultyNotes}
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            AI Structured Proposal Blueprint • EduQuest Mentorship Track
          </div>
          <div className="flex items-center space-x-2.5 w-full sm:w-auto">
            {proposal.proposal_html_url && (
              <button
                onClick={() => {
                  onClose();
                  onViewHtml(proposal);
                }}
                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>View Full Interactive HTML Model</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
