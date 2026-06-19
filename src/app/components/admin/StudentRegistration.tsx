import React, { useState, useRef } from 'react';
import { useExam } from '../../context/ExamContext';
import { Upload, UserPlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export const StudentRegistration: React.FC = () => {
  const { exams, registerStudent, registerStudentsBulk, students, deleteStudent } = useExam();
  const [email, setEmail] = useState('');
  const [examId, setExamId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [regFilter, setRegFilter] = useState('');

  const handleRegister = async () => {
    if (!email || !examId) {
      toast.error('Please fill in all fields');
      return;
    }
    try {
      await registerStudent({
        id: `stu-${Date.now()}`,
        email,
        examId,
        registeredAt: new Date().toISOString()
      });
      toast.success('Student registered successfully');
      setEmail('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Student registration failed');
    }
  };

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const csv = e.target?.result as string;
        const lines = csv.trim().split('\n');
        const header = lines[0].toLowerCase().split(',').map(h => h.trim());
        
        const emailIdx = header.findIndex(h => h.includes('email'));
        const examIdx = header.findIndex(h => h.includes('exam'));
        const nameIdx = header.findIndex(h => h.includes('name'));

        if (emailIdx === -1) {
          toast.error('CSV must have an "email" column');
          return;
        }

        const newStudents = [];
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const values = lines[i].split(',').map(v => v.trim());
          const studentEmail = values[emailIdx]?.toLowerCase();
          const studentExamId = examIdx >= 0 ? values[examIdx] : (examId || exams[0]?.id);

          if (studentEmail && studentExamId) {
            newStudents.push({
              id: `stu-${Date.now()}-${i}`,
              name: nameIdx >= 0 ? values[nameIdx] : undefined,
              email: studentEmail,
              examId: studentExamId,
              registeredAt: new Date().toISOString()
            });
          }
        }

        if (newStudents.length === 0) {
          toast.error('No valid students found in CSV');
          return;
        }

        await registerStudentsBulk(newStudents);
        toast.success(`Successfully registered ${newStudents.length} students`);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to upload CSV file');
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-6">Manual Registration</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student Email</label>
            <input
              type="email"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="student@university.edu"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign Exam</label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              value={examId}
              onChange={e => setExamId(e.target.value)}
            >
              <option value="">-- Select Exam --</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </div>
          <button
            onClick={handleRegister}
            className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg"
          >
            <UserPlus size={18} />
            <span>Register Student</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-6">Bulk Registration</h3>
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center space-y-4">
          <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-blue-600">
            <Upload size={32} />
          </div>
          <div>
            <p className="font-medium text-gray-900">Upload CSV File</p>
            <p className="text-sm text-gray-500">Columns: email, exam_id (optional), name (optional)</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleCsvUpload}
            className="hidden"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Choose CSV File
          </button>
        </div>
      </div>

      <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Registered Students ({students.length})</h3>
          <div className="flex items-center space-x-3">
            <select value={regFilter} onChange={e => setRegFilter(e.target.value)} className="px-3 py-2 border rounded">
              <option value="">All Exams</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
            <button
              onClick={() => {
                const filtered = regFilter ? students.filter(s => s.examId === regFilter) : students;
                if (filtered.length === 0) { toast.error('No students to download'); return; }
                const header = ['email', 'examId', 'registeredAt'];
                const rows = filtered.map(s => [s.email, s.examId, s.registeredAt]);
                const csvContent = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `registered_students_${regFilter || 'all'}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Download CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Exam ID</th>
                <th className="px-4 py-3">Registered At</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(regFilter ? students.filter(s => s.examId === regFilter) : students).map(s => (
                <tr key={s.id}>
                  <td className="px-4 py-3">{s.email}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{s.examId}</td>
                  <td className="px-4 py-3 text-gray-500 text-sm">{new Date(s.registeredAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        if (window.confirm('Delete this student and all associated data?')) {
                          deleteStudent(s.id);
                          toast.success('Student deleted successfully');
                        }
                      }}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
