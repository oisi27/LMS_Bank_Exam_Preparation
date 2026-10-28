import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Award, CheckCircle2, XCircle, MinusCircle, Clock, ArrowRight, Trophy, Users, AlertCircle } from 'lucide-react';

interface ResultProps {
  grade: {
    score?: number;
    maximumMarks?: number;
    correctCount?: number;
    wrongCount?: number;
    skippedCount?: number;
    accuracyPercentage?: number;
    isPassed?: boolean;
    timeSpentSeconds?: number;
    attemptId?: string;
    examId?: string;
    resultsWithheld?: boolean;
    releaseMode?: 'INSTANT' | 'SCHEDULED' | 'MANUAL';
    scheduledReleaseTime?: string | null;
    message?: string;
  };
  onRetakeOrExit: () => void;
  onReviewAnswers?: () => void;
}

interface RankInfo {
  rank: number;
  totalParticipants: number;
  percentile: number | null;
  averageScore: number;
  highestScore: number;
}

export const ResultScreen: React.FC<ResultProps> = ({ grade, onRetakeOrExit, onReviewAnswers }) => {
  const [rankInfo, setRankInfo] = useState<RankInfo | null>(null);
  const [rankLoading, setRankLoading] = useState<boolean>(false);
  const [rankNotice, setRankNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!grade.examId || grade.resultsWithheld) return;

    let isMounted = true;
    async function fetchRank() {
      try {
        setRankLoading(true);
        setRankNotice(null);
        const token = localStorage.getItem('token');
        const res = await axios.get(`http://localhost:5000/api/exams/${grade.examId}/leaderboard`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!isMounted) return;

        if (res.data.success) {
          if (res.data.currentUser?.rank) {
            setRankInfo({
              rank: res.data.currentUser.rank,
              totalParticipants: res.data.analytics.totalParticipants,
              percentile: res.data.currentUser.percentile,
              averageScore: res.data.analytics.averageScore,
              highestScore: res.data.analytics.highestScore
            });
          } else {
            // Student result might not yet be ranked or empty
            setRankNotice('Rank will be computed once attempt is finalized in the class standings.');
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        // Result release restriction message or error
        const errMsg = err.response?.data?.error;
        if (err.response?.status === 403) {
          setRankNotice(errMsg || 'Class rank will be published after the official exam review window.');
        } else {
          // Non-blocking fallback
          console.error('Failed to load ranking information:', err);
        }
      } finally {
        if (isMounted) setRankLoading(false);
      }
    }

    fetchRank();
    return () => {
      isMounted = false;
    };
  }, [grade.examId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (grade.resultsWithheld) {
    const isScheduled = grade.releaseMode === 'SCHEDULED';
    const message = grade.message || (isScheduled
      ? 'Exam submitted successfully. Your result will be available at the scheduled publication time.'
      : 'Exam submitted successfully. Your result is awaiting publication by the instructor.');

    return (
      <div style={{ maxWidth: '680px', margin: '3rem auto', padding: '1.5rem' }}>
        <div
          className="glass-panel-elevated"
          style={{
            padding: '3rem 2.5rem',
            textAlign: 'center',
            borderRadius: '1rem',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div
            style={{
              width: '4.5rem',
              height: '4.5rem',
              borderRadius: '50%',
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem auto',
              border: '2px solid #bfdbfe'
            }}
          >
            <Clock style={{ width: '2.25rem', height: '2.25rem' }} />
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.75rem', color: '#0f172a' }}>
            Exam Submitted Successfully
          </h1>

          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.75rem',
              padding: '1.25rem 1.5rem',
              margin: '1.5rem auto 2rem auto',
              maxWidth: '540px'
            }}
          >
            <p style={{ color: '#334155', fontSize: '1rem', fontWeight: 500, margin: 0, lineHeight: 1.6 }}>
              {message}
            </p>
            {isScheduled && grade.scheduledReleaseTime && (
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.6rem 0 0 0' }}>
                Scheduled Release Time: <strong>{new Date(grade.scheduledReleaseTime).toLocaleString()}</strong>
              </p>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={onRetakeOrExit}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.95rem',
                padding: '0.75rem 1.75rem',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.25)'
              }}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '820px', margin: '2.5rem auto', padding: '1.5rem' }}>
      <div className="glass-panel-elevated" style={{ padding: '2.5rem', textAlign: 'center' }}>
        <div style={{
          width: '5rem', height: '5rem', borderRadius: '50%',
          background: grade.isPassed ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          color: grade.isPassed ? '#10b981' : '#ef4444', display: 'flex',
          alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto'
        }}>
          <Award style={{ width: '2.5rem', height: '2.5rem' }} />
        </div>

        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem', color: '#0f172a' }}>
          {grade.isPassed ? 'Congratulations! Exam Passed' : 'Exam Completed'}
        </h1>
        <p style={{ color: '#64748b', marginBottom: '2rem' }}>
          Here is your authoritative breakdown based on the Bangladesh Bank negative marking formula (+1.0 / -0.25).
        </p>

        {/* Big Score Card */}
        <div style={{
          background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '1rem', padding: '1.75rem', marginBottom: '2rem', display: 'inline-block', minWidth: '240px'
        }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net Score</span>
          <div style={{ fontSize: '3rem', fontWeight: 800, color: (grade.score ?? 0) >= 0 ? '#38bdf8' : '#ef4444', lineHeight: 1.2 }}>
            {grade.score ?? 0} <span style={{ fontSize: '1.25rem', color: '#64748b' }}>/ {grade.maximumMarks ?? 0}</span>
          </div>
        </div>

        {/* Official Candidate Rank Banner */}
        {rankLoading && (
          <div style={{
            background: '#f8fafc', border: '1px solid #cbd5e1',
            borderRadius: '0.75rem', padding: '1rem 1.5rem', marginBottom: '2rem', color: '#475569', fontSize: '0.9rem'
          }}>
            Calculating official exam ranking against participants...
          </div>
        )}

        {!rankLoading && rankInfo && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(16, 185, 129, 0.12) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            borderRadius: '0.85rem',
            padding: '1.25rem 2rem',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a' }}>
                <Trophy style={{ width: '20px', height: '20px' }} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Your Standing</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                  Rank #{rankInfo.rank} <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>of {rankInfo.totalParticipants}</span>
                </div>
              </div>
            </div>

            {rankInfo.percentile !== null && (
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Percentile</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>
                  {rankInfo.percentile}%
                </div>
              </div>
            )}

            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Batch Highest</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#b45309' }}>
                {rankInfo.highestScore}
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Batch Average</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563eb' }}>
                {rankInfo.averageScore}
              </div>
            </div>
          </div>
        )}

        {!rankLoading && rankNotice && (
          <div style={{
            background: '#eff6ff', border: '1px solid #bfdbfe',
            borderRadius: '0.75rem', padding: '0.85rem 1.25rem', marginBottom: '2rem',
            color: '#1e40af', fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 500
          }}>
            <AlertCircle style={{ width: '16px', height: '16px', color: '#2563eb', flexShrink: 0 }} />
            {rankNotice}
          </div>
        )}

        {/* Detailed Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2.5rem' }}>
          <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#10b981', marginBottom: '0.4rem' }}>
              <CheckCircle2 style={{ width: '1.1rem', height: '1.1rem' }} /> Correct
            </div>
            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>{grade.correctCount}</span>
          </div>

          <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#ef4444', marginBottom: '0.4rem' }}>
              <XCircle style={{ width: '1.1rem', height: '1.1rem' }} /> Wrong
            </div>
            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>{grade.wrongCount}</span>
          </div>

          <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#64748b', marginBottom: '0.4rem' }}>
              <MinusCircle style={{ width: '1.1rem', height: '1.1rem' }} /> Skipped
            </div>
            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>{grade.skippedCount}</span>
          </div>

          <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#2563eb', marginBottom: '0.4rem' }}>
              <Clock style={{ width: '1.1rem', height: '1.1rem' }} /> Time Taken
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>{formatTime(grade.timeSpentSeconds || 0)}</span>
          </div>
        </div>

        {/* Action Buttons: Return to Dashboard & Review Detailed Answers */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {onReviewAnswers && (
            <button
              onClick={onReviewAnswers}
              style={{
                background: '#10b981', color: '#ffffff', fontWeight: 600, padding: '0.8rem 1.75rem',
                borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontSize: '0.95rem',
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem'
              }}
            >
              Review Questions & Explanations <ArrowRight style={{ width: '1.1rem', height: '1.1rem' }} />
            </button>
          )}

          <button
            onClick={onRetakeOrExit}
            style={{
              background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', fontWeight: 600, padding: '0.8rem 1.75rem',
              borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.95rem'
            }}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultScreen;
