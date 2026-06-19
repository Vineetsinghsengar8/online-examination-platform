import React, { useState } from 'react';
import { useExam, Exam, Module, QuestionType } from '../../context/ExamContext';
import { Plus, Trash2, Save, Clock, CheckSquare, Code, BookOpen, Globe, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const TYPE_META: Record<string, { icon: React.ReactNode; color: string }> = {
  mcq: { icon: <CheckSquare size={13} />, color: 'bg-blue-100 text-blue-700' },
  coding: { icon: <Code size={13} />, color: 'bg-purple-100 text-purple-700' },
  paragraph: { icon: <BookOpen size={13} />, color: 'bg-green-100 text-green-700' },
};

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `exam-${Date.now()}`;

export const ExamStructure: React.FC = () => {
  const { exams, addExam, updateExam, deleteExam } = useExam();
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newModules, setNewModules] = useState<Omit<Module, 'id' | 'examId'>[]>([]);
  const [saving, setSaving] = useState(false);

  const handleAddModule = () => {
    setNewModules([...newModules, { title: '', type: 'mcq', timeLimit: 10 }]);
  };

  const handleUpdateModule = (index: number, field: keyof Omit<Module, 'id' | 'examId'>, value: any) => {
    const updated = [...newModules];
    updated[index] = { ...updated[index], [field]: value };
    setNewModules(updated);
  };

  const handleRemoveModule = (index: number) => {
    setNewModules(newModules.filter((_, i) => i !== index));
  };

  const handleSaveExam = async () => {
    if (!newExamTitle.trim()) { toast.error('Please enter an exam title'); return; }
    if (newModules.length === 0) { toast.error('Please add at least one module'); return; }
    if (newModules.some(m => !m.title.trim())) { toast.error('All modules must have a title'); return; }

    // FIX: generate a stable, unique exam code (id) up front, and stamp every
    // module with that SAME exam id. Previously moduleId/examId mismatches
    // (timestamp drift between exam id and module ids) caused modules to be
    // generated but never line up with what ManageQuestions looked up.
    const examId = slugify(newExamTitle) + '-' + Date.now().toString().slice(-5);

    const newExam: Exam = {
      id: examId,
      title: newExamTitle.trim(),
      published: true,
      modules: newModules.map((m, i) => ({
        ...m,
        id: `mod-${examId}-${i}`,
        examId: examId,
      })),
    };

    setSaving(true);
    try {
      await addExam(newExam);
      toast.success('Exam structure saved! You can now add questions to each module.');
      setNewExamTitle('');
      setNewModules([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Exam structure was not saved');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = (exam: Exam) => {
    updateExam({ ...exam, published: !exam.published });
    toast.success(exam.published ? 'Exam unpublished' : 'Exam published');
  };

  const handleDeleteExam = async (examId: string) => {
    if (!confirm('Delete this exam and all its questions, results, and student data? This cannot be undone.')) return;
    try {
      await deleteExam(examId);
      toast.success('Exam deleted');
    } catch {
      toast.error('Failed to delete exam');
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Create New Exam Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-5">Create New Exam</h3>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Exam Name</label>
          <input
            type="text"
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
            placeholder="e.g. Full Stack Developer Assessment"
            value={newExamTitle}
            onChange={(e) => setNewExamTitle(e.target.value)}
          />
        </div>

        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Modules</h4>
            <button
              onClick={handleAddModule}
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              <Plus size={15} /> Add Module
            </button>
          </div>

          <div className="space-y-3">
            {newModules.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">
                No modules added yet. Click "Add Module" to start — e.g. an MCQ round and a Coding round.
              </p>
            )}
            {newModules.map((module, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-xl border border-gray-200 relative group">
                <button
                  onClick={() => handleRemoveModule(index)}
                  className="absolute top-3 right-3 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={15} />
                </button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Module Title</label>
                    <input
                      type="text"
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-400"
                      placeholder="e.g. Multiple Choice Round"
                      value={module.title}
                      onChange={(e) => handleUpdateModule(index, 'title', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                    <select
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-400"
                      value={module.type}
                      onChange={(e) => handleUpdateModule(index, 'type', e.target.value as QuestionType)}
                    >
                      <option value="mcq">Multiple Choice</option>
                      <option value="coding">Coding</option>
                      <option value="paragraph">Paragraph</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Time Limit (minutes)</label>
                    <div className="flex items-center gap-2">
                      <Clock size={15} className="text-gray-400" />
                      <input
                        type="number"
                        min="1"
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-400"
                        value={module.timeLimit}
                        onChange={(e) => handleUpdateModule(index, 'timeLimit', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 mt-3 px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_META[module.type].color}`}>
                  {TYPE_META[module.type].icon} {module.type.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleSaveExam}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-2.5 rounded-xl transition-colors font-medium text-sm"
        >
          {saving ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
          ) : (
            <><Save size={16} /> Save Exam Structure</>
          )}
        </button>
      </div>

      {/* Existing Exams List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-5">Existing Exams <span className="text-indigo-500">({exams.length})</span></h3>
        <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
          {exams.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No exams created yet.</p>
          )}
          {exams.map((exam) => (
            <div key={exam.id} className="p-4 border border-gray-200 rounded-xl hover:border-indigo-300 transition-colors">
              <div className="flex justify-between items-start mb-1">
                <div>
                  <h4 className="font-semibold text-gray-800">{exam.title}</h4>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{exam.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTogglePublish(exam)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 transition-colors ${exam.published ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
                  >
                    {exam.published ? <><Globe size={11} /> Published</> : <><EyeOff size={11} /> Draft</>}
                  </button>
                  <button onClick={() => handleDeleteExam(exam.id)} className="text-gray-300 hover:text-red-500 p-1">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 mt-3">
                {/* FIX: now actually shows every module that was added, since
                    addExam/normalizeExam preserves the modules array end-to-end. */}
                {exam.modules.map((mod) => (
                  <div key={mod.id} className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                    <span className="flex items-center gap-1.5 font-medium">
                      {TYPE_META[mod.type]?.icon}
                      {mod.title}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className={`uppercase text-[10px] font-bold px-1.5 py-0.5 rounded ${TYPE_META[mod.type]?.color}`}>{mod.type}</span>
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock size={11} /> {mod.timeLimit}m
                      </span>
                    </div>
                  </div>
                ))}
                {exam.modules.length === 0 && (
                  <p className="text-xs text-gray-400 italic">No modules configured.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
