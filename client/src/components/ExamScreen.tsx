import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Timer,
  ShieldAlert,
  Send,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Maximize2,
  AlertCircle
} from 'lucide-react';
import axios from 'axios';
import { MathRenderer } from './MathRenderer';

interface ExamDeliveryProps {
  examId: string;
  onFinish: (result: any) => void;
  onExit: () => void;
}

interface StoredAnswer {
  selectedOptionIds?: string[];
  numericAnswer?: number | null;
  textAnswer?: string;
  marked?: boolean;
}

export const ExamScreen: React.FC<ExamDeliveryProps> = ({ examId, onFinish, onExit }) => {
  const [loading, setLoading] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [startingAttempt, setStartingAttempt] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);

  const [attemptId, setAttemptId] = useState('');
  const [examTitle, setExamTitle] = useState('Bank Exam Mock Test');
  const [negativeMarkingRate, setNegativeMarkingRate] = useState<number>(0.25);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, StoredAnswer>>({});
  const [clientSeq, setClientSeq] = useState(1);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [autosaveWarning, setAutosaveWarning] = useState<string | null>(null);

  // Integrity states
  const [violationCount, setViolationCount] = useState(0);
  const [freezeOverlay, setFreezeOverlay] = useState(false);
  const [freezeReason, setFreezeReason] = useState('');
  const [maxViolations, setMaxViolations] = useState(3);
  const [terminalViolationOverlay, setTerminalViolationOverlay] = useState(false);
  const [isTerminated, setIsTerminated] = useState(false);

  const timerRef = useRef<any>(null);
  const expiresAtRef = useRef<string>('');
  const startingAttemptRef = useRef(false);

  // Fetch initial exam metadata for pre-exam rules screen (title, max violations, negative marking)
  useEffect(() => {
    let isMounted = true;
    async function loadMeta() {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`http://localhost:5000/api/exams/${examId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (isMounted && res.data?.exam) {
          if (res.data.exam.title) setExamTitle(res.data.exam.title);
          if (res.data.exam.negativeMarkingRate !== undefined) setNegativeMarkingRate(res.data.exam.negativeMarkingRate);
          if (res.data.exam.maxViolationsAllowed) setMaxViolations(res.data.exam.maxViolationsAllowed);
        }
      } catch {}
    }
    loadMeta();
    return () => { isMounted = false; };
  }, [examId]);

  // Start Exam Attempt after Rules Acknowledgment & Fullscreen Entry
  const handleStartExamConfirmed = async () => {
    if (startingAttemptRef.current || examStarted) return;
    setFullscreenError(null);

    // 1. Synchronously trigger Fullscreen within user gesture
    let enteredFullscreen = false;
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        enteredFullscreen = true;
      } else {
        setFullscreenError('Fullscreen mode is not supported by your browser.');
        return;
      }
    } catch (err: any) {
      setFullscreenError('Fullscreen permission is required to start the proctored exam. Please allow fullscreen.');
      return;
    }

    if (!document.fullscreenElement && !enteredFullscreen) {
      setFullscreenError('Failed to enter fullscreen mode. Please ensure browser permissions allow fullscreen.');
      return;
    }

    // 2. Fullscreen granted: start attempt on backend
    startingAttemptRef.current = true;
    setStartingAttempt(true);
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`http://localhost:5000/api/exams/${examId}/start`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = res.data;
      setAttemptId(data.attemptId);
      if (data.examTitle) setExamTitle(data.examTitle);
      if (data.negativeMarkingRate !== undefined) setNegativeMarkingRate(data.negativeMarkingRate);
      setQuestions(data.questions || []);
      setMaxViolations(data.integrityConfig?.maxViolations || 3);
      expiresAtRef.current = data.expiresAt;

      // Authoritative clock sync: diff = ends_at - serverNow
      const expiresMs = new Date(data.expiresAt).getTime();
      const serverNowMs = new Date(data.serverNow).getTime();
      const remainingSec = Math.max(0, Math.floor((expiresMs - serverNowMs) / 1000));
      setSecondsRemaining(remainingSec);

      // Restore saved answers for reconnect/refresh
      try {
        const attemptRes = await axios.get(`http://localhost:5000/api/exams/attempts/${data.attemptId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (attemptRes.data?.attempt?.answers) {
          const restoredAnswers: Record<string, StoredAnswer> = {};
          let highestSeq = 1;
          attemptRes.data.attempt.answers.forEach((ans: any) => {
            restoredAnswers[ans.questionId] = {
              selectedOptionIds: ans.selectedOptionIds || [],
              numericAnswer: ans.numericAnswer,
              textAnswer: ans.textAnswer || '',
              marked: Boolean(ans.isMarkedForReview)
            };
            if (ans.clientSequence && ans.clientSequence > highestSeq) {
              highestSeq = ans.clientSequence;
            }
          });
          setAnswers(restoredAnswers);
          setClientSeq(highestSeq + 1);
        }
      } catch {}

      setExamStarted(true);
      setLoading(false);
      setStartingAttempt(false);
      startingAttemptRef.current = false;
    } catch (err: any) {
      setLoading(false);
      setStartingAttempt(false);
      startingAttemptRef.current = false;
      const errorMsg = err.response?.data?.error || 'Failed to start exam.';
      alert(errorMsg);
      onExit();
    }
  };

  // Server-Authoritative Countdown Timer
  useEffect(() => {
    if (!examStarted || loading || secondsRemaining <= 0) return;

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [examStarted, loading]);

  // Periodic Authoritative Timer Sync (every 20s to detect admin time extensions)
  useEffect(() => {
    if (!examStarted || loading || !attemptId) return;

    const syncInterval = setInterval(async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`http://localhost:5000/api/exams/attempts/${attemptId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const currentAttempt = res.data?.attempt;
        if (currentAttempt?.expiresAt && currentAttempt.expiresAt !== expiresAtRef.current) {
          expiresAtRef.current = currentAttempt.expiresAt;
          const serverNowMs = currentAttempt.serverNow ? new Date(currentAttempt.serverNow).getTime() : Date.now();
          const expiresMs = new Date(currentAttempt.expiresAt).getTime();
          const remainingSec = Math.max(0, Math.floor((expiresMs - serverNowMs) / 1000));
          setSecondsRemaining(remainingSec);
        }
      } catch {}
    }, 20000);

    return () => clearInterval(syncInterval);
  }, [examStarted, loading, attemptId]);

  // 3. Append-only Integrity Violation Reporter
  const reportViolation = useCallback(async (type: string, reason: string) => {
    if (!attemptId || isTerminated) return;

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('http://localhost:5000/api/exams/violations', {
        attemptId,
        violationType: type,
        details: { reason, timestamp: new Date().toISOString() }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const total = res.data.totalViolations;
      setViolationCount(total);
      setFreezeReason(reason);

      if (res.data.isTerminated || total >= maxViolations) {
        setIsTerminated(true);
        setTerminalViolationOverlay(true);
        setFreezeOverlay(false);
      } else {
        setFreezeOverlay(true);
      }
    } catch {}
  }, [attemptId, maxViolations, isTerminated]);

  // 4. Integrity Event Listeners (Tab change, window blur, fullscreen exit, shortcuts)
  useEffect(() => {
    if (!examStarted || loading || !attemptId) return;

    const handleVisibility = () => {
      if (document.hidden) {
        reportViolation('TAB_SWITCH', 'Switched away to another browser tab or minimized window.');
      }
    };

    const handleFullscreen = () => {
      if (!document.fullscreenElement) {
        reportViolation('FULLSCREEN_EXIT', 'Exited exam fullscreen mode.');
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      reportViolation('CONTEXT_MENU', 'Attempted right-click during live exam.');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Ctrl+C, Ctrl+V, Ctrl+P, Alt+Tab / Win key deterrence
      if (
        (e.ctrlKey && ['c', 'v', 'p', 's', 'a', 'u'].includes(e.key.toLowerCase())) ||
        e.key === 'PrintScreen'
      ) {
        e.preventDefault();
        reportViolation('SHORTCUT_ATTEMPT', `Unauthorized shortcut blocked (${e.key}).`);
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
  }, [loading, reportViolation]);

  // 5. Debounced Idempotent Autosave
  const sendAutosave = useCallback(async (
    qId: string,
    payload: { selectedOptionIds?: string[]; numericAnswer?: number | null; textAnswer?: string },
    marked: boolean
  ) => {
    if (!attemptId) return;

    try {
      const token = localStorage.getItem('token');
      const nextSeq = clientSeq + 1;
      setClientSeq(nextSeq);

      const res = await axios.post('http://localhost:5000/api/exams/autosave', {
        attemptId,
        questionId: qId,
        selectedOptionIds: payload.selectedOptionIds,
        numericAnswer: payload.numericAnswer,
        textAnswer: payload.textAnswer,
        isMarkedForReview: marked,
        clientSequence: nextSeq
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Clear any prior autosave warning upon successful save
      setAutosaveWarning(null);

      // Synchronize timer if backend extended attempt expiry
      if (res.data?.expiresAt && res.data.expiresAt !== expiresAtRef.current) {
        expiresAtRef.current = res.data.expiresAt;
        const newRemainingSec = Math.max(0, Math.floor((new Date(res.data.expiresAt).getTime() - Date.now()) / 1000));
        setSecondsRemaining(newRemainingSec);
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        handleAutoSubmit();
      } else {
        setAutosaveWarning('Warning: Could not save your last answer. Please check your network connection.');
      }
    }
  }, [attemptId, clientSeq]);

  const selectOption = (optId: string) => {
    const currentQ = questions[currentIndex];
    const isMulti = currentQ.type === 'MULTI_SELECT';

    const currentSelected = answers[currentQ.id]?.selectedOptionIds || [];
    let updated: string[];

    if (isMulti) {
      if (currentSelected.includes(optId)) {
        updated = currentSelected.filter((id) => id !== optId);
      } else {
        updated = [...currentSelected, optId];
      }
    } else {
      updated = [optId];
    }

    const currentAns = answers[currentQ.id] || {};
    const isMarked = currentAns.marked || false;

    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: { ...currentAns, selectedOptionIds: updated, marked: isMarked }
    }));

    sendAutosave(currentQ.id, { ...currentAns, selectedOptionIds: updated }, isMarked);
  };

  const updateNumericAnswer = (val: string) => {
    const currentQ = questions[currentIndex];
    const num = val.trim() === '' ? null : Number(val);
    const parsedNum = num !== null && !isNaN(num) ? num : null;
    const currentAns = answers[currentQ.id] || {};
    const isMarked = currentAns.marked || false;

    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: { ...currentAns, numericAnswer: parsedNum, marked: isMarked }
    }));

    sendAutosave(currentQ.id, { ...currentAns, numericAnswer: parsedNum }, isMarked);
  };

  const updateTextAnswer = (val: string) => {
    const currentQ = questions[currentIndex];
    const currentAns = answers[currentQ.id] || {};
    const isMarked = currentAns.marked || false;

    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: { ...currentAns, textAnswer: val, marked: isMarked }
    }));

    sendAutosave(currentQ.id, { ...currentAns, textAnswer: val }, isMarked);
  };

  const toggleMarkReview = () => {
    const currentQ = questions[currentIndex];
    const currentAns = answers[currentQ.id] || {};
    const isMarked = !currentAns.marked;

    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: { ...currentAns, marked: isMarked }
    }));

    sendAutosave(
      currentQ.id,
      {
        selectedOptionIds: currentAns.selectedOptionIds,
        numericAnswer: currentAns.numericAnswer,
        textAnswer: currentAns.textAnswer
      },
      isMarked
    );
  };

  // 6. Safe Submit Handlers
  const handleSubmit = async () => {
    if (submitting) return; // Prevent double submit client-side
    if (!confirm('Are you sure you want to finish and submit your exam?')) return;

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `http://localhost:5000/api/exams/${attemptId}/submit`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-idempotency-key': `submit-${attemptId}`
          }
        }
      );

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      if (res.data.resultsWithheld) {
        onFinish({
          resultsWithheld: true,
          releaseMode: res.data.releaseMode,
          scheduledReleaseTime: res.data.scheduledReleaseTime,
          message: res.data.message,
          attemptId,
          examId
        });
      } else {
        onFinish({ ...res.data.grade, attemptId, examId });
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Submission failed.');
      setSubmitting(false);
    }
  };

  const handleAutoSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`http://localhost:5000/api/exams/${attemptId}/submit`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      if (res.data.resultsWithheld) {
        onFinish({
          resultsWithheld: true,
          releaseMode: res.data.releaseMode,
          scheduledReleaseTime: res.data.scheduledReleaseTime,
          message: res.data.message,
          attemptId,
          examId
        });
      } else {
        onFinish({ ...res.data.grade, attemptId, examId });
      }
    } catch {
      onExit();
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#0f172a' }}>
        <p style={{ fontSize: '1.25rem', color: '#2563eb' }}>Securing exam environment & syncing authoritative clock...</p>
      </div>
    );
  }

  // Pre-Exam Rules & Proctoring Warning Gate (Shown before attempt or timer starts)
  if (!examStarted) {
    return (
      <div style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        color: '#0f172a',
        padding: '2rem'
      }}>
        <div style={{
          background: '#ffffff',
          border: '1px solid #bfdbfe',
          borderRadius: '1rem',
          maxWidth: '680px',
          width: '100%',
          padding: '2.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '0.75rem', borderRadius: '0.75rem' }}>
              <ShieldAlert style={{ width: '2rem', height: '2rem', color: '#2563eb' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff' }}>Exam Proctoring & Rules Confirmation</h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{examTitle}</p>
            </div>
          </div>

          <p style={{ color: '#334155', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
            Before beginning, please review the strict integrity and proctoring guidelines. Your session is monitored by the authoritative server-side integrity engine.
          </p>

          <div style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <Maximize2 style={{ width: '1.25rem', height: '1.25rem', color: '#2563eb', flexShrink: 0, marginTop: '0.1rem' }} />
              <div>
                <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>1. Fullscreen Mode is Required:</strong>
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>The exam must remain in fullscreen mode throughout the test.</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <XCircle style={{ width: '1.25rem', height: '1.25rem', color: '#ef4444', flexShrink: 0, marginTop: '0.1rem' }} />
              <div>
                <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>2. Tab & Window Switching is Strictly Prohibited:</strong>
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Navigating to other browser tabs, applications, or desktop windows will be flagged.</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <AlertTriangle style={{ width: '1.25rem', height: '1.25rem', color: '#f59e0b', flexShrink: 0, marginTop: '0.1rem' }} />
              <div>
                <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>3. Fullscreen Exit is Logged:</strong>
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Exiting fullscreen triggers an immediate integrity strike and screen freeze.</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <ShieldAlert style={{ width: '1.25rem', height: '1.25rem', color: '#a855f7', flexShrink: 0, marginTop: '0.1rem' }} />
              <div>
                <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>4. Restricted Shortcuts & Actions:</strong>
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Copy/paste, right-click context menu, and unauthorized shortcuts are disabled and tracked.</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <CheckCircle2 style={{ width: '1.25rem', height: '1.25rem', color: '#10b981', flexShrink: 0, marginTop: '0.1rem' }} />
              <div>
                <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>5. Violation Limit ({maxViolations} Strikes Max):</strong>
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  Reaching {maxViolations} violations will permanently lock and automatically submit your exam.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <Timer style={{ width: '1.25rem', height: '1.25rem', color: '#2563eb', flexShrink: 0, marginTop: '0.1rem' }} />
              <div>
                <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>6. Server Timer Continues During Warnings:</strong>
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>The server-authoritative countdown continues running during violation freeze overlays.</p>
              </div>
            </div>
          </div>

          {fullscreenError && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
              color: '#b91c1c',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertTriangle style={{ width: '1.25rem', height: '1.25rem', color: '#ef4444', flexShrink: 0 }} />
              <span>{fullscreenError}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button
              onClick={onExit}
              disabled={startingAttempt}
              style={{
                flex: 1,
                padding: '0.85rem',
                borderRadius: '0.5rem',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontWeight: 600,
                cursor: startingAttempt ? 'not-allowed' : 'pointer'
              }}
            >
              Cancel / Back to Dashboard
            </button>
            <button
              onClick={handleStartExamConfirmed}
              disabled={startingAttempt}
              style={{
                flex: 2,
                padding: '0.85rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                fontWeight: 700,
                cursor: startingAttempt ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <Maximize2 style={{ width: '1.1rem', height: '1.1rem' }} />
              {startingAttempt ? 'Entering Fullscreen & Starting...' : 'I Agree — Enter Fullscreen & Start Exam'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const currentStoredAnswer = answers[currentQ?.id] || {};
  const selectedOptions = currentStoredAnswer.selectedOptionIds || [];
  const isMarked = currentStoredAnswer.marked || false;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc', color: '#0f172a', userSelect: 'none' }}>
      {/* Terminal Violation Auto-Submitted Overlay */}
      {terminalViolationOverlay && (
        <div className="integrity-overlay" style={{ textAlign: 'center', padding: '2rem', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', border: '2px solid #ef4444', padding: '2.5rem', borderRadius: '1rem', maxWidth: '540px', width: '100%', boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.4)' }}>
            <XCircle style={{ width: '4.5rem', height: '4.5rem', color: '#ef4444', margin: '0 auto 1.25rem auto' }} />
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.75rem', color: '#b91c1c' }}>Exam Automatically Submitted</h2>
            <p style={{ color: '#334155', marginBottom: '1.25rem', fontSize: '0.95rem', lineHeight: '1.5' }}>
              You have exceeded the maximum allowed integrity violations ({maxViolations}). In accordance with proctoring regulations, your exam has been locked and automatically submitted to the grading engine.
            </p>
            <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.75rem', border: '1px solid #cbd5e1' }}>
              <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '1.1rem' }}>
                Recorded Violations: {violationCount} / {maxViolations}
              </div>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.35rem' }}>
                Reason: {freezeReason || 'Maximum proctoring infractions reached'}
              </p>
            </div>
            <button
              onClick={() => {
                if (document.fullscreenElement) {
                  document.exitFullscreen().catch(() => {});
                }
                handleAutoSubmit();
              }}
              style={{ background: '#2563eb', color: '#ffffff', fontWeight: 700, padding: '0.85rem 2rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', width: '100%', fontSize: '1rem' }}
            >
              View Results & Summary
            </button>
          </div>
        </div>
      )}

      {/* Integrity Freeze-and-Warn Overlay */}
      {freezeOverlay && !terminalViolationOverlay && (
        <div className="integrity-overlay" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ background: '#ffffff', border: '1px solid #ef4444', padding: '2.5rem', borderRadius: '1rem', maxWidth: '500px', width: '100%' }}>
            <AlertTriangle style={{ width: '4rem', height: '4rem', color: '#ef4444', margin: '0 auto 1rem auto' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem', color: '#b91c1c' }}>Exam Integrity Violation Detected!</h2>
            <p style={{ color: '#334155', marginBottom: '1rem', fontSize: '0.95rem' }}>{freezeReason}</p>
            <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid #cbd5e1' }}>
              <span style={{ color: '#b45309', fontWeight: 700 }}>Recorded Violations: {violationCount} / {maxViolations}</span>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>The exam clock continues running in the background.</p>
            </div>
            <button
              onClick={() => {
                setFreezeOverlay(false);
                if (document.documentElement.requestFullscreen) {
                  document.documentElement.requestFullscreen().catch(() => {});
                }
              }}
              style={{ background: '#ef4444', color: '#ffffff', fontWeight: 600, padding: '0.75rem 2rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', width: '100%' }}
            >
              I Understand & Resume Exam
            </button>
          </div>
        </div>
      )}

      {/* Top Authoritative Bar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 2rem', borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
        <div>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2563eb' }}>{examTitle}</h1>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Negative Marking: -{negativeMarkingRate.toFixed(2)} | Server Authoritative Sync
          </span>
        </div>

        {/* Timer Display */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: secondsRemaining < 300 ? '#fef2f2' : '#f1f5f9',
            padding: '0.5rem 1.25rem', borderRadius: '0.75rem',
            border: `1px solid ${secondsRemaining < 300 ? '#f87171' : '#cbd5e1'}`
          }}>
            <Timer style={{ width: '1.25rem', height: '1.25rem', color: secondsRemaining < 300 ? '#dc2626' : '#2563eb' }} />
            <span style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'monospace', color: secondsRemaining < 300 ? '#b91c1c' : '#0f172a' }}>
              {formatTimer(secondsRemaining)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: violationCount > 0 ? '#ef4444' : '#10b981', fontSize: '0.85rem' }}>
            <ShieldAlert style={{ width: '1rem', height: '1rem' }} />
            <span>Violations: {violationCount}/{maxViolations}</span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#2563eb', color: '#ffffff',
              padding: '0.6rem 1.25rem', borderRadius: '0.5rem', border: 'none', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer'
            }}
          >
            <Send style={{ width: '1rem', height: '1rem' }} />
            {submitting ? 'Submitting...' : 'Submit Exam'}
          </button>
        </div>
      </header>

      {/* Visible Autosave Warning Banner */}
      {autosaveWarning && (
        <div style={{
          background: '#fef2f2',
          borderBottom: '1px solid #fca5a5',
          color: '#b91c1c',
          padding: '0.6rem 2rem',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: 600
        }}>
          <AlertCircle style={{ width: '1rem', height: '1rem', color: '#ef4444', flexShrink: 0 }} />
          <span>{autosaveWarning}</span>
        </div>
      )}

      {/* Main Delivery Area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Question Content */}
        <main style={{ flex: 1, padding: '2.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontWeight: 600 }}>
                Section: {currentQ?.section_name || 'General'}
              </span>
              <button
                onClick={toggleMarkReview}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  background: isMarked ? '#fef3c7' : '#ffffff',
                  color: isMarked ? '#b45309' : '#475569',
                  border: `1px solid ${isMarked ? '#fcd34d' : '#cbd5e1'}`,
                  padding: '0.4rem 0.8rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600
                }}
              >
                <Bookmark style={{ width: '0.9rem', height: '0.9rem' }} />
                {isMarked ? 'Marked for Review' : 'Mark for Review'}
              </button>
            </div>

            {/* Prompt with Bilingual and KaTeX support */}
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.6, marginBottom: '0.75rem', color: '#0f172a' }}>
                {currentIndex + 1}. <MathRenderer text={currentQ?.prompt || ''} />
              </h2>
              {currentQ?.prompt_bangla && (
                <p style={{ color: '#475569', fontSize: '1.05rem', lineHeight: 1.6 }}>
                  <MathRenderer text={currentQ.prompt_bangla} />
                </p>
              )}
            </div>

            {/* Options List for SINGLE_MCQ, MULTI_SELECT, TRUE_FALSE */}
            {(currentQ?.type === 'SINGLE_MCQ' || currentQ?.type === 'MULTI_SELECT' || currentQ?.type === 'TRUE_FALSE' || (currentQ?.options && currentQ.options.length > 0)) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem' }}>
                {currentQ?.options?.map((opt: any) => {
                  const isSelected = selectedOptions.includes(opt.id);
                  const isMulti = currentQ.type === 'MULTI_SELECT';
                  const keyDisplay = opt.optionKey || opt.option_key;
                  const textBanglaDisplay = opt.textBangla || opt.text_bangla;

                  return (
                    <div
                      key={opt.id}
                      onClick={() => selectOption(opt.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem',
                        background: isSelected ? '#eff6ff' : '#ffffff',
                        border: `1.5px solid ${isSelected ? '#2563eb' : '#cbd5e1'}`,
                        borderRadius: '0.75rem', cursor: 'pointer', transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 1px 3px rgba(37,99,235,0.1)' : 'none'
                      }}
                    >
                      {/* Checkbox / Radio Visual Indicator */}
                      <div style={{
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
                      }}>
                        {isSelected && (isMulti ? '✓' : '•')}
                      </div>

                      {/* Option Key Badge */}
                      <span style={{
                        width: '2rem', height: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: '50%', background: isSelected ? '#2563eb' : '#f1f5f9',
                        fontWeight: 700, fontSize: '0.85rem', color: isSelected ? '#ffffff' : '#334155',
                        border: `1px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`
                      }}>
                        {keyDisplay}
                      </span>

                      {/* Option Text */}
                      <div style={{ flex: 1, fontSize: '1rem', color: isSelected ? '#0f172a' : '#334155' }}>
                        <MathRenderer text={opt.text} />
                        {textBanglaDisplay && <span style={{ color: '#64748b', display: 'block', fontSize: '0.9rem', marginTop: '0.2rem' }}>{textBanglaDisplay}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Direct Numeric Input for NUMERIC questions without options */}
            {currentQ?.type === 'NUMERIC' && (!currentQ.options || currentQ.options.length === 0) && (
              <div style={{ marginBottom: '2.5rem', background: '#ffffff', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', color: '#334155', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Enter Numerical Answer:
                </label>
                <input
                  type="number"
                  step="any"
                  value={currentStoredAnswer.numericAnswer !== undefined && currentStoredAnswer.numericAnswer !== null ? currentStoredAnswer.numericAnswer : ''}
                  onChange={(e) => updateNumericAnswer(e.target.value)}
                  placeholder="e.g. 42.5"
                  style={{
                    width: '100%',
                    maxWidth: '300px',
                    padding: '0.75rem 1rem',
                    background: '#ffffff',
                    border: '1px solid #38bdf8',
                    borderRadius: '0.5rem',
                    color: '#0f172a',
                    fontSize: '1.1rem',
                    fontFamily: 'monospace'
                  }}
                />
              </div>
            )}

            {/* Direct Text Input for FILL_BLANK questions without options */}
            {currentQ?.type === 'FILL_BLANK' && (!currentQ.options || currentQ.options.length === 0) && (
              <div style={{ marginBottom: '2.5rem', background: '#ffffff', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', color: '#334155', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Enter Answer Text:
                </label>
                <input
                  type="text"
                  value={currentStoredAnswer.textAnswer || ''}
                  onChange={(e) => updateTextAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  style={{
                    width: '100%',
                    maxWidth: '450px',
                    padding: '0.75rem 1rem',
                    background: '#ffffff',
                    border: '1px solid #38bdf8',
                    borderRadius: '0.5rem',
                    color: '#0f172a',
                    fontSize: '1rem'
                  }}
                />
              </div>
            )}

            {/* Navigation Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#ffffff', color: '#1e293b',
                  border: '1px solid #cbd5e1', padding: '0.6rem 1.2rem', borderRadius: '0.5rem', cursor: currentIndex === 0 ? 'not-allowed' : 'pointer', fontWeight: 600
                }}
              >
                <ChevronLeft style={{ width: '1rem', height: '1rem' }} /> Previous
              </button>
              <button
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                disabled={currentIndex === questions.length - 1}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#ffffff', color: '#1e293b',
                  border: '1px solid #cbd5e1', padding: '0.6rem 1.2rem', borderRadius: '0.5rem', cursor: currentIndex === questions.length - 1 ? 'not-allowed' : 'pointer', fontWeight: 600
                }}
              >
                Next <ChevronRight style={{ width: '1rem', height: '1rem' }} />
              </button>
            </div>
          </div>
        </main>

        {/* Right: Question Palette Sidebar */}
        <aside style={{ width: '320px', background: '#ffffff', borderLeft: '1px solid #e2e8f0', padding: '1.5rem', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem', color: '#334155' }}>Question Palette</h3>

          {/* Status Legend */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', marginBottom: '1.5rem', color: '#475569', fontWeight: 500 }}>
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

          {/* Grid of Question Numbers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.6rem' }}>
            {questions.map((q, idx) => {
              const qAns = answers[q.id];
              const isAnswered = Boolean(
                (qAns?.selectedOptionIds && qAns.selectedOptionIds.length > 0) ||
                (qAns?.numericAnswer !== undefined && qAns.numericAnswer !== null) ||
                (qAns?.textAnswer && qAns.textAnswer.trim() !== '')
              );
              const isMarkedReview = qAns?.marked;
              const isCurrent = idx === currentIndex;

              let bgColor = '#ffffff';
              let textColor = '#334155';
              let borderColor = '#cbd5e1';

              if (isAnswered) {
                bgColor = '#059669';
                textColor = '#ffffff';
                borderColor = '#047857';
              } else if (isMarkedReview) {
                bgColor = '#ca8a04';
                textColor = '#ffffff';
                borderColor = '#a16207';
              }

              if (isCurrent) {
                borderColor = '#2563eb';
                if (!isAnswered && !isMarkedReview) {
                  bgColor = '#eff6ff';
                  textColor = '#1d4ed8';
                }
              }

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  style={{
                    height: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: bgColor, color: textColor, fontWeight: 700, fontSize: '0.85rem',
                    borderRadius: '0.5rem', border: isCurrent ? '2px solid #2563eb' : `1px solid ${borderColor}`,
                    cursor: 'pointer', transition: 'all 0.15s ease'
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
  );
};
