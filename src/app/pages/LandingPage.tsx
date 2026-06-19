import React, { useState } from 'react';
import { useExam } from '../context/ExamContext';
import { User, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

type LandingPageProps = {
  onEnter?: (role: 'admin' | 'student' | 'admin-login') => void;
};

const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
  const handleAdminEnter = () => onEnter?.('admin-login');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold text-slate-800 mb-2">Online Examination System</h1>
      <p className="text-slate-500 mb-12">Secure AI-Proctored Assessment Platform</p>
      
      <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
        <button 
          onClick={() => onEnter?.('student')}
          className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl transition-all border border-slate-200 flex flex-col items-center group"
        >
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <User className="w-10 h-10 text-blue-600" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-800 mb-2">Student</h2>
          <p className="text-slate-500 text-center">Login to take your scheduled exam with AI proctoring.</p>
        </button>

        <button 
          onClick={handleAdminEnter}
          className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl transition-all border border-slate-200 flex flex-col items-center group"
        >
          <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <ShieldCheck className="w-10 h-10 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-800 mb-2">Administrator</h2>
          <p className="text-slate-500 text-center">Manage exams, students, and view proctoring reports.</p>
        </button>
        
      </div>
    </div>
  );
};

export default LandingPage;
