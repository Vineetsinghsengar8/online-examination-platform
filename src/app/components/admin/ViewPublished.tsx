import React, { useState } from 'react';
import { useExam } from '../../context/ExamContext';
import { Eye, Edit, ToggleLeft, ToggleRight } from 'lucide-react';

const Modal: React.FC<{ title: string; onClose: () => void; children?: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 w-11/12 max-w-2xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <button onClick={onClose} className="text-sm text-gray-500">Close</button>
      </div>
      <div>{children}</div>
    </div>
  </div>
);

export const ViewPublished: React.FC = () => {
  const { exams, updateExam, deleteExam } = useExam();
  const [previewExamId, setPreviewExamId] = useState<string | null>(null);
  const [editExamId, setEditExamId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const togglePublish = (examId: string) => {
    const exam = exams.find(e => e.id === examId);
    if (exam) {
      updateExam({ ...exam, published: !exam.published });
    }
  };

  const openPreview = (examId: string) => setPreviewExamId(examId);
  const openEdit = (examId: string) => {
    const ex = exams.find(e => e.id === examId);
    if (!ex) return;
    setEditExamId(examId);
    setEditTitle(ex.title);
  };

  const saveEdit = () => {
    if (!editExamId) return;
    const ex = exams.find(e => e.id === editExamId);
    if (!ex) return;
    updateExam({ ...ex, title: editTitle });
    setEditExamId(null);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold mb-6">Published Exams Management</h3>
      <div className="space-y-4">
        {exams.map(exam => (
          <div key={exam.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <div>
              <h4 className="font-semibold text-gray-800">{exam.title}</h4>
              <p className="text-sm text-gray-500">{exam.modules.length} Modules • {exam.modules.reduce((acc, m) => acc + m.timeLimit, 0)} Minutes Total</p>
            </div>
            <div className="flex items-center space-x-4">
              <button onClick={() => openPreview(exam.id)} className="p-2 text-gray-500 hover:text-blue-600 transition-colors" title="Preview">
                <Eye size={20} />
              </button>
              <button onClick={() => openEdit(exam.id)} className="p-2 text-gray-500 hover:text-blue-600 transition-colors" title="Edit">
                <Edit size={20} />
              </button>
              <button 
                onClick={() => togglePublish(exam.id)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${exam.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
              >
                {exam.published ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                <span>{exam.published ? 'Published' : 'Draft'}</span>
              </button>
              <button
                onClick={() => deleteExam(exam.id)}
                className="px-3 py-1.5 rounded-full text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                title="Delete"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {previewExamId && (
        <Modal title="Exam Preview" onClose={() => setPreviewExamId(null)}>
          {(() => {
            const ex = exams.find(e => e.id === previewExamId);
            if (!ex) return <div>Exam not found</div>;
            return (
              <div>
                <h4 className="font-semibold text-gray-800 mb-2">{ex.title}</h4>
                <p className="text-sm text-gray-500 mb-4">Modules: {ex.modules.length}</p>
                <ul className="list-disc pl-6 space-y-2">
                  {ex.modules.map(m => (
                    <li key={m.id} className="text-sm">{m.title} — {m.timeLimit} min</li>
                  ))}
                </ul>
              </div>
            );
          })()}
        </Modal>
      )}

      {editExamId && (
        <Modal title="Edit Exam" onClose={() => setEditExamId(null)}>
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input className="w-full px-3 py-2 border rounded" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            <div className="flex justify-end space-x-2">
              <button onClick={() => setEditExamId(null)} className="px-3 py-2 border rounded">Cancel</button>
              <button onClick={saveEdit} className="px-3 py-2 bg-blue-600 text-white rounded">Save</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
