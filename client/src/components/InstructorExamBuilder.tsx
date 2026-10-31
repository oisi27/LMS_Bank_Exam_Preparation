import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, Button, Badge } from '../design-system';
import { useAuth } from '../context/AuthContext';
import { MathRenderer } from './MathRenderer';
import { InstructorExamTestModal } from './InstructorExamTestModal';
import {
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  HelpCircle,
  Edit2,
  Eye,
  FileQuestion,
  ListPlus,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Timer,
  Users,
  ShieldAlert,
  Award,
  RefreshCw,
  AlertTriangle,
  Upload,
  Download,
  Check,
  FileText
} from 'lucide-react';

interface SubmissionItem {
  attemptId: string;
  userId: string;
  studentName: string;
  attemptStatus: string;
  startedAt: string;
  submittedAt?: string;
  timeSpentSeconds?: number;
  resultId?: string;
  score?: number;
  totalMarks?: number;
  correctCount?: number;
  wrongCount?: number;
  skippedCount?: number;
  accuracyPercentage?: number;
  isPassed?: boolean;
  violationCount: number;
}

interface ViolationItem {
  id: string;
  attemptId: string;
  userId: string;
  studentName: string;
  violationType: string;
  details?: any;
  occurredAt: string;
}

interface ExamItem {
  id: string;
  title: string;
  titleBangla?: string;
  description?: string;
  category: string;
  type: string;
  status: 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'CLOSED' | 'RESULTS_PUBLISHED';
  durationMinutes: number;
  totalMarks: number;
  passMarks: number;
  negativeMarkingRate: number;
  allowedAttempts: number;
  startsAt: string;
  endsAt: string;
  resultReleaseMode: string;
  integrityEnabled: boolean;
  maxViolationsAllowed: number;
  createdBy: string;
  createdAt: string;
  questionCount: number;
  questionsSumMarks?: number;
  linkedCourses?: { id: string; title: string }[];
  linkedCourseIds?: string[];
}

interface Question {
  id: string;
  subject: string;
  chapter: string;
  topic: string;
  difficulty: string;
  type: string;
  prompt: string;
  prompt_bangla?: string;
  isApproved?: boolean;
  options?: any[];
}

export const InstructorExamBuilder: React.FC = () => {
  const { user } = useAuth();
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [selectedExam, setSelectedExam] = useState<ExamItem | null>(null);
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Exam Form Modal state
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [examForm, setExamForm] = useState({
    title: '',
    titleBangla: '',
    description: '',
    category: 'BANK_RECRUITMENT',
    type: 'MODEL_TEST' as 'CHAPTER_QUIZ' | 'MODEL_TEST',
    status: 'DRAFT' as 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'CLOSED',
    resultReleaseMode: 'INSTANT' as 'INSTANT' | 'SCHEDULED' | 'MANUAL',
    durationMinutes: 60,
    totalMarks: 100,
    passMarks: 40,
    negativeMarkingRate: 0.25,
    allowedAttempts: 1,
    startsAt: new Date().toISOString().slice(0, 16),
    endsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 16),
    courseIds: [] as string[]
  });

  // Question Selector Modal state
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [qSearch, setQSearch] = useState('');
  const [qSubject, setQSubject] = useState('');
  const [qDifficulty, setQDifficulty] = useState('');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [currentExamQuestions, setCurrentExamQuestions] = useState<any[]>([]);

  // 3-Tab Question Hub Modal states
  const [questionHubTab, setQuestionHubTab] = useState<'BANK' | 'MANUAL' | 'CSV'>('BANK');
  const [initialAssignedIds, setInitialAssignedIds] = useState<string[]>([]);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  // Manual Question Creation Form state
  const [manualSubject, setManualSubject] = useState('English Language & Literature');
  const [manualChapter, setManualChapter] = useState('Grammar');
  const [manualTopic, setManualTopic] = useState('');
  const [manualDifficulty, setManualDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [manualType, setManualType] = useState<'SINGLE_MCQ' | 'MULTI_SELECT'>('SINGLE_MCQ');
  const [manualPrompt, setManualPrompt] = useState('');
  const [manualPromptBangla, setManualPromptBangla] = useState('');
  const [manualExplanation, setManualExplanation] = useState('');
  const [manualExplanationBangla, setManualExplanationBangla] = useState('');
  const [manualOptions, setManualOptions] = useState([
    { optionKey: 'A', text: '', textBangla: '', isCorrect: true },
    { optionKey: 'B', text: '', textBangla: '', isCorrect: false },
    { optionKey: 'C', text: '', textBangla: '', isCorrect: false },
    { optionKey: 'D', text: '', textBangla: '', isCorrect: false }
  ]);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState('');
  const [manualSuccess, setManualSuccess] = useState('');

  // CSV Import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvRawText, setCsvRawText] = useState('');
  const [csvParsedRows, setCsvParsedRows] = useState<any[]>([]);
  const [csvRowErrors, setCsvRowErrors] = useState<{ row: number; error: string }[]>([]);
  const [csvValidCount, setCsvValidCount] = useState(0);
  const [csvImportLoading, setCsvImportLoading] = useState(false);
  const [csvImportError, setCsvImportError] = useState('');
  const [csvImportSuccess, setCsvImportSuccess] = useState('');

  // Workspace View Tab & Submissions Review state
  const [workspaceTab, setWorkspaceTab] = useState<'QUESTIONS' | 'SUBMISSIONS'>('QUESTIONS');
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsData, setSubmissionsData] = useState<{
    analytics: any;
    submissions: SubmissionItem[];
    violations: ViolationItem[];
  } | null>(null);

  // Student-View Exam Preview Modal State (Read-only simulation)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string[]>>({});
  const [previewMarked, setPreviewMarked] = useState<Record<string, boolean>>({});

  const fetchExams = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/exams?mine=true', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setExams(res.data.exams);
        if (selectedExam) {
          const updated = res.data.exams.find((e: ExamItem) => e.id === selectedExam.id);
          if (updated) setSelectedExam(updated);
        } else if (res.data.exams.length > 0) {
          setSelectedExam(res.data.exams[0]);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load exams.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const token = localStorage.getItem('token');
      const url = user?.role === 'ADMIN'
        ? 'http://localhost:5000/api/courses'
        : 'http://localhost:5000/api/courses?mine=true';
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setAvailableCourses(res.data.courses || []);
      }
    } catch (err: any) {
      console.error('Failed to load courses for exam builder:', err);
    }
  };

  const fetchExamDetails = async (examId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:5000/api/exams/${examId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setSelectedExam(res.data.exam);
        setCurrentExamQuestions(res.data.exam.questions || []);
        setSelectedQuestionIds((res.data.exam.questions || []).map((q: any) => q.questionId));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load exam details.');
    }
  };

  const fetchAvailableQuestions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/questions', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          search: qSearch || undefined,
          subject: qSubject || undefined,
          difficulty: qDifficulty || undefined,
          pageSize: 100
        }
      });
      if (res.data.success) {
        // Filter out questions that have < 2 options for MCQ types
        const valid = (res.data.questions || []).filter((q: any) => {
          if (q.type === 'SINGLE_MCQ' || q.type === 'MULTI_SELECT' || q.type === 'TRUE_FALSE') {
            return q.options && q.options.length >= 2;
          }
          return true;
        });
        setAvailableQuestions(valid);
      }
    } catch (err: any) {
      console.error('Error fetching questions:', err);
    }
  };

  const handleOpenQuestionModal = () => {
    const currentIds = currentExamQuestions.map((q: any) => q.questionId || q.id);
    setSelectedQuestionIds(currentIds);
    setInitialAssignedIds(currentIds);
    setQuestionHubTab('BANK');
    setShowUnsavedConfirm(false);
    setManualError('');
    setManualSuccess('');
    setCsvImportError('');
    setCsvImportSuccess('');
    setIsQuestionModalOpen(true);
    fetchAvailableQuestions();
  };

  const handleCloseQuestionModal = () => {
    const isChanged = JSON.stringify(selectedQuestionIds.slice().sort()) !== JSON.stringify(initialAssignedIds.slice().sort());
    if (isChanged) {
      setShowUnsavedConfirm(true);
    } else {
      setIsQuestionModalOpen(false);
    }
  };

  const handleConfirmDiscardAssignments = () => {
    setSelectedQuestionIds(initialAssignedIds);
    setShowUnsavedConfirm(false);
    setIsQuestionModalOpen(false);
  };

  const handleManualOptionChange = (idx: number, field: string, value: any) => {
    const updated = [...manualOptions];
    if (field === 'isCorrect' && manualType === 'SINGLE_MCQ') {
      updated.forEach((opt, i) => {
        opt.isCorrect = i === idx;
      });
    } else {
      (updated[idx] as any)[field] = value;
    }
    setManualOptions(updated);
  };

  const handleCreateManualQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError('');
    setManualSuccess('');

    if (!manualPrompt.trim()) {
      setManualError('Question prompt is required.');
      return;
    }
    if (manualOptions.some((o) => !o.text.trim())) {
      setManualError('All options (A, B, C, D) must have text.');
      return;
    }
    const correctCount = manualOptions.filter((o) => o.isCorrect).length;
    if (manualType === 'SINGLE_MCQ' && correctCount !== 1) {
      setManualError('Single MCQ must have exactly 1 correct answer.');
      return;
    }
    if (manualType === 'MULTI_SELECT' && correctCount < 1) {
      setManualError('Multi-select question must have at least 1 correct answer.');
      return;
    }

    setManualLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        subject: manualSubject,
        chapter: manualChapter || 'General',
        topic: manualTopic.trim() || 'General',
        difficulty: manualDifficulty,
        type: manualType,
        prompt: manualPrompt.trim(),
        promptBangla: manualPromptBangla.trim() || undefined,
        explanation: manualExplanation.trim() || undefined,
        explanationBangla: manualExplanationBangla.trim() || undefined,
        defaultMarks: 1.0,
        defaultNegativeMarks: selectedExam?.negativeMarkingRate || 0.25,
        options: manualOptions.map((o) => ({
          optionKey: o.optionKey,
          text: o.text.trim(),
          textBangla: o.textBangla.trim() || undefined,
          isCorrect: o.isCorrect
        }))
      };

      const res = await axios.post('http://localhost:5000/api/questions', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success && res.data.questionId) {
        const newId = res.data.questionId;
        setSelectedQuestionIds((prev) => (prev.includes(newId) ? prev : [...prev, newId]));
        setManualSuccess('Question created (Pending Admin Review) and staged for this exam!');
        setManualPrompt('');
        setManualPromptBangla('');
        setManualExplanation('');
        setManualExplanationBangla('');
        setManualOptions([
          { optionKey: 'A', text: '', textBangla: '', isCorrect: true },
          { optionKey: 'B', text: '', textBangla: '', isCorrect: false },
          { optionKey: 'C', text: '', textBangla: '', isCorrect: false },
          { optionKey: 'D', text: '', textBangla: '', isCorrect: false }
        ]);
        await fetchAvailableQuestions();
      }
    } catch (err: any) {
      setManualError(err.response?.data?.error || 'Failed to create question.');
    } finally {
      setManualLoading(false);
    }
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCsvImportError('');
    setCsvImportSuccess('');
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvRawText(text || '');
      preValidateCsv(text || '');
    };
    reader.readAsText(file);
  };

  const preValidateCsv = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      setCsvRowErrors([{ row: 1, error: 'CSV must contain a header row and at least 1 question record.' }]);
      setCsvParsedRows([]);
      setCsvValidCount(0);
      return;
    }

    const errors: { row: number; error: string }[] = [];
    const valid: any[] = [];
    const seenPrompts = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const rawLine = lines[i];
      const regex = /(?:^|,)(\"(?:[^\"]+|\"\")*\"|[^,]*)/g;
      const matches: string[] = [];
      let match;
      while ((match = regex.exec(rawLine)) !== null) {
        let val = match[1] || '';
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1).replace(/""/g, '"');
        }
        matches.push(val.trim());
        if (regex.lastIndex >= rawLine.length) break;
      }

      if (matches.length < 12) {
        errors.push({ row: i + 1, error: `Incomplete column count (${matches.length} found, expected at least 12)` });
        continue;
      }

      const [subject, chapter, topic, difficulty, type, prompt, promptBangla, optA, optB, optC, optD, correctOpt] = matches;
      if (!subject || !chapter || !prompt || !optA || !optB || !correctOpt) {
        errors.push({ row: i + 1, error: 'Missing mandatory fields (subject, chapter, prompt, optA, optB, correctOpt)' });
        continue;
      }

      const correctKeys = correctOpt.toUpperCase().split('|').map((k) => k.trim());
      const optionMap: Record<string, string> = { A: optA, B: optB };
      if (optC) optionMap.C = optC;
      if (optD) optionMap.D = optD;

      const invalidKeys = correctKeys.filter((k) => !optionMap[k] || optionMap[k].trim() === '');
      if (invalidKeys.length > 0) {
        errors.push({ row: i + 1, error: `Correct option key "${invalidKeys.join(', ')}" refers to an empty choice.` });
        continue;
      }

      if (seenPrompts.has(prompt.trim())) {
        errors.push({ row: i + 1, error: `Duplicate prompt within file: "${prompt.substring(0, 30)}..."` });
        continue;
      }
      seenPrompts.add(prompt.trim());

      valid.push({
        rowNumber: i + 1,
        subject,
        chapter,
        topic: topic || 'General',
        difficulty: difficulty || 'MEDIUM',
        type: type || 'SINGLE_MCQ',
        prompt,
        promptBangla,
        correctOpt,
        optA,
        optB,
        optC,
        optD
      });
    }

    setCsvRowErrors(errors);
    setCsvParsedRows(valid);
    setCsvValidCount(valid.length);
  };

  const handleImportCsvQuestions = async () => {
    if (!csvRawText || csvValidCount === 0) {
      setCsvImportError('No valid questions to import.');
      return;
    }

    setCsvImportLoading(true);
    setCsvImportError('');
    setCsvImportSuccess('');

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        'http://localhost:5000/api/questions/import-csv',
        { csvData: csvRawText, allowPartial: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        const newIds: string[] = res.data.importedQuestionIds || [];
        if (newIds.length > 0) {
          setSelectedQuestionIds((prev) => Array.from(new Set([...prev, ...newIds])));
        }
        setCsvImportSuccess(
          `Successfully imported ${res.data.importedCount} questions (${user?.role === 'ADMIN' ? 'Approved' : 'Pending Admin Review'}) and staged them for this exam!`
        );
        setCsvFile(null);
        setCsvRawText('');
        setCsvParsedRows([]);
        setCsvRowErrors([]);
        setCsvValidCount(0);
        await fetchAvailableQuestions();
      }
    } catch (err: any) {
      setCsvImportError(err.response?.data?.error || 'Failed to import CSV.');
    } finally {
      setCsvImportLoading(false);
    }
  };

  const handleDownloadSampleCsv = () => {
    const headers = 'subject,chapter,topic,difficulty,type,prompt,promptBangla,optA,optB,optC,optD,correctOpt,explanation';
    const sampleRow1 = 'English Language & Literature,Grammar,Prepositions,EASY,SINGLE_MCQ,"He is proficient ___ English.","তিনি ইংরেজিতে দক্ষ।","in","at","with","on",A,"Proficient takes \'in\'."';
    const sampleRow2 = 'Mathematics & Analytical Ability,Algebra,Equations,MEDIUM,SINGLE_MCQ,"If $x + 2 = 5$, what is $x$?","যদি $x + 2 = 5$ হয়, তবে $x$ এর মান কত?","1","2","3","4",C,"Subtracting 2 gives $x = 3$."';
    const sampleRow3 = 'Bangladesh & Global Affairs,History,Liberation War,MEDIUM,SINGLE_MCQ,"In which year did the Bangladesh Liberation War take place?","বাংলাদেশের মুক্তিযুদ্ধ কোন সালে হয়েছিল?","1970","1971","1972","1973",B,"1971."';
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, sampleRow1, sampleRow2, sampleRow3].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'bank_exam_question_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchSubmissions = async (examId: string) => {
    setSubmissionsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:5000/api/exams/${examId}/submissions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setSubmissionsData({
          analytics: res.data.analytics,
          submissions: res.data.submissions,
          violations: res.data.violations
        });
      }
    } catch (err: any) {
      console.error('Error fetching submissions:', err);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
    fetchCourses();
  }, []);

  useEffect(() => {
    if (selectedExam) {
      fetchExamDetails(selectedExam.id);
      if (workspaceTab === 'SUBMISSIONS') {
        fetchSubmissions(selectedExam.id);
      }
    }
  }, [selectedExam?.id, workspaceTab]);

  useEffect(() => {
    if (isQuestionModalOpen) {
      fetchAvailableQuestions();
    }
  }, [isQuestionModalOpen, qSubject, qDifficulty]);

  const handleOpenCreateModal = () => {
    setEditingExamId(null);
    setExamForm({
      title: '',
      titleBangla: '',
      description: '',
      category: 'BANK_RECRUITMENT',
      type: 'MODEL_TEST',
      status: 'DRAFT',
      resultReleaseMode: 'INSTANT',
      durationMinutes: 60,
      totalMarks: 100,
      passMarks: 40,
      negativeMarkingRate: 0.25,
      allowedAttempts: 1,
      startsAt: new Date().toISOString().slice(0, 16),
      endsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 16),
      courseIds: []
    });
    setSelectedQuestionIds([]);
    setIsExamModalOpen(true);
  };

  const handleOpenEditModal = (exam: ExamItem) => {
    setEditingExamId(exam.id);
    setExamForm({
      title: exam.title,
      titleBangla: exam.titleBangla || '',
      description: exam.description || '',
      category: exam.category,
      type: exam.type as any,
      status: exam.status as any,
      resultReleaseMode: (exam.resultReleaseMode as any) || 'INSTANT',
      durationMinutes: exam.durationMinutes,
      totalMarks: exam.totalMarks,
      passMarks: exam.passMarks,
      negativeMarkingRate: exam.negativeMarkingRate,
      allowedAttempts: exam.allowedAttempts,
      startsAt: exam.startsAt ? new Date(exam.startsAt).toISOString().slice(0, 16) : '',
      endsAt: exam.endsAt ? new Date(exam.endsAt).toISOString().slice(0, 16) : '',
      courseIds: (exam as any).linkedCourseIds || []
    });
    setIsExamModalOpen(true);
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    setSuccess('');

    // Validation for SCHEDULED release mode
    if (examForm.resultReleaseMode === 'SCHEDULED') {
      if (!examForm.endsAt) {
        setError('Please specify the result publication date and time for scheduled release.');
        setActionLoading(false);
        return;
      }
      if (new Date(examForm.endsAt) <= new Date(examForm.startsAt)) {
        setError('Scheduled result publication date/time must be after the exam start time.');
        setActionLoading(false);
        return;
      }
    }

    // Validation for Maximum Attempts per Student (positive whole integer)
    const attempts = Number(examForm.allowedAttempts);
    if (!Number.isInteger(attempts) || attempts < 1) {
      setError('Maximum Attempts per Student must be a positive integer (at least 1).');
      setActionLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const payload: any = {
        title: examForm.title.trim(),
        titleBangla: examForm.titleBangla ? examForm.titleBangla.trim() : null,
        description: examForm.description ? examForm.description.trim() : null,
        category: examForm.category,
        type: examForm.type,
        status: examForm.status,
        resultReleaseMode: examForm.resultReleaseMode,
        durationMinutes: Number(examForm.durationMinutes),
        totalMarks: Number(examForm.totalMarks),
        passMarks: Number(examForm.passMarks),
        negativeMarkingRate: Number(examForm.negativeMarkingRate),
        allowedAttempts: Number(examForm.allowedAttempts),
        startsAt: new Date(examForm.startsAt).toISOString(),
        endsAt: new Date(examForm.endsAt).toISOString(),
        courseIds: examForm.courseIds
      };

      if (!editingExamId) {
        // Creating new exam: pass selected question IDs if any
        if (selectedQuestionIds.length > 0) {
          payload.questionIds = selectedQuestionIds;
        }
        const res = await axios.post('http://localhost:5000/api/exams', payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.success) {
          setSuccess('Exam created successfully.');
          setIsExamModalOpen(false);
          await fetchExams();
        }
      } else {
        // Updating existing exam
        const res = await axios.put(`http://localhost:5000/api/exams/${editingExamId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.success) {
          setSuccess('Exam configuration updated successfully.');
          setIsExamModalOpen(false);
          await fetchExams();
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save exam.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveAssignedQuestions = async () => {
    if (!selectedExam) return;
    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const res = await axios.put(
        `http://localhost:5000/api/exams/${selectedExam.id}`,
        { questionIds: selectedQuestionIds },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setSuccess('Assigned questions updated successfully.');
        setIsQuestionModalOpen(false);
        await fetchExamDetails(selectedExam.id);
        await fetchExams();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update assigned questions.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (exam: ExamItem, newStatus: string) => {
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.put(
        `http://localhost:5000/api/exams/${exam.id}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setSuccess(`Exam status changed to ${newStatus}.`);
        await fetchExams();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update exam status.');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleQuestionSelection = (qId: string) => {
    if (selectedQuestionIds.includes(qId)) {
      setSelectedQuestionIds(selectedQuestionIds.filter((id) => id !== qId));
    } else {
      setSelectedQuestionIds([...selectedQuestionIds, qId]);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'LIVE':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              background: '#dcfce7',
              color: '#15803d',
              border: '1px solid #86efac',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <CheckCircle2 size={12} /> LIVE
          </span>
        );
      case 'SCHEDULED':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              background: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Clock size={12} /> SCHEDULED
          </span>
        );
      case 'CLOSED':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              background: '#fee2e2',
              color: '#b91c1c',
              border: '1px solid #fca5a5'
            }}
          >
            CLOSED
          </span>
        );
      case 'RESULTS_PUBLISHED':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              background: '#f0fdf4',
              color: '#16a34a',
              border: '1px solid #86efac',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <CheckCircle2 size={12} /> RESULTS PUBLISHED
          </span>
        );
      default:
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              background: 'rgba(148, 163, 184, 0.15)',
              color: '#334155',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <HelpCircle size={12} /> DRAFT
          </span>
        );
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Instructor Exam Builder
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '4px 0 0 0' }}>
            Author, configure, and assign question sets for Bangladesh Bank model tests and quizzes.
          </p>
        </div>

        <Button variant="primary" onClick={handleOpenCreateModal}>
          <Plus size={16} /> Create Exam
        </Button>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#b91c1c', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {success && (
        <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', color: '#15803d', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
          <CheckCircle2 size={18} /> {success}
        </div>
      )}

      {/* Two-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '24px', alignItems: 'flex-start' }}>
        {/* Left Column: Exam List */}
        <div>
          <Card style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>My Exams</h3>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{exams.length} created</span>
            </div>

            {loading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Loading exams...</div>
            ) : exams.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
                <FileQuestion size={32} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>No exams created yet.</div>
                <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Click "+ Create Exam" to get started.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '680px', overflowY: 'auto' }}>
                {exams.map((ex) => {
                  const isSelected = selectedExam?.id === ex.id;
                  return (
                    <div
                      key={ex.id}
                      onClick={() => setSelectedExam(ex)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: isSelected ? '#eff6ff' : '#ffffff',
                        border: isSelected ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                        boxShadow: isSelected ? '0 1px 3px rgba(37, 99, 235, 0.1)' : '0 1px 2px rgba(0, 0, 0, 0.03)',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = '#f1f5f9';
                          e.currentTarget.style.borderColor = '#cbd5e1';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = '#ffffff';
                          e.currentTarget.style.borderColor = '#e2e8f0';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.92rem', color: isSelected ? '#1d4ed8' : '#0f172a', lineHeight: 1.3 }}>
                          {ex.title}
                        </div>
                        {getStatusBadge(ex.status)}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', fontSize: '0.78rem', color: isSelected ? '#334155' : '#475569', marginTop: '6px', flexWrap: 'wrap' }}>
                        <span>⏱ {ex.durationMinutes}m</span>
                        <span>🎯 {ex.passMarks}/{ex.totalMarks} marks</span>
                        <span>❓ {ex.questionCount} Qs</span>
                        <span style={{ fontWeight: 600, color: ex.resultReleaseMode === 'SCHEDULED' ? '#2563eb' : ex.resultReleaseMode === 'MANUAL' ? '#d97706' : '#16a34a' }}>
                          📢 {ex.resultReleaseMode || 'INSTANT'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Active Exam Workspace */}
        <div>
          {selectedExam ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Header Card */}
              <Card style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ flex: '1 1 350px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>
                        {selectedExam.title}
                      </h2>
                      {getStatusBadge(selectedExam.status)}
                    </div>

                    {selectedExam.titleBangla && (
                      <div style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '2px' }}>
                        {selectedExam.titleBangla}
                      </div>
                    )}

                    <p style={{ color: '#334155', fontSize: '0.88rem', margin: '8px 0 0 0' }}>
                      {selectedExam.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {selectedExam.status === 'DRAFT' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleToggleStatus(selectedExam, 'LIVE')}
                        disabled={actionLoading || currentExamQuestions.length === 0}
                      >
                        <CheckCircle2 size={14} /> Publish to Live
                      </Button>
                    )}

                    {selectedExam.status === 'LIVE' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleToggleStatus(selectedExam, 'DRAFT')}
                        disabled={actionLoading}
                      >
                        Unpublish to Draft
                      </Button>
                    )}

                    {selectedExam.status !== 'RESULTS_PUBLISHED' && selectedExam.status !== 'DRAFT' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleToggleStatus(selectedExam, 'RESULTS_PUBLISHED')}
                        disabled={actionLoading}
                      >
                        <CheckCircle2 size={14} /> Publish Results
                      </Button>
                    )}

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setPreviewIndex(0);
                        setPreviewAnswers({});
                        setPreviewMarked({});
                        setIsPreviewOpen(true);
                      }}
                      disabled={currentExamQuestions.length === 0}
                    >
                      <Eye size={14} /> Preview (Student View)
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenEditModal(selectedExam)}
                      disabled={actionLoading}
                    >
                      <Edit2 size={14} /> Settings
                    </Button>
                  </div>
                </div>

                {/* Exam Metadata Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginTop: '18px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>DURATION</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{selectedExam.durationMinutes} mins</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>TOTAL MARKS</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{selectedExam.totalMarks}</span>
                      {selectedExam.questionsSumMarks !== undefined && Math.abs(selectedExam.questionsSumMarks - selectedExam.totalMarks) > 0.01 && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            background: 'rgba(245, 158, 11, 0.2)',
                            color: '#f59e0b',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                          title={`Sum of assigned questions is ${selectedExam.questionsSumMarks} marks, differing from configured ${selectedExam.totalMarks}`}
                        >
                          <AlertTriangle size={11} /> Questions: {selectedExam.questionsSumMarks}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>PASS MARKS</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{selectedExam.passMarks}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>NEGATIVE RATE</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>-{selectedExam.negativeMarkingRate}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>ATTEMPTS</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{selectedExam.allowedAttempts} allowed</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>RESULT RELEASE</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: selectedExam.resultReleaseMode === 'SCHEDULED' ? '#2563eb' : selectedExam.resultReleaseMode === 'MANUAL' ? '#d97706' : '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      {selectedExam.resultReleaseMode || 'INSTANT'}
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>ASSOCIATED COURSES</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                      {selectedExam.linkedCourses && selectedExam.linkedCourses.length > 0 ? (
                        <span style={{ color: '#2563eb' }}>
                          {selectedExam.linkedCourses.map((c: any) => c.title).join(', ')}
                        </span>
                      ) : (
                        <span style={{ color: '#64748b', fontStyle: 'italic' }}>Standalone Global Mock Exam</span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Workspace Navigation Tabs */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                <button
                  onClick={() => setWorkspaceTab('QUESTIONS')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    background: workspaceTab === 'QUESTIONS' ? '#2563eb' : 'transparent',
                    color: workspaceTab === 'QUESTIONS' ? '#ffffff' : '#475569',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <FileQuestion size={15} /> Assigned Questions ({currentExamQuestions.length})
                </button>
                <button
                  onClick={() => setWorkspaceTab('SUBMISSIONS')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    background: workspaceTab === 'SUBMISSIONS' ? '#2563eb' : 'transparent',
                    color: workspaceTab === 'SUBMISSIONS' ? '#ffffff' : '#475569',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Users size={15} /> Student Submissions & Integrity
                  {submissionsData && (
                    <span style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: '10px', fontSize: '0.75rem' }}>
                      {submissionsData.submissions.length}
                    </span>
                  )}
                </button>
              </div>

              {/* TAB 1: Questions Management Card */}
              {workspaceTab === 'QUESTIONS' && (
                <Card style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                        Assigned Questions ({currentExamQuestions.length})
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        Questions that candidates will be evaluated on in this exam.
                      </span>
                    </div>

                    {selectedExam.status === 'DRAFT' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleOpenQuestionModal}
                      >
                        <ListPlus size={16} /> Manage Questions
                      </Button>
                    )}
                  </div>

                  {currentExamQuestions.length === 0 ? (
                    <div style={{ padding: '36px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px' }}>
                      <FileQuestion size={40} style={{ margin: '0 auto 10px auto', opacity: 0.4 }} />
                      <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>No questions assigned to this exam.</div>
                      <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>
                        Click "Manage Questions" to pick questions from the question bank.
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {currentExamQuestions.map((eq: any, index: number) => (
                        <div
                          key={eq.questionId || index}
                          style={{
                            padding: '12px 16px',
                            borderRadius: '8px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '12px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '0.9rem', minWidth: '24px' }}>
                              Q{index + 1}.
                            </span>
                            <div>
                              <div style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 500 }}>
                                {eq.prompt}
                              </div>
                              {eq.promptBangla && (
                                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                                  {eq.promptBangla}
                                </div>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                              +{eq.marks || 1} / -{eq.negativeMarks || selectedExam.negativeMarkingRate}
                            </span>
                            <Badge text={eq.type || 'MCQ'} type="info" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {/* TAB 2: Student Submissions & Integrity Review */}
              {workspaceTab === 'SUBMISSIONS' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Performance Analytics Overview Bar */}
                  {submissionsData && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                      <Card style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Submissions</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                          {submissionsData.analytics.totalAttempts}
                        </div>
                      </Card>

                      <Card style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Average Score</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8' }}>
                          {submissionsData.analytics.averageScore}
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}> / {selectedExam.totalMarks}</span>
                        </div>
                      </Card>

                      <Card style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Highest Score</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#b45309' }}>
                          {submissionsData.analytics.highestScore}
                        </div>
                      </Card>

                      <Card style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Pass Rate</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#15803d' }}>
                          {submissionsData.analytics.passRatePercentage}%
                        </div>
                      </Card>

                      <Card style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Integrity Flags</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: submissionsData.analytics.totalViolations > 0 ? '#ef4444' : '#10b981' }}>
                          {submissionsData.analytics.totalViolations}
                        </div>
                      </Card>
                    </div>
                  )}

                  {/* Submissions Table Card */}
                  <Card style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Award size={18} color="#38bdf8" /> Student Attempts & Scores
                        </h3>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          Candidate scores, pass/fail status, accuracy, and detected violation strikes.
                        </span>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => fetchSubmissions(selectedExam.id)} disabled={submissionsLoading}>
                        <RefreshCw size={13} className={submissionsLoading ? 'animate-spin' : ''} /> Refresh
                      </Button>
                    </div>

                    {submissionsLoading ? (
                      <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                        Loading student submission data...
                      </div>
                    ) : !submissionsData || submissionsData.submissions.length === 0 ? (
                      <div style={{ padding: '36px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', color: '#64748b' }}>
                        No students have submitted attempts for this exam yet.
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                              <th style={{ padding: '10px 12px' }}>Candidate Name</th>
                              <th style={{ padding: '10px 12px' }}>Status</th>
                              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Score</th>
                              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Accuracy</th>
                              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Correct / Wrong</th>
                              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Integrity Flags</th>
                              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Submitted At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {submissionsData.submissions.map((sub) => (
                              <tr key={sub.attemptId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '12px', fontWeight: 600, color: '#0f172a' }}>
                                  {sub.studentName}
                                </td>
                                <td style={{ padding: '12px' }}>
                                  {sub.isPassed ? (
                                    <Badge text="PASSED" type="success" />
                                  ) : sub.resultId ? (
                                    <Badge text="FAILED" type="danger" />
                                  ) : (
                                    <Badge text={sub.attemptStatus} type="warning" />
                                  )}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#b45309' }}>
                                  {sub.resultId && sub.score !== null && sub.score !== undefined ? (
                                    `${sub.score} / ${sub.totalMarks}`
                                  ) : sub.attemptStatus === 'IN_PROGRESS' ? (
                                    <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 400 }}>In Progress</span>
                                  ) : (
                                    <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 400 }}>Pending Grading</span>
                                  )}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center', color: '#38bdf8', fontWeight: 600 }}>
                                  {sub.resultId && sub.accuracyPercentage !== null && sub.accuracyPercentage !== undefined ? (
                                    `${sub.accuracyPercentage}%`
                                  ) : (
                                    <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 400 }}>—</span>
                                  )}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                  {sub.resultId && sub.correctCount !== null && sub.correctCount !== undefined ? (
                                    <>
                                      <span style={{ color: '#10b981', fontWeight: 600 }}>{sub.correctCount}</span>
                                      <span style={{ color: '#64748b', margin: '0 4px' }}>/</span>
                                      <span style={{ color: '#ef4444', fontWeight: 600 }}>{sub.wrongCount ?? 0}</span>
                                    </>
                                  ) : (
                                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>—</span>
                                  )}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                  {sub.violationCount > 0 ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontWeight: 700 }}>
                                      <ShieldAlert size={14} /> {sub.violationCount} strike(s)
                                    </span>
                                  ) : (
                                    <span style={{ color: '#10b981', fontSize: '0.8rem' }}>Clean (0)</span>
                                  )}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontSize: '0.8rem' }}>
                                  {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : 'In Progress'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>

                  {/* Integrity Violations Forensic Log Card */}
                  <Card style={{ padding: '20px' }}>
                    <div style={{ marginBottom: '14px' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldAlert size={18} color="#ef4444" /> Exam Integrity & Proctoring Incident Log
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        Forensic trail of full screen exits, tab switches, and window focus loss recorded during live attempts.
                      </span>
                    </div>

                    {!submissionsData || submissionsData.violations.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', color: '#64748b' }}>
                        No integrity violations recorded for this exam.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {submissionsData.violations.map((v) => (
                          <div
                            key={v.id}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '6px',
                              background: 'rgba(239, 68, 68, 0.08)',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '0.85rem'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <Badge text={v.violationType} type="danger" />
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>{v.studentName}</span>
                              {v.details && typeof v.details === 'object' && v.details.note && (
                                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>({v.details.note})</span>
                              )}
                            </div>
                            <span style={{ color: '#64748b', fontSize: '0.78rem' }}>
                              {new Date(v.occurredAt).toLocaleTimeString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              )}
            </div>
          ) : (
            <Card style={{ padding: '60px', textAlign: 'center' }}>
              <FileQuestion size={48} style={{ margin: '0 auto 16px auto', color: '#60a5fa', opacity: 0.8 }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 8px 0' }}>
                Select an Exam to Manage
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto' }}>
                Pick an exam from the left column or create a new bank recruitment exam to configure syllabus and questions.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Modal: Create / Edit Exam */}
      {isExamModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <Card style={{ width: '600px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                {editingExamId ? 'Edit Exam Settings' : 'Create New Exam'}
              </h3>
              <button onClick={() => setIsExamModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveExam} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                  Exam Title (English) *
                </label>
                <input
                  type="text"
                  value={examForm.title}
                  onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                  placeholder="e.g. Bangladesh Bank AD Mock Test 01"
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                  Exam Title (বাংলা - Optional)
                </label>
                <input
                  type="text"
                  value={examForm.titleBangla}
                  onChange={(e) => setExamForm({ ...examForm, titleBangla: e.target.value })}
                  placeholder="e.g. বাংলাদেশ ব্যাংক সহকারী পরিচালক মক টেস্ট ০১"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                    Type
                  </label>
                  <select
                    value={examForm.type}
                    onChange={(e) => setExamForm({ ...examForm, type: e.target.value as any })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a' }}
                  >
                    <option value="MODEL_TEST">MODEL_TEST</option>
                    <option value="CHAPTER_QUIZ">CHAPTER_QUIZ</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                    Duration (Minutes) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={examForm.durationMinutes}
                    onChange={(e) => setExamForm({ ...examForm, durationMinutes: Number(e.target.value) })}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                    Total Marks *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={examForm.totalMarks}
                    onChange={(e) => setExamForm({ ...examForm, totalMarks: Number(e.target.value) })}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                    Pass Marks *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={examForm.passMarks}
                    onChange={(e) => setExamForm({ ...examForm, passMarks: Number(e.target.value) })}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                    Negative Rate *
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={examForm.negativeMarkingRate}
                    onChange={(e) => setExamForm({ ...examForm, negativeMarkingRate: Number(e.target.value) })}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                    Maximum Attempts per Student *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={examForm.allowedAttempts}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                      setExamForm({ ...examForm, allowedAttempts: val as any });
                    }}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: examForm.resultReleaseMode === 'SCHEDULED' ? '1fr' : '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                    Starts At *
                  </label>
                  <input
                    type="datetime-local"
                    value={examForm.startsAt}
                    onChange={(e) => setExamForm({ ...examForm, startsAt: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a' }}
                  />
                </div>

                {examForm.resultReleaseMode !== 'SCHEDULED' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                      Ends At *
                    </label>
                    <input
                      type="datetime-local"
                      value={examForm.endsAt}
                      onChange={(e) => setExamForm({ ...examForm, endsAt: e.target.value })}
                      required
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a' }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Result Release Mode *
                </label>
                <select
                  value={examForm.resultReleaseMode}
                  onChange={(e) => setExamForm({ ...examForm, resultReleaseMode: e.target.value as any })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontWeight: 500 }}
                >
                  <option value="INSTANT">INSTANT — Publish results immediately after submission</option>
                  <option value="SCHEDULED">SCHEDULED — Publish results at a specified date and time</option>
                  <option value="MANUAL">MANUAL — Keep results unpublished until instructor releases</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '4px' }}>
                  {examForm.resultReleaseMode === 'INSTANT' && 'Candidates see their scores, pass/fail status, and solution review immediately upon submission.'}
                  {examForm.resultReleaseMode === 'SCHEDULED' && 'Scores and reviews remain hidden until the scheduled publication date and time configured below.'}
                  {examForm.resultReleaseMode === 'MANUAL' && 'Scores and reviews remain hidden until you click "Publish Results" in the workspace.'}
                </span>
              </div>

              {/* Show result publication date/time input ONLY when SCHEDULED is selected */}
              {examForm.resultReleaseMode === 'SCHEDULED' && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#1d4ed8', marginBottom: '4px' }}>
                    <Clock size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                    Result Publication Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={examForm.endsAt}
                    onChange={(e) => setExamForm({ ...examForm, endsAt: e.target.value })}
                    required={examForm.resultReleaseMode === 'SCHEDULED'}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#ffffff', border: '1px solid #93c5fd', color: '#0f172a' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#1e40af', display: 'block', marginTop: '4px' }}>
                    Candidate results, answer keys, explanations, and rankings will automatically release to students at this exact scheduled time.
                  </span>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                  Status
                </label>
                <select
                  value={examForm.status}
                  onChange={(e) => setExamForm({ ...examForm, status: e.target.value as any })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a' }}
                >
                  <option value="DRAFT">DRAFT (Hidden from Students)</option>
                  <option value="LIVE">LIVE (Open for Enrollment)</option>
                  <option value="SCHEDULED">SCHEDULED (Opens at Start Time)</option>
                  <option value="CLOSED">CLOSED (Past Exam)</option>
                </select>
              </div>

              {/* Course Association Selector (Option B) */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Link to Course(s) (Optional)
                </label>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '8px' }}>
                  Associate this exam with specific courses you teach. Leave unchecked to keep as an independent Global Mock Exam.
                </span>
                {availableCourses.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
                    No eligible courses found under your account. This exam will remain a standalone Global Mock Exam.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '130px', overflowY: 'auto' }}>
                    {availableCourses.map((c: any) => {
                      const isChecked = examForm.courseIds.includes(c.id);
                      return (
                        <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#1e293b', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setExamForm({ ...examForm, courseIds: [...examForm.courseIds, c.id] });
                              } else {
                                setExamForm({ ...examForm, courseIds: examForm.courseIds.filter((id) => id !== c.id) });
                              }
                            }}
                          />
                          <span>{c.title}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <Button variant="secondary" onClick={() => setIsExamModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : editingExamId ? 'Save Changes' : 'Create Exam'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: 3-Tab Question Hub (Bank, Manual, CSV) */}
      {isQuestionModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <Card style={{ width: '960px', maxWidth: '96%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', padding: '24px', position: 'relative' }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    Manage Exam Questions
                  </h3>
                  <Badge text="DRAFT EXAM" type="info" />
                </div>
                <span style={{ fontSize: '0.82rem', color: '#64748b', display: 'block', marginTop: '2px' }}>
                  Assign questions to <strong>{selectedExam?.title}</strong> from the bank, manual authoring, or bulk CSV import.
                </span>
              </div>
              <button
                onClick={handleCloseQuestionModal}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
                title="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* 3-Tab Navigation Bar */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '14px' }}>
              <button
                type="button"
                onClick={() => setQuestionHubTab('BANK')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: questionHubTab === 'BANK' ? '#2563eb' : '#f1f5f9',
                  color: questionHubTab === 'BANK' ? '#ffffff' : '#475569',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Search size={15} /> Select from Question Bank
              </button>

              <button
                type="button"
                onClick={() => setQuestionHubTab('MANUAL')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: questionHubTab === 'MANUAL' ? '#2563eb' : '#f1f5f9',
                  color: questionHubTab === 'MANUAL' ? '#ffffff' : '#475569',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Plus size={15} /> Create Question Manually
              </button>

              <button
                type="button"
                onClick={() => setQuestionHubTab('CSV')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: questionHubTab === 'CSV' ? '#2563eb' : '#f1f5f9',
                  color: questionHubTab === 'CSV' ? '#ffffff' : '#475569',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Upload size={15} /> Import Questions from CSV
              </button>
            </div>

            {/* Selection HUD & Staged Questions Bar */}
            <div
              style={{
                padding: '10px 14px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px',
                flexWrap: 'wrap',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.9rem', color: '#1e40af', fontWeight: 700 }}>
                  Staged for this Exam: {selectedQuestionIds.length} Question{selectedQuestionIds.length === 1 ? '' : 's'}
                </span>
                {(() => {
                  const unapprovedCount = availableQuestions.filter(
                    (q) => selectedQuestionIds.includes(q.id) && !q.isApproved
                  ).length;
                  if (unapprovedCount > 0) {
                    return (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          background: '#fef3c7',
                          color: '#92400e',
                          border: '1px solid #fcd34d',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <AlertTriangle size={12} /> {unapprovedCount} Pending Admin Review
                      </span>
                    );
                  }
                  if (selectedQuestionIds.length > 0) {
                    return (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          background: '#dcfce7',
                          color: '#166534',
                          border: '1px solid #86efac',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <CheckCircle2 size={12} /> All Verified
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>

              {selectedQuestionIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedQuestionIds([])}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc2626',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    textDecoration: 'underline'
                  }}
                >
                  Clear All Staged
                </button>
              )}
            </div>

            {/* TAB 1: BROWSE QUESTION BANK */}
            {questionHubTab === 'BANK' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {/* Filter Controls */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px', position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Search question bank by prompt, topic, formula..."
                      value={qSearch}
                      onChange={(e) => setQSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') fetchAvailableQuestions();
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#0f172a',
                        fontSize: '0.85rem'
                      }}
                    />
                  </div>

                  <select
                    value={qSubject}
                    onChange={(e) => setQSubject(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="">All Subjects</option>
                    <option value="English Language & Literature">English</option>
                    <option value="Mathematics & Analytical Ability">Mathematics</option>
                    <option value="Bangla Language & Literature">Bangla</option>
                    <option value="Bangladesh & Global Affairs">General Knowledge</option>
                    <option value="Banking, Finance & Economy">Banking & Finance</option>
                  </select>

                  <select
                    value={qDifficulty}
                    onChange={(e) => setQDifficulty(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="">All Difficulties</option>
                    <option value="EASY">EASY</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HARD">HARD</option>
                  </select>

                  <Button variant="secondary" size="sm" onClick={fetchAvailableQuestions}>
                    <Search size={14} /> Search
                  </Button>
                </div>

                {/* Questions List */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    paddingRight: '6px',
                    minHeight: '280px',
                    maxHeight: '380px'
                  }}
                >
                  {availableQuestions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      No questions found matching criteria.
                    </div>
                  ) : (
                    availableQuestions.map((q) => {
                      const isChecked = selectedQuestionIds.includes(q.id);
                      return (
                        <div
                          key={q.id}
                          onClick={() => toggleQuestionSelection(q.id)}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '6px',
                            background: isChecked ? '#eff6ff' : '#ffffff',
                            border: isChecked ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            style={{ marginTop: '3px', cursor: 'pointer' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 600 }}>
                              <MathRenderer text={q.prompt} />
                            </div>
                            {q.prompt_bangla && (
                              <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                                <MathRenderer text={q.prompt_bangla} />
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', fontSize: '0.74rem', color: '#64748b', alignItems: 'center' }}>
                              <span>Subject: {q.subject}</span>
                              <span>•</span>
                              <span>Topic: {q.topic}</span>
                              <span>•</span>
                              <span style={{ color: q.difficulty === 'HARD' ? '#b91c1c' : q.difficulty === 'MEDIUM' ? '#b45309' : '#15803d', fontWeight: 700 }}>
                                {q.difficulty}
                              </span>
                              <span>•</span>
                              <span
                                style={{
                                  color: q.isApproved ? '#15803d' : '#b45309',
                                  background: q.isApproved ? '#dcfce7' : '#fef3c7',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 700
                                }}
                              >
                                {q.isApproved ? 'APPROVED' : 'PENDING APPROVAL'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: CREATE QUESTION MANUALLY */}
            {questionHubTab === 'MANUAL' && (
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '6px' }}>
                {manualSuccess && (
                  <div style={{ padding: '10px 14px', borderRadius: '6px', background: '#dcfce7', border: '1px solid #86efac', color: '#166534', fontSize: '0.85rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={16} /> {manualSuccess}
                  </div>
                )}
                {manualError && (
                  <div style={{ padding: '10px 14px', borderRadius: '6px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: '0.85rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} /> {manualError}
                  </div>
                )}

                <form onSubmit={handleCreateManualQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>Subject *</label>
                      <select
                        value={manualSubject}
                        onChange={(e) => setManualSubject(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      >
                        <option value="English Language & Literature">English Language & Literature</option>
                        <option value="Mathematics & Analytical Ability">Mathematics & Analytical Ability</option>
                        <option value="Bangla Language & Literature">Bangla Language & Literature</option>
                        <option value="Bangladesh & Global Affairs">Bangladesh & Global Affairs</option>
                        <option value="Banking, Finance & Economy">Banking, Finance & Economy</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>Chapter *</label>
                      <input
                        type="text"
                        value={manualChapter}
                        onChange={(e) => setManualChapter(e.target.value)}
                        required
                        placeholder="e.g. Grammar, Algebra"
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>Topic *</label>
                      <input
                        type="text"
                        value={manualTopic}
                        onChange={(e) => setManualTopic(e.target.value)}
                        required
                        placeholder="e.g. Prepositions, Profit & Loss"
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>Difficulty *</label>
                      <select
                        value={manualDifficulty}
                        onChange={(e) => setManualDifficulty(e.target.value as any)}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      >
                        <option value="EASY">EASY</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HARD">HARD</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>Question Type *</label>
                      <select
                        value={manualType}
                        onChange={(e) => setManualType(e.target.value as any)}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      >
                        <option value="SINGLE_MCQ">Single MCQ (1 Correct Answer)</option>
                        <option value="MULTI_SELECT">Multi-Select (1+ Correct Answers)</option>
                      </select>
                    </div>
                  </div>

                  {/* Question Prompts */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                      Prompt (English) * <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Supports LaTeX equations enclosed in $...$</span>
                    </label>
                    <textarea
                      rows={2}
                      value={manualPrompt}
                      onChange={(e) => setManualPrompt(e.target.value)}
                      required
                      placeholder="e.g. Find the value of $x$ when $2x + 6 = 14$."
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                      Prompt (Bangla Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={manualPromptBangla}
                      onChange={(e) => setManualPromptBangla(e.target.value)}
                      placeholder="বাংলা প্রশ্ন লিখুন (যেমন: $2x + 6 = 14$ হলে $x$ এর মান কত?)"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* Options (A, B, C, D) */}
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Answer Options (Select correct answer)</span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Designate the correct choice via the selector</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {manualOptions.map((opt, idx) => (
                        <div key={opt.optionKey} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type={manualType === 'SINGLE_MCQ' ? 'radio' : 'checkbox'}
                            name="manualCorrect"
                            checked={opt.isCorrect}
                            onChange={() => handleManualOptionChange(idx, 'isCorrect', true)}
                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                          />
                          <span style={{ width: '24px', fontWeight: 700, fontSize: '0.85rem', color: opt.isCorrect ? '#166534' : '#475569' }}>
                            {opt.optionKey}.
                          </span>
                          <input
                            type="text"
                            required
                            placeholder={`Option ${opt.optionKey} text`}
                            value={opt.text}
                            onChange={(e) => handleManualOptionChange(idx, 'text', e.target.value)}
                            style={{
                              flex: 1,
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: opt.isCorrect ? '1.5px solid #16a34a' : '1px solid #cbd5e1',
                              background: opt.isCorrect ? '#f0fdf4' : '#ffffff',
                              fontSize: '0.85rem'
                            }}
                          />
                          <input
                            type="text"
                            placeholder="Bangla text (optional)"
                            value={opt.textBangla}
                            onChange={(e) => handleManualOptionChange(idx, 'textBangla', e.target.value)}
                            style={{ flex: '0 1 180px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Explanation */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                      Solution / Explanation (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={manualExplanation}
                      onChange={(e) => setManualExplanation(e.target.value)}
                      placeholder="Step-by-step mathematical reasoning or grammatical rule explanation..."
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* Platform Quality Governance Notice */}
                  <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '6px', padding: '10px 12px', fontSize: '0.76rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlert size={16} />
                    <span>
                      <strong>Platform Governance Notice:</strong> Newly authored faculty questions are saved with status <strong>PENDING ADMIN APPROVAL</strong>. You can test them immediately in this DRAFT exam, but approval is required to publish to LIVE.
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                    <Button variant="primary" type="submit" disabled={manualLoading}>
                      <Plus size={15} /> {manualLoading ? 'Saving Question...' : 'Save & Stage for This Exam'}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 3: IMPORT QUESTIONS FROM CSV */}
            {questionHubTab === 'CSV' && (
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '6px' }}>
                {csvImportSuccess && (
                  <div style={{ padding: '10px 14px', borderRadius: '6px', background: '#dcfce7', border: '1px solid #86efac', color: '#166534', fontSize: '0.85rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={16} /> {csvImportSuccess}
                  </div>
                )}
                {csvImportError && (
                  <div style={{ padding: '10px 14px', borderRadius: '6px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: '0.85rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} /> {csvImportError}
                  </div>
                )}

                {/* File Upload Zone & Template Download */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <div
                    style={{
                      flex: 1,
                      minWidth: '280px',
                      border: '2px dashed #cbd5e1',
                      borderRadius: '8px',
                      padding: '16px',
                      textAlign: 'center',
                      background: '#f8fafc',
                      cursor: 'pointer'
                    }}
                  >
                    <Upload size={24} style={{ color: '#2563eb', margin: '0 auto 6px auto' }} />
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
                      {csvFile ? csvFile.name : 'Choose a .CSV question dataset'}
                    </div>
                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                      {csvFile ? `${(csvFile.size / 1024).toFixed(1)} KB` : 'Click to browse or drop file here'}
                    </span>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCsvFileChange}
                      style={{ display: 'block', margin: '8px auto 0 auto', fontSize: '0.8rem' }}
                    />
                  </div>

                  <div style={{ flex: '0 1 300px', display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
                    <Button variant="secondary" size="sm" onClick={handleDownloadSampleCsv}>
                      <Download size={14} /> Download Sample CSV Template
                    </Button>
                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                      Header columns: subject, chapter, topic, difficulty, type, prompt, promptBangla, optA, optB, optC, optD, correctOpt, explanation
                    </span>
                  </div>
                </div>

                {/* Pre-Validation Summary */}
                {csvRawText && (
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>Pre-Validation Summary:</span>
                      <span style={{ fontSize: '0.8rem', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                        {csvValidCount} Valid Questions Ready
                      </span>
                      {csvRowErrors.length > 0 && (
                        <span style={{ fontSize: '0.8rem', background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          {csvRowErrors.length} Issue(s) Flagged
                        </span>
                      )}
                    </div>

                    {/* Error breakdown if any */}
                    {csvRowErrors.length > 0 && (
                      <div style={{ maxHeight: '120px', overflowY: 'auto', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '6px', padding: '8px 12px', marginBottom: '10px' }}>
                        <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#9f1239', marginBottom: '4px' }}>Flagged Rows (will be skipped):</div>
                        {csvRowErrors.map((err, i) => (
                          <div key={i} style={{ fontSize: '0.74rem', color: '#be123c' }}>
                            • Row {err.row}: {err.error}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Preview of Parsed Valid Rows */}
                    {csvParsedRows.length > 0 && (
                      <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#ffffff' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                              <th style={{ padding: '6px 10px' }}>Row</th>
                              <th style={{ padding: '6px 10px' }}>Subject</th>
                              <th style={{ padding: '6px 10px' }}>Prompt</th>
                              <th style={{ padding: '6px 10px' }}>Correct Key</th>
                            </tr>
                          </thead>
                          <tbody>
                            {csvParsedRows.slice(0, 10).map((r, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '6px 10px', color: '#64748b' }}>{r.rowNumber}</td>
                                <td style={{ padding: '6px 10px', fontWeight: 600 }}>{r.subject}</td>
                                <td style={{ padding: '6px 10px' }}>{r.prompt}</td>
                                <td style={{ padding: '6px 10px', fontWeight: 700, color: '#16a34a' }}>{r.correctOpt}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {csvParsedRows.length > 10 && (
                          <div style={{ padding: '6px 10px', fontSize: '0.74rem', color: '#64748b', background: '#f8fafc', textAlign: 'center' }}>
                            Showing first 10 of {csvParsedRows.length} valid questions...
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Button */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                      <Button
                        variant="primary"
                        onClick={handleImportCsvQuestions}
                        disabled={csvImportLoading || csvValidCount === 0}
                      >
                        <Upload size={14} /> {csvImportLoading ? 'Importing CSV...' : `Import ${csvValidCount} Valid Questions & Stage for Exam`}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                Staged questions will be assigned to this exam upon clicking Save.
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="secondary" onClick={handleCloseQuestionModal}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSaveAssignedQuestions} disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : `Save ${selectedQuestionIds.length} Assigned Questions`}
                </Button>
              </div>
            </div>

            {/* Unsaved Changes Confirmation Dialog Overlay */}
            {showUnsavedConfirm && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(15, 23, 42, 0.75)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '12px',
                  zIndex: 20
                }}
              >
                <div style={{ background: '#ffffff', borderRadius: '10px', padding: '24px', maxWidth: '440px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', color: '#b45309' }}>
                    <AlertTriangle size={24} />
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Unsaved Staged Questions</h4>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.5, marginBottom: '16px' }}>
                    You have staged questions that are not yet saved to this exam. Questions created or imported remain stored in your Question Bank, but will not be assigned to this exam unless you save.
                  </p>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <Button variant="secondary" size="sm" onClick={() => setShowUnsavedConfirm(false)}>
                      Keep Editing
                    </Button>
                    <Button variant="danger" size="sm" onClick={handleConfirmDiscardAssignments}>
                      Discard Assignments
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleSaveAssignedQuestions} disabled={actionLoading}>
                      Save & Close
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* INSTRUCTOR TEST MODE & PREVIEW (Safe Non-Persistent Simulation) */}
      {isPreviewOpen && selectedExam && (
        <InstructorExamTestModal
          examId={selectedExam.id}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}
    </div>
  );
};
