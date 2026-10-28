import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Users,
  GraduationCap,
  Briefcase,
  BookOpen,
  CheckCircle2,
  FileCheck,
  Activity,
  Shield,
  Award,
  Clock,
  History,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { Card, Button, Badge } from '../design-system';

interface AdminDashboardProps {
  onNavigateTab: (tab: string, subSection?: 'USERS' | 'LIVE_MONITOR' | 'AUDIT_LOGS' | 'COURSE_MODERATION' | 'GRADE_OVERRIDE') => void;
  currentUser?: { name: string; role: string } | null;
}

interface PlatformStats {
  totalUsers: number;
  totalStudents: number;
  totalInstructors: number;
  totalAdmins: number;
  totalCourses: number;
  pendingCourseApprovals: number;
  totalExams: number;
  activeExamAttempts: number;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onNavigateTab,
  currentUser
}) => {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [activeAttemptsList, setActiveAttemptsList] = useState<any[]>([]);
  const [recentViolations, setRecentViolations] = useState<any[]>([]);
  const [pendingCoursesList, setPendingCoursesList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>(new Date().toLocaleTimeString());

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [statsRes, overviewRes, pendingRes] = await Promise.allSettled([
        axios.get('http://localhost:5000/api/admin/platform-stats', { headers }),
        axios.get('http://localhost:5000/api/dashboard/admin-overview', { headers }),
        axios.get('http://localhost:5000/api/admin/courses/pending', { headers })
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value.data.success) {
        setStats(statsRes.value.data.stats);
      }

      if (overviewRes.status === 'fulfilled' && overviewRes.value.data) {
        setActiveAttemptsList(overviewRes.value.data.activeAttempts || []);
        setRecentViolations(overviewRes.value.data.recentViolations || []);
      }

      if (pendingRes.status === 'fulfilled' && pendingRes.value.data.success) {
        setPendingCoursesList(pendingRes.value.data.courses || []);
      }

      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error('Failed to load admin dashboard data:', err);
      setError('Failed to fetch platform metrics. Please check network connectivity.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
          paddingBottom: '20px',
          borderBottom: '1px solid #e2e8f0'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              System Administration & Platform Command
            </h1>
            <Badge text="Administrator" type="info" />
          </div>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '6px 0 0 0' }}>
            Welcome back, {currentUser?.name || 'Platform Administrator'}. Real-time academic infrastructure metrics, candidate monitoring, and administrative governance.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Last sync: {lastRefreshed}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchDashboardData}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Metrics
          </Button>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#b91c1c',
            marginBottom: '20px',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {/* Primary Platform Statistics Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '16px',
          marginBottom: '28px'
        }}
      >
        {/* Total Users */}
        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Total Users</span>
            <div style={{ background: '#eff6ff', padding: '6px', borderRadius: '6px', color: '#2563eb' }}>
              <Users size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
            {stats ? stats.totalUsers.toLocaleString() : '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
            Active platform accounts
          </div>
        </Card>

        {/* Total Students */}
        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Total Students</span>
            <div style={{ background: '#f0fdf4', padding: '6px', borderRadius: '6px', color: '#15803d' }}>
              <GraduationCap size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
            {stats ? stats.totalStudents.toLocaleString() : '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
            Exam candidates enrolled
          </div>
        </Card>

        {/* Total Instructors */}
        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Total Instructors</span>
            <div style={{ background: '#faf5ff', padding: '6px', borderRadius: '6px', color: '#9333ea' }}>
              <Briefcase size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
            {stats ? stats.totalInstructors.toLocaleString() : '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
            Faculty & content creators
          </div>
        </Card>

        {/* Total Courses */}
        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Total Courses</span>
            <div style={{ background: '#fffbeb', padding: '6px', borderRadius: '6px', color: '#b45309' }}>
              <BookOpen size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
            {stats ? stats.totalCourses.toLocaleString() : '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
            Curriculum modules & courses
          </div>
        </Card>

        {/* Pending Approvals */}
        <Card style={{ padding: '16px', border: stats && stats.pendingCourseApprovals > 0 ? '1px solid #fde68a' : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Pending Approvals</span>
            <div style={{ background: stats && stats.pendingCourseApprovals > 0 ? '#fffbeb' : '#f1f5f9', padding: '6px', borderRadius: '6px', color: stats && stats.pendingCourseApprovals > 0 ? '#b45309' : '#64748b' }}>
              <FileCheck size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: stats && stats.pendingCourseApprovals > 0 ? '#b45309' : '#0f172a' }}>
            {stats ? stats.pendingCourseApprovals : '0'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
            Awaiting admin moderation
          </div>
        </Card>

        {/* Total Exams */}
        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Total Exams</span>
            <div style={{ background: '#eef2ff', padding: '6px', borderRadius: '6px', color: '#4f46e5' }}>
              <Award size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
            {stats ? stats.totalExams.toLocaleString() : '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
            Model tests & assessments
          </div>
        </Card>

        {/* Active Exam Attempts */}
        <Card style={{ padding: '16px', border: stats && stats.activeExamAttempts > 0 ? '1px solid #86efac' : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Active Attempts</span>
            <div style={{ background: '#f0fdf4', padding: '6px', borderRadius: '6px', color: '#15803d' }}>
              <Activity size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: stats && stats.activeExamAttempts > 0 ? '#15803d' : '#0f172a' }}>
            {stats ? stats.activeExamAttempts.toLocaleString() : '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
            In-progress timed tests
          </div>
        </Card>
      </div>

      {/* Administrative Governance Quick Navigation Section */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={18} color="#38bdf8" /> Admin Governance & Operations
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {/* Quick Action: Live Exam Monitor */}
          <div
            onClick={() => onNavigateTab('admin', 'LIVE_MONITOR')}
            style={{
              padding: '16px',
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#38bdf8';
              e.currentTarget.style.background = 'rgba(56, 189, 248, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.background = '#ffffff';
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{ background: '#eff6ff', padding: '6px', borderRadius: '6px', color: '#2563eb' }}>
                  <Activity size={18} />
                </div>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>Live Exam Monitor</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                Track concurrent examinees, view tab-switching/integrity alerts, and extend candidate timers in real time.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#2563eb', fontSize: '0.8rem', fontWeight: 600, marginTop: '12px' }}>
              Launch Monitor <ArrowRight size={13} />
            </div>
          </div>

          {/* Quick Action: Grade Override */}
          <div
            onClick={() => onNavigateTab('admin', 'GRADE_OVERRIDE')}
            style={{
              padding: '16px',
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#a855f7';
              e.currentTarget.style.background = 'rgba(168, 85, 247, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.background = '#ffffff';
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{ background: '#faf5ff', padding: '6px', borderRadius: '6px', color: '#9333ea' }}>
                  <Award size={18} />
                </div>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>Grade Override</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                Review finalized exam scores, perform authorized grade corrections with audit reasons, and inspect history.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#9333ea', fontSize: '0.8rem', fontWeight: 600, marginTop: '12px' }}>
              Manage Overrides <ArrowRight size={13} />
            </div>
          </div>

          {/* Quick Action: Course Moderation */}
          <div
            onClick={() => onNavigateTab('admin', 'COURSE_MODERATION')}
            style={{
              padding: '16px',
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#eab308';
              e.currentTarget.style.background = 'rgba(234, 179, 8, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.background = '#ffffff';
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{ background: '#fffbeb', padding: '6px', borderRadius: '6px', color: '#b45309' }}>
                  <FileCheck size={18} />
                </div>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>Course Moderation</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                Inspect instructor syllabus submissions, preview multimedia resources, and approve or reject courses.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#b45309', fontSize: '0.8rem', fontWeight: 600, marginTop: '12px' }}>
              Moderate Courses <ArrowRight size={13} />
            </div>
          </div>

          {/* Quick Action: User & Role Management */}
          <div
            onClick={() => onNavigateTab('admin', 'USERS')}
            style={{
              padding: '16px',
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#10b981';
              e.currentTarget.style.background = 'rgba(16, 185, 129, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.background = '#ffffff';
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{ background: '#f0fdf4', padding: '6px', borderRadius: '6px', color: '#15803d' }}>
                  <Users size={18} />
                </div>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>User & Role Management</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                Search candidates and faculty, assign or revoke Student/Instructor/Admin privileges, and toggle active status.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#15803d', fontSize: '0.8rem', fontWeight: 600, marginTop: '12px' }}>
              Manage Users <ArrowRight size={13} />
            </div>
          </div>

          {/* Quick Action: Audit Logs */}
          <div
            onClick={() => onNavigateTab('admin', 'AUDIT_LOGS')}
            style={{
              padding: '16px',
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#f97316';
              e.currentTarget.style.background = 'rgba(249, 115, 22, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.background = '#ffffff';
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{ background: '#fff7ed', padding: '6px', borderRadius: '6px', color: '#ea580c' }}>
                  <History size={18} />
                </div>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>Audit Logs</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                Access the immutable, chronological audit trail recording administrative permissions, overrides, and security events.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ea580c', fontSize: '0.8rem', fontWeight: 600, marginTop: '12px' }}>
              View Audit Trail <ArrowRight size={13} />
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Active Exam Monitoring & Pending Courses Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* Left Column: Live Active Attempts Preview */}
        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="#15803d" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Live In-Progress Attempts ({activeAttemptsList.length})
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('admin', 'LIVE_MONITOR')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#2563eb',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              Open Full Monitor <ChevronRight size={14} />
            </button>
          </div>

          {activeAttemptsList.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
              No active candidates currently taking timed exams.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activeAttemptsList.slice(0, 5).map((att) => (
                <div
                  key={att.id}
                  style={{
                    padding: '12px',
                    borderRadius: '6px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1e293b' }}>
                      {att.user_name || 'Examinee'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {att.exam_title || 'Timed Exam'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: '#f0fdf4',
                        color: '#15803d',
                        fontSize: '0.72rem',
                        fontWeight: 600
                      }}
                    >
                      IN PROGRESS
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Right Column: Pending Course Approvals */}
        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileCheck size={18} color="#facc15" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Course Moderation Queue ({pendingCoursesList.length})
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('admin', 'COURSE_MODERATION')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#b45309',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              Review All <ChevronRight size={14} />
            </button>
          </div>

          {pendingCoursesList.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
              <CheckCircle2 size={24} color="#10b981" style={{ margin: '0 auto 8px auto', display: 'block' }} />
              All course submissions have been reviewed and approved.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pendingCoursesList.slice(0, 5).map((course) => (
                <div
                  key={course.id}
                  style={{
                    padding: '12px',
                    borderRadius: '6px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1e293b' }}>
                      {course.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      By {course.instructor_name || 'Instructor'} • {course.module_count || 0} modules
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigateTab('admin', 'COURSE_MODERATION')}
                  >
                    Moderate
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
