import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';

export type QuestionType = 'mcq' | 'paragraph' | 'coding' | 'multiple_select';

export interface TestCase { input: string; output: string; }

export interface Question {
  id: string;
  moduleId: string;
  type: QuestionType;
  text: string;
  image?: string;
  options?: string[];
  correctAnswers?: string[];
  codeTemplate?: string;
  testCases?: TestCase[];
  language?: string;
}

export interface Module {
  id: string;
  examId: string;
  title: string;
  type: QuestionType;
  timeLimit: number;
}

export interface Exam {
  id: string;
  title: string;
  published: boolean;
  modules: Module[];
}

export interface Student {
  id: string;
  name?: string;
  email: string;
  examId: string;
  scheduledTime?: string;
  registeredAt: string;
}

export interface ProctoringReport {
  id: string;
  studentId: string;
  examId: string;
  type: 'tab_switch' | 'fullscreen_exit' | 'face_detection' | 'looking_away';
  timestamp: string;
  evidence?: string;
}

export interface Result {
  studentId: string;
  examId: string;
  score: number;
  totalScore: number;
  submittedAt: string;
  status: 'completed' | 'terminated';
}

export interface ExamSession {
  studentId: string;
  examId: string;
  attemptId?: number;
  startTime: string;
  status: 'not_started' | 'in_progress' | 'submitted' | 'terminated';
  currentModuleIndex: number;
  timeRemaining: number;
  answers: Record<string, any>;
  violations: { fullscreen: number; tab: number; face: number; };
}

interface ExamContextType {
  exams: Exam[];
  questions: Question[];
  students: Student[];
  logs: ProctoringReport[];
  results: Result[];
  addExam: (exam: Exam) => Promise<void>;
  updateExam: (exam: Exam) => void;
  deleteExam: (examId: string) => Promise<void>;
  addQuestion: (question: Question) => Promise<void>;
  deleteQuestion: (questionId: string) => Promise<void>;
  registerStudent: (student: Student) => Promise<void>;
  registerStudentsBulk: (students: Student[]) => Promise<void>;
  deleteStudent: (studentId: string) => Promise<void>;
  currentUser: { role: 'admin' | 'student' | null; id?: string; name?: string } | null;
  currentSession: ExamSession | null;
  loginStudent: (email: string, examId: string) => Promise<Student | null>;
  loginAdmin: () => void;
  loginAdminWithCredentials: (email: string, password: string) => Promise<any | null>;
  logout: () => void;
  startExam: () => void;
  submitExam: (answers: Record<string, any>, status?: 'submitted' | 'terminated') => Promise<boolean>;
  recordViolation: (type: 'fullscreen' | 'tab' | 'face' | 'ai', detail?: string, evidence?: string) => void;
  analyzeFrame: (base64Image: string) => Promise<{ violation?: string; face_count?: number; confidence?: number; details?: string[] } | null>;
  runCode: (code: string, language: string, testcases: TestCase[], examId?: string, questionId?: string) => Promise<any>;
  updateAnswer: (questionId: string, answer: any) => void;
  nextModule: () => void;
  refreshData: () => void;
}

const ExamContext = createContext<ExamContextType | undefined>(undefined);

export const ExamProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [logs, setLogs] = useState<ProctoringReport[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [currentUser, setCurrentUser] = useState<{ role: 'admin' | 'student' | null; id?: string; name?: string } | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('AUTH_USER');
      if (saved) { try { return JSON.parse(saved); } catch { return null; } }
    }
    return null;
  });
  const [currentSession, setCurrentSession] = useState<ExamSession | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('AUTH_TOKEN');
    return null;
  });

  const apiBaseUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';

  const getToken = (): string | null => {
    if (typeof window !== 'undefined') return localStorage.getItem('AUTH_TOKEN') || authToken;
    return authToken;
  };

  const getHeaders = (json = true): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (json) headers['Content-Type'] = 'application/json';
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const hasToken = (): boolean => !!getToken();

  const readApiError = async (response: Response) => {
    try {
      const body = await response.json();
      return body?.message || `Request failed with status ${response.status}`;
    } catch { return `Request failed with status ${response.status}`; }
  };

  const persistUser = (user: { role: 'admin' | 'student' | null; id?: string; name?: string } | null) => {
    if (typeof window !== 'undefined') {
      if (user) localStorage.setItem('AUTH_USER', JSON.stringify(user));
      else localStorage.removeItem('AUTH_USER');
    }
    setCurrentUser(user);
  };

  // ── Normalizers ───────────────────────────────────────────────────────────

  const normalizeExam = (e: any): Exam => {
    // FIX: Use modules from backend if available
    let modules: Module[] = [];
    if (Array.isArray(e.modules) && e.modules.length > 0) {
      modules = e.modules.map((m: any) => ({
        id: m.id || `mod-${e.code || e.exam_id}-${m.title}`,
        examId: m.examId || e.code || String(e.exam_id),
        title: m.title || 'Module',
        type: (m.type || 'mcq') as QuestionType,
        timeLimit: m.timeLimit || e.duration || 30,
      }));
    } else {
      // Default single module
      modules = [{
        id: `mod-${e.code || e.exam_id}`,
        examId: e.code || String(e.exam_id),
        title: e.title,
        type: 'mcq' as QuestionType,
        timeLimit: e.duration || 30,
      }];
    }
    return {
      id: e.code || String(e.exam_id),
      title: e.title,
      published: !!e.published,
      modules,
    };
  };

  const normalizeQuestion = (q: any): Question => {
    const examCode = q.exam_code || String(q.exam_id);
    const moduleId = q.module_id || `mod-${examCode}`;
    return {
      id: String(q.question_id),
      moduleId,
      type: (q.type || q.question_type || 'mcq') as QuestionType,
      text: q.question,
      options: [q.option1, q.option2, q.option3, q.option4].filter(Boolean),
      correctAnswers: q.answer ? [q.answer] : [],
      codeTemplate: q.code_template || '',
      language: q.language || '',
      testCases: q.test_cases || [],
    };
  };

  const normalizeStudent = (s: any): Student => ({
    id: String(s.id),
    name: s.name || s.email || undefined,
    email: s.email,
    examId: String(s.exam_code ?? s.exam_id ?? ''),
    registeredAt: s.registered_at ?? new Date().toISOString(),
  });

  const normalizeResult = (r: any): Result => {
    const score = r.score || 0;
    const percentage = r.percentage || 0;
    const calculatedTotal = percentage > 0 ? Math.round((score * 100) / percentage) : Math.max(score, r.total_score || 1);
    return {
      studentId: String(r.student_id),
      examId: r.exam_code || String(r.exam_id),
      score,
      totalScore: r.total_score || calculatedTotal,
      submittedAt: r.submitted_at || r.created_at || new Date().toISOString(),
      status: 'completed',
    };
  };

  const normalizeViolation = (v: any): ProctoringReport => {
    const typeMap: Record<string, ProctoringReport['type']> = {
      'Tab Switch': 'tab_switch',
      'Fullscreen Exit': 'fullscreen_exit',
      'No Face Detected': 'face_detection',
      'Multiple Faces Detected': 'face_detection',
      'Candidate Absent': 'face_detection',
    };
    return {
      id: String(v.violation_id),
      studentId: String(v.student_id),
      examId: v.exam_code || String(v.exam_id),
      type: typeMap[v.violation_type] || 'looking_away',
      timestamp: v.violation_time || new Date().toISOString(),
      evidence: v.screenshot_path || undefined,
    };
  };

  // ── Data Fetching ────────────────────────────────────────────────────────

  const fetchExams = async () => {
    if (!hasToken()) return;
    try {
      const response = await fetch(`${apiBaseUrl}/admin/exams`, { headers: getHeaders() });
      if (!response.ok) return;
      const body = await response.json();
      if (!body.success) return;
      const backendExams: Exam[] = (body.data || []).map((item: any) => normalizeExam(item));
      setExams(backendExams);
      // Fetch questions for each exam
      for (const exam of backendExams) {
        await fetchQuestionsForExam(exam.id);
      }
    } catch (err) { console.warn('fetchExams failed', err); }
  };

  const fetchQuestionsForExam = async (examId: string) => {
    if (!hasToken()) return;
    try {
      const response = await fetch(`${apiBaseUrl}/admin/questions/${examId}`, { headers: getHeaders() });
      if (!response.ok) return;
      const body = await response.json();
      if (!body.success) return;
      const backendQuestions: Question[] = (body.data || []).map((item: any) => normalizeQuestion(item));
      setQuestions(prev => {
        const others = prev.filter(q => !backendQuestions.some(bq => bq.id === q.id));
        return [...others, ...backendQuestions];
      });
    } catch (err) { console.warn(`fetchQuestions for ${examId} failed`, err); }
  };

  const fetchStudents = async () => {
    if (!hasToken()) return;
    try {
      const response = await fetch(`${apiBaseUrl}/students`, { headers: getHeaders() });
      if (!response.ok) return;
      const body = await response.json();
      if (!body.success) return;
      setStudents((body.data || []).map((item: any) => normalizeStudent(item)));
    } catch (err) { console.warn('fetchStudents failed', err); }
  };

  const fetchResults = async () => {
    if (!hasToken()) return;
    try {
      const response = await fetch(`${apiBaseUrl}/all_results`, { headers: getHeaders() });
      if (!response.ok) return;
      const body = await response.json();
      if (!body.success) return;
      setResults((body.data || []).map((item: any) => normalizeResult(item)));
    } catch (err) { console.warn('fetchResults failed', err); }
  };

  const fetchViolations = async () => {
    if (!hasToken()) return;
    try {
      const response = await fetch(`${apiBaseUrl}/violations`, { headers: getHeaders() });
      if (!response.ok) return;
      const body = await response.json();
      if (!body.success) return;
      setLogs((body.data || []).map((item: any) => normalizeViolation(item)));
    } catch (err) { console.warn('fetchViolations failed', err); }
  };

  const refreshData = () => {
    fetchExams();
    fetchStudents();
    fetchResults();
    fetchViolations();
  };

  // ── Exam Actions ──────────────────────────────────────────────────────────

  const addExam = async (exam: Exam) => {
    if (hasToken()) {
      const totalDuration = exam.modules.reduce((t, m) => t + m.timeLimit, 0) || 30;
      const response = await fetch(`${apiBaseUrl}/create_exam`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          title: exam.title,
          duration: totalDuration,
          code: exam.id,
          published: exam.published,
          modules: exam.modules,
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const body = await response.json();
      if (!body.success || !body.data) throw new Error(body.message || 'Exam was not saved');

      const savedCode = String(body.data.code || exam.id);
      const savedExam: Exam = {
        ...exam,
        id: savedCode,
        published: body.data.published ?? exam.published,
        modules: exam.modules.map(m => ({ ...m, examId: savedCode })),
      };
      setExams(prev => [...prev.filter(e => e.id !== savedExam.id), savedExam]);
      return;
    }
    setExams(prev => [...prev, exam]);
  };

  const updateExam = (updatedExam: Exam) => {
    setExams(prev => prev.map(e => e.id === updatedExam.id ? updatedExam : e));
    if (hasToken()) {
      fetch(`${apiBaseUrl}/update_exam/${updatedExam.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ title: updatedExam.title, published: updatedExam.published, modules: updatedExam.modules }),
      }).then(() => fetchExams()).catch(err => console.warn('updateExam failed', err));
    }
  };

  const deleteExam = async (examId: string) => {
    if (hasToken()) {
      const response = await fetch(`${apiBaseUrl}/delete_exam/${examId}`, { method: 'DELETE', headers: getHeaders() });
      if (!response.ok) { toast.error(await readApiError(response)); return; }
    }
    const examToDelete = exams.find(e => e.id === examId);
    const moduleIds = examToDelete?.modules.map(m => m.id) ?? [];
    setExams(prev => prev.filter(e => e.id !== examId));
    setQuestions(prev => prev.filter(q => !moduleIds.includes(q.moduleId)));
    setLogs(prev => prev.filter(l => l.examId !== examId));
    setResults(prev => prev.filter(r => r.examId !== examId));
  };

  // ── Question Actions ────────────────────────────────────────────────────

  const addQuestion = async (question: Question) => {
    const exam = exams.find(e => e.modules.some(m => m.id === question.moduleId));
    const module = exam?.modules.find(m => m.id === question.moduleId);

    if (hasToken() && exam) {
      const options = question.options || [];
      const padded = [...options];
      while (padded.length < 4) padded.push(`Option ${padded.length + 1}`);
      const answer = question.correctAnswers?.[0] || padded[0];

      const payload: any = {
        exam_code: exam.id,
        question: question.text,
        type: question.type || module?.type || 'mcq',
        module_id: question.moduleId,
        option1: padded[0],
        option2: padded[1],
        option3: padded[2],
        option4: padded[3],
        answer,
      };

      if (question.type === 'coding') {
        payload.code_template = question.codeTemplate || '';
        payload.language = question.language || 'python';
        payload.test_cases = question.testCases || [];
      }

      const response = await fetch(`${apiBaseUrl}/add_question`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const body = await response.json();
      if (!body.success || !body.data) throw new Error(body.message || 'Question was not saved');

      // Add to local state with correct moduleId
      const newQ: Question = {
        ...question,
        id: String(body.data.question_id),
        moduleId: question.moduleId,
      };
      setQuestions(prev => [...prev, newQ]);
      return;
    }
    setQuestions(prev => [...prev, question]);
  };

  const deleteQuestion = async (questionId: string) => {
    if (hasToken()) {
      const response = await fetch(`${apiBaseUrl}/delete_question/${questionId}`, { method: 'DELETE', headers: getHeaders() });
      if (!response.ok) { toast.error(await readApiError(response)); return; }
    }
    setQuestions(prev => prev.filter(q => q.id !== questionId));
  };

  // ── Student Actions ──────────────────────────────────────────────────────

  const registerStudent = async (student: Student) => {
    if (hasToken()) {
      const response = await fetch(`${apiBaseUrl}/students`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ email: student.email, name: student.name || student.email, exam_code: student.examId }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const body = await response.json();
      if (body.success && body.data) { setStudents(prev => [...prev, normalizeStudent(body.data)]); return; }
      throw new Error('Student was not saved');
    }
    setStudents(prev => [...prev, student]);
  };

  const registerStudentsBulk = async (newStudents: Student[]) => {
    if (hasToken()) {
      const response = await fetch(`${apiBaseUrl}/students/bulk`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ students: newStudents.map(s => ({ email: s.email, name: s.name || s.email, exam_code: s.examId })) }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const body = await response.json();
      if (body.success && Array.isArray(body.data?.created)) {
        setStudents(prev => [...prev, ...body.data.created.map((i: any) => normalizeStudent(i))]);
        const errors = body.data.errors || [];
        if (errors.length > 0) throw new Error(`${body.data.created.length} saved, ${errors.length} failed. Row ${errors[0].row}: ${errors[0].message}`);
        return;
      }
      throw new Error('Students were not saved');
    }
    setStudents(prev => [...prev, ...newStudents.filter(n => !prev.some(s => s.id === n.id))]);
  };

  const deleteStudent = async (studentId: string) => {
    if (hasToken()) {
      const response = await fetch(`${apiBaseUrl}/delete_student/${studentId}`, { method: 'DELETE', headers: getHeaders() });
      if (!response.ok) { toast.error(await readApiError(response)); return; }
    }
    setStudents(prev => prev.filter(s => s.id !== studentId));
    setLogs(prev => prev.filter(l => l.studentId !== studentId));
    setResults(prev => prev.filter(r => r.studentId !== studentId));
  };

  // ── Auth Actions ─────────────────────────────────────────────────────────

  const loginStudent = async (email: string, examId: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedExamId = examId.trim();
    if (!normalizedEmail || !normalizedExamId) return null;

    try {
      const authResponse = await fetch(`${apiBaseUrl}/student/login`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ email: normalizedEmail, exam_id: normalizedExamId }),
      });

      if (authResponse.ok) {
        const authData = await authResponse.json();
        if (authData.success && authData.data?.token) {
          const token = authData.data.token as string;
          setAuthToken(token);
          localStorage.setItem('AUTH_TOKEN', token);

          const student: Student = {
            id: String(authData.data.user.id),
            email: authData.data.user.email,
            name: authData.data.user.name,
            examId: normalizedExamId,
            registeredAt: new Date().toISOString(),
          };

          const examResponse = await fetch(`${apiBaseUrl}/questions/${normalizedExamId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          let exam: Exam | null = null;
          let attemptId: number | undefined;

          if (examResponse.ok) {
            const examData = await examResponse.json();
            if (examData.success && examData.data) {
              const remoteExam = examData.data.exam;
              attemptId = examData.data.attempt_id;
              exam = normalizeExam(remoteExam);

              const convertedQuestions: Question[] = (examData.data.questions || []).map((q: any) => ({
                id: String(q.question_id),
                moduleId: q.module_id || `mod-${remoteExam.code}`,
                type: (q.type || q.question_type || 'mcq') as QuestionType,
                text: q.question,
                options: [q.option1, q.option2, q.option3, q.option4].filter(Boolean),
                codeTemplate: q.code_template || '',
                language: q.language || '',
                testCases: q.test_cases || [],
              }));

              setExams(prev => {
                const others = prev.filter(e => e.id !== exam!.id);
                return [...others, exam!];
              });
              setQuestions(prev => {
                const others = prev.filter(q => !convertedQuestions.some(cq => cq.id === q.id));
                return [...others, ...convertedQuestions];
              });
            }
          }

          if (!exam) return null;
          if (!exam.published) { toast.error('This exam is not published.'); return null; }

          persistUser({ role: 'student', id: student.id, name: student.name || student.email });
          setCurrentSession({
            studentId: student.id,
            examId: exam.id,
            attemptId,
            startTime: new Date().toISOString(),
            status: 'not_started',
            currentModuleIndex: 0,
            timeRemaining: (exam.modules[0]?.timeLimit || 30) * 60,
            answers: {},
            violations: { fullscreen: 0, tab: 0, face: 0 },
          });

          return student;
        }
      }
    } catch (err) {
      console.warn('loginStudent failed', err);
    }
    return null;
  };

  const loginAdmin = () => {
    const adminUser = { role: 'admin' as const, name: 'Administrator', id: 'admin-local' };
    persistUser(adminUser);
    return adminUser;
  };

  const loginAdminWithCredentials = async (email: string, password: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/login`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      if (!response.ok) return null;
      const body = await response.json();
      if (body.success && body.data?.token) {
        const token = body.data.token as string;
        setAuthToken(token);
        localStorage.setItem('AUTH_TOKEN', token);
        const adminUser = { role: 'admin' as const, id: String(body.data.user.id), name: body.data.user.name };
        persistUser(adminUser);
        return body.data.user;
      }
      return null;
    } catch (err) {
      // Dev fallback
      if (email.trim().toLowerCase() === 'admin123@gmail.com' && password === 'admin123') {
        const devToken = 'dev-admin-token';
        setAuthToken(devToken);
        localStorage.setItem('AUTH_TOKEN', devToken);
        const devAdmin = { role: 'admin' as const, id: 'admin-local', name: 'Administrator' };
        persistUser(devAdmin);
        return { id: 'admin-local', name: 'Administrator', email };
      }
      return null;
    }
  };

  const logout = () => {
    setCurrentSession(null);
    setAuthToken(null);
    persistUser(null);
    localStorage.removeItem('AUTH_TOKEN');
  };

  const startExam = () => {
    if (currentSession) setCurrentSession({ ...currentSession, status: 'in_progress', startTime: new Date().toISOString() });
  };

  const submitExam = async (answers: Record<string, any>, status: 'submitted' | 'terminated' = 'submitted') => {
    if (!currentSession || !currentUser) return false;

    let success = false;
    let backendResult: any = null;

    if (hasToken()) {
      try {
        const payload: any = {
          answers: Object.entries(answers).map(([questionId, selectedAnswer]) => ({
            question_id: Number(questionId),
            selected_answer: Array.isArray(selectedAnswer)
              ? selectedAnswer.join(', ')
              : typeof selectedAnswer === 'object'
              ? JSON.stringify(selectedAnswer)
              : String(selectedAnswer ?? ''),
          })),
        };
        if (currentSession.attemptId) payload.attempt_id = currentSession.attemptId;

        const response = await fetch(`${apiBaseUrl}/submit_exam`, {
          method: 'POST', headers: getHeaders(), body: JSON.stringify(payload),
        });

        if (response.ok) {
          const body = await response.json();
          if (body.success) { success = true; backendResult = body.data; toast.success('Exam submitted successfully.'); }
        }
      } catch (err) { console.warn('submitExam backend failed', err); }
    }

    const score = backendResult ? Number(backendResult.score ?? 0) : 0;
    const totalScore = backendResult?.total_score || 0;

    const proctoringLog: ProctoringReport = {
      id: `log-${Date.now()}`,
      studentId: currentSession.studentId,
      examId: currentSession.examId,
      type: 'looking_away',
      timestamp: new Date().toISOString(),
      evidence: `violations: fs=${currentSession.violations.fullscreen} tab=${currentSession.violations.tab} face=${currentSession.violations.face}`,
    };

    setResults(prev => [...prev, { studentId: currentSession.studentId, examId: currentSession.examId, score, totalScore, submittedAt: new Date().toISOString(), status: status === 'terminated' ? 'terminated' : 'completed' }]);
    setLogs(prev => [...prev, proctoringLog]);
    setCurrentSession({ ...currentSession, status });
    return true;
  };

  const recordViolation = (type: 'fullscreen' | 'tab' | 'face' | 'ai', detail?: string, evidence?: string) => {
    if (!currentSession || currentSession.status !== 'in_progress') return;

    const violationKey = type === 'fullscreen' ? 'fullscreen' : type === 'tab' ? 'tab' : 'face';
    const newViolations = { ...currentSession.violations, [violationKey]: currentSession.violations[violationKey] + 1 };
    const total = newViolations.fullscreen + newViolations.tab + newViolations.face;

    const backendViolationTypeMap: Record<string, string> = {
      fullscreen: 'Fullscreen Exit', tab: 'Tab Switch', face: 'No Face Detected', ai: 'No Face Detected',
    };

    if (hasToken() && currentSession.examId) {
      fetch(`${apiBaseUrl}/record_violation`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({
          student_id: Number(currentSession.studentId) || undefined,
          exam_id: currentSession.examId,
          violation_type: backendViolationTypeMap[type] || 'Tab Switch',
          screenshot: evidence || undefined,
        }),
      }).catch(err => console.warn('recordViolation failed', err));
    }

    if (total > 3) {
      toast.error('Too many violations! Exam automatically submitted.');
      setCurrentSession({ ...currentSession, violations: newViolations, status: 'terminated' });
    } else {
      toast.warning(`Violation Warning (${detail ?? type}). Total: ${total}/4`);
      setCurrentSession({ ...currentSession, violations: newViolations });
    }

    const logType: ProctoringReport['type'] = type === 'fullscreen' ? 'fullscreen_exit' : type === 'tab' ? 'tab_switch' : 'face_detection';
    setLogs(prev => [...prev, { id: `log-${Date.now()}`, studentId: currentSession.studentId, examId: currentSession.examId, type: logType, timestamp: new Date().toISOString(), evidence: evidence || detail || type }]);
  };

  const analyzeFrame = async (base64Image: string) => {
    if (!hasToken() || !currentSession) return null;
    try {
      const response = await fetch(`${apiBaseUrl}/analyze_frame`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ student_id: Number(currentSession.studentId) || undefined, exam_id: currentSession.examId, screenshot: base64Image }),
      });
      if (!response.ok) return null;
      const body = await response.json();
      if (!body.success) return null;
      return { violation: body.data?.violation, face_count: body.data?.face_count, confidence: body.data?.confidence, details: body.data?.details };
    } catch (err) { return null; }
  };

  const runCode = async (code: string, language: string, testcases: TestCase[], examId?: string, questionId?: string) => {
    if (!hasToken()) return null;
    try {
      const response = await fetch(`${apiBaseUrl}/run_code`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ code, language, testcases, exam_id: examId, question_id: questionId }),
      });
      if (!response.ok) return null;
      const body = await response.json();
      return body.success ? body.data : null;
    } catch (err) { return null; }
  };

  const updateAnswer = (questionId: string, answer: any) => {
    if (currentSession) setCurrentSession({ ...currentSession, answers: { ...currentSession.answers, [questionId]: answer } });
  };

  const nextModule = () => {
    if (!currentSession) return;
    const exam = exams.find(e => e.id === currentSession.examId);
    if (!exam) return;
    const nextIndex = currentSession.currentModuleIndex + 1;
    if (nextIndex < exam.modules.length) {
      setCurrentSession({ ...currentSession, currentModuleIndex: nextIndex, timeRemaining: exam.modules[nextIndex].timeLimit * 60 });
    } else {
      submitExam(currentSession.answers, 'submitted');
    }
  };

  useEffect(() => {
    if (currentUser?.role === 'admin' && authToken) {
      fetchStudents();
      fetchExams();
      fetchResults();
      fetchViolations();
    }
  }, [currentUser?.role, authToken]);

  return (
    <ExamContext.Provider value={{
      exams, questions, students, logs, results,
      addExam, updateExam, deleteExam, addQuestion, deleteQuestion,
      registerStudent, registerStudentsBulk, deleteStudent,
      currentUser, currentSession,
      loginStudent, loginAdmin, loginAdminWithCredentials, logout,
      startExam, submitExam, recordViolation, analyzeFrame, runCode,
      updateAnswer, nextModule, refreshData,
    }}>
      {children}
    </ExamContext.Provider>
  );
};

export const useExam = () => {
  const context = useContext(ExamContext);
  if (!context) throw new Error('useExam must be used within ExamProvider');
  return context;
};
