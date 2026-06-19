import React from 'react';
import { useExam } from '../../context/ExamContext';
import { Users, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const Dashboard: React.FC = () => {
  const { exams, students, logs, results } = useExam();

  const stats = [
    { label: 'Total Exams', value: exams.length, icon: FileText, color: 'bg-blue-500' },
    { label: 'Registered Students', value: students.length, icon: Users, color: 'bg-green-500' },
    { label: 'Violations Detected', value: logs.length, icon: AlertTriangle, color: 'bg-red-500' },
    { label: 'Completed Exams', value: results.length, icon: CheckCircle, color: 'bg-purple-500' },
  ];

  const chartData = exams.map(exam => {
    const title = exam.title ?? 'Untitled';
    const name = title.length > 15 ? title.slice(0, 15) + '...' : title;
    return {
      name,
      students: students.filter(s => s.examId === exam.id).length,
      completed: results.filter(r => r.examId === exam.id).length
    };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
              <div className={`${stat.color} p-4 rounded-lg text-white`}>
                <Icon size={24} />
              </div>
              <div>
                <p className="text-gray-500 text-sm">{stat.label}</p>
                <h3 className="text-2xl font-bold text-gray-800">{stat.value}</h3>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Exam Participation</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="students" fill="#3b82f6" name="Registered" />
                <Bar dataKey="completed" fill="#10b981" name="Completed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Recent Violations</h3>
          <div className="space-y-4">
            {logs.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No violations recorded yet.</p>
            ) : (
              logs.slice(0, 5).map(log => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle size={16} className="text-red-500" />
                    <span className="text-sm font-medium text-red-700 capitalize">
                      {log.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <span className="text-xs text-red-500">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
