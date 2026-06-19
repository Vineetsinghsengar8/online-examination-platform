import React, { useState } from 'react';
import { Student, useExam } from '../../context/ExamContext';
import { LogIn, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { CameraCheck } from './CameraCheck';
import { ExamInterface } from './ExamInterface';

type StudentView = 'login' | 'instructions' | 'camera-check' | 'exam' | 'result';

export const StudentPortal: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const [view, setView] = useState<StudentView>('login');
  const [student, setStudent] = useState<Student | null>(null);
  const { exams, loginStudent } = useExam();

  const handleLogin = async (email: string, examId: string) => {
    const loggedInStudent = await loginStudent(email, examId);
    if (loggedInStudent) {
      setStudent(loggedInStudent);
      setView('instructions');
    } else {
      toast.error('Login failed. Ensure exam code and email are correct.');
    }
  };

  const currentExam = student ? exams.find(e => e.id === student.examId) : null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header (hidden in exam) */}
      {view !== 'exam' && (
        <header className="bg-white shadow-sm p-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-xl text-blue-600">SecureExam</span>
          </div>
          <button onClick={onExit} className="text-gray-500 hover:text-gray-700 text-sm">
            Exit to Home
          </button>
        </header>
      )}

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {view === 'login' && <StudentLogin onLogin={handleLogin} />}
        
        {view === 'instructions' && currentExam && (
          <Instructions 
            examTitle={currentExam.title} 
            duration={currentExam.modules.reduce((a,b) => a + b.timeLimit, 0)}
            onStart={() => setView('camera-check')} 
          />
        )}

        {view === 'camera-check' && (
          <CameraCheck 
            onVerified={() => setView('exam')} 
            onBack={() => setView('instructions')}
          />
        )}

        {view === 'exam' && student && currentExam && (
          <ExamInterface 
            student={student} 
            exam={currentExam} 
            onComplete={() => setView('result')}
          />
        )}

        {view === 'result' && (
           <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center space-y-6">
             <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-green-600">
               <CheckCircle size={40} />
             </div>
             <h2 className="text-2xl font-bold text-gray-800">Exam Submitted!</h2>
             <p className="text-gray-600">
               Your exam has been successfully recorded. You may now close this window.
             </p>
             <button 
               onClick={onExit}
               className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
             >
               Return to Home
             </button>
           </div>
        )}
      </main>
    </div>
  );
};

const StudentLogin: React.FC<{ onLogin: (email: string, examId: string) => void }> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [examId, setExamId] = useState('EXAM-001');

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800">Student Login</h2>
        <p className="text-gray-500 mt-2">Enter your registered email and exam code to begin</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
        <input 
          type="email" 
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Exam Code</label>
        <input 
          type="text" 
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="EXAM-001"
          value={examId}
          onChange={e => setExamId(e.target.value)}
        />
      </div>
      <button 
        onClick={() => onLogin(email, examId)}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-colors"
      >
        <LogIn size={20} />
        <span>Continue</span>
      </button>
      <div className="p-4 bg-blue-50 rounded-lg flex items-start space-x-3 text-sm text-blue-800">
        <AlertCircle size={20} className="shrink-0 mt-0.5" />
        <p>Ensure you are in a quiet room with good lighting. You will need a working webcam.</p>
      </div>
    </div>
  );
};

const Instructions: React.FC<{ examTitle: string; duration: number; onStart: () => void }> = ({ examTitle, duration, onStart }) => {
  return (
    <div className="bg-white p-8 rounded-xl shadow-lg max-w-2xl w-full space-y-8">
      <div className="border-b border-gray-100 pb-6">
        <h2 className="text-3xl font-bold text-gray-900">{examTitle}</h2>
        <p className="text-gray-500 mt-2">Total Duration: {duration} Minutes</p>
      </div>
      
      <div className="space-y-4">
        <h3 className="font-semibold text-lg text-gray-800">Instructions & Rules</h3>
        <ul className="space-y-3 text-gray-600">
          <li className="flex items-start space-x-3">
            <span className="bg-slate-100 px-2 py-0.5 rounded text-sm font-bold text-slate-700">1</span>
            <span>You must grant camera access to proceed.</span>
          </li>
          <li className="flex items-start space-x-3">
            <span className="bg-slate-100 px-2 py-0.5 rounded text-sm font-bold text-slate-700">2</span>
            <span>The exam will run in <strong>Full Screen</strong> mode. Exiting full screen is a violation.</span>
          </li>
          <li className="flex items-start space-x-3">
            <span className="bg-slate-100 px-2 py-0.5 rounded text-sm font-bold text-slate-700">3</span>
            <span>Switching tabs or windows is strictly prohibited and tracked.</span>
          </li>
          <li className="flex items-start space-x-3">
            <span className="bg-slate-100 px-2 py-0.5 rounded text-sm font-bold text-slate-700">4</span>
            <span>More than <strong>3 violations</strong> will result in automatic submission.</span>
          </li>
        </ul>
      </div>

      <button 
        onClick={onStart}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-blue-200 shadow-lg hover:shadow-xl transition-all"
      >
        Start Now
      </button>
    </div>
  );
};
