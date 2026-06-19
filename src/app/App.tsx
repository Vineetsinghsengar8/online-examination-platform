import React, { useState } from 'react';
import { ExamProvider } from './context/ExamContext';
import ErrorBoundary from './ErrorBoundary';
import { AdminPortal } from './components/admin/AdminPortal';
import { StudentPortal } from './components/student/StudentPortal';
import { ShieldCheck, GraduationCap, ArrowRight } from 'lucide-react';
import { Toaster } from 'sonner';

// Main App Component
import LandingPage from './pages/LandingPage';
import AdminLogin from './pages/AdminLogin';

const AppContent: React.FC = () => {
  console.log('App: rendering AppContent');
  const [role, setRole] = useState<'home' | 'admin' | 'student' | 'admin-login'>('home');

  // Visible debug banner to help confirm whether React rendered
  const DebugBanner = () => (
    <div style={{position: 'fixed', top: 12, right: 12, zIndex: 99999, background: 'linear-gradient(90deg,#ff9a9e,#fecfef)', padding: '6px 10px', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', color: '#3a0018', fontWeight: 700}}>
      Debug: App mounted
    </div>
  );

  if (role === 'admin') {
    return <AdminPortal onLogout={() => setRole('home')} />;
  }

  if (role === 'admin-login') {
    return <AdminLogin onLoginSuccess={() => setRole('admin')} onCancel={() => setRole('home')} />;
  }

  if (role === 'student') {
    return <StudentPortal onExit={() => setRole('home')} />;
  }

  return (
    <LandingPage onEnter={(role) => setRole(role)} />
  );
};

export default function App() {
  return (
    <ExamProvider>
      <Toaster position="top-right" richColors />
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </ExamProvider>
  );
}
