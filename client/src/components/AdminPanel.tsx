import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  ShieldCheck,
  FileCheck,
  AlertTriangle,
  History,
  Activity,
  UserCheck,
  UserX,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BookOpen,
  Check,
  Eye,
  FileText,
  Video,
  Layers,
  Calendar,
  User as UserIcon,
  X,
  Award,
  Clock
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Badge } from '../design-system';

interface AdminPanelProps {
  onBack: () => void;
  initialTab?: 'USERS' | 'LIVE_MONITOR' | 'AUDIT_LOGS' | 'COURSE_MODERATION' | 'GRADE_OVERRIDE';
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
  is_active: number;
  target_exam?: string;
  target_date?: string;
  created_at: string;
  updated_at: string;
}

interface AuditLog {
  id: string;
  actor_id: string;
  actor_role: string;
  action: string;
  resource: string;
  resource_id?: string;
  details?: any;
  created_at: string;
  actor_name?: string;
  actor_email?: string;
}

interface PendingCourse {
  id: string;
  category_id: string;
  category_name?: string;
  category_name_bangla?: string;
  title: string;
  title_bangla?: string;
  slug: string;
  description?: string;
  cover_image_url?: string;
  instructor_id: string;
  instructor_name?: string;
  instructor_email?: string;
  status: 'PENDING_REVIEW' | 'DRAFT' | 'REJECTED' | 'PUBLISHED';
  rejection_reason?: string;
  module_count: number;
  lesson_count: number;
  resource_count: number;
  created_at: string;
  updated_at: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBack, initialTab }) => {
  const { user: currentAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'USERS' | 'LIVE_MONITOR' | 'AUDIT_LOGS' | 'COURSE_MODERATION' | 'GRADE_OVERRIDE'>(initialTab || 'LIVE_MONITOR');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Live Exam Monitor State (Preserved)
  const [violations, setViolations] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [performanceAnalytics, setPerformanceAnalytics] = useState<{
    totalGradedResults: number;
    totalCandidates: number;
    averageScore: number;
    scoreUnit: string;
    averageAccuracy: number;
    accuracyUnit: string;
    minScore: number;
    maxScore: number;
    passRatePercentage: number;
  } | null>(null);

  // Time Extension Modal State (For active attempts in Live Monitor)
  const [timeExtensionModalAttempt, setTimeExtensionModalAttempt] = useState<any | null>(null);
  const [extensionMinutes, setExtensionMinutes] = useState<number>(15);
  const [extensionReason, setExtensionReason] = useState<string>('');
  const [extensionLoading, setExtensionLoading] = useState<boolean>(false);
  const [extensionError, setExtensionError] = useState<string | null>(null);
  const [extensionSuccess, setExtensionSuccess] = useState<string | null>(null);

  // Grade Override State & Filter
  const [gradeOverrideAttempts, setGradeOverrideAttempts] = useState<any[]>([]);
  const [gradeOverrideLoading, setGradeOverrideLoading] = useState<boolean>(false);
  const [gradeOverrideError, setGradeOverrideError] = useState<string | null>(null);
  const [gradeOverrideSuccess, setGradeOverrideSuccess] = useState<string | null>(null);
  const [gradeOverrideSearch, setGradeOverrideSearch] = useState<string>('');
  const [gradeOverridePage, setGradeOverridePage] = useState<number>(1);
  const [gradeOverrideTotalPages, setGradeOverrideTotalPages] = useState<number>(1);
  const [gradeOverrideTotal, setGradeOverrideTotal] = useState<number>(0);

  // Grade Override Modal State
  const [selectedAttemptForOverride, setSelectedAttemptForOverride] = useState<any | null>(null);
  const [overrideScoreInput, setOverrideScoreInput] = useState<string>('');
  const [overrideReasonInput, setOverrideReasonInput] = useState<string>('');
  const [overrideSubmitting, setOverrideSubmitting] = useState<boolean>(false);
  const [overrideModalError, setOverrideModalError] = useState<string | null>(null);

  // User Management State
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState<boolean>(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersSuccess, setUsersSuccess] = useState<string | null>(null);

  // User Filter & Pagination State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const pageSize = 15;

  // Modals & Action State for Users
  const [statusConfirmUser, setStatusConfirmUser] = useState<AdminUser | null>(null);
  const [roleModalUser, setRoleModalUser] = useState<AdminUser | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<'STUDENT' | 'INSTRUCTOR' | 'ADMIN'>('STUDENT');
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditTotalPages, setAuditTotalPages] = useState<number>(1);
  const [auditTotal, setAuditTotal] = useState<number>(0);
  const auditPageSize = 20;

  // Course Moderation State (Milestone 3 Step 2B)
  const [pendingCourses, setPendingCourses] = useState<PendingCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState<boolean>(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [coursesSuccess, setCoursesSuccess] = useState<string | null>(null);

  // Course Moderation Modals State
  const [approveConfirmCourse, setApproveConfirmCourse] = useState<PendingCourse | null>(null);
  const [rejectModalCourse, setRejectModalCourse] = useState<PendingCourse | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [previewCourse, setPreviewCourse] = useState<PendingCourse | null>(null);
  const [curriculumData, setCurriculumData] = useState<any | null>(null);
  const [curriculumLoading, setCurriculumLoading] = useState<boolean>(false);

  // Debounce search query input (350ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset page on search change
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Reset page when dropdown filters change
  const handleRoleFilterChange = (role: string) => {
    setSelectedRole(role);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (status: string) => {
    setSelectedStatus(status);
    setCurrentPage(1);
  };

  // 1. Polling for Live Exam Monitor
  useEffect(() => {
    let isMounted = true;
    async function fetchLiveMonitorData() {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('http://localhost:5000/api/dashboard/admin-overview', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (isMounted) {
          setViolations(res.data.recentViolations || []);
          setAttempts(res.data.activeAttempts || []);
          if (res.data.performanceAnalytics) {
            setPerformanceAnalytics(res.data.performanceAnalytics);
          }
        }
      } catch (err: any) {
        console.error('Failed to poll admin overview:', err);
      }
    }

    fetchLiveMonitorData();
    const interval = setInterval(fetchLiveMonitorData, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // 2. Fetch Users (Server-side search, filter, and pagination)
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const token = localStorage.getItem('token');
      const params: any = {
        page: currentPage,
        limit: pageSize
      };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (selectedRole) params.role = selectedRole;
      if (selectedStatus) params.status = selectedStatus;

      const res = await axios.get('http://localhost:5000/api/admin/users', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        params
      });

      if (res.data.success) {
        setUsers(res.data.data || []);
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.totalPages || 1);
          setTotalUsers(res.data.pagination.total || 0);
        }
      } else {
        setUsersError(res.data.error || 'Failed to fetch user list.');
      }
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setUsersError(err.response?.data?.error || 'Authorization failed. Please refresh your session.');
      } else {
        setUsersError(err.response?.data?.error || 'Unable to connect to user management service.');
      }
    } finally {
      setUsersLoading(false);
    }
  }, [currentPage, debouncedSearch, selectedRole, selectedStatus]);

  useEffect(() => {
    if (activeTab === 'USERS') {
      fetchUsers();
    }
  }, [activeTab, fetchUsers]);

  // 3. Fetch Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/admin/audit-logs', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        params: {
          page: auditPage,
          limit: auditPageSize
        }
      });

      if (res.data.success) {
        setAuditLogs(res.data.data || []);
        if (res.data.pagination) {
          setAuditTotalPages(res.data.pagination.totalPages || 1);
          setAuditTotal(res.data.pagination.total || 0);
        }
      } else {
        setAuditError(res.data.error || 'Failed to fetch audit records.');
      }
    } catch (err: any) {
      setAuditError(err.response?.data?.error || 'Unable to load tamper-proof audit trail.');
    } finally {
      setAuditLoading(false);
    }
  }, [auditPage]);

  // Fetch Graded Attempts for Grade Override
  const fetchGradeOverrideAttempts = useCallback(async () => {
    setGradeOverrideLoading(true);
    setGradeOverrideError(null);
    try {
      const token = localStorage.getItem('token');
      const params: any = {
        page: gradeOverridePage,
        limit: 15
      };
      if (gradeOverrideSearch.trim()) {
        params.search = gradeOverrideSearch.trim();
      }

      const res = await axios.get('http://localhost:5000/api/admin/grade-override/attempts', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        params
      });

      if (res.data.success) {
        setGradeOverrideAttempts(res.data.data || []);
        if (res.data.pagination) {
          setGradeOverrideTotalPages(res.data.pagination.totalPages || 1);
          setGradeOverrideTotal(res.data.pagination.total || 0);
        }
      } else {
        setGradeOverrideError(res.data.error || 'Failed to fetch graded attempts.');
      }
    } catch (err: any) {
      setGradeOverrideError(err.response?.data?.error || 'Unable to connect to exam results service.');
    } finally {
      setGradeOverrideLoading(false);
    }
  }, [gradeOverridePage, gradeOverrideSearch]);

  useEffect(() => {
    if (activeTab === 'GRADE_OVERRIDE') {
      fetchGradeOverrideAttempts();
    }
  }, [activeTab, fetchGradeOverrideAttempts]);

  // Execute Grade Override
  const handleExecuteGradeOverride = async () => {
    if (!selectedAttemptForOverride) return;

    const numScore = parseFloat(overrideScoreInput);
    if (isNaN(numScore) || !isFinite(numScore)) {
      setOverrideModalError('Please enter a valid finite number for corrected score.');
      return;
    }

    if (numScore < 0 || numScore > Number(selectedAttemptForOverride.total_marks)) {
      setOverrideModalError(`Score must be between 0 and maximum total marks (${selectedAttemptForOverride.total_marks}).`);
      return;
    }

    if (!overrideReasonInput || overrideReasonInput.trim().length < 5) {
      setOverrideModalError('A mandatory justification reason (min 5 characters) is required.');
      return;
    }

    setOverrideSubmitting(true);
    setOverrideModalError(null);

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        'http://localhost:5000/api/admin/grade-override',
        {
          attemptId: selectedAttemptForOverride.attempt_id,
          correctedScore: numScore,
          reason: overrideReasonInput.trim()
        },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );

      if (res.data.success) {
        setGradeOverrideSuccess(`Grade override successfully applied for ${selectedAttemptForOverride.student_name}.`);
        setSelectedAttemptForOverride(null);
        setOverrideScoreInput('');
        setOverrideReasonInput('');
        fetchGradeOverrideAttempts();
      } else {
        setOverrideModalError(res.data.error || 'Failed to apply grade override.');
      }
    } catch (err: any) {
      setOverrideModalError(err.response?.data?.error || 'Server error while applying grade override.');
    } finally {
      setOverrideSubmitting(false);
    }
  };

  // Execute Exam Time Extension
  const handleExecuteTimeExtension = async () => {
    if (!timeExtensionModalAttempt) return;

    if (!extensionMinutes || extensionMinutes < 1 || extensionMinutes > 180) {
      setExtensionError('Extension time must be between 1 and 180 minutes.');
      return;
    }

    if (!extensionReason || extensionReason.trim().length < 5) {
      setExtensionError('A mandatory justification reason (min 5 characters) is required.');
      return;
    }

    setExtensionLoading(true);
    setExtensionError(null);

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        'http://localhost:5000/api/admin/time-extension',
        {
          attemptId: timeExtensionModalAttempt.id,
          additionalMinutes: Number(extensionMinutes),
          reason: extensionReason.trim()
        },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );

      if (res.data.success) {
        setExtensionSuccess(res.data.message || 'Exam time successfully extended.');
        setTimeExtensionModalAttempt(null);
        setExtensionMinutes(15);
        setExtensionReason('');
      } else {
        setExtensionError(res.data.error || 'Failed to extend time.');
      }
    } catch (err: any) {
      setExtensionError(err.response?.data?.error || 'Server error while extending exam time.');
    } finally {
      setExtensionLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'AUDIT_LOGS') {
      fetchAuditLogs();
    }
  }, [activeTab, fetchAuditLogs]);

  // 4. Fetch Pending Courses for Moderation (Milestone 3 Step 2B)
  const fetchPendingCourses = useCallback(async () => {
    setCoursesLoading(true);
    setCoursesError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/admin/courses/pending', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (res.data.success) {
        setPendingCourses(res.data.courses || []);
      } else {
        setCoursesError(res.data.error || 'Failed to retrieve pending courses.');
      }
    } catch (err: any) {
      setCoursesError(err.response?.data?.error || 'Unable to connect to course moderation service.');
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'COURSE_MODERATION') {
      fetchPendingCourses();
    }
  }, [activeTab, fetchPendingCourses]);

  // Fetch full curriculum for Preview modal
  const handleOpenPreview = async (course: PendingCourse) => {
    setPreviewCourse(course);
    setCurriculumLoading(true);
    setCurriculumData(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:5000/api/courses/${course.id}/curriculum`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data.success) {
        setCurriculumData(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load course preview curriculum:', err);
    } finally {
      setCurriculumLoading(false);
    }
  };

  // Action: Approve Course
  const handleApproveCourse = async () => {
    if (!approveConfirmCourse) return;
    setActionInProgress(true);
    setModalError(null);

    try {
      const token = localStorage.getItem('token');
      const res = await axios.patch(
        `http://localhost:5000/api/admin/courses/${approveConfirmCourse.id}/approve`,
        {},
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      if (res.data.success) {
        setCoursesSuccess(`Course '${approveConfirmCourse.title}' approved and published successfully.`);
        setTimeout(() => setCoursesSuccess(null), 5000);
        setApproveConfirmCourse(null);
        await fetchPendingCourses();
      } else {
        setModalError(res.data.error || 'Failed to approve course.');
      }
    } catch (err: any) {
      setModalError(err.response?.data?.error || 'Server rejected course approval.');
    } finally {
      setActionInProgress(false);
    }
  };

  // Action: Reject Course
  const handleRejectCourse = async () => {
    if (!rejectModalCourse) return;
    if (!rejectionReason.trim() || rejectionReason.trim().length < 5) {
      setModalError('Rejection reason must be at least 5 characters.');
      return;
    }

    setActionInProgress(true);
    setModalError(null);

    try {
      const token = localStorage.getItem('token');
      const res = await axios.patch(
        `http://localhost:5000/api/admin/courses/${rejectModalCourse.id}/reject`,
        { reason: rejectionReason.trim() },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      if (res.data.success) {
        setCoursesSuccess(`Course '${rejectModalCourse.title}' rejected. Feedback reason recorded.`);
        setTimeout(() => setCoursesSuccess(null), 5000);
        setRejectModalCourse(null);
        setRejectionReason('');
        await fetchPendingCourses();
      } else {
        setModalError(res.data.error || 'Failed to reject course.');
      }
    } catch (err: any) {
      setModalError(err.response?.data?.error || 'Server rejected course rejection.');
    } finally {
      setActionInProgress(false);
    }
  };

  // Action: Toggle Account Status (Suspend / Reactivate)
  const handleToggleStatus = async () => {
    if (!statusConfirmUser) return;
    setActionInProgress(true);
    setModalError(null);

    const newActiveState = statusConfirmUser.is_active === 1 ? false : true;

    try {
      const token = localStorage.getItem('token');
      const res = await axios.patch(
        `http://localhost:5000/api/admin/users/${statusConfirmUser.id}/status`,
        { isActive: newActiveState },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      if (res.data.success) {
        setUsersSuccess(
          newActiveState
            ? `Account '${statusConfirmUser.name}' activated successfully.`
            : `Account '${statusConfirmUser.name}' suspended. Active sessions revoked.`
        );
        setTimeout(() => setUsersSuccess(null), 5000);
        setStatusConfirmUser(null);
        await fetchUsers();
      } else {
        setModalError(res.data.error || 'Failed to update account status.');
      }
    } catch (err: any) {
      setModalError(err.response?.data?.error || 'Server rejected status update.');
    } finally {
      setActionInProgress(false);
    }
  };

  // Action: Change User Role
  const handleChangeRole = async () => {
    if (!roleModalUser) return;
    setActionInProgress(true);
    setModalError(null);

    try {
      const token = localStorage.getItem('token');
      const res = await axios.patch(
        `http://localhost:5000/api/admin/users/${roleModalUser.id}/role`,
        { role: selectedNewRole },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      if (res.data.success) {
        setUsersSuccess(`User '${roleModalUser.name}' role updated to ${selectedNewRole}.`);
        setTimeout(() => setUsersSuccess(null), 5000);
        setRoleModalUser(null);
        await fetchUsers();
      } else {
        setModalError(res.data.error || 'Failed to change user role.');
      }
    } catch (err: any) {
      setModalError(err.response?.data?.error || 'Server rejected role update.');
    } finally {
      setActionInProgress(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', padding: '2rem' }}>
      <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <span style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>
              Administration & Governance
            </span>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Admin Operations & Moderation Center</h1>
          </div>
          <button
            onClick={onBack}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#1e293b',
              padding: '0.6rem 1.25rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Global Feedback Banners */}
        {usersSuccess && (
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '1.5rem',
              color: '#15803d',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <CheckCircle2 style={{ width: '18px', height: '18px', flexShrink: 0 }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{usersSuccess}</span>
          </div>
        )}

        {coursesSuccess && (
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '1.5rem',
              color: '#15803d',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <CheckCircle2 style={{ width: '18px', height: '18px', flexShrink: 0 }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{coursesSuccess}</span>
          </div>
        )}

        {gradeOverrideSuccess && (
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '1.5rem',
              color: '#15803d',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <CheckCircle2 style={{ width: '18px', height: '18px', flexShrink: 0 }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{gradeOverrideSuccess}</span>
          </div>
        )}

        {extensionSuccess && (
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '1.5rem',
              color: '#15803d',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <CheckCircle2 style={{ width: '18px', height: '18px', flexShrink: 0 }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{extensionSuccess}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            borderBottom: '1px solid #e2e8f0',
            marginBottom: '2rem',
            overflowX: 'auto'
          }}
        >
          {[
            { id: 'LIVE_MONITOR', label: 'Live Exam Monitor', icon: Activity },
            { id: 'GRADE_OVERRIDE', label: 'Grade Override', icon: Award },
            { id: 'COURSE_MODERATION', label: 'Course Moderation', icon: BookOpen },
            { id: 'USERS', label: 'User & Role Management', icon: Users },
            { id: 'AUDIT_LOGS', label: 'Tamper-Proof Audit Logs', icon: History }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setUsersError(null);
                  setUsersSuccess(null);
                  setCoursesError(null);
                  setCoursesSuccess(null);
                  setGradeOverrideError(null);
                  setGradeOverrideSuccess(null);
                  setExtensionError(null);
                  setExtensionSuccess(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.25rem',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #38bdf8' : '2px solid transparent',
                  color: isActive ? '#38bdf8' : '#94a3b8',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'color 0.15s ease'
                }}
              >
                <Icon style={{ width: '1.1rem', height: '1.1rem' }} /> {tab.label}
                {tab.id === 'COURSE_MODERATION' && pendingCourses.length > 0 && (
                  <span
                    style={{
                      background: '#38bdf8',
                      color: '#090d16',
                      borderRadius: '999px',
                      padding: '1px 7px',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      marginLeft: '4px'
                    }}
                  >
                    {pendingCourses.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* Tab 1: Live Exam Monitor (Strictly Preserved)                              */}
        {/* ========================================================================= */}
        {activeTab === 'LIVE_MONITOR' && (
          <div>
            {/* Platform-Wide Academic Analytics Overview */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '1.75rem'
              }}
            >
              <div
                className="glass-panel"
                style={{
                  padding: '1.25rem',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)'
                }}
              >
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Platform Average Score
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '0.35rem' }}>
                  <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38bdf8' }}>
                    {performanceAnalytics ? performanceAnalytics.averageScore : '—'}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                    {performanceAnalytics?.scoreUnit || 'marks'}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
                  {performanceAnalytics && performanceAnalytics.totalGradedResults > 0
                    ? `From ${performanceAnalytics.totalGradedResults} graded exam results`
                    : 'No graded exam submissions yet'}
                </div>
              </div>

              <div
                className="glass-panel"
                style={{
                  padding: '1.25rem',
                  border: '1px solid #86efac',
                  background: '#f0fdf4'
                }}
              >
                <div style={{ color: '#475569', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Platform Pass Rate
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '0.35rem' }}>
                  <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#15803d' }}>
                    {performanceAnalytics ? `${performanceAnalytics.passRatePercentage}%` : '—'}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
                  Across all eligible exam attempts
                </div>
              </div>

              <div
                className="glass-panel"
                style={{
                  padding: '1.25rem',
                  border: '1px solid #e9d5ff',
                  background: '#faf5ff'
                }}
              >
                <div style={{ color: '#475569', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Average Accuracy
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '0.35rem' }}>
                  <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#6b21a8' }}>
                    {performanceAnalytics ? `${performanceAnalytics.averageAccuracy}%` : '—'}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
                  Correct answers / attempted questions
                </div>
              </div>

              <div
                className="glass-panel"
                style={{
                  padding: '1.25rem',
                  border: '1px solid #fde68a',
                  background: '#fffbeb'
                }}
              >
                <div style={{ color: '#475569', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Candidates Evaluated
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '0.35rem' }}>
                  <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#b45309' }}>
                    {performanceAnalytics ? performanceAnalytics.totalCandidates : 0}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>students</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
                  Distinct examinees with graded results
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#0f172a' }}>
                  Active Exam Attempts (Real-Time)
                </h3>
                {attempts.length === 0 ? (
                  <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No active attempts currently running.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {attempts.map((att: any) => (
                      <div
                        key={att.id}
                        style={{
                          background: '#ffffff',
                          padding: '1rem',
                          borderRadius: '0.5rem',
                          border: '1px solid #cbd5e1',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {att.user_name} ({att.user_email})
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Exam: {att.exam_title}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                            Expires: {att.expires_at ? new Date(att.expires_at).toLocaleTimeString() : 'N/A'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#10b981', fontSize: '0.78rem', fontWeight: 700 }}>● IN PROGRESS</span>
                          <button
                            onClick={() => {
                              setTimeExtensionModalAttempt(att);
                              setExtensionMinutes(15);
                              setExtensionReason('');
                              setExtensionError(null);
                            }}
                            style={{
                              background: 'rgba(56, 189, 248, 0.15)',
                              border: '1px solid rgba(56, 189, 248, 0.35)',
                              color: '#38bdf8',
                              padding: '5px 10px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 600
                            }}
                          >
                            <Clock style={{ width: '12px', height: '12px' }} />
                            Extend Time
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#ef4444' }}>
                  Append-Only Integrity Violations
                </h3>
                {violations.length === 0 ? (
                  <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No integrity violations recorded yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {violations.map((v: any) => {
                      const candidateDisplay = v.candidate_name || v.candidateName || 'Unknown';
                      const examDisplay = v.exam_title || v.examTitle || 'General Examination';
                      const formattedTime = v.occurred_at
                        ? new Date(v.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'N/A';
                      const detailsText = (() => {
                        if (!v.details) return 'Integrity violation detected.';
                        try {
                          const parsed = typeof v.details === 'string' ? JSON.parse(v.details) : v.details;
                          return parsed.reason || (typeof parsed === 'string' ? parsed : JSON.stringify(parsed));
                        } catch {
                          return v.details;
                        }
                      })();

                      return (
                        <div
                          key={v.id}
                          style={{
                            background: 'rgba(239,68,68,0.1)',
                            padding: '0.85rem 1rem',
                            borderRadius: '0.5rem',
                            border: '1px solid rgba(239,68,68,0.2)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                                Candidate: {candidateDisplay}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '1px' }}>
                                Exam: {examDisplay}
                              </div>
                            </div>
                            <span style={{ color: '#64748b', fontSize: '0.75rem', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                              Time: {formattedTime}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
                            <span style={{ color: '#b91c1c', fontWeight: 700, fontSize: '0.82rem' }}>
                              Violation: {v.violation_type}
                            </span>
                          </div>

                          <p style={{ color: '#334155', fontSize: '0.8rem', margin: 0 }}>
                            Details: {detailsText}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Tab: Grade Override (Administrative Academic Correction)                 */}
        {/* ========================================================================= */}
        {activeTab === 'GRADE_OVERRIDE' && (
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                  Administrative Grade Override
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '2px' }}>
                  Total graded candidate attempts: <strong>{gradeOverrideTotal}</strong>
                </p>
              </div>

              {/* Search & Refresh */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', width: '280px' }}>
                  <Search
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '16px',
                      height: '16px',
                      color: '#64748b'
                    }}
                  />
                  <input
                    type="text"
                    value={gradeOverrideSearch}
                    onChange={(e) => {
                      setGradeOverrideSearch(e.target.value);
                      setGradeOverridePage(1);
                    }}
                    placeholder="Search candidate name or exam..."
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 34px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      color: '#0f172a',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>

                <Button variant="secondary" size="sm" onClick={() => fetchGradeOverrideAttempts()}>
                  <RefreshCw style={{ width: '14px', height: '14px' }} /> Refresh
                </Button>
              </div>
            </div>

            {/* Error Message */}
            {gradeOverrideError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  padding: '12px',
                  borderRadius: '6px',
                  color: '#f87171',
                  marginBottom: '1rem',
                  fontSize: '0.9rem'
                }}
              >
                {gradeOverrideError}
              </div>
            )}

            {/* Graded Attempts Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                    <th style={{ padding: '0.75rem' }}>Candidate</th>
                    <th style={{ padding: '0.75rem' }}>Exam</th>
                    <th style={{ padding: '0.75rem' }}>Current Score</th>
                    <th style={{ padding: '0.75rem' }}>Original Score</th>
                    <th style={{ padding: '0.75rem' }}>Status</th>
                    <th style={{ padding: '0.75rem' }}>Graded Date</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {gradeOverrideLoading ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                        Loading graded attempts...
                      </td>
                    </tr>
                  ) : gradeOverrideAttempts.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                        No graded attempts found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    gradeOverrideAttempts.map((row: any) => {
                      const isOverridden = Boolean(row.is_overridden);
                      const originalDisplay = isOverridden && row.original_score !== null
                        ? Number(row.original_score).toFixed(2)
                        : '—';

                      return (
                        <tr
                          key={row.result_id}
                          style={{
                            borderBottom: '1px solid #e2e8f0',
                            transition: 'background 0.15s'
                          }}
                        >
                          <td style={{ padding: '0.75rem' }}>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.student_name}</div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{row.student_email}</div>
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            <div style={{ fontWeight: 500, color: '#334155' }}>{row.exam_title}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              Pass Marks: {row.pass_marks} | Total: {row.total_marks}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: row.is_passed ? '#15803d' : '#b91c1c' }}>
                              {Number(row.current_score).toFixed(2)} / {row.total_marks}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {row.accuracy_percentage}% Accuracy
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            {isOverridden ? (
                              <div>
                                <span style={{ color: '#b45309', fontWeight: 700 }}>{originalDisplay}</span>
                                <div style={{ fontSize: '0.72rem', color: '#92400e', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.override_reason}>
                                  Reason: {row.override_reason}
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: '#64748b' }}>Original</span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            {isOverridden ? (
                              <span
                                style={{
                                  background: '#fffbeb',
                                  border: '1px solid #fde68a',
                                  color: '#b45309',
                                  padding: '2px 8px',
                                  borderRadius: '999px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700
                                }}
                              >
                                OVERRIDDEN
                              </span>
                            ) : (
                              <span
                                style={{
                                  background: row.is_passed ? '#dcfce7' : '#fee2e2',
                                  border: `1px solid ${row.is_passed ? '#86efac' : '#fca5a5'}`,
                                  color: row.is_passed ? '#15803d' : '#b91c1c',
                                  padding: '2px 8px',
                                  borderRadius: '999px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700
                                }}
                              >
                                {row.is_passed ? 'PASSED' : 'FAILED'}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem', color: '#64748b', fontSize: '0.8rem' }}>
                            {row.graded_at ? new Date(row.graded_at).toLocaleDateString() : 'N/A'}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            <button
                              onClick={() => {
                                setSelectedAttemptForOverride(row);
                                setOverrideScoreInput(String(row.current_score));
                                setOverrideReasonInput(row.override_reason || '');
                                setOverrideModalError(null);
                              }}
                              style={{
                                background: 'rgba(56, 189, 248, 0.15)',
                                border: '1px solid rgba(56, 189, 248, 0.35)',
                                color: '#38bdf8',
                                padding: '5px 12px',
                                borderRadius: '4px',
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontWeight: 600
                              }}
                            >
                              <Edit2 style={{ width: '13px', height: '13px' }} />
                              Override Grade
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '1.5rem',
                paddingTop: '1rem',
                borderTop: '1px solid #e2e8f0'
              }}
            >
              <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                Page <strong>{gradeOverridePage}</strong> of <strong>{gradeOverrideTotalPages}</strong>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={gradeOverridePage <= 1 || gradeOverrideLoading}
                  onClick={() => setGradeOverridePage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft style={{ width: '14px', height: '14px' }} /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={gradeOverridePage >= gradeOverrideTotalPages || gradeOverrideLoading}
                  onClick={() => setGradeOverridePage((p) => Math.min(gradeOverrideTotalPages, p + 1))}
                >
                  Next <ChevronRight style={{ width: '14px', height: '14px' }} />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Tab 2: Course Moderation Tab (Milestone 3 Step 2B)                         */}
        {/* ========================================================================= */}
        {activeTab === 'COURSE_MODERATION' && (
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                  Courses Awaiting Administrative Review
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '2px' }}>
                  Pending submission queue: <strong>{pendingCourses.length}</strong> courses
                </p>
              </div>

              <Button variant="secondary" size="sm" onClick={() => fetchPendingCourses()}>
                <RefreshCw style={{ width: '14px', height: '14px' }} /> Refresh Queue
              </Button>
            </div>

            {/* Error Message */}
            {coursesError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  padding: '12px',
                  borderRadius: '6px',
                  color: '#f87171',
                  marginBottom: '1rem',
                  fontSize: '0.9rem'
                }}
              >
                {coursesError}
              </div>
            )}

            {/* Courses Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                    <th style={{ padding: '0.75rem' }}>Course Title & Category</th>
                    <th style={{ padding: '0.75rem' }}>Instructor</th>
                    <th style={{ padding: '0.75rem' }}>Syllabus Scale</th>
                    <th style={{ padding: '0.75rem' }}>Submitted At</th>
                    <th style={{ padding: '0.75rem' }}>Status</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {coursesLoading ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                        Loading pending courses from moderation engine...
                      </td>
                    </tr>
                  ) : pendingCourses.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                          <CheckCircle2 style={{ width: '36px', height: '36px', color: '#10b981' }} />
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>
                            All Caught Up! No Courses Awaiting Review
                          </div>
                          <p style={{ color: '#64748b', fontSize: '0.85rem', maxWidth: '420px' }}>
                            When faculty instructors submit new courses from their Course Builder, they will appear here
                            for quality evaluation and approval before becoming student-visible.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pendingCourses.map((c) => {
                      return (
                        <tr
                          key={c.id}
                          style={{
                            borderBottom: '1px solid #e2e8f0',
                            background: 'rgba(56, 189, 248, 0.02)'
                          }}
                        >
                          <td style={{ padding: '0.75rem' }}>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.title}</div>
                            {c.title_bangla && (
                              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{c.title_bangla}</div>
                            )}
                            <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '2px' }}>
                              Category: {c.category_name || 'General Banking'}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem', color: '#334155' }}>
                            <div style={{ fontWeight: 600 }}>{c.instructor_name || 'Assigned Instructor'}</div>
                            {c.instructor_email && (
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.instructor_email}</div>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem' }}>
                              <span
                                style={{
                                  background: '#ffffff',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  color: '#64748b'
                                }}
                              >
                                {c.module_count} Modules
                              </span>
                              <span
                                style={{
                                  background: '#ffffff',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  color: '#64748b'
                                }}
                              >
                                {c.lesson_count} Lessons
                              </span>
                              {c.resource_count > 0 && (
                                <span
                                  style={{
                                    background: 'rgba(56, 189, 248, 0.15)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    color: '#38bdf8'
                                  }}
                                >
                                  {c.resource_count} PDFs
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: '#64748b', fontFamily: 'monospace' }}>
                            {new Date(c.updated_at || c.created_at).toLocaleString()}
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                color: '#f59e0b',
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                background: 'rgba(245, 158, 11, 0.15)',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                padding: '2px 8px',
                                borderRadius: '4px'
                              }}
                            >
                              ● PENDING REVIEW
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              {/* Preview Syllabus Button */}
                              <button
                                onClick={() => handleOpenPreview(c)}
                                title="Inspect Course Syllabus"
                                style={{
                                  background: '#ffffff',
                                  border: '1px solid #cbd5e1',
                                  color: '#334155',
                                  padding: '5px 9px',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Eye style={{ width: '13px', height: '13px' }} />
                                Preview
                              </button>

                              {/* Approve Button */}
                              <button
                                onClick={() => {
                                  setApproveConfirmCourse(c);
                                  setModalError(null);
                                }}
                                title="Approve & Publish Course"
                                style={{
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  color: '#34d399',
                                  padding: '5px 9px',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontWeight: 600
                                }}
                              >
                                <Check style={{ width: '13px', height: '13px' }} />
                                Approve
                              </button>

                              {/* Reject Button */}
                              <button
                                onClick={() => {
                                  setRejectModalCourse(c);
                                  setRejectionReason('');
                                  setModalError(null);
                                }}
                                title="Reject Course with Feedback"
                                style={{
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  color: '#f87171',
                                  padding: '5px 9px',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontWeight: 600
                                }}
                              >
                                <X style={{ width: '13px', height: '13px' }} />
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Tab 3: User & Role Management (Integrated Backend APIs)                   */}
        {/* ========================================================================= */}
        {activeTab === 'USERS' && (
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                  Registered Users & Administrative Governance
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '2px' }}>
                  Total matching users: <strong>{totalUsers}</strong>
                </p>
              </div>

              {/* Controls Header */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Search Input with Debounce */}
                <div style={{ position: 'relative', width: '260px' }}>
                  <Search
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '16px',
                      height: '16px',
                      color: '#64748b'
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 34px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      color: '#0f172a',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>

                {/* Role Filter */}
                <select
                  value={selectedRole}
                  onChange={(e) => handleRoleFilterChange(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    color: '#0f172a',
                    fontSize: '0.85rem'
                  }}
                >
                  <option value="">All Roles</option>
                  <option value="STUDENT">Student</option>
                  <option value="INSTRUCTOR">Instructor</option>
                  <option value="ADMIN">Admin</option>
                </select>

                {/* Status Filter */}
                <select
                  value={selectedStatus}
                  onChange={(e) => handleStatusFilterChange(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    color: '#0f172a',
                    fontSize: '0.85rem'
                  }}
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="suspended">Suspended Only</option>
                </select>

                <Button variant="secondary" size="sm" onClick={() => fetchUsers()}>
                  <RefreshCw style={{ width: '14px', height: '14px' }} /> Refresh
                </Button>
              </div>
            </div>

            {/* Error Message */}
            {usersError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  padding: '12px',
                  borderRadius: '6px',
                  color: '#f87171',
                  marginBottom: '1rem',
                  fontSize: '0.9rem'
                }}
              >
                {usersError}
              </div>
            )}

            {/* Users Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                    <th style={{ padding: '0.75rem' }}>Name</th>
                    <th style={{ padding: '0.75rem' }}>Email / Phone</th>
                    <th style={{ padding: '0.75rem' }}>Role</th>
                    <th style={{ padding: '0.75rem' }}>Target Bank Exam</th>
                    <th style={{ padding: '0.75rem' }}>Status</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersLoading ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                        Loading users from database...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                        No users found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const isSelf = currentAdmin?.id === u.id;
                      const isActive = u.is_active === 1;

                      return (
                        <tr
                          key={u.id}
                          style={{
                            borderBottom: '1px solid #e2e8f0',
                            background: !isActive ? 'rgba(239, 68, 68, 0.03)' : 'transparent'
                          }}
                        >
                          <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{u.name}</span>
                              {isSelf && (
                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    background: '#38bdf8',
                                    color: '#090d16',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontWeight: 700
                                  }}
                                >
                                  YOU
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem', color: '#64748b' }}>
                            <div>{u.email}</div>
                            {u.phone && (
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.phone}</div>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            <span
                              style={{
                                padding: '0.2rem 0.5rem',
                                borderRadius: '0.3rem',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background:
                                  u.role === 'ADMIN'
                                    ? 'rgba(168,85,247,0.2)'
                                    : u.role === 'INSTRUCTOR'
                                    ? 'rgba(59,130,246,0.2)'
                                    : 'rgba(16,185,129,0.2)',
                                color:
                                  u.role === 'ADMIN'
                                    ? '#c084fc'
                                    : u.role === 'INSTRUCTOR'
                                    ? '#60a5fa'
                                    : '#34d399'
                              }}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem', color: '#334155' }}>
                            {u.target_exam || 'General Prep'}
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            {isActive ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  color: '#10b981',
                                  fontWeight: 600,
                                  fontSize: '0.8rem'
                                }}
                              >
                                ● Active
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  color: '#ef4444',
                                  fontWeight: 600,
                                  fontSize: '0.8rem'
                                }}
                              >
                                ✕ Suspended
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              {/* Change Role Button */}
                              <button
                                onClick={() => {
                                  setRoleModalUser(u);
                                  setSelectedNewRole(u.role);
                                  setModalError(null);
                                }}
                                disabled={isSelf}
                                title={isSelf ? 'Cannot modify your own administrator role' : 'Change Role'}
                                style={{
                                  background: isSelf ? '#1e293b' : '#334155',
                                  border: '1px solid #cbd5e1',
                                  color: isSelf ? '#64748b' : '#f8fafc',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  cursor: isSelf ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Edit2 style={{ width: '12px', height: '12px' }} />
                                Role
                              </button>

                              {/* Suspend / Activate Button */}
                              {isActive ? (
                                <button
                                  onClick={() => {
                                    setStatusConfirmUser(u);
                                    setModalError(null);
                                  }}
                                  disabled={isSelf}
                                  title={isSelf ? 'Cannot suspend your own account' : 'Suspend Account'}
                                  style={{
                                    background: isSelf ? '#1e293b' : 'rgba(239,68,68,0.15)',
                                    border: isSelf ? '1px solid #334155' : '1px solid rgba(239,68,68,0.3)',
                                    color: isSelf ? '#64748b' : '#f87171',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    cursor: isSelf ? 'not-allowed' : 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <UserX style={{ width: '12px', height: '12px' }} />
                                  Suspend
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setStatusConfirmUser(u);
                                    setModalError(null);
                                  }}
                                  style={{
                                    background: 'rgba(16,185,129,0.15)',
                                    border: '1px solid rgba(16,185,129,0.3)',
                                    color: '#34d399',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <UserCheck style={{ width: '12px', height: '12px' }} />
                                  Activate
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '1.5rem',
                paddingTop: '1rem',
                borderTop: '1px solid #e2e8f0'
              }}
            >
              <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1 || usersLoading}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft style={{ width: '14px', height: '14px' }} /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages || usersLoading}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next <ChevronRight style={{ width: '14px', height: '14px' }} />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Tab 4: Tamper-Proof Audit Trail (Real Backend Integration)                */}
        {/* ========================================================================= */}
        {activeTab === 'AUDIT_LOGS' && (
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem'
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#38bdf8' }}>
                  Tamper-Proof Audit Trail (SQLite Persistent Log)
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '2px' }}>
                  Total audit events logged: <strong>{auditTotal}</strong>
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => fetchAuditLogs()}>
                <RefreshCw style={{ width: '14px', height: '14px' }} /> Refresh Trail
              </Button>
            </div>

            {/* Error Message */}
            {auditError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  padding: '12px',
                  borderRadius: '6px',
                  color: '#f87171',
                  marginBottom: '1rem',
                  fontSize: '0.9rem'
                }}
              >
                {auditError}
              </div>
            )}

            {/* Audit Logs Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                    <th style={{ padding: '0.75rem' }}>Timestamp (UTC)</th>
                    <th style={{ padding: '0.75rem' }}>Action</th>
                    <th style={{ padding: '0.75rem' }}>Actor</th>
                    <th style={{ padding: '0.75rem' }}>Target Resource</th>
                    <th style={{ padding: '0.75rem' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLoading ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                        Loading audit trail records...
                      </td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                        No audit events recorded yet. Administrative mutations will appear here automatically.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => {
                      const actionColor =
                        log.action === 'USER_SUSPENDED' || log.action === 'COURSE_REJECTED'
                          ? '#f87171'
                          : log.action === 'USER_ACTIVATED' || log.action === 'COURSE_APPROVED'
                          ? '#34d399'
                          : log.action === 'USER_ROLE_CHANGED' || log.action === 'COURSE_SUBMITTED'
                          ? '#38bdf8'
                          : '#fbbf24';

                      return (
                        <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '0.75rem', fontFamily: 'monospace', color: '#64748b' }}>
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: `${actionColor}20`,
                                color: actionColor,
                                border: `1px solid ${actionColor}40`
                              }}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            <div style={{ fontWeight: 600 }}>{log.actor_name || log.actor_id}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {log.actor_role} {log.actor_email ? `• ${log.actor_email}` : ''}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem', color: '#334155' }}>
                            <span style={{ fontWeight: 600 }}>{log.resource}</span>
                            {log.resource_id && (
                              <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                                ID: {log.resource_id}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            {log.details ? (
                              typeof log.details === 'object' ? (
                                <div
                                  style={{
                                    fontFamily: 'monospace',
                                    fontSize: '0.75rem',
                                    color: '#64748b',
                                    background: '#ffffff',
                                    padding: '6px 8px',
                                    borderRadius: '4px',
                                    border: '1px solid #1e293b'
                                  }}
                                >
                                  {Object.entries(log.details).map(([k, v]) => (
                                    <div key={k}>
                                      <span style={{ color: '#38bdf8' }}>{k}:</span> {String(v)}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{String(log.details)}</span>
                              )
                            ) : (
                              <span style={{ color: '#64748b' }}>-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '1.5rem',
                paddingTop: '1rem',
                borderTop: '1px solid #e2e8f0'
              }}
            >
              <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                Page <strong>{auditPage}</strong> of <strong>{auditTotalPages}</strong>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={auditPage <= 1 || auditLoading}
                  onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft style={{ width: '14px', height: '14px' }} /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={auditPage >= auditTotalPages || auditLoading}
                  onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
                >
                  Next <ChevronRight style={{ width: '14px', height: '14px' }} />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 1: Account Status Confirmation (Suspend or Activate)                */}
        {/* ========================================================================= */}
        {statusConfirmUser && (
          <div className="integrity-overlay" style={{ padding: '1.5rem' }}>
            <div
              className="glass-panel-elevated"
              style={{
                maxWidth: '480px',
                width: '100%',
                padding: '1.75rem',
                border: '1px solid rgba(255,255,255,0.15)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                {statusConfirmUser.is_active === 1 ? (
                  <div
                    style={{
                      background: 'rgba(239,68,68,0.2)',
                      padding: '10px',
                      borderRadius: '8px',
                      color: '#f87171'
                    }}
                  >
                    <AlertTriangle style={{ width: '24px', height: '24px' }} />
                  </div>
                ) : (
                  <div
                    style={{
                      background: 'rgba(16,185,129,0.2)',
                      padding: '10px',
                      borderRadius: '8px',
                      color: '#34d399'
                    }}
                  >
                    <UserCheck style={{ width: '24px', height: '24px' }} />
                  </div>
                )}
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                    {statusConfirmUser.is_active === 1 ? 'Suspend Account' : 'Activate Account'}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    Target: <strong>{statusConfirmUser.name}</strong> ({statusConfirmUser.email})
                  </p>
                </div>
              </div>

              <div
                style={{
                  background: '#ffffff',
                  padding: '12px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  lineHeight: '1.5',
                  color: '#334155',
                  marginBottom: '1.25rem'
                }}
              >
                {statusConfirmUser.is_active === 1 ? (
                  <div>
                    Suspending this account will immediately revoke all active refresh tokens and block protected
                    API access. The user will not be able to log in or take bank exams until reactivated.
                  </div>
                ) : (
                  <div>
                    Activating this account will restore access immediately. The user will be able to log in and resume
                    course lessons and model tests.
                  </div>
                )}
              </div>

              {modalError && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '10px',
                    borderRadius: '6px',
                    color: '#f87171',
                    marginBottom: '1rem',
                    fontSize: '0.85rem'
                  }}
                >
                  {modalError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button
                  variant="secondary"
                  disabled={actionInProgress}
                  onClick={() => setStatusConfirmUser(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant={statusConfirmUser.is_active === 1 ? 'danger' : 'primary'}
                  disabled={actionInProgress}
                  onClick={handleToggleStatus}
                >
                  {actionInProgress
                    ? 'Updating...'
                    : statusConfirmUser.is_active === 1
                    ? 'Confirm Suspension'
                    : 'Confirm Activation'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 2: Change User Role Modal                                           */}
        {/* ========================================================================= */}
        {roleModalUser && (
          <div className="integrity-overlay" style={{ padding: '1.5rem' }}>
            <div
              className="glass-panel-elevated"
              style={{
                maxWidth: '480px',
                width: '100%',
                padding: '1.75rem',
                border: '1px solid rgba(255,255,255,0.15)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                <div
                  style={{
                    background: 'rgba(59,130,246,0.2)',
                    padding: '10px',
                    borderRadius: '8px',
                    color: '#60a5fa'
                  }}
                >
                  <ShieldCheck style={{ width: '24px', height: '24px' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Modify Account Role</h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    User: <strong>{roleModalUser.name}</strong> ({roleModalUser.email})
                  </p>
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '6px' }}>
                  Select New Role
                </label>
                <select
                  value={selectedNewRole}
                  onChange={(e) => setSelectedNewRole(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    color: '#0f172a',
                    fontSize: '0.9rem',
                    fontWeight: 600
                  }}
                >
                  <option value="STUDENT">STUDENT — Exam participant & course learner</option>
                  <option value="INSTRUCTOR">INSTRUCTOR — Course creator & question contributor</option>
                  <option value="ADMIN">ADMIN — Full system oversight & live exam supervision</option>
                </select>
              </div>

              <div
                style={{
                  background: '#ffffff',
                  padding: '12px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  lineHeight: '1.5',
                  color: '#334155',
                  marginBottom: '1.25rem'
                }}
              >
                <strong>Permission Notice:</strong> Changing this user's role takes effect immediately through the
                database-verified authentication middleware. If promoting a Student to Instructor, they will gain course
                authoring and question bank privileges. Active refresh tokens are revoked to ensure new tokens inherit
                updated permissions.
              </div>

              {modalError && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '10px',
                    borderRadius: '6px',
                    color: '#f87171',
                    marginBottom: '1rem',
                    fontSize: '0.85rem'
                  }}
                >
                  {modalError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button
                  variant="secondary"
                  disabled={actionInProgress}
                  onClick={() => setRoleModalUser(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={actionInProgress || selectedNewRole === roleModalUser.role}
                  onClick={handleChangeRole}
                >
                  {actionInProgress
                    ? 'Applying...'
                    : selectedNewRole === roleModalUser.role
                    ? 'Current Role'
                    : 'Confirm Role Change'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 3: Course Approval Confirmation Modal (Milestone 3 Step 2B)         */}
        {/* ========================================================================= */}
        {approveConfirmCourse && (
          <div className="integrity-overlay" style={{ padding: '1.5rem' }}>
            <div
              className="glass-panel-elevated"
              style={{
                maxWidth: '520px',
                width: '100%',
                padding: '1.75rem',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.2)',
                    padding: '10px',
                    borderRadius: '8px',
                    color: '#34d399'
                  }}
                >
                  <CheckCircle2 style={{ width: '24px', height: '24px' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Approve Course Publication</h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    Instructor: <strong>{approveConfirmCourse.instructor_name || approveConfirmCourse.instructor_id}</strong>
                  </p>
                </div>
              </div>

              <div
                style={{
                  background: '#ffffff',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  marginBottom: '1.25rem'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginBottom: '4px' }}>
                  {approveConfirmCourse.title}
                </div>
                {approveConfirmCourse.title_bangla && (
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '8px' }}>
                    {approveConfirmCourse.title_bangla}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px', fontSize: '0.8rem', color: '#38bdf8' }}>
                  <span>● {approveConfirmCourse.module_count} Modules</span>
                  <span>● {approveConfirmCourse.lesson_count} Lessons</span>
                  <span>● {approveConfirmCourse.resource_count} Resource Handouts</span>
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  lineHeight: '1.5',
                  color: '#334155',
                  marginBottom: '1.25rem'
                }}
              >
                <strong>Student Visibility Impact:</strong> Approving this course transitions its status to{' '}
                <span style={{ color: '#10b981', fontWeight: 700 }}>PUBLISHED</span>. Enrolled student candidates will
                immediately gain access to all video lessons, notes, and study resources in the course catalog. This
                administrative decision is logged permanently to the tamper-proof audit trail.
              </div>

              {modalError && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '10px',
                    borderRadius: '6px',
                    color: '#f87171',
                    marginBottom: '1rem',
                    fontSize: '0.85rem'
                  }}
                >
                  {modalError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button
                  variant="secondary"
                  disabled={actionInProgress}
                  onClick={() => setApproveConfirmCourse(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={actionInProgress}
                  onClick={handleApproveCourse}
                >
                  {actionInProgress ? 'Publishing...' : 'Confirm Approval & Publish'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 4: Course Rejection Modal (Milestone 3 Step 2B)                     */}
        {/* ========================================================================= */}
        {rejectModalCourse && (
          <div className="integrity-overlay" style={{ padding: '1.5rem' }}>
            <div
              className="glass-panel-elevated"
              style={{
                maxWidth: '520px',
                width: '100%',
                padding: '1.75rem',
                border: '1px solid rgba(239, 68, 68, 0.3)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    padding: '10px',
                    borderRadius: '8px',
                    color: '#f87171'
                  }}
                >
                  <AlertTriangle style={{ width: '24px', height: '24px' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Reject Course Submission</h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    Course: <strong>{rejectModalCourse.title}</strong>
                  </p>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '6px' }}>
                  Rejection Reason / Required Faculty Revisions <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Specify what needs correction (e.g. Please provide at least two video lessons with duration >= 15m and attach lecture PDF formula sheets)..."
                  value={rejectionReason}
                  onChange={(e) => {
                    setRejectionReason(e.target.value);
                    if (modalError) setModalError(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    lineHeight: '1.5',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                  Minimum 5 characters required. Feedback will be provided to the instructor in their Course Builder.
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  lineHeight: '1.5',
                  color: '#334155',
                  marginBottom: '1.25rem'
                }}
              >
                Rejecting this course updates its status to{' '}
                <span style={{ color: '#f87171', fontWeight: 700 }}>REJECTED</span> and returns it to the instructor
                for modifications. The course will remain completely hidden from students until re-submitted and approved.
              </div>

              {modalError && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '10px',
                    borderRadius: '6px',
                    color: '#f87171',
                    marginBottom: '1rem',
                    fontSize: '0.85rem'
                  }}
                >
                  {modalError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button
                  variant="secondary"
                  disabled={actionInProgress}
                  onClick={() => {
                    setRejectModalCourse(null);
                    setRejectionReason('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  disabled={actionInProgress || rejectionReason.trim().length < 5}
                  onClick={handleRejectCourse}
                >
                  {actionInProgress ? 'Rejecting...' : 'Confirm Rejection'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 5: Course Syllabus Preview Modal (Milestone 3 Step 2B)              */}
        {/* ========================================================================= */}
        {previewCourse && (
          <div className="integrity-overlay" style={{ padding: '1.5rem', overflowY: 'auto' }}>
            <div
              className="glass-panel-elevated"
              style={{
                maxWidth: '680px',
                width: '100%',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                padding: '1.75rem',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                overflow: 'hidden'
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid #e2e8f0'
                }}
              >
                <div>
                  <span style={{ color: '#38bdf8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    Syllabus Inspection & Quality Review
                  </span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '2px' }}>{previewCourse.title}</h3>
                  {previewCourse.title_bangla && (
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{previewCourse.title_bangla}</div>
                  )}
                </div>
                <button
                  onClick={() => setPreviewCourse(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <X style={{ width: '20px', height: '20px' }} />
                </button>
              </div>

              {/* Metadata strip */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  background: '#ffffff',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  marginBottom: '1rem'
                }}
              >
                <div>
                  <span style={{ color: '#64748b' }}>Instructor: </span>
                  <strong style={{ color: '#0f172a' }}>
                    {previewCourse.instructor_name || previewCourse.instructor_id}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Category: </span>
                  <strong style={{ color: '#38bdf8' }}>{previewCourse.category_name || 'General'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Status: </span>
                  <strong style={{ color: '#f59e0b' }}>{previewCourse.status}</strong>
                </div>
              </div>

              {/* Description */}
              {previewCourse.description && (
                <div style={{ fontSize: '0.85rem', color: '#334155', marginBottom: '1rem', lineHeight: '1.5' }}>
                  {previewCourse.description}
                </div>
              )}

              {/* Curriculum Content */}
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                  Course Curriculum & Lesson Breakdown
                </h4>

                {curriculumLoading ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                    Loading syllabus modules and lessons...
                  </div>
                ) : !curriculumData || !curriculumData.modules || curriculumData.modules.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem', background: '#ffffff', borderRadius: '6px' }}>
                    No modules or lessons have been attached to this course yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {curriculumData.modules.map((mod: any, mIdx: number) => (
                      <div
                        key={mod.id}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '10px 12px'
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#38bdf8', marginBottom: '6px' }}>
                          Module {mIdx + 1}: {mod.title}
                        </div>
                        {(!mod.lessons || mod.lessons.length === 0) ? (
                          <div style={{ fontSize: '0.75rem', color: '#64748b', paddingLeft: '8px' }}>
                            (No lessons in this module)
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '8px' }}>
                            {mod.lessons.map((les: any, lIdx: number) => (
                              <div
                                key={les.id}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  fontSize: '0.8rem',
                                  borderLeft: '2px solid #334155',
                                  paddingLeft: '8px',
                                  paddingTop: '2px',
                                  paddingBottom: '2px'
                                }}
                              >
                                <div>
                                  <span style={{ color: '#334155' }}>
                                    {mIdx + 1}.{lIdx + 1} {les.title}
                                  </span>
                                  {les.duration_minutes && (
                                    <span style={{ color: '#64748b', fontSize: '0.75rem', marginLeft: '6px' }}>
                                      ({les.duration_minutes} min)
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  {les.video_url && (
                                    <span style={{ color: '#a855f7', fontSize: '0.7rem' }}>[Video]</span>
                                  )}
                                  {les.resources && les.resources.length > 0 && (
                                    <span style={{ color: '#10b981', fontSize: '0.7rem' }}>
                                      [{les.resources.length} Handout{les.resources.length > 1 ? 's' : ''}]
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons inside Preview */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid #e2e8f0'
                }}
              >
                <Button variant="secondary" size="sm" onClick={() => setPreviewCourse(null)}>
                  Close Preview
                </Button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      const c = previewCourse;
                      setPreviewCourse(null);
                      setRejectModalCourse(c);
                      setRejectionReason('');
                      setModalError(null);
                    }}
                  >
                    Reject Course
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      const c = previewCourse;
                      setPreviewCourse(null);
                      setApproveConfirmCourse(c);
                      setModalError(null);
                    }}
                  >
                    Approve Course
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Modal: Grade Override Confirmation & Input                                */}
        {/* ========================================================================= */}
        {selectedAttemptForOverride && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1rem'
            }}
          >
            <div
              className="glass-panel"
              style={{
                width: '100%',
                maxWidth: '520px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '1.5rem',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid #e2e8f0'
                }}
              >
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Award style={{ width: '18px', height: '18px', color: '#38bdf8' }} />
                  Override Student Grade
                </h4>
                <button
                  onClick={() => setSelectedAttemptForOverride(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <X style={{ width: '18px', height: '18px' }} />
                </button>
              </div>

              {/* Target Candidate & Exam Details */}
              <div
                style={{
                  background: '#ffffff',
                  padding: '12px',
                  borderRadius: '6px',
                  marginBottom: '1.25rem',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#64748b' }}>Candidate:</span>
                  <strong style={{ color: '#0f172a' }}>{selectedAttemptForOverride.student_name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#64748b' }}>Exam:</span>
                  <span style={{ color: '#334155' }}>{selectedAttemptForOverride.exam_title}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#475569' }}>Original Machine Score:</span>
                  <strong style={{ color: '#b45309' }}>
                    {selectedAttemptForOverride.original_score !== null ? selectedAttemptForOverride.original_score : selectedAttemptForOverride.current_score} / {selectedAttemptForOverride.total_marks}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#475569' }}>Current Effective Score:</span>
                  <strong style={{ color: selectedAttemptForOverride.is_passed ? '#15803d' : '#b91c1c' }}>
                    {selectedAttemptForOverride.current_score} ({selectedAttemptForOverride.is_passed ? 'PASSED' : 'FAILED'})
                  </strong>
                </div>
              </div>

              {/* Input for Corrected Score */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Corrected Score (0 to {selectedAttemptForOverride.total_marks}) *
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max={selectedAttemptForOverride.total_marks}
                  value={overrideScoreInput}
                  onChange={(e) => setOverrideScoreInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: '#020617',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    color: '#0f172a',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              {/* Input for Justification Reason */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Mandatory Audit Justification Reason *
                </label>
                <textarea
                  rows={3}
                  value={overrideReasonInput}
                  onChange={(e) => setOverrideReasonInput(e.target.value)}
                  placeholder="e.g., Awarded 2 marks for contested question #4 after instructor review."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: '#020617',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                  Minimum 5 characters. This reason is permanently recorded in the tamper-proof audit trail.
                </div>
              </div>

              {overrideModalError && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '10px',
                    borderRadius: '6px',
                    color: '#f87171',
                    marginBottom: '1rem',
                    fontSize: '0.85rem'
                  }}
                >
                  {overrideModalError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <Button variant="secondary" size="sm" onClick={() => setSelectedAttemptForOverride(null)} disabled={overrideSubmitting}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleExecuteGradeOverride} disabled={overrideSubmitting}>
                  {overrideSubmitting ? 'Applying Override...' : 'Confirm Grade Override'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Modal: Administrative Exam Time Extension                                 */}
        {/* ========================================================================= */}
        {timeExtensionModalAttempt && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1rem'
            }}
          >
            <div
              className="glass-panel"
              style={{
                width: '100%',
                maxWidth: '480px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '1.5rem',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid #e2e8f0'
                }}
              >
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock style={{ width: '18px', height: '18px', color: '#38bdf8' }} />
                  Extend Live Exam Time
                </h4>
                <button
                  onClick={() => setTimeExtensionModalAttempt(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <X style={{ width: '18px', height: '18px' }} />
                </button>
              </div>

              {/* Attempt Info */}
              <div
                style={{
                  background: '#ffffff',
                  padding: '12px',
                  borderRadius: '6px',
                  marginBottom: '1.25rem',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#64748b' }}>Candidate:</span>
                  <strong style={{ color: '#0f172a' }}>{timeExtensionModalAttempt.user_name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#64748b' }}>Exam:</span>
                  <span style={{ color: '#334155' }}>{timeExtensionModalAttempt.exam_title}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Current Expiry:</span>
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                    {timeExtensionModalAttempt.expires_at ? new Date(timeExtensionModalAttempt.expires_at).toLocaleTimeString() : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Additional Minutes */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Additional Minutes (1 to 180) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={extensionMinutes}
                  onChange={(e) => setExtensionMinutes(parseInt(e.target.value, 10) || 0)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: '#020617',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    color: '#0f172a',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              {/* Justification Reason */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Mandatory Justification Reason *
                </label>
                <textarea
                  rows={3}
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  placeholder="e.g., Power outage compensation for candidate."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: '#020617',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                  Authoritative server timer will be updated and candidate's screen will immediately resynchronize.
                </div>
              </div>

              {extensionError && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '10px',
                    borderRadius: '6px',
                    color: '#f87171',
                    marginBottom: '1rem',
                    fontSize: '0.85rem'
                  }}
                >
                  {extensionError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <Button variant="secondary" size="sm" onClick={() => setTimeExtensionModalAttempt(null)} disabled={extensionLoading}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleExecuteTimeExtension} disabled={extensionLoading}>
                  {extensionLoading ? 'Extending...' : 'Confirm Extension'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
