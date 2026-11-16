import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { AIUsageMetrics } from '../../types';
import { Sparkles, DollarSign, Cpu, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';

export const AdminAIUsagePage: React.FC = () => {
  const [metrics, setMetrics] = useState<AIUsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await api.get<AIUsageMetrics>('/ai/usage');
        setMetrics(res.data);
      } catch (err) {
        console.error('Failed to load AI usage stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsage();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">AI Operations & Token Usage</h1>
        <p className="text-xs text-slate-500 mt-1">
          Monitor token consumption, prompt analytics, and cost controls for OpenAI integrations.
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total LLM Requests</p>
          <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{metrics?.total_requests || 0}</h3>
          <p className="text-[11px] text-slate-400 mt-1">Across all student sessions</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Tokens Processed</p>
          <h3 className="text-2xl font-extrabold text-brand-600 mt-1">
            {(metrics?.total_tokens || 0).toLocaleString()}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">
            Prompt: {(metrics?.prompt_tokens || 0).toLocaleString()} | Completion: {(metrics?.completion_tokens || 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Estimated Cost</p>
          <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">
            ${(metrics?.estimated_cost_usd || 0).toFixed(4)} USD
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">Calculated via OpenAI pricing model</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Model</p>
          <h3 className="text-xl font-bold text-slate-800 mt-1 truncate">gpt-4o-mini</h3>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">Cost-optimized tier enabled</p>
        </div>
      </div>

      {/* Strict Cost Optimization Protocols */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 text-brand-700">
          <ShieldCheck className="w-5 h-5" />
          <h2 className="text-sm font-bold uppercase tracking-wider">Deterministic Cost Governance Architecture</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="font-bold text-slate-800 flex items-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-1.5" />
              Zero AI Calls for Routine Actions
            </div>
            <p className="text-slate-500 text-[11px]">
              Course selection, dashboard loading, syllabus inspection, task completion, and progress calculations execute purely against Supabase PostgreSQL and Python algorithms.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="font-bold text-slate-800 flex items-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-1.5" />
              Deterministic Scheduling Fallback
            </div>
            <p className="text-slate-500 text-[11px]">
              If OpenAI limits or network timeouts occur, the deterministic Python scheduling engine generates a complete, mathematically precise schedule without disruption.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="font-bold text-slate-800 flex items-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-1.5" />
              Syllabus Strictness Enforcement
            </div>
            <p className="text-slate-500 text-[11px]">
              All study tasks bind to official Aptech course topic foreign keys. AI is prevented from inventing unapproved modules or changing catalog duration.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="font-bold text-slate-800 flex items-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-1.5" />
              Context Scoping
            </div>
            <p className="text-slate-500 text-[11px]">
              The AI Learning Assistant injects only the active topic description and course title into the LLM context prompt, preventing token bloat.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

