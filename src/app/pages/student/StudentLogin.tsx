import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExam } from '../../context/ExamContext';
import { toast } from 'sonner';

const StudentLogin: React.FC = () => {
  const navigate = useNavigate();
  const { loginStudent } = useExam();
  const [email, setEmail] = useState('john@example.com');
  const [examId, setExamId] = useState('EXAM-001');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await loginStudent(email, examId);
    if (ok) {
      toast.success('Login successful');
      navigate('/student/instructions');
    } else {
      toast.error('Invalid credentials or exam not found.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-100 w-full max-w-md">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Student Login</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="student@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Exam ID</label>
            <input 
              type="text" 
              required
              value={examId}
              onChange={e => setExamId(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="EXAM-XXX"
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Start Session
          </button>
        </form>
        <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
          <p className="font-semibold mb-1">Demo Credentials:</p>
          <p>Email: john@example.com</p>
          <p>Exam ID: EXAM-001</p>
        </div>
      </div>
    </div>
  );
};

export default StudentLogin;
