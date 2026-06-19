import React, { useState, useEffect, useRef } from 'react';
import { useExam, Exam, Student, Question, QuestionType } from '../../context/ExamContext';
import Webcam from 'react-webcam';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/themes/prism.css';
import { AlertTriangle, Clock, ShieldAlert, SkipForward, CheckCircle, Flag, Bookmark, CheckSquare, Play, Loader2, Terminal, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ExamInterfaceProps {
  student: Student;
  exam: Exam;
  onComplete: () => void;
}

const LANGUAGE_OPTIONS = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript (Node)' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'go', label: 'Go' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
];

export const ExamInterface: React.FC<ExamInterfaceProps> = ({ student, exam, onComplete }) => {
  const { questions: allQuestions, submitExam: submitExamToBackend, recordViolation, analyzeFrame, runCode } = useExam();
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [violations, setViolations] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [resumeTimer, setResumeTimer] = useState<number | null>(null);
  const webcamRef = useRef<Webcam>(null);

  const [lockedExam] = useState(exam);
  const [marked, setMarked] = useState<Record<string, boolean>>({});

  const toggleMark = (qid: string) => setMarked(prev => ({ ...prev, [qid]: !prev[qid] }));

  const currentModule = lockedExam.modules[currentModuleIndex];
  const moduleQuestions = allQuestions.filter(q => q.moduleId === currentModule?.id);
  const currentQuestion = moduleQuestions[currentQuestionIndex];

  const answeredCount = moduleQuestions.filter(q => {
    const a = answers[q.id];
    return a !== undefined && a !== null && !(Array.isArray(a) && a.length === 0) && !(typeof a === 'string' && a.trim() === '');
  }).length;
  const progress = moduleQuestions.length ? Math.round((answeredCount / moduleQuestions.length) * 100) : 0;

  const violationThreshold = 3;

  useEffect(() => {
    if (currentModule) {
      setTimeLeft(currentModule.timeLimit * 60);
      setCurrentQuestionIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentModuleIndex]);

  useEffect(() => {
    if (blocked) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { handleNextModule(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentModuleIndex, blocked]);

  useEffect(() => {
    const handleFullScreenChange = () => {
      const isFS = !!document.fullscreenElement;
      if (!isFS && violations < violationThreshold) {
        handleViolation('fullscreen_exit');
        setBlocked(true);
        setResumeTimer(10);
      }
    };
    const handleVisibilityChange = () => {
      if (document.hidden && !blocked) handleViolation('tab_switch');
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [violations, blocked]);

  // AI proctoring frame analysis every 12s
  useEffect(() => {
    if (!analyzeFrame || blocked) return;
    const interval = window.setInterval(async () => {
      if (!webcamRef.current) return;
      const screenshot = webcamRef.current.getScreenshot();
      if (!screenshot) return;
      const result = await analyzeFrame(screenshot);
      if (result?.violation) {
        recordViolation('ai', `AI Proctoring: ${result.violation}`, screenshot);
        toast.warning(`Proctoring alert: ${result.violation}`);
      }
    }, 12000);
    return () => window.clearInterval(interval);
  }, [analyzeFrame, blocked, recordViolation]);

  useEffect(() => {
    if (resumeTimer === null || resumeTimer <= 0) {
      if (resumeTimer === 0 && blocked) submitExam('terminated');
      return;
    }
    const timer = setInterval(() => setResumeTimer(prev => (prev !== null ? prev - 1 : null)), 1000);
    return () => clearInterval(timer);
  }, [resumeTimer, blocked]);

  const handleViolation = (type: 'tab_switch' | 'fullscreen_exit') => {
    const newCount = violations + 1;
    setViolations(newCount);
    recordViolation(type === 'fullscreen_exit' ? 'fullscreen' : 'tab');
    if (newCount > violationThreshold) submitExam('terminated');
  };

  const handleResumeExam = () => {
    document.documentElement.requestFullscreen()
      .then(() => { setBlocked(false); setResumeTimer(null); })
      .catch(() => toast.error('Fullscreen required to resume'));
  };

  const submitExam = async (status: 'submitted' | 'terminated' = 'submitted') => {
    const finished = await submitExamToBackend(answers, status);
    if (!finished) toast.error('There was an issue submitting the exam.');
    if (document.fullscreenElement) document.exitFullscreen();
    onComplete();
  };

  const handleNextModule = () => {
    if (currentModuleIndex < lockedExam.modules.length - 1) {
      setCurrentModuleIndex(prev => prev + 1);
      toast.info('Starting next module...');
    } else {
      submitExam('submitted');
    }
  };

  const handleAnswerChange = (val: any) => setAnswers(prev => ({ ...prev, [currentQuestion.id]: val }));

  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<any>(null);

  const toggleMultiSelectAnswer = (option: string) => {
    const currentAnswer = answers[currentQuestion.id] ?? [];
    const updated = Array.isArray(currentAnswer)
      ? currentAnswer.includes(option) ? currentAnswer.filter((i: string) => i !== option) : [...currentAnswer, option]
      : [option];
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: updated }));
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getCodeLang = () => (answers[`${currentQuestion?.id}_lang`] as string) || currentQuestion?.language || 'python';

  const handleRunCode = async () => {
    if (!currentQuestion) return;
    const lang = getCodeLang();
    const codeVal = answers[`${currentQuestion.id}_rawcode`] || answers[currentQuestion.id] || currentQuestion.codeTemplate || '';
    if (!codeVal.trim()) { toast.error('Write some code first'); return; }
    setRunning(true);
    setRunResult(null);
    const res = await runCode(codeVal, lang, currentQuestion.testCases || [], lockedExam.id, currentQuestion.id);
    setRunning(false);
    if (!res) { toast.error('Could not reach the code runner'); return; }
    setRunResult(res);

    // Persist structured submission as the answer for grading
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: JSON.stringify({ code: codeVal, language: lang, test_results: res.results || [] }),
      [`${currentQuestion.id}_rawcode`]: codeVal,
    }));

    if (res.compile_error) toast.error('Compilation failed');
    else if (res.all_passed) toast.success(`All ${res.total} test case(s) passed!`);
    else toast.warning(`${res.passed}/${res.total} test case(s) passed`);
  };

  // --- Render Blocked Screen ---
  if (blocked) {
    return (
      <div className="fixed inset-0 bg-black text-white flex flex-col items-center justify-center z-50 p-8 text-center">
        <ShieldAlert size={64} className="text-red-500 mb-6 animate-pulse" />
        <h2 className="text-3xl font-bold mb-4">Exam Paused — Violation Detected</h2>
        <p className="text-xl mb-8">You exited full screen mode. This has been recorded.</p>
        {resumeTimer !== null && resumeTimer > 0 ? (
          <div className="space-y-6">
            <p className="text-gray-400">You must resume within</p>
            <div className="text-6xl font-bold font-mono text-red-500">{resumeTimer}s</div>
            <button onClick={handleResumeExam} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold text-lg transition-colors">Resume Exam</button>
          </div>
        ) : (
          <div className="text-red-500 font-bold text-xl">Exam Terminated due to inactivity.</div>
        )}
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <p className="text-gray-500">Loading module...</p>
        {moduleQuestions.length === 0 && (
          <button onClick={handleNextModule} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium">
            Skip Empty Module
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Top Bar */}
      <div className="h-16 bg-slate-900 text-white flex items-center justify-between px-6 shadow-md z-10 shrink-0">
        <div className="flex items-center gap-4">
          <span className="font-bold text-lg">{exam.title}</span>
          <span className="px-2.5 py-1 bg-slate-800 rounded-lg text-xs text-slate-300 font-medium">
            Module {currentModuleIndex + 1}/{lockedExam.modules.length}: {currentModule.title}
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className={`flex items-center gap-2 font-mono text-xl font-bold ${timeLeft < 60 ? 'text-red-400 animate-pulse' : 'text-indigo-400'}`}>
            <Clock size={20} /><span>{formatTime(timeLeft)}</span>
          </div>
          <div className="text-sm text-slate-300 opacity-80 hidden lg:block">Keep camera on and stay in full screen.</div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Question Navigation */}
        <aside className="w-64 bg-white border-r border-gray-100 p-4 overflow-y-auto flex flex-col shrink-0">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Questions</h3>
                <p className="text-xs text-gray-400">Module progress</p>
              </div>
              <div className="text-xs font-bold text-indigo-600">{progress}%</div>
            </div>
            <div className="mt-3 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="space-y-1.5 flex-1">
            {moduleQuestions.map((q, idx) => {
              const answered = answers[q.id] !== undefined && answers[q.id] !== '' && !(Array.isArray(answers[q.id]) && answers[q.id].length === 0);
              const isMarked = !!marked[q.id];
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors border ${idx === currentQuestionIndex ? 'border-indigo-300 bg-indigo-50' : 'border-transparent hover:border-gray-200 bg-white'}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-lg text-xs font-bold ${idx === currentQuestionIndex ? 'bg-indigo-600 text-white' : answered ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{idx + 1}</div>
                    <div className="text-xs text-gray-600 truncate">{q.text.slice(0, 40)}{q.text.length > 40 ? '…' : ''}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isMarked && <Flag size={13} className="text-amber-500" />}
                    {answered ? <CheckSquare size={13} className="text-green-500" /> : <Bookmark size={13} className="text-gray-300" />}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Center: Question Content */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="mb-6">
            <span className="text-xs font-bold text-indigo-500 uppercase tracking-wide">Question {currentQuestionIndex + 1} of {moduleQuestions.length}</span>
            <h2 className="text-2xl font-bold text-gray-900 mt-2 leading-snug">{currentQuestion.text}</h2>
          </div>
          {currentQuestion.image && (
            <img src={currentQuestion.image} alt="Question Reference" className="max-w-full h-auto rounded-xl mb-6 border border-gray-200" />
          )}
          <div className="mt-6 text-sm text-gray-500">
            {currentQuestion.type === 'coding' ? 'Write your solution in the editor on the right and click Run Code to test it.' : 'Answer on the right and use the left navigation to jump between questions.'}
          </div>

          {currentQuestion.type === 'coding' && runResult && (
            <div className="mt-6 bg-slate-900 rounded-xl p-4 font-mono text-xs">
              <div className="flex items-center gap-2 mb-3 text-slate-300">
                <Terminal size={14} /> <span className="font-semibold">Execution Results</span>
                {runResult.compile_error ? (
                  <span className="ml-auto text-red-400 font-bold flex items-center gap-1"><XCircle size={13} /> Compile Error</span>
                ) : (
                  <span className={`ml-auto font-bold flex items-center gap-1 ${runResult.all_passed ? 'text-green-400' : 'text-amber-400'}`}>
                    {runResult.all_passed ? <CheckCircle size={13} /> : <AlertTriangle size={13} />} {runResult.passed}/{runResult.total} passed
                  </span>
                )}
              </div>
              {runResult.compile_error ? (
                <pre className="text-red-300 whitespace-pre-wrap">{runResult.compile_error}</pre>
              ) : (
                <div className="space-y-2">
                  {(runResult.results || []).map((r: any, i: number) => (
                    <div key={i} className={`p-2.5 rounded-lg ${r.passed ? 'bg-green-950/40 border border-green-800/40' : 'bg-red-950/40 border border-red-800/40'}`}>
                      <div className={`font-bold mb-1 ${r.passed ? 'text-green-400' : 'text-red-400'}`}>Test Case {i + 1}: {r.passed ? 'PASS' : 'FAIL'}</div>
                      <div className="text-slate-400">Output: <span className="text-slate-200">{r.output ?? '(none)'}</span></div>
                      {r.expected && <div className="text-slate-400">Expected: <span className="text-slate-200">{r.expected}</span></div>}
                      {(r.error || r.stderr) && <div className="text-red-400 mt-1">{r.error || r.stderr}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel: Answer + Webcam */}
        <div className="w-[460px] flex flex-col bg-gray-50 border-l border-gray-100 shrink-0">
          <div className="p-3.5 border-b border-gray-100 bg-white flex items-center justify-between">
            <div>
              <div className="text-[11px] text-gray-400 font-medium">AI Proctoring</div>
              <div className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Camera active
              </div>
            </div>
            <div className="w-24 h-16 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
              <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" width={96} height={64} className="object-cover w-full h-full" />
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            {currentQuestion.type === 'mcq' && (
              <div className="space-y-3">
                {currentQuestion.options?.map((opt, idx) => (
                  <label key={idx} className={`flex items-center p-3.5 rounded-xl border-2 cursor-pointer transition-all ${answers[currentQuestion.id] === opt ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-200'}`}>
                    <input type="radio" name="mcq" className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" checked={answers[currentQuestion.id] === opt} onChange={() => handleAnswerChange(opt)} />
                    <span className="ml-3 text-sm font-medium text-gray-700">{opt}</span>
                  </label>
                ))}
              </div>
            )}

            {currentQuestion.type === 'multiple_select' && (
              <div className="space-y-3">
                {currentQuestion.options?.map((opt, idx) => {
                  const selected = Array.isArray(answers[currentQuestion.id]) && answers[currentQuestion.id].includes(opt);
                  return (
                    <label key={idx} className={`flex items-center p-3.5 rounded-xl border-2 cursor-pointer transition-all ${selected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-200'}`}>
                      <input type="checkbox" className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" checked={selected} onChange={() => toggleMultiSelectAnswer(opt)} />
                      <span className="ml-3 text-sm font-medium text-gray-700">{opt}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {currentQuestion.type === 'paragraph' && (
              <textarea
                className="w-full h-64 p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-sm text-gray-700 leading-relaxed"
                placeholder="Type your answer here..."
                value={answers[currentQuestion.id] || ''}
                onChange={e => handleAnswerChange(e.target.value)}
              />
            )}

            {currentQuestion.type === 'coding' && (
              <div className="flex flex-col">
                <div className="bg-gray-900 text-gray-300 px-3 py-2 text-xs font-mono rounded-t-xl flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Lang:</span>
                    <select
                      value={getCodeLang()}
                      onChange={e => setAnswers(prev => ({ ...prev, [`${currentQuestion.id}_lang`]: e.target.value }))}
                      className="bg-gray-800 text-white px-2 py-1 rounded text-xs outline-none"
                    >
                      {LANGUAGE_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </div>
                  <span className="text-[10px] text-gray-400">Multi-language compiler</span>
                </div>
                <div className="bg-white border border-gray-200 rounded-b-xl overflow-hidden font-mono text-xs shadow-inner" style={{ maxHeight: 280, overflowY: 'auto' }}>
                  <Editor
                    value={answers[`${currentQuestion.id}_rawcode`] ?? answers[currentQuestion.id] ?? currentQuestion.codeTemplate ?? ''}
                    onValueChange={(val) => {
                      handleAnswerChange(val);
                      setAnswers(prev => ({ ...prev, [`${currentQuestion.id}_rawcode`]: val }));
                    }}
                    highlight={code => {
                      try { if (getCodeLang() === 'python') return highlight(code, (languages as any).python); } catch {}
                      try { return highlight(code, (languages as any).js); } catch { return code; }
                    }}
                    padding={14}
                    style={{ fontFamily: '"Fira code", "Fira Mono", monospace', fontSize: 13, minHeight: 220 }}
                  />
                </div>

                {(currentQuestion.testCases || []).length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-gray-600 mb-1.5">Sample Test Cases</div>
                    <div className="space-y-1.5">
                      {(currentQuestion.testCases || []).slice(0, 3).map((tc, i) => (
                        <div key={i} className="flex items-start gap-2 text-[11px] bg-white border border-gray-100 p-2 rounded-lg">
                          <div className="w-5 font-mono text-gray-400">#{i + 1}</div>
                          <div className="flex-1">
                            <div className="text-gray-600">In: <span className="font-mono text-gray-800">{tc.input}</span></div>
                            <div className="text-gray-500">Out: <span className="font-mono text-gray-700">{tc.output}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleRunCode}
                  disabled={running}
                  className="mt-3 w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-400 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  {running ? <><Loader2 size={15} className="animate-spin" /> Running...</> : <><Play size={15} /> Run Code</>}
                </button>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="bg-white border-t border-gray-100 p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))} disabled={currentQuestionIndex === 0} className="px-3.5 py-2 border border-gray-200 rounded-xl text-xs font-medium disabled:opacity-40">Previous</button>
              <button onClick={() => toggleMark(currentQuestion.id)} className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 ${marked[currentQuestion.id] ? 'bg-amber-100 text-amber-700' : 'bg-gray-50 text-gray-600'}`}>
                <Flag size={13} /> Mark
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-gray-500">{answeredCount}/{moduleQuestions.length}</div>
              {currentQuestionIndex < moduleQuestions.length - 1 ? (
                <button onClick={() => setCurrentQuestionIndex(prev => prev + 1)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors">Next</button>
              ) : (
                <button onClick={handleNextModule} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-colors">
                  <span>{currentModuleIndex < exam.modules.length - 1 ? 'Next Module' : 'Submit Exam'}</span><SkipForward size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
