import React, { useState, useEffect } from 'react';
import {
  Award,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock,
  ArrowRight,
  RotateCcw,
  BookOpenCheck,
  Check,
  X,
  AlertCircle,
  HelpCircle,
  Filter
} from 'lucide-react';
import axios from 'axios';
import { MathRenderer } from './MathRenderer';

interface ExamReviewScreenProps {
  attemptId: string;
  onBackToDashboard: () => void;
}

export const ExamReviewScreen: React.FC<ExamReviewScreenProps> = ({ attemptId, onBackToDashboard }) => {
  const [loading, setLoading] = useState(true);
  const [reviewData, setReviewData] = useState<any>(null);
  const [filter, setFilter] = useState<'ALL' | 'CORRECT' | 'WRONG' | 'SKIPPED'>('ALL');

  useEffect(() => {
    async function fetchReview() {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`http://localhost:5000/api/exams/${attemptId}/review`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setReviewData(res.data);
      } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to load exam review.');
      } finally {
        setLoading(false);
      }
    }
    fetchReview();
  }, [attemptId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <p style={{ color: '#64748b' }}>Loading detailed solutions and performance analysis...</p>
      </div>
    );
  }

  if (!reviewData) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#0f172a' }}>
        <p>Review data unavailable.</p>
        <button onClick={onBackToDashboard} style={{ background: '#2563eb', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', color: '#fff', marginTop: '1rem' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const { result, reviewItems, examTitle, examTitleBangla } = reviewData;

  const filteredItems = reviewItems.filter((item: any) => {
    if (filter === 'ALL') return true;
    return item.status === filter;
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', padding: '2rem' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>
              <BookOpenCheck style={{ width: '1rem', height: '1rem' }} /> POST-EXAM COMPREHENSIVE QUESTION REVIEW
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.25rem' }}>{examTitle}</h1>
            {examTitleBangla && <p style={{ color: '#64748b', fontSize: '0.95rem' }}>{examTitleBangla}</p>}
          </div>

          <button
            onClick={onBackToDashboard}
            style={{
              background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b',
              padding: '0.6rem 1.25rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600
            }}
          >
            Back to Dashboard
          </button>
        </div>

        {/* Score Banner */}
        <div className="glass-panel" style={{ padding: '1.5rem 2rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase' }}>Authoritative Result</span>
            <div style={{ fontSize: '2.25rem', fontWeight: 800, color: result?.score >= 0 ? '#38bdf8' : '#ef4444' }}>
              {result?.score} <span style={{ fontSize: '1.1rem', color: '#64748b' }}>/ {result?.total_marks} Marks</span>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Negative Marking applied: -0.25 per wrong answer</p>
          </div>

          <div style={{ display: 'flex', gap: '1.25rem' }}>
            <div style={{ background: '#ffffff', padding: '0.75rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', textAlign: 'center' }}>
              <div style={{ color: '#10b981', fontWeight: 700, fontSize: '1.2rem' }}>{result?.correct_count}</div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Correct</span>
            </div>
            <div style={{ background: '#ffffff', padding: '0.75rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', textAlign: 'center' }}>
              <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '1.2rem' }}>{result?.wrong_count}</div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Wrong (-0.25)</span>
            </div>
            <div style={{ background: '#ffffff', padding: '0.75rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', textAlign: 'center' }}>
              <div style={{ color: '#64748b', fontWeight: 700, fontSize: '1.2rem' }}>{result?.skipped_count}</div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Skipped</span>
            </div>
            <div style={{ background: '#ffffff', padding: '0.75rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', textAlign: 'center' }}>
              <div style={{ color: '#2563eb', fontWeight: 700, fontSize: '1.2rem' }}>{result?.accuracy_percentage}%</div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Accuracy</span>
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Filter style={{ width: '0.9rem', height: '0.9rem' }} /> Filter:
          </span>
          {[
            { id: 'ALL', label: `All Questions (${reviewItems.length})` },
            { id: 'CORRECT', label: `Correct (${result?.correct_count})` },
            { id: 'WRONG', label: `Wrong (${result?.wrong_count})` },
            { id: 'SKIPPED', label: `Skipped (${result?.skipped_count})` }
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setFilter(btn.id as any)}
              style={{
                background: filter === btn.id ? '#2563eb' : '#1e293b',
                color: filter === btn.id ? '#ffffff' : '#cbd5e1',
                border: '1px solid #cbd5e1', padding: '0.4rem 0.8rem',
                borderRadius: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Questions Detailed Solution Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {filteredItems.map((item: any, idx: number) => {
            let statusColor = '#475569';
            let statusBg = '#f1f5f9';
            let statusText = 'Skipped (0 marks)';

            if (item.status === 'CORRECT') {
              statusColor = '#15803d';
              statusBg = '#f0fdf4';
              statusText = `Correct (+${item.marks} marks)`;
            } else if (item.status === 'WRONG') {
              statusColor = '#b91c1c';
              statusBg = '#fef2f2';
              statusText = `Wrong (-${item.negativeMarks} marks)`;
            }

            return (
              <div
                key={item.id}
                className="glass-panel"
                style={{ padding: '1.75rem', borderLeft: `4px solid ${statusColor}` }}
              >
                {/* Meta info & status badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem' }}>
                    <span style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '0.2rem 0.6rem', borderRadius: '0.3rem', color: '#93c5fd' }}>
                      {item.subject}
                    </span>
                    <span style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '0.2rem 0.6rem', borderRadius: '0.3rem', color: '#334155' }}>
                      {item.chapter}
                    </span>
                    <span style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '0.2rem 0.6rem', borderRadius: '0.3rem', color: '#f59e0b' }}>
                      {item.difficulty}
                    </span>
                  </div>

                  <span style={{ background: statusBg, color: statusColor, fontSize: '0.8rem', fontWeight: 700, padding: '0.25rem 0.75rem', borderRadius: '1rem' }}>
                    {statusText}
                  </span>
                </div>

                {/* Question Prompt */}
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, lineHeight: 1.6, marginBottom: '0.5rem', color: '#0f172a' }}>
                  {item.orderIndex || idx + 1}. <MathRenderer text={item.prompt} />
                </h3>
                {item.promptBangla && (
                  <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                    <MathRenderer text={item.promptBangla} />
                  </p>
                )}

                {/* Non-MCQ Answers Display (NUMERIC / FILL_BLANK) */}
                {(item.type === 'NUMERIC' || item.type === 'FILL_BLANK') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div style={{
                      padding: '0.75rem 1rem', borderRadius: '0.5rem',
                      background: item.status === 'CORRECT' ? 'rgba(16,185,129,0.1)' : item.status === 'WRONG' ? 'rgba(239,68,68,0.1)' : '#0f172a',
                      border: `1.5px solid ${item.status === 'CORRECT' ? '#10b981' : item.status === 'WRONG' ? '#ef4444' : '#334155'}`
                    }}>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                        Your Submitted Answer
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: item.status === 'CORRECT' ? '#10b981' : item.status === 'WRONG' ? '#ef4444' : '#cbd5e1' }}>
                        {item.type === 'NUMERIC'
                          ? (item.studentNumericAnswer !== null && item.studentNumericAnswer !== undefined ? item.studentNumericAnswer : 'Not Answered (Skipped)')
                          : (item.studentTextAnswer ? item.studentTextAnswer : 'Not Answered (Skipped)')}
                      </div>
                    </div>

                    <div style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'rgba(16,185,129,0.15)', border: '1.5px solid #10b981' }}>
                      <div style={{ fontSize: '0.8rem', color: '#10b981', textTransform: 'uppercase', marginBottom: '0.25rem', fontWeight: 700 }}>
                        Correct Model Answer
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#10b981' }}>
                        {item.type === 'NUMERIC'
                          ? `${item.correctNumeric ?? 'N/A'}${item.numericTolerance > 0 ? ` (Tolerance: ±${item.numericTolerance})` : ''}`
                          : (item.correctText ?? 'N/A')}
                      </div>
                    </div>
                  </div>
                )}

                {/* Options List with Visual Feedback (for MCQ, MULTI_SELECT, TRUE_FALSE) */}
                {item.type !== 'NUMERIC' && item.type !== 'FILL_BLANK' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
                    {item.options?.map((opt: any) => {
                      const isStudentSelected = item.studentSelectedIds?.includes(opt.id);
                      const isCorrectAnswer = opt.is_correct === 1;

                      let optBg = '#ffffff';
                      let optBorder = '#cbd5e1';
                      let optTextColor = '#334155';
                      let badge = null;

                      if (isCorrectAnswer) {
                        optBg = '#dcfce7';
                        optBorder = '#86efac';
                        optTextColor = '#166534';
                        badge = (
                          <span style={{ color: '#166534', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', fontWeight: 700 }}>
                            <Check style={{ width: '1rem', height: '1rem' }} /> Correct Answer
                          </span>
                        );
                      } else if (isStudentSelected && !isCorrectAnswer) {
                        optBg = '#fee2e2';
                        optBorder = '#fca5a5';
                        optTextColor = '#991b1b';
                        badge = (
                          <span style={{ color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', fontWeight: 700 }}>
                            <X style={{ width: '1rem', height: '1rem' }} /> Your Answer
                          </span>
                        );
                      }

                      return (
                        <div
                          key={opt.id}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '0.75rem 1rem', background: optBg, border: `1.5px solid ${optBorder}`,
                            borderRadius: '0.5rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{
                              width: '1.75rem', height: '1.75rem', borderRadius: '50%',
                              background: isCorrectAnswer ? '#166534' : isStudentSelected ? '#dc2626' : '#f1f5f9',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.8rem', fontWeight: 700, color: (isCorrectAnswer || isStudentSelected) ? '#ffffff' : '#334155',
                              border: (isCorrectAnswer || isStudentSelected) ? 'none' : '1px solid #cbd5e1'
                            }}>
                              {opt.option_key}
                            </span>
                            <span style={{ fontSize: '0.95rem', color: optTextColor, fontWeight: (isCorrectAnswer || isStudentSelected) ? 600 : 400 }}>
                              <MathRenderer text={opt.text} />
                              {opt.text_bangla && <span style={{ color: isCorrectAnswer ? '#15803d' : isStudentSelected ? '#b91c1c' : '#64748b', display: 'block', fontSize: '0.85rem' }}>{opt.text_bangla}</span>}
                            </span>
                          </div>
                          {badge}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Explanation Box */}
                {(item.explanation || item.explanationBangla) && (
                  <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '1rem 1.25rem', borderRadius: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#2563eb', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                      <AlertCircle style={{ width: '1rem', height: '1rem' }} /> Detailed Solution & Rationale:
                    </div>
                    {item.explanation && (
                      <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.6 }}>
                        <MathRenderer text={item.explanation} />
                      </div>
                    )}
                    {item.explanationBangla && (
                      <div style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6, marginTop: '0.25rem' }}>
                        <MathRenderer text={item.explanationBangla} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Navigation */}
        <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
          <button
            onClick={onBackToDashboard}
            style={{
              background: '#2563eb', color: '#ffffff', fontWeight: 600, padding: '0.8rem 2.5rem',
              borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontSize: '1rem',
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem'
            }}
          >
            Done with Review & Return to Dashboard <ArrowRight style={{ width: '1.1rem', height: '1.1rem' }} />
          </button>
        </div>
      </div>
    </div>
  );
};
