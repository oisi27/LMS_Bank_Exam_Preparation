import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, Button, Badge } from '../design-system';
import { useAuth } from '../context/AuthContext';
import { MathRenderer } from './MathRenderer';
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
  AlertTriangle
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
    endsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 16)
  });

  // Question Selector Modal state
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [qSearch, setQSearch] = useState('');
  const [qSubject, setQSubject] = useState('');
  const [qDifficulty, setQDifficulty] = useState('');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [currentExamQuestions, setCurrentExamQuestions] = useState<any[]>([]);

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
          difficulty: qDifficulty || undefined
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
      endsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 16)
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
      endsAt: exam.endsAt ? new Date(exam.endsAt).toISOString().slice(0, 16) : ''
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
        endsAt: new Date(examForm.endsAt).toISOString()
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
                        onClick={() => {
                          setSelectedQuestionIds(currentExamQuestions.map((q: any) => q.questionId));
                          setIsQuestionModalOpen(true);
                        }}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
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

      {/* Modal: Question Bank Selector */}
      {isQuestionModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <Card style={{ width: '850px', maxWidth: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                  Manage Exam Questions
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Select questions from the question bank to assign to <strong>{selectedExam?.title}</strong>.
                </span>
              </div>
              <button onClick={() => setIsQuestionModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px', position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search questions by prompt or topic..."
                  value={qSearch}
                  onChange={(e) => setQSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') fetchAvailableQuestions(); }}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '0.85rem' }}
                />
              </div>

              <select
                value={qSubject}
                onChange={(e) => setQSubject(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '0.85rem' }}
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
                style={{ padding: '8px 12px', borderRadius: '6px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '0.85rem' }}
              >
                <option value="">All Difficulties</option>
                <option value="EASY">EASY</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HARD">HARD</option>
              </select>

              <Button variant="secondary" size="sm" onClick={fetchAvailableQuestions}>
                <Search size={14} /> Filter
              </Button>
            </div>

            {/* Selection HUD */}
            <div style={{ padding: '10px 14px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.88rem', color: '#93c5fd', fontWeight: 600 }}>
                Selected Questions: {selectedQuestionIds.length}
              </span>
              {selectedQuestionIds.length > 0 && (
                <button
                  onClick={() => setSelectedQuestionIds([])}
                  style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  Clear Selection
                </button>
              )}
            </div>

            {/* Questions List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px', minHeight: '320px', maxHeight: '420px' }}>
              {availableQuestions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                  No matching questions found in question bank.
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
                        border: isChecked ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ marginTop: '3px', cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 500 }}>
                          {q.prompt}
                        </div>
                        {q.prompt_bangla && (
                          <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                            {q.prompt_bangla}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '6px', fontSize: '0.75rem', color: '#64748b' }}>
                          <span>Subject: {q.subject}</span>
                          <span>•</span>
                          <span>Topic: {q.topic}</span>
                          <span>•</span>
                          <span style={{ color: q.difficulty === 'HARD' ? '#b91c1c' : q.difficulty === 'MEDIUM' ? '#b45309' : '#15803d', fontWeight: 700 }}>
                            {q.difficulty}
                          </span>
                          <span>•</span>
                          <span style={{ color: q.isApproved ? '#15803d' : '#b91c1c', fontWeight: 700 }}>
                            {q.isApproved ? 'APPROVED' : 'UNAPPROVED'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
              <Button variant="secondary" onClick={() => setIsQuestionModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveAssignedQuestions} disabled={actionLoading}>
                {actionLoading ? 'Saving...' : `Save ${selectedQuestionIds.length} Assigned Questions`}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* STUDENT-VIEW EXAM PREVIEW MODAL (Safe Read-Only Simulation) */}
      {isPreviewOpen && selectedExam && currentExamQuestions.length > 0 && (
        <div className="integrity-overlay" style={{ zIndex: 9999, overflow: 'hidden' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: '100vw',
              height: '100vh',
              background: '#f8fafc',
              color: '#0f172a'
            }}
          >
            {/* Top Preview Bar */}
            <header
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 2rem',
                borderBottom: '1px solid #e2e8f0',
                background: '#ffffff'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      background: '#fef08a',
                      color: '#854d0e',
                      border: '1px solid #fde047',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 800
                    }}
                  >
                    PREVIEW MODE (NO ATTEMPT CREATED)
                  </span>
                  <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1d4ed8', margin: 0 }}>
                    {selectedExam.title}
                  </h1>
                </div>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Duration: {selectedExam.durationMinutes}m | Total Marks: {selectedExam.totalMarks} | Pass Marks: {selectedExam.passMarks} | Negative Marking: -{selectedExam.negativeMarkingRate}
                </span>
              </div>

              {/* Simulated Timer and Close Preview Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: '#f1f5f9',
                    padding: '0.5rem 1.25rem',
                    borderRadius: '0.75rem',
                    border: '1px solid #cbd5e1'
                  }}
                >
                  <Timer style={{ width: '1.25rem', height: '1.25rem', color: '#2563eb' }} />
                  <span style={{ fontSize: '1.15rem', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                    {selectedExam.durationMinutes}:00 (Simulated)
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    color: '#15803d',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}
                >
                  <ShieldAlert style={{ width: '1rem', height: '1rem' }} />
                  <span>Proctoring: {selectedExam.integrityEnabled ? `Active (Max ${selectedExam.maxViolationsAllowed} Strikes)` : 'Disabled'}</span>
                </div>

                <Button variant="secondary" size="sm" onClick={() => setIsPreviewOpen(false)}>
                  <X size={16} /> Exit Preview
                </Button>
              </div>
            </header>

            {/* Main Delivery Simulation Area */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Left Column: Question Content */}
              <main style={{ flex: 1, padding: '2.5rem', overflowY: 'auto' }}>
                {(() => {
                  const currentQ = currentExamQuestions[previewIndex];
                  const qId = currentQ?.questionId || currentQ?.id;
                  const currentStoredAnswer = previewAnswers[qId] || [];
                  const isMarked = Boolean(previewMarked[qId]);

                  const togglePreviewOption = (optId: string) => {
                    setPreviewAnswers((prev) => {
                      const existing = prev[qId] || [];
                      if (currentQ.type === 'MULTI_SELECT') {
                        return existing.includes(optId)
                          ? { ...prev, [qId]: existing.filter((id) => id !== optId) }
                          : { ...prev, [qId]: [...existing, optId] };
                      }
                      return { ...prev, [qId]: [optId] };
                    });
                  };

                  const toggleMark = () => {
                    setPreviewMarked((prev) => ({ ...prev, [qId]: !prev[qId] }));
                  };

                  return (
                    <div style={{ maxWidth: '800px', margin: '0 auto', background: '#ffffff', padding: '2rem', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.85rem',
                            color: '#1d4ed8',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '1rem',
                            fontWeight: 600
                          }}
                        >
                          Section: {currentQ?.sectionName || 'General'} | Marks: +{currentQ?.marks ?? 1} / -{currentQ?.negativeMarks ?? selectedExam.negativeMarkingRate}
                        </span>

                        <button
                          type="button"
                          onClick={toggleMark}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            background: isMarked ? '#fef3c7' : '#ffffff',
                            color: isMarked ? '#b45309' : '#475569',
                            border: `1px solid ${isMarked ? '#fcd34d' : '#cbd5e1'}`,
                            padding: '0.4rem 0.8rem',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          <Bookmark style={{ width: '0.9rem', height: '0.9rem' }} />
                          {isMarked ? 'Marked for Review' : 'Mark for Review'}
                        </button>
                      </div>

                      {/* Prompt with Bilingual and KaTeX support */}
                      <div style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.6, marginBottom: '0.75rem', color: '#0f172a' }}>
                          {previewIndex + 1}. <MathRenderer text={currentQ?.prompt || ''} />
                        </h2>
                        {currentQ?.promptBangla && (
                          <p style={{ color: '#475569', fontSize: '1.05rem', lineHeight: 1.6 }}>
                            <MathRenderer text={currentQ.promptBangla} />
                          </p>
                        )}
                      </div>

                      {/* Options List */}
                      {currentQ?.options && currentQ.options.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem' }}>
                          {currentQ.options.map((opt: any) => {
                            const isSelected = currentStoredAnswer.includes(opt.id);
                            const isMulti = currentQ.type === 'MULTI_SELECT';

                            return (
                              <div
                                key={opt.id}
                                onClick={() => togglePreviewOption(opt.id)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '1rem',
                                  padding: '1rem 1.25rem',
                                  background: isSelected ? '#eff6ff' : '#ffffff',
                                  border: `1.5px solid ${isSelected ? '#2563eb' : '#cbd5e1'}`,
                                  borderRadius: '0.75rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  boxShadow: isSelected ? '0 1px 3px rgba(37,99,235,0.1)' : 'none'
                                }}
                              >
                                <div
                                  style={{
                                    width: '1.25rem',
                                    height: '1.25rem',
                                    borderRadius: isMulti ? '4px' : '50%',
                                    border: `2px solid ${isSelected ? '#2563eb' : '#94a3b8'}`,
                                    background: isSelected ? '#2563eb' : '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#ffffff',
                                    fontSize: '0.75rem',
                                    fontWeight: 700
                                  }}
                                >
                                  {isSelected && (isMulti ? '✓' : '•')}
                                </div>

                                <span
                                  style={{
                                    width: '2rem',
                                    height: '2rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '50%',
                                    background: isSelected ? '#2563eb' : '#f1f5f9',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    color: isSelected ? '#ffffff' : '#334155',
                                    border: `1px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`
                                  }}
                                >
                                  {opt.optionKey}
                                </span>

                                <div style={{ flex: 1, fontSize: '1rem', color: isSelected ? '#0f172a' : '#334155' }}>
                                  <MathRenderer text={opt.text} />
                                  {opt.textBangla && (
                                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                                      {opt.textBangla}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '0.75rem', marginBottom: '2.5rem', border: '1px solid #e2e8f0' }}>
                          <span style={{ color: '#475569', fontWeight: 600 }}>Type: {currentQ?.type || 'NON_MCQ'} (Direct Student Input)</span>
                        </div>
                      )}

                      {/* Navigation Controls */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Button
                          variant="secondary"
                          size="md"
                          onClick={() => setPreviewIndex((prev) => Math.max(0, prev - 1))}
                          disabled={previewIndex === 0}
                        >
                          <ChevronLeft size={16} /> Previous Question
                        </Button>

                        <span style={{ color: '#475569', fontSize: '0.9rem', fontWeight: 600 }}>
                          Question {previewIndex + 1} of {currentExamQuestions.length}
                        </span>

                        <Button
                          variant="secondary"
                          size="md"
                          onClick={() => setPreviewIndex((prev) => Math.min(currentExamQuestions.length - 1, prev + 1))}
                          disabled={previewIndex === currentExamQuestions.length - 1}
                        >
                          Next Question <ChevronRight size={16} />
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </main>

              {/* Right Column: Question Palette Sidebar */}
              <aside
                style={{
                  width: '320px',
                  background: '#ffffff',
                  borderLeft: '1px solid #e2e8f0',
                  padding: '1.5rem',
                  overflowY: 'auto'
                }}
              >
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: '#0f172a' }}>
                  Question Palette
                </h3>

                {/* Status Legend */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.5rem',
                    fontSize: '0.75rem',
                    marginBottom: '1.5rem',
                    color: '#475569',
                    fontWeight: 500
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{ width: '10px', height: '10px', background: '#059669', borderRadius: '2px' }} /> Answered
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{ width: '10px', height: '10px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '2px' }} /> Unanswered
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{ width: '10px', height: '10px', background: '#ca8a04', borderRadius: '2px' }} /> Review
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{ width: '10px', height: '10px', border: '2px solid #2563eb', background: '#eff6ff', borderRadius: '2px' }} /> Current
                  </div>
                </div>

                {/* Palette Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.6rem' }}>
                  {currentExamQuestions.map((q, idx) => {
                    const qId = q.questionId || q.id;
                    const ans = previewAnswers[qId];
                    const isAnswered = ans && ans.length > 0;
                    const isMarked = Boolean(previewMarked[qId]);
                    const isCurrent = idx === previewIndex;

                    let bgColor = '#ffffff';
                    let textColor = '#334155';
                    let borderColor = '#cbd5e1';

                    if (isAnswered) {
                      bgColor = '#059669';
                      textColor = '#ffffff';
                      borderColor = '#047857';
                    } else if (isMarked) {
                      bgColor = '#ca8a04';
                      textColor = '#ffffff';
                      borderColor = '#a16207';
                    }

                    if (isCurrent) {
                      borderColor = '#2563eb';
                      if (!isAnswered && !isMarked) {
                        bgColor = '#eff6ff';
                        textColor = '#1d4ed8';
                      }
                    }

                    return (
                      <button
                        key={qId}
                        type="button"
                        onClick={() => setPreviewIndex(idx)}
                        style={{
                          height: '2.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: bgColor,
                          color: textColor,
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          borderRadius: '0.5rem',
                          border: isCurrent ? '2px solid #2563eb' : `1px solid ${borderColor}`,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
