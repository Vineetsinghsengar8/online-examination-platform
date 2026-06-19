import React, { useState } from 'react';
import { useExam } from '../context/ExamContext';
import { toast } from 'sonner';

export const AdminLogin: React.FC<{ onLoginSuccess: () => void; onCancel: () => void }> = ({ onLoginSuccess, onCancel }) => {
  const { loginAdminWithCredentials } = useExam();
  // Prefill dev/admin shortcut credentials for convenience
  const [email, setEmail] = useState('admin123@gmail.com');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    const user = await loginAdminWithCredentials(email, password);
    setLoading(false);
    if (user) {
      toast.success('Admin logged in');
      onLoginSuccess();
    } else {
      toast.error('Invalid admin credentials');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Administrator Login</h2>
        <p className="text-sm text-gray-500 mb-6">Enter admin credentials to manage the system.</p>
        <input
          className="w-full px-4 py-3 border border-gray-300 rounded mb-3"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          type="password"
          className="w-full px-4 py-3 border border-gray-300 rounded mb-4"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <div className="flex justify-end space-x-2">
          <button onClick={onCancel} className="px-4 py-2 border rounded">Cancel</button>
          <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
