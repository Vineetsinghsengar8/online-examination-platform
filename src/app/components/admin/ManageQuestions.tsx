import React, { useState, useRef } from 'react';
import { useExam, Question, QuestionType, Module } from '../../context/ExamContext';
import { Plus, Trash2, Code, BookOpen, CheckSquare, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { toast } from 'sonner';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  mcq: <CheckSquare size={14} className="text-blue-500" />,
  coding: <Code size={14} className="text-purple-500" />,
  paragraph: <BookOpen size={14} className="text-green-500" />,
};

const TYPE_COLORS: Record<string, string> = {
  mcq: 'bg-blue-100 text-blue-700',
  coding: 'bg-purple-100 text-purple-700',
  paragraph: 'bg-green-100 text-green-700',
};

export const ManageQuestions: React.FC = () => {
  const { exams, questions, addQuestion, deleteQuestion } = useExam();
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [expandedQ, setExpandedQ] = useState<string | null>(null);

  // Form state
  const [qText, setQText] = useState('');
  const [qImage, setQImage] = useState('');
  const [mcqOptions, setMcqOptions] = useState(['', '', '', '']);
  const [mcqCorrect, setMcqCorrect] = useState<string[]>([]);
  const [codeTemplate, setCodeTemplate] = useState('');
  const [testCases, setTestCases] = useState([{ input: '', output: '' }]);
  const [language, setLanguage] = useState('python');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // FIX: selectedExam and its modules are derived from the exam list directly
  const selectedExam = exams.find(e => e.id === selectedExamId);
  const selectedModule = selectedExam?.modules.find(m => m.id === selectedModuleId);

  // FIX: Match questions by moduleId — now includes questions from backend with correct moduleId
  const filteredQuestions = questions.filter(q => q.moduleId === selectedModuleId);

  const resetForm = () => {
    setQText(''); setQImage('');
    setMcqOptions(['', '', '', '']); setMcqCorrect([]);
    setCodeTemplate(''); setTestCases([{ input: '', output: '' }]); setLanguage('python');
  };

  const handleAddQuestion = async () => {
    if (!selectedModule) { toast.error('Please select a module first'); return; }
    if (!qText.trim()) { toast.error('Question text is required'); return; }

    const newQ: Question = {
      id: `q-${Date.now()}`,
      moduleId: selectedModuleId,
      type: selectedModule.type,
      text: qText.trim(),
      image: qImage || undefined,
    };

    if (selectedModule.type === 'mcq') {
      const validOptions = mcqOptions.filter(o => o.trim());
      if (validOptions.length < 2) { toast.error('At least 2 options required'); return; }
      if (mcqCorrect.length === 0) { toast.error('Select at least one correct answer'); return; }
      newQ.options = mcqOptions;
      newQ.correctAnswers = mcqCorrect;
    } else if (selectedModule.type === 'coding') {
      const validTC = testCases.filter(tc => tc.input || tc.output);
      newQ.codeTemplate = codeTemplate;
      newQ.testCases = validTC.length > 0 ? validTC : [];
      newQ.language = language;
    }

    setSubmitting(true);
    try {
      await addQuestion(newQ);
      toast.success('Question added!');
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add question');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm('Delete this question?')) return;
    try {
      await deleteQuestion(qId);
      toast.success('Question deleted');
    } catch {
      toast.error('Failed to delete question');
    }
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = String(reader.result || '');
        const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) { toast.error('CSV needs header + at least 1 row'); return; }
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(',').map(v => v.trim());
          const map: Record<string, string> = {};
          headers.forEach((h, j) => map[h] = vals[j] ?? '');
          const qTextVal = map['question'] || map['text'] || '';
          if (!qTextVal || !selectedModule) continue;
          const base: Question = {
            id: `q-csv-${Date.now()}-${i}`,
            moduleId: selectedModuleId,
            type: selectedModule.type,
            text: qTextVal,
          };
          if (base.type === 'mcq') {
            const opts = [1,2,3,4,5,6,7,8].map(n => map[`option${n}`]).filter(Boolean);
            base.options = opts;
            const corr = map['correct_answers'] || map['correct'] || map['answer'] || '';
            base.correctAnswers = corr ? corr.split(';').map(s => s.trim()) : [];
          }
          await addQuestion(base);
          count++;
        }
        toast.success(`Imported ${count} questions`);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        toast.error('CSV import failed');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Exam & Module Selector */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Select Exam & Module</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Exam</label>
            <select
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              value={selectedExamId}
              onChange={e => { setSelectedExamId(e.target.value); setSelectedModuleId(''); resetForm(); }}
            >
              <option value="">— Choose an exam —</option>
              {exams.map(e => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Module</label>
            <select
              className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors ${!selectedExamId ? 'border-gray-100 bg-gray-50 text-gray-400' : 'border-gray-200'}`}
              value={selectedModuleId}
              onChange={e => { setSelectedModuleId(e.target.value); resetForm(); }}
              disabled={!selectedExamId}
            >
              <option value="">— Choose a module —</option>
              {/* FIX: Show ALL modules from the selected exam */}
              {selectedExam?.modules.map(m => (
                <option key={m.id} value={m.id}>
                  {m.title} ({m.type.toUpperCase()}) — {m.timeLimit}min
                </option>
              ))}
            </select>
            {selectedExamId && (!selectedExam?.modules || selectedExam.modules.length === 0) && (
              <p className="text-xs text-amber-600 mt-1">⚠ No modules found. Create modules in Exam Structure first.</p>
            )}
          </div>
        </div>
        {selectedModule && (
          <div className="mt-3 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${TYPE_COLORS[selectedModule.type]}`}>
              {TYPE_ICONS[selectedModule.type]} {selectedModule.type.toUpperCase()}
            </span>
            <span className="text-xs text-gray-500">{filteredQuestions.length} question(s) in this module</span>
          </div>
        )}
      </div>

      {selectedModule && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Add Question Form */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-base font-bold text-gray-800 mb-5 flex items-center gap-2">
              {TYPE_ICONS[selectedModule.type]}
              Add {selectedModule.type.toUpperCase()} Question
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Question Text *</label>
                <textarea
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                  rows={3} value={qText} onChange={e => setQText(e.target.value)}
                  placeholder="Enter your question here..."
                />
              </div>

              {/* MCQ Options */}
              {selectedModule.type === 'mcq' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Options <span className="text-gray-400 font-normal">(check the correct answer)</span></label>
                  {mcqOptions.map((opt, idx) => (
                    <div key={idx} className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-colors ${mcqCorrect.includes(opt) && opt ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                      <input
                        type="checkbox"
                        checked={mcqCorrect.includes(opt) && opt !== ''}
                        onChange={e => {
                          if (e.target.checked) setMcqCorrect([...mcqCorrect, opt]);
                          else setMcqCorrect(mcqCorrect.filter(c => c !== opt));
                        }}
                        disabled={!opt}
                        className="w-4 h-4 rounded text-green-600 focus:ring-green-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-gray-400 w-5">{String.fromCharCode(65 + idx)}</span>
                      <input
                        type="text"
                        className="flex-1 bg-transparent text-sm outline-none"
                        placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                        value={opt}
                        onChange={e => {
                          const n = [...mcqOptions]; n[idx] = e.target.value; setMcqOptions(n);
                        }}
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => setMcqOptions([...mcqOptions, ''])}
                    className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Option
                  </button>
                </div>
              )}

              {/* Coding Fields */}
              {selectedModule.type === 'coding' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Language</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={language} onChange={e => setLanguage(e.target.value)}
                    >
                      <option value="python">Python</option>
                      <option value="javascript">JavaScript (Node)</option>
                      <option value="java">Java</option>
                      <option value="cpp">C++</option>
                      <option value="c">C</option>
                      <option value="go">Go</option>
                      <option value="ruby">Ruby</option>
                      <option value="php">PHP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Starter Code Template</label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                      rows={5} value={codeTemplate} onChange={e => setCodeTemplate(e.target.value)}
                      placeholder={`# Write your ${language} solution here\ndef solution():\n    pass`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Test Cases</label>
                    {testCases.map((tc, idx) => (
                      <div key={idx} className="flex gap-2 mb-2 items-center">
                        <div className="flex-1 space-y-1">
                          <input
                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-mono focus:ring-1 focus:ring-indigo-400 outline-none"
                            placeholder="Input (e.g. 5 3)" value={tc.input}
                            onChange={e => { const n = [...testCases]; n[idx].input = e.target.value; setTestCases(n); }}
                          />
                          <input
                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-mono focus:ring-1 focus:ring-green-400 outline-none"
                            placeholder="Expected output (e.g. 8)" value={tc.output}
                            onChange={e => { const n = [...testCases]; n[idx].output = e.target.value; setTestCases(n); }}
                          />
                        </div>
                        <button onClick={() => setTestCases(testCases.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => setTestCases([...testCases, { input: '', output: '' }])} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                      <Plus size={12} /> Add Test Case
                    </button>
                  </div>
                </div>
              )}

              {/* Paragraph */}
              {selectedModule.type === 'paragraph' && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                  Paragraph questions require written responses. Students will type their answers in a text area.
                </div>
              )}

              <button
                onClick={handleAddQuestion}
                disabled={submitting}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Adding...</>
                ) : (
                  <><Plus size={16} /> Add Question</>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Questions List + CSV Import */}
          <div className="space-y-4">
            {/* Bulk CSV Import */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-2">Bulk Import via CSV</h3>
              <p className="text-xs text-gray-500 mb-3">Headers: <code className="bg-gray-100 px-1 rounded">question, option1..option8, correct_answers (semicolon-separated), image, language, code_template</code></p>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCsvImport} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors">
                📂 Select CSV File
              </button>
            </div>

            {/* Questions List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-3">
                Questions in Module <span className="text-indigo-600">({filteredQuestions.length})</span>
              </h3>
              {filteredQuestions.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No questions yet. Add one above.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {filteredQuestions.map((q, idx) => (
                    <div key={q.id} className="border border-gray-100 rounded-xl overflow-hidden">
                      <div
                        className="flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
                      >
                        <span className="text-xs font-bold text-gray-400 mt-0.5 w-5 shrink-0">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{q.text}</p>
                          <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[q.type]}`}>
                            {TYPE_ICONS[q.type]} {q.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {expandedQ === q.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                          <button
                            onClick={ev => { ev.stopPropagation(); handleDeleteQuestion(q.id); }}
                            className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                          ><Trash2 size={14} /></button>
                        </div>
                      </div>
                      {expandedQ === q.id && (
                        <div className="px-4 pb-3 border-t border-gray-50 bg-gray-50/50">
                          {q.type === 'mcq' && q.options && (
                            <ul className="mt-2 space-y-1">
                              {q.options.map((opt, i) => (
                                <li key={i} className={`text-xs flex items-center gap-1.5 ${q.correctAnswers?.includes(opt) ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
                                  <span className={`w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold ${q.correctAnswers?.includes(opt) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {String.fromCharCode(65 + i)}
                                  </span>
                                  {opt}
                                  {q.correctAnswers?.includes(opt) && <span className="text-green-600">✓</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                          {q.type === 'coding' && (
                            <div className="mt-2">
                              <span className="text-xs font-medium text-gray-500">Language: {q.language || 'python'}</span>
                              {q.codeTemplate && <pre className="mt-1 bg-gray-100 p-2 rounded-lg text-xs font-mono text-gray-700 overflow-x-auto">{q.codeTemplate}</pre>}
                              {q.testCases && q.testCases.length > 0 && (
                                <div className="mt-2">
                                  <span className="text-xs font-medium text-gray-500">Test Cases: {q.testCases.length}</span>
                                </div>
                              )}
                            </div>
                          )}
                          {q.type === 'paragraph' && (
                            <p className="mt-2 text-xs text-gray-500 italic">Open-ended question — manual grading required.</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!selectedModuleId && selectedExamId && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center text-amber-700 text-sm">
          ⬆ Select a module above to manage its questions.
        </div>
      )}
      {!selectedExamId && (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-10 text-center text-gray-400 text-sm">
          Select an exam to start managing questions.
        </div>
      )}
    </div>
  );
};
