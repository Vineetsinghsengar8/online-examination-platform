import React, { useState } from 'react';
import { Eye, CheckCircle, XCircle, Clock, User, BookOpen, Code } from 'lucide-react';

interface Answer {
  answer_id: number;
  attempt_id: number;
  question_id: number;
  question_text: string;
  selected_answer: string;
  correct_answer: string;
  is_correct: boolean | null;
  options: Record<string, string>;
}

interface AttemptData {
  attempt_id: number;
  student_name: string;
  student_email: string;
  exam_title: string;
  exam_code: string;
  start_time: string;
  end_time: string;
}

interface Props {
  attemptId: number;
  studentName: string;
  studentEmail: string;
  examTitle: string;
  onClose: () => void;
}

const apiBaseUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';

const getHeaders = () => {
  const token = localStorage.getItem('AUTH_TOKEN');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

export const StudentAnswersViewer: React.FC<Props> = ({ attemptId, studentName, studentEmail, examTitle, onClose }) => {
  const [data, setData] = useState<{ attempt: AttemptData; answers: Answer[]; total_questions: number; answered: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    const fetchAnswers = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiBaseUrl}/student_answers/${attemptId}`, { headers: getHeaders() });
        const body = await res.json();
        if (body.success) setData(body.data);
        else setError(body.message || 'Failed to load answers');
      } catch {
        setError('Network error loading answers');
      } finally {
        setLoading(false);
      }
    };
    fetchAnswers();
  }, [attemptId]);

  const isCodeAnswer = (answer: string) => {
    try { const parsed = JSON.parse(answer); return typeof parsed === 'object' && parsed.code; }
    catch { return false; }
  };

  const parseCodeAnswer = (answer: string) => {
    try { return JSON.parse(answer); } catch { return null; }
  };

  const correct = data?.answers.filter(a => a.is_correct === true).length ?? 0;
  const total = data?.total_questions ?? 0;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Eye size={20} className="text-indigo-500" /> Answer Review
            </h2>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1"><User size={13} /> {studentName} ({studentEmail})</span>
              <span className="flex items-center gap-1"><BookOpen size={13} /> {examTitle}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl font-bold p-1">×</button>
        </div>

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
              <span className="text-sm">Loading answers...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="m-5 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
        )}

        {data && !loading && (
          <>
            {/* Score Summary */}
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className={`text-2xl font-black ${pct >= 50 ? 'text-green-600' : 'text-red-600'}`}>{pct}%</div>
                <div className="text-sm text-gray-500">Score: <strong>{correct}/{total}</strong></div>
              </div>
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600"><CheckCircle size={14} /> {correct} correct</span>
                <span className="flex items-center gap-1 text-red-500"><XCircle size={14} /> {total - correct} wrong</span>
                <span className="flex items-center gap-1 text-gray-400"><Clock size={14} /> {data.answered} answered</span>
              </div>
              {data.attempt.start_time && (
                <div className="text-xs text-gray-400 ml-auto">
                  {new Date(data.attempt.start_time).toLocaleString()} – {data.attempt.end_time ? new Date(data.attempt.end_time).toLocaleString() : 'In Progress'}
                </div>
              )}
            </div>

            {/* Answers List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {data.answers.length === 0 && (
                <p className="text-center text-gray-400 py-8 text-sm">No answers submitted for this attempt.</p>
              )}
              {data.answers.map((ans, idx) => {
                const isCode = isCodeAnswer(ans.selected_answer || '');
                const parsedCode = isCode ? parseCodeAnswer(ans.selected_answer) : null;
                return (
                  <div key={ans.answer_id} className={`rounded-xl border p-4 ${ans.is_correct === true ? 'border-green-200 bg-green-50' : ans.is_correct === false ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-sm font-medium text-gray-800">
                        <span className="text-gray-400 font-bold mr-1">Q{idx + 1}.</span> {ans.question_text}
                      </p>
                      {ans.is_correct === true && <CheckCircle size={18} className="text-green-500 shrink-0" />}
                      {ans.is_correct === false && <XCircle size={18} className="text-red-500 shrink-0" />}
                      {ans.is_correct === null && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">Manual Review</span>}
                    </div>

                    {isCode && parsedCode ? (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <Code size={13} className="text-purple-500" />
                          <span className="text-xs font-medium text-purple-700">Code Submission ({parsedCode.language})</span>
                        </div>
                        <pre className="bg-gray-900 text-green-300 text-xs p-3 rounded-lg overflow-x-auto font-mono">{parsedCode.code}</pre>
                        {parsedCode.test_results && (
                          <div className="flex gap-2 flex-wrap">
                            {parsedCode.test_results.map((r: any, ti: number) => (
                              <span key={ti} className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                TC{ti + 1}: {r.passed ? '✓ Pass' : '✗ Fail'}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 space-y-1.5">
                        {Object.values(ans.options).filter(Boolean).length > 0 && (
                          <div className="grid grid-cols-2 gap-1">
                            {Object.entries(ans.options).filter(([, v]) => v).map(([k, v]) => (
                              <div key={k} className={`text-xs px-2 py-1 rounded-lg ${v === ans.correct_answer ? 'bg-green-100 text-green-700 font-medium' : v === ans.selected_answer && v !== ans.correct_answer ? 'bg-red-100 text-red-600 line-through' : 'bg-gray-50 text-gray-600'}`}>
                                {v}
                                {v === ans.correct_answer && ' ✓'}
                                {v === ans.selected_answer && v !== ans.correct_answer && ' (selected)'}
                              </div>
                            ))}
                          </div>
                        )}
                        {ans.selected_answer && !Object.values(ans.options).filter(Boolean).length && (
                          <div className="bg-white border border-gray-200 rounded-lg p-2.5 text-sm text-gray-700">
                            {ans.selected_answer}
                          </div>
                        )}
                        {!ans.selected_answer && (
                          <p className="text-xs text-gray-400 italic">No answer submitted</p>
                        )}
                        {ans.correct_answer && (
                          <p className="text-xs text-green-700 font-medium">✓ Correct: {ans.correct_answer}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
