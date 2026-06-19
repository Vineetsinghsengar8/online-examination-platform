import React, { useState, useEffect } from 'react';
import { useExam } from '../../context/ExamContext';
import { Eye, Trophy, TrendingUp, Users, CheckCircle, XCircle } from 'lucide-react';
import { StudentAnswersViewer } from './StudentAnswersViewer';

interface Attempt {
  attempt_id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  exam_id: number;
  exam_title: string;
  exam_code: string;
  start_time: string;
  end_time: string;
  completed: boolean;
  score: number | null;
  percentage: number | null;
}

const apiBaseUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';

const getHeaders = () => {
  const token = localStorage.getItem('AUTH_TOKEN');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

export const StudentResults: React.FC = () => {
  const { results, students, exams } = useExam();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [viewAttempt, setViewAttempt] = useState<Attempt | null>(null);
  const [filterExam, setFilterExam] = useState('');
  const [searchStudent, setSearchStudent] = useState('');
  const [activeTab, setActiveTab] = useState<'results' | 'attempts'>('results');

  useEffect(() => {
    const fetchAttempts = async () => {
      setLoadingAttempts(true);
      try {
        const res = await fetch(`${apiBaseUrl}/all_attempts`, { headers: getHeaders() });
        const body = await res.json();
        if (body.success) setAttempts(body.data || []);
      } catch { } finally { setLoadingAttempts(false); }
    };
    fetchAttempts();
  }, []);

  const filteredResults = results.filter(r => {
    const student = students.find(s => s.id === r.studentId);
    const matchExam = !filterExam || r.examId === filterExam;
    const matchStudent = !searchStudent || (student?.name?.toLowerCase().includes(searchStudent.toLowerCase()) || student?.email.toLowerCase().includes(searchStudent.toLowerCase()));
    return matchExam && matchStudent;
  });

  const filteredAttempts = attempts.filter(a => {
    const matchExam = !filterExam || a.exam_code === filterExam;
    const matchStudent = !searchStudent || a.student_name?.toLowerCase().includes(searchStudent.toLowerCase()) || a.student_email?.toLowerCase().includes(searchStudent.toLowerCase());
    return matchExam && matchStudent;
  });

  const avgScore = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + (r.totalScore > 0 ? (r.score / r.totalScore) * 100 : 0), 0) / results.length)
    : 0;
  const passCount = results.filter(r => r.totalScore > 0 && (r.score / r.totalScore) * 100 >= 50).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: <Users size={18} />, label: 'Total Results', value: results.length, color: 'bg-blue-50 text-blue-600' },
          { icon: <TrendingUp size={18} />, label: 'Average Score', value: `${avgScore}%`, color: 'bg-indigo-50 text-indigo-600' },
          { icon: <CheckCircle size={18} />, label: 'Passed', value: passCount, color: 'bg-green-50 text-green-600' },
          { icon: <XCircle size={18} />, label: 'Failed', value: results.length - passCount, color: 'bg-red-50 text-red-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${stat.color}`}>{stat.icon}</div>
            <div className="text-2xl font-black text-gray-800">{stat.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search student name / email..."
          value={searchStudent}
          onChange={e => setSearchStudent(e.target.value)}
          className="flex-1 min-w-48 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <select
          value={filterExam}
          onChange={e => setFilterExam(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">All Exams</option>
          {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
          {(['results', 'attempts'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium transition-colors capitalize ${activeTab === tab ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Results Table */}
      {activeTab === 'results' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800">Exam Results <span className="text-indigo-500">({filteredResults.length})</span></h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 text-left">Student</th>
                  <th className="px-4 py-3 text-left">Exam</th>
                  <th className="px-4 py-3 text-center">Score</th>
                  <th className="px-4 py-3 text-center">%</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-left">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredResults.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">No results found.</td></tr>
                )}
                {filteredResults.map((r, i) => {
                  const student = students.find(s => s.id === r.studentId);
                  const exam = exams.find(e => e.id === r.examId);
                  const pct = r.totalScore > 0 ? Math.round((r.score / r.totalScore) * 100) : 0;
                  return (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-800">{student?.name || r.studentId}</p>
                        <p className="text-xs text-gray-400">{student?.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-700">{exam?.title || r.examId}</p>
                        <p className="text-xs text-gray-400 font-mono">{r.examId}</p>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-gray-800">{r.score}/{r.totalScore}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold ${pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{pct}%</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pct >= 50 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {pct >= 50 ? 'Pass' : 'Fail'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(r.submittedAt).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attempts Table with Answer Viewer */}
      {activeTab === 'attempts' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800">Exam Attempts <span className="text-indigo-500">({filteredAttempts.length})</span></h3>
            <p className="text-xs text-gray-500 mt-0.5">Click the eye icon to review a student's answers</p>
          </div>
          {loadingAttempts ? (
            <div className="py-12 text-center text-gray-400 text-sm">Loading attempts...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-5 py-3 text-left">Student</th>
                    <th className="px-4 py-3 text-left">Exam</th>
                    <th className="px-4 py-3 text-center">Score</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-left">Time</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredAttempts.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">No attempts found.</td></tr>
                  )}
                  {filteredAttempts.map((a) => (
                    <tr key={a.attempt_id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-800">{a.student_name}</p>
                        <p className="text-xs text-gray-400">{a.student_email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-700">{a.exam_title}</p>
                        <p className="text-xs text-gray-400 font-mono">{a.exam_code}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {a.score !== null ? (
                          <span className="font-bold text-gray-800">{a.score} ({Math.round(a.percentage || 0)}%)</span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.completed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {a.completed ? 'Completed' : 'In Progress'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {a.start_time ? new Date(a.start_time).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setViewAttempt(a)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium transition-colors"
                        >
                          <Eye size={13} /> Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Answer Viewer Modal */}
      {viewAttempt && (
        <StudentAnswersViewer
          attemptId={viewAttempt.attempt_id}
          studentName={viewAttempt.student_name}
          studentEmail={viewAttempt.student_email}
          examTitle={viewAttempt.exam_title}
          onClose={() => setViewAttempt(null)}
        />
      )}
    </div>
  );
};
