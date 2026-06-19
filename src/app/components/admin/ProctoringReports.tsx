import React, { useState, useEffect } from 'react';
import { useExam } from '../../context/ExamContext';
import { AlertTriangle, Filter, X, Download, ShieldAlert, ShieldCheck, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface EvidenceModalProps {
  isOpen: boolean;
  evidence?: string;
  timestamp: string;
  studentName: string;
  violationType: string;
  onClose: () => void;
}

const apiBaseUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';
const getHeaders = () => {
  const token = localStorage.getItem('AUTH_TOKEN');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

const EvidenceModal: React.FC<EvidenceModalProps> = ({ isOpen, evidence, timestamp, studentName, violationType, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Evidence Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-xs font-semibold text-gray-500 uppercase">Student</p><p className="text-gray-900 font-medium">{studentName}</p></div>
            <div><p className="text-xs font-semibold text-gray-500 uppercase">Violation Type</p><p className="text-gray-900 font-medium capitalize">{violationType.replace('_', ' ')}</p></div>
            <div className="col-span-2"><p className="text-xs font-semibold text-gray-500 uppercase">Timestamp</p><p className="text-gray-900 font-medium">{new Date(timestamp).toLocaleString()}</p></div>
          </div>
          {evidence ? (
            <div className="border-t border-gray-200 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Screenshot</p>
              {evidence.startsWith('data:image') ? (
                <img src={evidence} alt="Evidence" className="w-full rounded-lg border border-gray-200 max-h-64 object-cover" />
              ) : (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200"><p className="text-sm text-gray-600 break-words">{evidence}</p></div>
              )}
            </div>
          ) : (
            <div className="border-t border-gray-200 pt-4 bg-gray-50 p-4 rounded-lg text-center"><p className="text-sm text-gray-500">No evidence captured for this violation</p></div>
          )}
        </div>
      </div>
    </div>
  );
};

interface RiskReport {
  student_id: number;
  total_violations: number;
  risk_score: number;
  risk_level: 'Low' | 'Medium' | 'High';
  summary: Record<string, number>;
  recommendation: string;
}

const RiskBadge: React.FC<{ level: string }> = ({ level }) => {
  const map: Record<string, { icon: React.ReactNode; color: string }> = {
    Low: { icon: <ShieldCheck size={13} />, color: 'bg-green-100 text-green-700' },
    Medium: { icon: <Shield size={13} />, color: 'bg-amber-100 text-amber-700' },
    High: { icon: <ShieldAlert size={13} />, color: 'bg-red-100 text-red-700' },
  };
  const m = map[level] || map.Low;
  return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${m.color}`}>{m.icon} {level} Risk</span>;
};

export const ProctoringReports: React.FC = () => {
  const { logs, students, exams } = useExam();
  const [examFilter, setExamFilter] = useState('');
  const [selectedEvidence, setSelectedEvidence] = useState<any>(null);
  const [riskReports, setRiskReports] = useState<Record<string, RiskReport>>({});
  const [loadingRisk, setLoadingRisk] = useState(false);

  const filteredLogs = examFilter ? logs.filter(l => l.examId === examFilter) : [];

  const studentIdsInExam = Array.from(new Set(filteredLogs.map(l => l.studentId)));

  useEffect(() => {
    if (!examFilter || studentIdsInExam.length === 0) { setRiskReports({}); return; }
    const fetchReports = async () => {
      setLoadingRisk(true);
      const reports: Record<string, RiskReport> = {};
      await Promise.all(studentIdsInExam.map(async (sid) => {
        try {
          const res = await fetch(`${apiBaseUrl}/proctoring_report/${sid}?exam_id=${encodeURIComponent(examFilter)}`, { headers: getHeaders() });
          const body = await res.json();
          if (body.success) reports[sid] = body.data;
        } catch { /* ignore */ }
      }));
      setRiskReports(reports);
      setLoadingRisk(false);
    };
    fetchReports();
  }, [examFilter, logs.length]);

  const getStudentName = (sid: string) => students.find(s => s.id === sid)?.email || sid;

  const downloadProctoringCSV = () => {
    if (!examFilter) { toast.error('Please select an exam first'); return; }
    if (filteredLogs.length === 0) { toast.error('No proctoring reports to download'); return; }
    try {
      const header = ['student_email', 'exam_id', 'violation_type', 'timestamp', 'evidence'];
      const rows = filteredLogs.map(l => [
        getStudentName(l.studentId), l.examId, l.type,
        new Date(l.timestamp).toISOString(),
        l.evidence ? (l.evidence.length > 200 ? l.evidence.slice(0,200) + '...[truncated]' : l.evidence) : ''
      ]);
      const csvContent = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `proctoring_${examFilter}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click(); URL.revokeObjectURL(url);
      toast.success('Proctoring CSV downloaded');
    } catch (err) { toast.error('Failed to generate CSV'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center space-x-3">
          <Filter size={18} className="text-gray-400" />
          <select className="border-none bg-transparent focus:ring-0 text-gray-700 font-medium text-sm outline-none" value={examFilter} onChange={e => setExamFilter(e.target.value)}>
            <option value="">Select an exam to view AI proctoring reports</option>
            {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </div>
        <button onClick={downloadProctoringCSV} disabled={!examFilter || filteredLogs.length === 0} className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-40 text-sm font-medium transition-colors">
          <Download size={15} /><span>Download CSV</span>
        </button>
      </div>

      {/* Risk Summary Cards */}
      {examFilter && studentIdsInExam.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <ShieldAlert size={16} className="text-indigo-500" /> AI Proctoring Risk Assessment
            {loadingRisk && <span className="text-xs text-gray-400 font-normal">(analyzing...)</span>}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {studentIdsInExam.map(sid => {
              const report = riskReports[sid];
              if (!report) return null;
              return (
                <div key={sid} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm text-gray-800 truncate">{getStudentName(sid)}</span>
                    <RiskBadge level={report.risk_level} />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${report.risk_score < 30 ? 'bg-green-500' : report.risk_score < 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, report.risk_score)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-500">{report.risk_score}</span>
                  </div>
                  <p className="text-xs text-gray-500">{report.total_violations} violation(s)</p>
                  <p className="text-xs text-gray-400 mt-1 italic">{report.recommendation}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Student</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Exam ID</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Violation Type</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Time</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Evidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {examFilter === '' ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400 text-sm">Please select an exam to view proctoring reports.</td></tr>
            ) : filteredLogs.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400 text-sm">No violations found for the selected exam.</td></tr>
            ) : (
              filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{getStudentName(log.studentId)}</td>
                  <td className="px-6 py-4 text-xs text-gray-500 font-mono">{log.examId}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 capitalize">
                      <AlertTriangle size={11} /> {log.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => setSelectedEvidence(log)} className="text-indigo-600 text-xs hover:underline font-medium">View</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <EvidenceModal
        isOpen={!!selectedEvidence}
        evidence={selectedEvidence?.evidence}
        timestamp={selectedEvidence?.timestamp || ''}
        studentName={selectedEvidence ? getStudentName(selectedEvidence.studentId) : ''}
        violationType={selectedEvidence?.type || ''}
        onClose={() => setSelectedEvidence(null)}
      />
    </div>
  );
};
