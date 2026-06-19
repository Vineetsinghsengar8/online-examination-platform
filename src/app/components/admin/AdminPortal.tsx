import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  HelpCircle, 
  Users, 
  Eye, 
  AlertTriangle, 
  Award, 
  LogOut 
} from 'lucide-react';
import { Dashboard } from './Dashboard';
import { ExamStructure } from './ExamStructure';
import { ManageQuestions } from './ManageQuestions';
import { StudentRegistration } from './StudentRegistration';
import { ViewPublished } from './ViewPublished';
import { ProctoringReports } from './ProctoringReports';
import { StudentResults } from './StudentResults';

type AdminView = 'dashboard' | 'exam-structure' | 'manage-questions' | 'student-registration' | 'view-published' | 'proctoring-reports' | 'student-results';

export const AdminPortal: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [currentView, setCurrentView] = useState<AdminView>('dashboard');

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'exam-structure', label: 'Exam Structure', icon: FileText },
    { id: 'manage-questions', label: 'Manage Questions', icon: HelpCircle },
    { id: 'student-registration', label: 'Student Registration', icon: Users },
    { id: 'view-published', label: 'View Published', icon: Eye },
    { id: 'proctoring-reports', label: 'Proctoring Reports', icon: AlertTriangle },
    { id: 'student-results', label: 'Student Results', icon: Award },
  ];

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'exam-structure': return <ExamStructure />;
      case 'manage-questions': return <ManageQuestions />;
      case 'student-registration': return <StudentRegistration />;
      case 'view-published': return <ViewPublished />;
      case 'proctoring-reports': return <ProctoringReports />;
      case 'student-results': return <StudentResults />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 text-slate-900">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold tracking-tight">ExamAdmin</h1>
          <p className="text-slate-400 text-sm">Proctoring System</p>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id as AdminView)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                currentView === item.id 
                  ? 'bg-blue-600 text-white' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-400 hover:bg-slate-800 hover:text-red-300 transition-colors"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <header className="bg-white shadow-sm px-8 py-4 mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">
            {navItems.find(i => i.id === currentView)?.label}
          </h2>
        </header>
        <main className="px-8 pb-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};
