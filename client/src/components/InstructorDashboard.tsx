import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BookOpen,
  FileQuestion,
  HelpCircle,
  Users,
  ShieldAlert,
  ArrowRight,
  PlusCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  Layers,
  Award,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { Card, Button, Badge } from '../design-system';

interface InstructorDashboardProps {
  onNavigateTab: (tab: string) => void;
  currentUser?: { name: string; role: string } | null;
}

interface CourseItem {
  id: string;
  title: string;
  status: 'DRAFT' | 'PUBLISHED';
  category_name?: string;
  created_at: string;
}

interface ExamItem {
  id: string;
  title: string;
  category: string;
  status: 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'CLOSED' | 'RESULTS_PUBLISHED';
  totalMarks: number;
  durationMinutes: number;
  questionCount: number;
  startsAt: string;
  endsAt: string;
}

interface RecentSubmission {
  attemptId: string;
  examTitle: string;
  studentName: string;
  score: number | null;
  totalMarks: number | null;
  accuracyPercentage: number | null;
  isPassed: boolean | number | null;
  violationCount: number;
  startedAt: string;
}

interface ViolationItem {
  id: string;
  examTitle: string;
  studentName: string;
  violationType: string;
  occurredAt: string;
  details?: any;
}

export const InstructorDashboard: React.FC<InstructorDashboardProps> = ({
  onNavigateTab,
  currentUser
}) => {
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [questionsCount, setQuestionsCount] = useState<number | null>(null);
  const [recentSubmissions, setRecentSubmissions] = useState<RecentSubmission[]>([]);
  const [recentViolations, setRecentViolations] = useState<ViolationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchInstructorData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch instructor's owned courses
      const coursesReq = axios.get('http://localhost:5000/api/courses?mine=true', { headers });

      // 2. Fetch instructor's owned exams
      const examsReq = axios.get('http://localhost:5000/api/exams?mine=true', { headers });

      // 3. Fetch questions to determine count
      const questionsReq = axios.get('http://localhost:5000/api/questions?pageSize=1', { headers });

      const [coursesRes, examsRes, questionsRes] = await Promise.allSettled([
        coursesReq,
        examsReq,
        questionsReq
      ]);

      let loadedExams: ExamItem[] = [];
      if (examsRes.status === 'fulfilled' && examsRes.value.data.success) {
        loadedExams = examsRes.value.data.exams || [];
        setExams(loadedExams);
      }

      if (coursesRes.status === 'fulfilled' && coursesRes.value.data.success) {
        setCourses(coursesRes.value.data.courses || []);
      }

      if (questionsRes.status === 'fulfilled' && questionsRes.value.data.success) {
        setQuestionsCount(questionsRes.value.data.totalItems ?? 0);
      }

      // 4. Fetch submissions and violations across instructor's exams
      if (loadedExams.length > 0) {
        // Sample recent exams (up to 5) to collect active student submissions
        const sampleExams = loadedExams.slice(0, 5);
        const submissionPromises = sampleExams.map((ex) =>
          axios
            .get(`http://localhost:5000/api/exams/${ex.id}/submissions`, { headers })
            .then((r) => ({ exam: ex, data: r.data }))
            .catch(() => null)
        );

        const subResults = await Promise.all(submissionPromises);
        const aggregatedSubmissions: RecentSubmission[] = [];
        const aggregatedViolations: ViolationItem[] = [];

        for (const res of subResults) {
          if (res && res.data && res.data.success) {
            const examTitle = res.exam.title;
            const examTotalMarks = res.data.exam?.totalMarks ?? res.exam.totalMarks ?? null;
            if (Array.isArray(res.data.submissions)) {
              for (const sub of res.data.submissions) {
                // Support both camelCase and snake_case defensively
                const rawScore = sub.score !== undefined ? sub.score : sub.score_marks;
                const rawTotal = sub.totalMarks !== undefined && sub.totalMarks !== null ? sub.totalMarks : (sub.total_marks ?? examTotalMarks);
                const parsedScore = rawScore !== null && rawScore !== undefined && !isNaN(Number(rawScore)) ? Number(rawScore) : null;
                const parsedTotal = rawTotal !== null && rawTotal !== undefined && !isNaN(Number(rawTotal)) ? Number(rawTotal) : null;

                aggregatedSubmissions.push({
                  attemptId: sub.attemptId || sub.attempt_id || '',
                  examTitle,
                  studentName: sub.studentName || sub.student_name || 'Unknown Candidate',
                  score: parsedScore,
                  totalMarks: parsedTotal,
                  accuracyPercentage:
                    sub.accuracyPercentage !== null && sub.accuracyPercentage !== undefined && !isNaN(Number(sub.accuracyPercentage))
                      ? Number(sub.accuracyPercentage)
                      : (sub.accuracy_percentage !== null && sub.accuracy_percentage !== undefined && !isNaN(Number(sub.accuracy_percentage)) ? Number(sub.accuracy_percentage) : null),
                  isPassed: sub.isPassed !== undefined ? sub.isPassed : sub.is_passed,
                  violationCount: Number(sub.violationCount ?? sub.violation_count ?? 0),
                  startedAt: sub.startedAt || sub.started_at || ''
                });
              }
            }

            if (Array.isArray(res.data.violations)) {
              for (const v of res.data.violations) {
                aggregatedViolations.push({
                  id: v.id,
                  examTitle,
                  studentName: v.studentName || v.student_name || 'Unknown Candidate',
                  violationType: v.violationType || v.violation_type || 'PROCTORING_FLAG',
                  occurredAt: v.occurredAt || v.occurred_at || '',
                  details: v.details
                });
              }
            }
          }
        }

        // Sort descending by date
        aggregatedSubmissions.sort((a, b) => {
          const timeA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
          const timeB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
          return timeB - timeA;
        });

        aggregatedViolations.sort((a, b) => {
          const timeA = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
          const timeB = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
          return timeB - timeA;
        });

        setRecentSubmissions(aggregatedSubmissions.slice(0, 8));
        setRecentViolations(aggregatedViolations.slice(0, 8));
      } else {
        setRecentSubmissions([]);
        setRecentViolations([]);
      }
    } catch (err: any) {
      console.error('Error fetching instructor dashboard data:', err);
      setError(err.response?.data?.error || 'Unable to load instructor workspace data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInstructorData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchInstructorData();
  };

  const publishedCoursesCount = courses.filter((c) => c.status === 'PUBLISHED').length;
  const draftCoursesCount = courses.filter((c) => c.status === 'DRAFT').length;

  const liveExamsCount = exams.filter((e) => e.status === 'LIVE').length;
  const scheduledExamsCount = exams.filter((e) => e.status === 'SCHEDULED').length;
  const draftExamsCount = exams.filter((e) => e.status === 'DRAFT').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner / Welcome HUD */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          paddingBottom: '8px',
          borderBottom: '1px solid #e2e8f0'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1
              style={{
                fontSize: '1.75rem',
                fontWeight: 800,
                color: '#0f172a',
                margin: 0,
                letterSpacing: '-0.02em'
              }}
            >
              Instructor Workspace
            </h1>
            <Badge text="INSTRUCTOR" type="info" />
          </div>
          <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Welcome back, {currentUser?.name || 'Instructor'}. Manage course syllabus, mock exams, question banks, and monitor live candidate submissions.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigateTab('course-builder')}>
            <PlusCircle size={14} /> New Course
          </Button>
          <Button variant="primary" size="sm" onClick={() => onNavigateTab('exam-builder')}>
            <PlusCircle size={14} /> New Exam
          </Button>
        </div>
      </div>

      {error && (
        <Card style={{ borderLeft: '4px solid #ef4444', background: '#fef2f2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle style={{ color: '#dc2626' }} size={20} />
            <span style={{ color: '#b91c1c', fontSize: '0.9rem', fontWeight: 600 }}>{error}</span>
          </div>
        </Card>
      )}

      {/* KPI Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px'
        }}
      >
        {/* Metric 1: My Courses */}
        <Card
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>My Courses</span>
              <BookOpen size={18} style={{ color: '#3b82f6' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a' }}>
              {loading ? '...' : courses.length}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: '#10b981' }}>{publishedCoursesCount} Published</span>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>•</span>
              <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>{draftCoursesCount} Drafts</span>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('course-builder')}
            style={{
              marginTop: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: 'none',
              color: '#2563eb',
              fontSize: '0.8rem',
              fontWeight: 600,
              padding: 0,
              cursor: 'pointer'
            }}
          >
            Open Course Builder <ArrowRight size={14} />
          </button>
        </Card>

        {/* Metric 2: My Mock Exams */}
        <Card
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>My Mock Exams</span>
              <FileQuestion size={18} style={{ color: '#10b981' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a' }}>
              {loading ? '...' : exams.length}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: '#10b981' }}>{liveExamsCount} Live</span>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>•</span>
              <span style={{ fontSize: '0.75rem', color: '#2563eb' }}>{scheduledExamsCount} Scheduled</span>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>•</span>
              <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>{draftExamsCount} Draft</span>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('exam-builder')}
            style={{
              marginTop: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: 'none',
              color: '#15803d',
              fontSize: '0.8rem',
              fontWeight: 600,
              padding: 0,
              cursor: 'pointer'
            }}
          >
            Open Exam Builder <ArrowRight size={14} />
          </button>
        </Card>

        {/* Metric 3: Question Bank */}
        <Card
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Question Bank</span>
              <HelpCircle size={18} style={{ color: '#a855f7' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a' }}>
              {loading ? '...' : questionsCount !== null ? questionsCount : '1,316'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px' }}>
              Bank recruitment questions available for test authoring
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('questions')}
            style={{
              marginTop: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: 'none',
              color: '#c084fc',
              fontSize: '0.8rem',
              fontWeight: 600,
              padding: 0,
              cursor: 'pointer'
            }}
          >
            Manage Questions <ArrowRight size={14} />
          </button>
        </Card>

        {/* Metric 4: Integrity Alerts */}
        <Card
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Integrity Alerts</span>
              <ShieldAlert size={18} style={{ color: '#ef4444' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: recentViolations.length > 0 ? '#b91c1c' : '#0f172a' }}>
              {loading ? '...' : recentViolations.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px' }}>
              Recorded proctoring events across recent exams
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('exam-builder')}
            style={{
              marginTop: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: 'none',
              color: '#2563eb',
              fontSize: '0.8rem',
              fontWeight: 600,
              padding: 0,
              cursor: 'pointer'
            }}
          >
            View Submissions & Logs <ArrowRight size={14} />
          </button>
        </Card>
      </div>

      {/* Main Instructor Modules Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        {/* Module A: Recent Student Submissions */}
        <Card style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={20} style={{ color: '#3b82f6' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Recent Student Submissions
              </h3>
            </div>
            <Button variant="outline" size="sm" onClick={() => onNavigateTab('exam-builder')}>
              Submissions Review
            </Button>
          </div>

          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
              Loading student submissions...
            </div>
          ) : recentSubmissions.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
              <Award size={36} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
              <div style={{ fontWeight: 600, color: '#334155' }}>No Student Submissions Yet</div>
              <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                When candidates submit attempts on your live mock exams, their scores and accuracy will appear here.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #cbd5e1', textAlign: 'left', color: '#475569', background: '#f8fafc', fontWeight: 600 }}>
                    <th style={{ padding: '8px 12px' }}>Candidate</th>
                    <th style={{ padding: '8px 12px' }}>Exam</th>
                    <th style={{ padding: '8px 12px' }}>Score</th>
                    <th style={{ padding: '8px 12px' }}>Status</th>
                    <th style={{ padding: '8px 12px' }}>Violations</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSubmissions.map((sub) => (
                    <tr
                      key={sub.attemptId}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        color: '#1e293b'
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{sub.studentName}</td>
                      <td style={{ padding: '10px 12px', color: '#334155' }}>{sub.examTitle}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {sub.score !== null ? (
                          <span style={{ fontWeight: 700, color: '#2563eb' }}>
                            {sub.score} / {sub.totalMarks !== null ? sub.totalMarks : '—'}
                          </span>
                        ) : (
                          <span style={{ color: '#64748b' }}>Pending</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {sub.isPassed === true || sub.isPassed === 1 ? (
                          <Badge text="PASSED" type="success" />
                        ) : sub.isPassed === false || sub.isPassed === 0 ? (
                          <Badge text="FAILED" type="danger" />
                        ) : (
                          <Badge text="GRADED" type="info" />
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {sub.violationCount > 0 ? (
                          <span style={{ color: '#b91c1c', fontWeight: 700 }}>
                            {sub.violationCount} warning(s)
                          </span>
                        ) : (
                          <span style={{ color: '#15803d', fontWeight: 600 }}>Clean</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Module B: Exam Integrity & Proctoring Stream */}
        <Card style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={20} style={{ color: '#ef4444' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Exam Integrity & Proctoring Feed
              </h3>
            </div>
            <Button variant="outline" size="sm" onClick={() => onNavigateTab('exam-builder')}>
              View All Logs
            </Button>
          </div>

          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
              Loading integrity logs...
            </div>
          ) : recentViolations.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
              <CheckCircle2 size={36} style={{ margin: '0 auto 12px auto', color: '#10b981', opacity: 0.8 }} />
              <div style={{ fontWeight: 600, color: '#334155' }}>No Integrity Violations Detected</div>
              <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                All candidate sessions across your mock exams are adhering to proctoring policies.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentViolations.map((v) => {
                let formattedTime = 'Date unavailable';
                if (v.occurredAt) {
                  const d = new Date(v.occurredAt);
                  if (!isNaN(d.getTime())) {
                    formattedTime = d.toLocaleTimeString('en-US', {
                      timeZone: 'Asia/Dhaka',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    });
                  }
                }

                return (
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
                      <div>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{v.studentName}</span>
                        <span style={{ color: '#64748b', fontSize: '0.78rem', marginLeft: '6px' }}>
                          in {v.examTitle}
                        </span>
                      </div>
                    </div>
                    <span style={{ color: '#64748b', fontSize: '0.78rem' }}>
                      {formattedTime}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Module C: Quick Links to Instructor Management Tools */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'rgba(37, 99, 235, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb'
              }}
            >
              <BookOpen size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem' }}>Course Builder</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                Structure chapters, modules, lecture videos, and downloadable resources.
              </div>
            </div>
          </div>
          <div style={{ width: '100%', marginTop: '16px' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigateTab('course-builder')}
            >
              Launch Course Builder
            </Button>
          </div>
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: '#f0fdf4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#15803d'
              }}
            >
              <FileQuestion size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem' }}>Exam Builder</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                Configure negative marking, exam timers, scheduled windows, and review candidate submissions.
              </div>
            </div>
          </div>
          <div style={{ width: '100%', marginTop: '16px' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigateTab('exam-builder')}
            >
              Launch Exam Builder
            </Button>
          </div>
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'rgba(168, 85, 247, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#c084fc'
              }}
            >
              <HelpCircle size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem' }}>Question Bank</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                Create bilingual Bengali/English questions, configure numeric tolerances, and import CSV batches.
              </div>
            </div>
          </div>
          <div style={{ width: '100%', marginTop: '16px' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigateTab('questions')}
            >
              Launch Question Bank
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
