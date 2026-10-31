import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  Timer,
  ShieldAlert,
  AlertTriangle,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Award,
  FileQuestion,
  Eye,
  Maximize2
} from 'lucide-react';
import { MathRenderer } from './MathRenderer';
import { Button, Card, Badge } from '../design-system';

export interface InstructorExamTestModalProps {
  examId: string;
  onClose: () => void;
}

interface StoredOption {
  id: string;
  optionKey: string;
  text: string;
  textBangla?: string | null;
  isCorrect?: boolean;
}

interface TestQuestion {
  questionId: string;
  prompt: string;
  promptBangla?: string | null;
  type: string;
  sectionName?: string;
  marks: number;
  negativeMarks: number;
  options: StoredOption[];
  explanation?: string;
  explanationBangla?: string;
}

interface QuestionGradeDetail {
  questionId: string;
  prompt: string;
  promptBangla?: string | null;
  type: string;
  sectionName?: string;
  marks: number;
  negativeMarks: number;
  selectedOptionIds: string[];
  correctOptionIds: string[];
  options: StoredOption[];
  isCorrect: boolean;
  isWrong: boolean;
  isSkipped: boolean;
  marksAwarded: number;
}

interface SimulatedGradeResult {
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  totalScore: number;
  maximumMarks: number;
  accuracyPercentage: number;
  isPassed: boolean;
  passMarks: number;
  breakdown: QuestionGradeDetail[];
  timeSpentSeconds: number;
}

export const InstructorExamTestModal: React.FC<InstructorExamTestModalProps> = ({
  examId,
  onClose
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // In-memory test answers and review tags (Zero Database Calls)
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});

  // Client-side timer state
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // In-memory proctoring simulation state
  const [violationCount, setViolationCount] = useState(0);
  const [activeViolationAlert, setActiveViolationAlert] = useState<{
    type: string;
    reason: string;
    strike: number;
  } | null>(null);
  const [isTerminated, setIsTerminated] = useState(false);
  const lastViolationTimeRef = useRef<number>(0);

  // In-memory evaluation and result modal state
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [simulatedResult, setSimulatedResult] = useState<SimulatedGradeResult | null>(null);
  const [showQuestionReview, setShowQuestionReview] = useState(false);

  // 1. Fetch Exam Configuration using Authorized Instructor Token (Read-Only)
  useEffect(() => {
    let isMounted = true;
    async function loadExamData() {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`http://localhost:5000/api/exams/${examId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (isMounted) {
          if (res.data?.success && res.data?.exam) {
            const e = res.data.exam;
            setExam(e);
            const qList: TestQuestion[] = (e.questions || []).map((q: any) => ({
              questionId: q.questionId || q.id,
              prompt: q.prompt || '',
              promptBangla: q.promptBangla || null,
              type: q.type || 'SINGLE_MCQ',
              sectionName: q.sectionName || 'General',
              marks: Number(q.marks) || 1.0,
              negativeMarks: Number(q.negativeMarks ?? e.negativeMarkingRate ?? 0.25),
              options: q.options || [],
              explanation: q.explanation,
              explanationBangla: q.explanationBangla
            }));
            setQuestions(qList);

            // Initialize in-memory timer
            const durationSecs = (Number(e.durationMinutes) || 60) * 60;
            setSecondsRemaining(durationSecs);
          } else {
            setError(res.data?.error || 'Failed to load exam details.');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.response?.data?.error || 'Failed to connect to exam service.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadExamData();
    return () => {
      isMounted = false;
    };
  }, [examId]);

  // 2. Pure In-Memory Scoring Calculation (Reproduces Production Grading Engine)
  const computeInMemGrade = useCallback(
    (currentAnswers: Record<string, string[]>, timeSpent: number): SimulatedGradeResult => {
      const passMarks = Number(exam?.passMarks) || 40.0;
      let correctCount = 0;
      let wrongCount = 0;
      let skippedCount = 0;
      let totalScore = 0;
      let maximumMarks = 0;
      const breakdown: QuestionGradeDetail[] = [];

      for (const q of questions) {
        maximumMarks += q.marks;
        const selectedIds = currentAnswers[q.questionId] || [];
        const isSkipped = selectedIds.length === 0;

        // Extract correct option IDs securely available in the instructor payload
        const correctOptionIds = (q.options || [])
          .filter((opt) => Boolean(opt.isCorrect))
          .map((opt) => opt.id);

        let isCorrect = false;
        let isWrong = false;
        let marksAwarded = 0;

        if (isSkipped) {
          skippedCount++;
        } else {
          if (q.type === 'MULTI_SELECT') {
            const selectedSet = new Set(selectedIds);
            const correctSet = new Set(correctOptionIds);
            if (
              selectedSet.size === correctSet.size &&
              [...selectedSet].every((id) => correctSet.has(id))
            ) {
              isCorrect = true;
            } else {
              isWrong = true;
            }
          } else {
            // Default SINGLE_MCQ / TRUE_FALSE
            const chosen = selectedIds[0];
            const expected = correctOptionIds[0];
            if (chosen && chosen === expected) {
              isCorrect = true;
            } else {
              isWrong = true;
            }
          }

          if (isCorrect) {
            correctCount++;
            marksAwarded = q.marks;
            totalScore += q.marks;
          } else {
            wrongCount++;
            marksAwarded = -q.negativeMarks;
            totalScore -= q.negativeMarks;
          }
        }

        breakdown.push({
          questionId: q.questionId,
          prompt: q.prompt,
          promptBangla: q.promptBangla,
          type: q.type,
          sectionName: q.sectionName,
          marks: q.marks,
          negativeMarks: q.negativeMarks,
          selectedOptionIds: selectedIds,
          correctOptionIds,
          options: q.options,
          isCorrect,
          isWrong,
          isSkipped,
          marksAwarded
        });
      }

      // Safe normalization preventing floating point artifacts
      const normalizedScore = Math.round(totalScore * 100) / 100;
      const answeredCount = correctCount + wrongCount;
      const accuracyPercentage =
        answeredCount > 0 ? Math.round((correctCount / answeredCount) * 10000) / 100 : 0;
      const isPassed = normalizedScore >= passMarks;

      return {
        totalQuestions: questions.length,
        answeredCount,
        correctCount,
        wrongCount,
        skippedCount,
        totalScore: normalizedScore,
        maximumMarks: Math.round(maximumMarks * 100) / 100,
        accuracyPercentage,
        isPassed,
        passMarks,
        breakdown,
        timeSpentSeconds: timeSpent
      };
    },
    [exam, questions]
  );

  // 3. In-Memory Submission (Zero Database Requests)
  const handleSimulatedSubmit = useCallback(() => {
    if (isSubmitted) return;
    const result = computeInMemGrade(answers, elapsedSeconds);
    setSimulatedResult(result);
    setIsSubmitted(true);
    setActiveViolationAlert(null);
  }, [isSubmitted, computeInMemGrade, answers, elapsedSeconds]);

  // 4. Client-Side Countdown Timer (Simulation Mode)
  useEffect(() => {
    if (loading || isSubmitted || isTerminated || secondsRemaining <= 0) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSimulatedSubmit();
          return 0;
        }
        return prev - 1;
      });
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, isSubmitted, isTerminated, secondsRemaining, handleSimulatedSubmit]);

  // 5. In-Memory Proctoring Simulation with Anti-Duplicate Debouncing
  const handleSimulatedViolation = useCallback(
    (type: string, reason: string) => {
      if (isSubmitted || isTerminated) return;

      const now = Date.now();
      // Anti-duplicate protection: Ignore companion events within 2.5 seconds
      if (now - lastViolationTimeRef.current < 2500) {
        return;
      }
      lastViolationTimeRef.current = now;

      const maxStrikes = Number(exam?.maxViolationsAllowed) || 3;
      setViolationCount((prev) => {
        const nextStrike = prev + 1;
        if (nextStrike >= maxStrikes) {
          setIsTerminated(true);
          setActiveViolationAlert({
            type,
            reason: `Maximum integrity strikes reached (${nextStrike}/${maxStrikes}). Test session auto-terminated.`,
            strike: nextStrike
          });
          // Auto-submit simulation on 3 strikes
          handleSimulatedSubmit();
        } else {
          setActiveViolationAlert({
            type,
            reason,
            strike: nextStrike
          });
        }
        return nextStrike;
      });
    },
    [isSubmitted, isTerminated, exam, handleSimulatedSubmit]
  );

  // 6. Scoped Event Listeners with Guaranteed Teardown
  useEffect(() => {
    if (loading || isSubmitted || isTerminated) return;

    const handleVisibility = () => {
      if (document.hidden) {
        handleSimulatedViolation(
          'TAB_SWITCH',
          'Switched away to another browser tab or minimized window.'
        );
      }
    };

    const handleFullscreen = () => {
      if (!document.fullscreenElement) {
        handleSimulatedViolation('FULLSCREEN_EXIT', 'Exited exam fullscreen mode.');
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      handleSimulatedViolation('CONTEXT_MENU', 'Attempted right-click during live exam.');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && ['c', 'v', 'p', 's', 'a', 'u'].includes(e.key.toLowerCase())) ||
        e.key === 'PrintScreen'
      ) {
        e.preventDefault();
        handleSimulatedViolation('SHORTCUT_ATTEMPT', `Unauthorized shortcut blocked (${e.key}).`);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('fullscreenchange', handleFullscreen);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('fullscreenchange', handleFullscreen);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [loading, isSubmitted, isTerminated, handleSimulatedViolation]);

  // Answer Toggling (Single / Multi-Select)
  const toggleOption = (qId: string, optId: string, type: string) => {
    if (isSubmitted || isTerminated) return;
    setAnswers((prev) => {
      const existing = prev[qId] || [];
      if (type === 'MULTI_SELECT') {
        return existing.includes(optId)
          ? { ...prev, [qId]: existing.filter((id) => id !== optId) }
          : { ...prev, [qId]: [...existing, optId] };
      }
      return { ...prev, [qId]: [optId] };
    });
  };

  const clearOption = (qId: string) => {
    if (isSubmitted || isTerminated) return;
    setAnswers((prev) => ({ ...prev, [qId]: [] }));
  };

  const toggleMarkReview = (qId: string) => {
    setMarkedForReview((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  // Format Timer
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
  };

  // Request Fullscreen Simulation helper
  const enterFullscreen = () => {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  if (loading) {
    return (
      <div className="integrity-overlay" style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
        <div style={{ background: '#ffffff', padding: '2rem 3rem', borderRadius: '1rem', textAlign: 'center' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>
            Initializing Instructor Test Mode...
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.88rem' }}>Loading verified questions & configuration (Simulation only)...</p>
        </div>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="integrity-overlay" style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
        <div style={{ background: '#ffffff', padding: '2rem', borderRadius: '1rem', maxWidth: '480px', textAlign: 'center' }}>
          <AlertTriangle style={{ width: '40px', height: '40px', color: '#ef4444', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Unable to Start Test Mode</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{error || 'Exam could not be loaded.'}</p>
          <Button variant="secondary" onClick={onClose}>Close & Exit</Button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const qId = currentQ?.questionId;
  const currentAnswer = (qId && answers[qId]) || [];
  const isCurrentMarked = Boolean(qId && markedForReview[qId]);
  const maxStrikes = Number(exam.maxViolationsAllowed) || 3;

  return (
    <div className="integrity-overlay" style={{ zIndex: 9999, overflow: 'hidden', background: '#f8fafc', color: '#0f172a' }}>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh' }}>
        {/* Top Simulation Warning Banner */}
        <div
          style={{
            background: '#fef3c7',
            borderBottom: '1px solid #fcd34d',
            padding: '0.35rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.78rem',
            color: '#92400e',
            fontWeight: 700
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ background: '#b45309', color: '#ffffff', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>
              SIMULATION ONLY
            </span>
            <span>INSTRUCTOR TEST MODE: No attempts, answers, violations, or scores will be saved to the database.</span>
          </div>
          <span>Midterm Evaluation Sandbox</span>
        </div>

        {/* Header Bar */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem 1.75rem',
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 800
                }}
              >
                NON-PERSISTENT TEST
              </span>
              <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                {exam.title}
              </h1>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
              Total Marks: {exam.totalMarks} | Pass Marks: {exam.passMarks} | Negative Marking: -{exam.negativeMarkingRate} per wrong answer
            </div>
          </div>

          {/* Right Header Controls: Timer, Integrity Status, Submit, Exit */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Interactive Timer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: secondsRemaining < 300 ? '#fef2f2' : '#f1f5f9',
                padding: '0.45rem 1rem',
                borderRadius: '0.5rem',
                border: `1px solid ${secondsRemaining < 300 ? '#fca5a5' : '#cbd5e1'}`
              }}
            >
              <Timer style={{ width: '1.1rem', height: '1.1rem', color: secondsRemaining < 300 ? '#ef4444' : '#2563eb' }} />
              <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'monospace', color: secondsRemaining < 300 ? '#b91c1c' : '#0f172a' }}>
                {formatTime(secondsRemaining)}
              </span>
            </div>

            {/* Simulated Integrity Counter */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: violationCount > 0 ? '#fef2f2' : '#f0fdf4',
                color: violationCount > 0 ? '#b91c1c' : '#15803d',
                border: `1px solid ${violationCount > 0 ? '#fca5a5' : '#bbf7d0'}`,
                padding: '0.45rem 0.85rem',
                borderRadius: '0.5rem',
                fontSize: '0.82rem',
                fontWeight: 700
              }}
            >
              <ShieldAlert style={{ width: '1rem', height: '1rem' }} />
              <span>Strikes: {violationCount} / {maxStrikes}</span>
            </div>

            {/* Request Fullscreen Helper button */}
            <button
              type="button"
              onClick={enterFullscreen}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                padding: '0.45rem 0.75rem',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#475569'
              }}
              title="Test Fullscreen Mode"
            >
              <Maximize2 size={14} /> Fullscreen
            </button>

            {/* Submit Test Exam Button */}
            {!isSubmitted && (
              <button
                type="button"
                onClick={handleSimulatedSubmit}
                style={{
                  background: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.45rem 1.15rem',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.85rem'
                }}
              >
                Submit Test Exam
              </button>
            )}

            {/* Exit Preview */}
            <Button variant="secondary" size="sm" onClick={onClose}>
              <X size={15} /> Exit Test
            </Button>
          </div>
        </header>

        {/* Main Content Layout */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Question Presentation Area */}
          <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
            <div style={{ maxWidth: '820px', margin: '0 auto', background: '#ffffff', padding: '2rem', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              {/* Question Metadata Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <span
                  style={{
                    fontSize: '0.82rem',
                    color: '#1d4ed8',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    padding: '0.2rem 0.7rem',
                    borderRadius: '1rem',
                    fontWeight: 700
                  }}
                >
                  Section: {currentQ?.sectionName || 'General'} | Marks: +{currentQ?.marks} / -{currentQ?.negativeMarks}
                </span>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {currentAnswer.length > 0 && !isSubmitted && (
                    <button
                      type="button"
                      onClick={() => clearOption(currentQ.questionId)}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#64748b',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '0.4rem',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      Clear Answer
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => toggleMarkReview(currentQ.questionId)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      background: isCurrentMarked ? '#fef3c7' : '#ffffff',
                      color: isCurrentMarked ? '#b45309' : '#475569',
                      border: `1px solid ${isCurrentMarked ? '#fcd34d' : '#cbd5e1'}`,
                      padding: '0.35rem 0.75rem',
                      borderRadius: '0.4rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.8rem'
                    }}
                  >
                    <Bookmark style={{ width: '0.85rem', height: '0.85rem' }} />
                    {isCurrentMarked ? 'Marked for Review' : 'Mark for Review'}
                  </button>
                </div>
              </div>

              {/* Question Prompt with KaTeX Math Rendering */}
              <div style={{ marginBottom: '1.75rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, lineHeight: 1.6, marginBottom: '0.6rem', color: '#0f172a' }}>
                  {currentIndex + 1}. <MathRenderer text={currentQ?.prompt || ''} />
                </h2>
                {currentQ?.promptBangla && (
                  <p style={{ color: '#475569', fontSize: '1.05rem', lineHeight: 1.6, margin: 0 }}>
                    <MathRenderer text={currentQ.promptBangla} />
                  </p>
                )}
              </div>

              {/* Options List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '2rem' }}>
                {(currentQ?.options || []).map((opt) => {
                  const isSelected = currentAnswer.includes(opt.id);
                  const isMulti = currentQ.type === 'MULTI_SELECT';

                  return (
                    <div
                      key={opt.id}
                      onClick={() => toggleOption(currentQ.questionId, opt.id, currentQ.type)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.85rem',
                        padding: '0.9rem 1.15rem',
                        background: isSelected ? '#eff6ff' : '#ffffff',
                        border: `1.5px solid ${isSelected ? '#2563eb' : '#cbd5e1'}`,
                        borderRadius: '0.65rem',
                        cursor: isSubmitted ? 'default' : 'pointer',
                        transition: 'all 0.15s ease'
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
                          flexShrink: 0
                        }}
                      >
                        {isSelected && (
                          <div style={{ width: '6px', height: '6px', borderRadius: isMulti ? '1px' : '50%', background: '#ffffff' }} />
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                        <span style={{ fontWeight: 700, color: isSelected ? '#1d4ed8' : '#64748b' }}>
                          {opt.optionKey}.
                        </span>
                        <span style={{ fontSize: '0.95rem', color: '#1e293b' }}>
                          <MathRenderer text={opt.text} />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Navigation Toolbar (Previous / Next) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft size={16} /> Previous
                </Button>

                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>
                  Question {currentIndex + 1} of {questions.length}
                </span>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  disabled={currentIndex === questions.length - 1}
                >
                  Next <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </main>

          {/* Right Column: Question Palette */}
          <aside
            style={{
              width: '320px',
              background: '#ffffff',
              borderLeft: '1px solid #e2e8f0',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto'
            }}
          >
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', color: '#0f172a' }}>
              Question Palette
            </h3>

            {/* Legend */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.72rem', marginBottom: '1.25rem', color: '#475569', fontWeight: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '10px', height: '10px', background: '#059669', borderRadius: '2px' }} /> Answered
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '10px', height: '10px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '2px' }} /> Unanswered
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '10px', height: '10px', background: '#ca8a04', borderRadius: '2px' }} /> Review
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '10px', height: '10px', border: '2px solid #2563eb', background: '#eff6ff', borderRadius: '2px' }} /> Current
              </div>
            </div>

            {/* Palette Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
              {questions.map((q, idx) => {
                const ans = answers[q.questionId];
                const isAnswered = ans && ans.length > 0;
                const isMarked = Boolean(markedForReview[q.questionId]);
                const isCurrent = idx === currentIndex;

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
                    key={q.questionId}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    style={{
                      height: '2.4rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: bgColor,
                      color: textColor,
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      borderRadius: '0.45rem',
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

        {/* Simulated Violation Warning Alert Overlay */}
        {activeViolationAlert && (
          <div
            className="integrity-overlay"
            style={{
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(15, 23, 42, 0.85)'
            }}
          >
            <div
              style={{
                background: '#ffffff',
                padding: '2rem 2.5rem',
                borderRadius: '1rem',
                maxWidth: '520px',
                textAlign: 'center',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: activeViolationAlert.strike >= maxStrikes ? '#fef2f2' : '#fef3c7',
                  color: activeViolationAlert.strike >= maxStrikes ? '#b91c1c' : '#b45309',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px'
                }}
              >
                <ShieldAlert size={32} />
              </div>

              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                {activeViolationAlert.strike >= maxStrikes
                  ? 'Simulation Terminated'
                  : `Integrity Strike ${activeViolationAlert.strike} of ${maxStrikes}`}
              </h3>

              <p style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                Violation Detected: {activeViolationAlert.type}
              </p>

              <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                {activeViolationAlert.reason}
              </p>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.75rem',
                  color: '#64748b',
                  marginBottom: '1.5rem'
                }}
              >
                <strong>Instructor Simulation Note:</strong> In a real student exam, this event is recorded into the SQLite <code>exam_violations</code> audit table and broadcast to the Admin Monitor. In this test mode, no records are written.
              </div>

              {activeViolationAlert.strike >= maxStrikes ? (
                <Button variant="danger" onClick={() => setActiveViolationAlert(null)}>
                  View Simulation Scorecard
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => {
                    setActiveViolationAlert(null);
                    enterFullscreen();
                  }}
                >
                  Acknowledge & Resume Test
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Temporary Result Scorecard Modal (When Submitted) */}
        {isSubmitted && simulatedResult && (
          <div
            className="integrity-overlay"
            style={{
              zIndex: 10001,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(15, 23, 42, 0.9)',
              padding: '1.5rem',
              overflowY: 'auto'
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '1rem',
                maxWidth: '750px',
                width: '100%',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
              }}
            >
              {/* Scorecard Header */}
              <div
                style={{
                  padding: '1.25rem 2rem',
                  borderBottom: '1px solid #e2e8f0',
                  background: simulatedResult.isPassed ? '#f0fdf4' : '#fef2f2',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <span
                    style={{
                      background: '#fef3c7',
                      color: '#92400e',
                      border: '1px solid #fde047',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 800
                    }}
                  >
                    TEMPORARY SCORECARD — ZERO DATABASE PERSISTENCE
                  </span>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: '4px 0 0' }}>
                    Instructor Test Results: {exam.title}
                  </h2>
                </div>

                <Badge
                  text={simulatedResult.isPassed ? 'PASSED (SIMULATED)' : 'FAILED (SIMULATED)'}
                  type={simulatedResult.isPassed ? 'success' : 'danger'}
                />
              </div>

              {/* Scorecard Stats Grid */}
              <div style={{ padding: '1.75rem 2rem', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Score Obtained</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: simulatedResult.isPassed ? '#16a34a' : '#dc2626', marginTop: '2px' }}>
                      {simulatedResult.totalScore}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>out of {simulatedResult.maximumMarks}</div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Accuracy</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>
                      {simulatedResult.accuracyPercentage}%
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{simulatedResult.answeredCount} attempted</div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Correct / Wrong</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                      <span style={{ color: '#16a34a' }}>{simulatedResult.correctCount}</span> / <span style={{ color: '#dc2626' }}>{simulatedResult.wrongCount}</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{simulatedResult.skippedCount} skipped</div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Integrity Strikes</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: violationCount > 0 ? '#b45309' : '#16a34a', marginTop: '2px' }}>
                      {violationCount}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Max allowed: {maxStrikes}</div>
                  </div>
                </div>

                <div
                  style={{
                    background: '#f1f5f9',
                    borderRadius: '0.5rem',
                    padding: '0.85rem 1rem',
                    fontSize: '0.8rem',
                    color: '#475569',
                    marginBottom: '1.5rem',
                    lineHeight: 1.5
                  }}
                >
                  <strong>Scoring Policy Verified:</strong> Applied standard Bangladesh Bank recruitment penalty: <code>-{exam.negativeMarkingRate}</code> marks per incorrect answer. Pass threshold is <code>{exam.passMarks}</code> marks.
                </div>

                {/* Question-by-Question Review Toggle */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowQuestionReview(!showQuestionReview)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Eye size={16} />
                    {showQuestionReview ? 'Hide Question Review' : 'View Question Breakdown & Explanations'}
                  </button>

                  {showQuestionReview && (
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {simulatedResult.breakdown.map((item, idx) => (
                        <div
                          key={item.questionId}
                          style={{
                            background: '#f8fafc',
                            border: `1px solid ${item.isCorrect ? '#bbf7d0' : item.isWrong ? '#fca5a5' : '#cbd5e1'}`,
                            borderRadius: '0.5rem',
                            padding: '1rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                              Q{idx + 1}. <MathRenderer text={item.prompt} />
                            </span>
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                color: item.isCorrect ? '#16a34a' : item.isWrong ? '#dc2626' : '#64748b'
                              }}
                            >
                              {item.isCorrect ? `+${item.marksAwarded}` : item.isWrong ? `${item.marksAwarded}` : '0.0 (Skipped)'}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.82rem', color: '#334155', marginTop: '0.5rem' }}>
                            {item.options.map((opt) => {
                              const isSelected = item.selectedOptionIds.includes(opt.id);
                              const isCorrect = item.correctOptionIds.includes(opt.id);

                              return (
                                <div
                                  key={opt.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    marginTop: '2px',
                                    color: isCorrect ? '#15803d' : isSelected ? '#b91c1c' : '#64748b',
                                    fontWeight: isCorrect || isSelected ? 700 : 400
                                  }}
                                >
                                  <span>{opt.optionKey}. {opt.text}</span>
                                  {isCorrect && <CheckCircle2 size={14} color="#16a34a" />}
                                  {isSelected && !isCorrect && <XCircle size={14} color="#dc2626" />}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Scorecard Footer */}
              <div
                style={{
                  padding: '1rem 2rem',
                  borderTop: '1px solid #e2e8f0',
                  background: '#ffffff',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}
              >
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setIsSubmitted(false);
                    setSimulatedResult(null);
                    setAnswers({});
                    setMarkedForReview({});
                    setViolationCount(0);
                    setSecondsRemaining((Number(exam.durationMinutes) || 60) * 60);
                    setElapsedSeconds(0);
                    setCurrentIndex(0);
                  }}
                >
                  <RotateCcw size={15} /> Retake Test Simulation
                </Button>

                <Button variant="primary" size="sm" onClick={onClose}>
                  Close & Exit Test Mode
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

