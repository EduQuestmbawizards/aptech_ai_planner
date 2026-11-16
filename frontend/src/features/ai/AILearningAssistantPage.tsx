import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { MyEnrolledCourse, CourseSyllabus, AITutorResponse } from '../../types';
import {
  Bot,
  Send,
  Sparkles,
  BookOpen,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
} from 'lucide-react';

export const AILearningAssistantPage: React.FC = () => {
  const [courses, setCourses] = useState<MyEnrolledCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [syllabus, setSyllabus] = useState<CourseSyllabus | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');

  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; text: string; data?: AITutorResponse }[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await api.get('/enrollments/my');
        const active = res.data.items.filter((e: any) => e.status === 'ACTIVE');
        setCourses(active);
        if (active.length > 0) {
          setSelectedCourseId(active[0].course_id);
          fetchSyllabus(active[0].course_id);
        }
      } catch (err) {
        console.error('Failed to load courses', err);
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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    const targetCourseId = selectedCourseId || (courses.length > 0 ? courses[0].course_id : undefined);

    const userText = question.trim();
    setQuestion('');
    setErrorMsg(null);
    setChatHistory((prev) => [...prev, { role: 'user', text: userText }]);
    setLoading(true);

    try {
      const historyPayload = chatHistory.map((m) => ({
        role: m.role,
        content: m.text,
      }));

      const res = await api.post<AITutorResponse>('/ai/tutor', {
        course_id: targetCourseId,
        topic_id: selectedTopicId || null,
        question: userText,
        conversation_history: historyPayload,
      });

      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: res.data.answer,
          data: res.data,
        },
      ]);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to get answer from AI Assistant.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">AI Learning Assistant</h1>
          <p className="text-xs text-slate-500 mt-1">
            Official curriculum tutor. Ask technical questions, get code explanations, and practice interview questions.
          </p>
        </div>

        {/* Course & Topic Context Pickers */}
        <div className="flex flex-wrap items-center gap-2">
          {courses.length > 1 && (
            <select
              value={selectedCourseId}
              onChange={(e) => {
                setSelectedCourseId(e.target.value);
                fetchSyllabus(e.target.value);
                setSelectedTopicId('');
              }}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700"
            >
              {courses.map((c) => (
                <option key={c.course_id} value={c.course_id}>
                  {c.course_name}
                </option>
              ))}
            </select>
          )}

          {syllabus && (
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 max-w-xs truncate"
            >
              <option value="">Whole Course Context</option>
              {syllabus.modules.map((m) =>
                m.topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {m.module_code} — {t.title}
                  </option>
                ))
              )}
            </select>
          )}
        </div>
      </div>

      {/* Main Chat Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-[650px] overflow-hidden">
        {/* Chat History View */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {chatHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">How can I assist your Aptech studies today?</h3>
              <p className="text-xs text-slate-500 max-w-md">
                Ask about syntax, algorithmic complexity, architectural patterns, or request sample practice questions based on your current syllabus topic.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 max-w-lg text-left">
                {[
                  'Explain the difference between synchronous and async execution in Python FastAPI.',
                  'How does PostgreSQL indexing optimize high-volume queries?',
                  'What are the best practices for state management in React 18?',
                  'Generate 3 practical lab questions on React Hook Form and Zod.',
                ].map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => setQuestion(prompt)}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-brand-300 bg-slate-50/50 hover:bg-white text-[11px] text-slate-700 transition-colors text-left"
                  >
                    "{prompt}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            chatHistory.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-2xl rounded-2xl p-4 text-xs ${
                    msg.role === 'user'
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-slate-50 border border-slate-200/80 text-slate-900 space-y-3 shadow-xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>

                  {msg.data && (
                    <div className="pt-3 border-t border-slate-200/60 space-y-2.5 text-[11px]">
                      {msg.data.key_takeaways.length > 0 && (
                        <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1">
                          <div className="font-bold text-slate-800 flex items-center">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-500 mr-1" />
                            Key Takeaways:
                          </div>
                          {msg.data.key_takeaways.map((k, i) => (
                            <div key={i} className="text-slate-600">
                              • {k}
                            </div>
                          ))}
                        </div>
                      )}

                      {msg.data.suggested_practice_questions.length > 0 && (
                        <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1">
                          <div className="font-bold text-slate-800 flex items-center">
                            <HelpCircle className="w-3.5 h-3.5 text-brand-600 mr-1" />
                            Suggested Practice Questions:
                          </div>
                          {msg.data.suggested_practice_questions.map((q, i) => (
                            <div key={i} className="text-slate-600">
                              {i + 1}. {q}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="text-[10px] text-slate-400 text-right">
                        Model: {msg.data.model_used}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex items-center space-x-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl w-fit">
              <Sparkles className="w-4 h-4 text-brand-600 animate-spin" />
              <span>Analyzing curriculum & formulating structured response...</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-100 bg-white">
          <form onSubmit={handleSend} className="flex items-center space-x-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a technical doubt or request practice exercises..."
              className="flex-1 text-xs px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="p-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

