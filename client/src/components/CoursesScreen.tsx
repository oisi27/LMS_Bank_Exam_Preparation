import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Video,
  FileText,
  Download,
  Lock,
  CheckCircle,
  PlayCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Shield,
  Clock,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  X,
  SlidersHorizontal
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

interface CoursesScreenProps {
  onBackToDashboard: () => void;
  onTakeExam?: (examId: string) => void;
  initialCourseId?: string | null;
}

// YouTube URL Parser and Safe Embed Formatter
function parseVideoSource(rawUrl?: string | null): { type: 'YOUTUBE' | 'MP4' | 'NONE'; embedUrl?: string; directUrl?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') return { type: 'NONE' };
  const trimmed = rawUrl.trim();
  if (!trimmed) return { type: 'NONE' };

  // youtube.com/embed/...
  const embedMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i);
  if (embedMatch && embedMatch[1]) {
    return {
      type: 'YOUTUBE',
      embedUrl: `https://www.youtube.com/embed/${embedMatch[1]}`,
      directUrl: `https://www.youtube.com/watch?v=${embedMatch[1]}`
    };
  }

  // youtube.com/watch?v=...
  const watchMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/i);
  if (watchMatch && watchMatch[1]) {
    return {
      type: 'YOUTUBE',
      embedUrl: `https://www.youtube.com/embed/${watchMatch[1]}`,
      directUrl: `https://www.youtube.com/watch?v=${watchMatch[1]}`
    };
  }

  // youtu.be/...
  const shortMatch = trimmed.match(/(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/i);
  if (shortMatch && shortMatch[1]) {
    return {
      type: 'YOUTUBE',
      embedUrl: `https://www.youtube.com/embed/${shortMatch[1]}`,
      directUrl: `https://www.youtube.com/watch?v=${shortMatch[1]}`
    };
  }

  // youtube.com/shorts/...
  const shortsMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i);
  if (shortsMatch && shortsMatch[1]) {
    return {
      type: 'YOUTUBE',
      embedUrl: `https://www.youtube.com/embed/${shortsMatch[1]}`,
      directUrl: `https://www.youtube.com/watch?v=${shortsMatch[1]}`
    };
  }

  return { type: 'MP4', directUrl: trimmed };
}

export const CoursesScreen: React.FC<CoursesScreenProps> = ({ onBackToDashboard, onTakeExam, initialCourseId }) => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [curriculum, setCurriculum] = useState<any>(null);
  const [activeLesson, setActiveLesson] = useState<any>(null);
  const [signedLinkInfo, setSignedLinkInfo] = useState<{ url: string; title: string; expires: number } | null>(null);
  const [courseExams, setCourseExams] = useState<any[]>([]);
  const [selectedCourseExamId, setSelectedCourseExamId] = useState<string | null>(null);
  const [courseExamsLoading, setCourseExamsLoading] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  // Video Playback & Fallback State
  const [videoPlaybackError, setVideoPlaybackError] = useState<string | null>(null);
  const [videoPlayerKey, setVideoPlayerKey] = useState<number>(0);

  // Lesson Progress State (Phase 7 Milestone 1)
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);
  const [progressPercentage, setProgressPercentage] = useState<number>(0);
  const [progressCount, setProgressCount] = useState<{ completed: number; total: number }>({ completed: 0, total: 0 });
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Search & Filter State (Phase 2 Master's Proposal Requirement)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedLevel, setSelectedLevel] = useState('ALL');

  // Helper to determine if a course is a legitimate, published, non-archived academic course
  const isEligibleCourse = (c: any) => Boolean(c && c.status === 'PUBLISHED' && !c.is_archived);

  // Compute distinct categories from loaded courses for subject filtering
  const distinctCategories = React.useMemo(() => {
    const catMap = new Map<string, { id: string; name: string; count: number }>();
    for (const c of courses) {
      if (!isEligibleCourse(c)) continue;
      const id = c.category_id || c.categoryId || 'unknown';
      const name = c.category_name || c.categoryName || 'General';
      if (!catMap.has(id)) {
        catMap.set(id, { id, name, count: 0 });
      }
      catMap.get(id)!.count++;
    }
    return Array.from(catMap.values());
  }, [courses]);

  // Compute filtered courses based on search query and category (strictly published & non-archived)
  const filteredCourses = React.useMemo(() => {
    return courses.filter((c) => {
      // Must be an eligible published, non-archived course
      if (!isEligibleCourse(c)) return false;
      // Category / Subject filter
      if (selectedCategory !== 'ALL' && c.category_id !== selectedCategory && c.categoryId !== selectedCategory) {
        return false;
      }
      // Search query filter (matches title, Bengali title, description, or category name)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (c.title || '').toLowerCase().includes(q);
        const banglaMatch = (c.title_bangla || c.titleBangla || '').toLowerCase().includes(q);
        const descMatch = (c.description || '').toLowerCase().includes(q);
        const catMatch = (c.category_name || c.categoryName || '').toLowerCase().includes(q);
        if (!titleMatch && !banglaMatch && !descMatch && !catMatch) {
          return false;
        }
      }
      return true;
    });
  }, [courses, selectedCategory, searchQuery]);

  // When filters change, auto-select first matching course if currently selected course was filtered out
  useEffect(() => {
    if (filteredCourses.length > 0) {
      const isSelectedPresent = filteredCourses.some((c) => c.id === selectedCourse?.id);
      if (!isSelectedPresent) {
        loadCurriculum(filteredCourses[0].id);
      }
    } else {
      setSelectedCourse(null);
      setCurriculum(null);
      setActiveLesson(null);
    }
  }, [filteredCourses]);

  // Load Courses (Requirement: In learning viewer, show ONLY courses satisfying status === 'PUBLISHED' and !is_archived)
  useEffect(() => {
    async function fetchCourses() {
      try {
        const token = localStorage.getItem('token');
        const coursesRes = await axios.get('http://localhost:5000/api/courses', {
          headers: { Authorization: `Bearer ${token}` }
        });

        const rawCourses: any[] = coursesRes.data.courses || [];
        const eligibleCourses = rawCourses.filter(isEligibleCourse);
        setCourses(eligibleCourses);

        if (eligibleCourses.length > 0) {
          const targetCourse = initialCourseId
            ? eligibleCourses.find((c: any) => c.id === initialCourseId) || eligibleCourses[0]
            : eligibleCourses[0];
          loadCurriculum(targetCourse.id);
        } else {
          setSelectedCourse(null);
          setCurriculum(null);
          setActiveLesson(null);
          setCourseExams([]);
          setSelectedCourseExamId(null);
        }
      } catch (err) {
        console.error('Failed to load courses:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCourses();
  }, []);

  // Fetch student progress for a course
  const fetchCourseProgress = async (courseId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:5000/api/courses/${courseId}/progress`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setCompletedLessonIds(res.data.completedLessonIds || []);
        setProgressPercentage(res.data.progressPercentage || 0);
        setProgressCount({
          completed: res.data.completedCount || 0,
          total: res.data.totalLessons || 0
        });
      }
    } catch (err) {
      console.error('Failed to load course progress:', err);
    }
  };

  // Fetch exams explicitly linked to this course (Option B: Complete Course-Based Exam Integration)
  const fetchCourseExams = async (courseId: string) => {
    if (!courseId) {
      setCourseExams([]);
      setSelectedCourseExamId(null);
      return;
    }
    setCourseExamsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:5000/api/courses/${courseId}/exams`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        const loadedExams: any[] = res.data.exams || [];
        setCourseExams(loadedExams);
        if (loadedExams.length > 0) {
          // If a live exam is available, select first live exam, otherwise first exam
          const liveExam = loadedExams.find((e) => e.isLive);
          setSelectedCourseExamId(liveExam ? liveExam.id : loadedExams[0].id);
        } else {
          setSelectedCourseExamId(null);
        }
      } else {
        setCourseExams([]);
        setSelectedCourseExamId(null);
      }
    } catch (err) {
      console.error('Failed to load course exams:', err);
      setCourseExams([]);
      setSelectedCourseExamId(null);
    } finally {
      setCourseExamsLoading(false);
    }
  };

  // Load Curriculum for a selected course
  const loadCurriculum = async (courseId: string) => {
    if (!courseId) return;
    // Clear stale exam selection immediately when switching courses
    setCourseExams([]);
    setSelectedCourseExamId(null);
    try {
      const token = localStorage.getItem('token');
      const [curriculumRes] = await Promise.all([
        axios.get(`http://localhost:5000/api/courses/${courseId}/curriculum`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetchCourseProgress(courseId),
        fetchCourseExams(courseId)
      ]);
      const courseData = curriculumRes.data.course;
      // Safety guard: ensure loaded course belongs to published non-archived catalog
      if (courseData && (!isEligibleCourse(courseData) && courseData.status !== 'PUBLISHED')) {
        console.warn('Attempted to load non-published course in learning viewer:', courseData.title);
        setSelectedCourse(null);
        setCurriculum(null);
        setActiveLesson(null);
        return;
      }
      setSelectedCourse(courseData);
      setCurriculum(curriculumRes.data.modules || []);
      // Select first lesson by default
      if (curriculumRes.data.modules?.[0]?.lessons?.[0]) {
        setActiveLesson(curriculumRes.data.modules[0].lessons[0]);
      } else {
        setActiveLesson(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle lesson complete / undo complete
  const handleToggleLessonComplete = async (lessonId: string) => {
    if (!selectedCourse || actionInProgress) return;
    setActionInProgress(true);
    setStatusMessage(null);
    const token = localStorage.getItem('token');
    const isCompleted = completedLessonIds.includes(lessonId);

    try {
      if (isCompleted) {
        // Undo completion
        await axios.delete(`http://localhost:5000/api/courses/lessons/${lessonId}/complete`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStatusMessage({ type: 'success', text: 'Lesson completion undone.' });
      } else {
        // Mark completed
        await axios.post(`http://localhost:5000/api/courses/lessons/${lessonId}/complete`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStatusMessage({ type: 'success', text: 'Lesson marked as completed!' });
      }

      // Refresh progress immediately from server
      await fetchCourseProgress(selectedCourse.id);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.error || 'Unable to update lesson progress.'
      });
    } finally {
      setActionInProgress(false);
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  // Request secure time-expiring signed URL
  const fetchSignedLink = async (resourceId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:5000/api/courses/resources/${resourceId}/signed-link`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSignedLinkInfo({
        url: res.data.signedUrl,
        title: res.data.resourceTitle,
        expires: res.data.expiresInSeconds
      });
    } catch (err) {
      alert('Unable to generate secure download link.');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '80vh', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#64748b' }}>Loading structured syllabus modules & lessons...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', padding: '1.5rem 2.5rem' }}>
      <div style={{ maxWidth: '1300px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <span style={{ color: '#2563eb', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Academic Curriculum</span>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Category &gt; Course &gt; Module &gt; Lesson Viewer</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Course Selector Dropdown */}
            <select
              value={selectedCourse?.id || ''}
              onChange={(e) => loadCurriculum(e.target.value)}
              style={{
                background: '#ffffff', border: '1px solid #cbd5e1', color: '#2563eb',
                padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 600, outline: 'none'
              }}
            >
              {filteredCourses.length === 0 ? (
                <option value="" disabled>No published courses available</option>
              ) : (
                filteredCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))
              )}
            </select>

            {/* Course-Specific Exam Launch Section (Option B) */}
            {onTakeExam && (
              courseExamsLoading ? (
                <button
                  disabled
                  style={{
                    background: '#f1f5f9', color: '#94a3b8', padding: '0.5rem 1rem',
                    borderRadius: '0.5rem', border: '1px solid #e2e8f0', cursor: 'not-allowed',
                    fontWeight: 600, fontSize: '0.85rem'
                  }}
                >
                  Checking Course Exams...
                </button>
              ) : courseExams.length === 0 ? (
                <button
                  disabled
                  style={{
                    background: '#f8fafc', color: '#94a3b8', padding: '0.5rem 1.1rem',
                    borderRadius: '0.5rem', border: '1px solid #e2e8f0', cursor: 'not-allowed',
                    fontWeight: 600, fontSize: '0.85rem'
                  }}
                  title="No exams are assigned to this course. Grand Model Tests are available on the main Dashboard."
                >
                  No Course Exam Assigned
                </button>
              ) : courseExams.length === 1 ? (
                <button
                  onClick={() => selectedCourseExamId && onTakeExam(selectedCourseExamId)}
                  disabled={user?.role === 'STUDENT' && !courseExams[0].canAttempt}
                  style={{
                    background: (user?.role === 'INSTRUCTOR' || user?.role === 'ADMIN')
                      ? '#d97706'
                      : (courseExams[0].canAttempt ? '#2563eb' : '#94a3b8'),
                    color: '#ffffff',
                    padding: '0.5rem 1.25rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    cursor: (user?.role === 'STUDENT' && !courseExams[0].canAttempt) ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.88rem'
                  }}
                  title={(user?.role === 'INSTRUCTOR' || user?.role === 'ADMIN')
                    ? 'Simulated non-persistent test session (No official database attempt)'
                    : (courseExams[0].canAttempt
                        ? `Start official timed candidate exam (${courseExams[0].attemptsRemaining} attempts left)`
                        : 'Exam is not currently open or attempt limit reached')}
                >
                  {(user?.role === 'INSTRUCTOR' || user?.role === 'ADMIN') ? (
                    <>Preview Exam (Instructor Test Mode) →</>
                  ) : (
                    <>Take Timed Exam Now →</>
                  )}
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <select
                    value={selectedCourseExamId || ''}
                    onChange={(e) => setSelectedCourseExamId(e.target.value)}
                    style={{
                      background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a',
                      padding: '0.45rem 0.75rem', borderRadius: '0.5rem', fontWeight: 600,
                      fontSize: '0.82rem', maxWidth: '240px', outline: 'none'
                    }}
                  >
                    {courseExams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title} ({ex.durationMinutes}m | {ex.totalMarks}m)
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => selectedCourseExamId && onTakeExam(selectedCourseExamId)}
                    style={{
                      background: (user?.role === 'INSTRUCTOR' || user?.role === 'ADMIN') ? '#d97706' : '#2563eb',
                      color: '#ffffff',
                      padding: '0.45rem 1rem',
                      borderRadius: '0.5rem',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.82rem'
                    }}
                    title={(user?.role === 'INSTRUCTOR' || user?.role === 'ADMIN')
                      ? 'Simulated non-persistent test session'
                      : 'Start official timed candidate exam'}
                  >
                    {(user?.role === 'INSTRUCTOR' || user?.role === 'ADMIN') ? (
                      <>Preview Selected →</>
                    ) : (
                      <>Take Selected →</>
                    )}
                  </button>
                </div>
              )
            )}

            <button
              onClick={onBackToDashboard}
              style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '0.5rem 1.2rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}
            >
              Dashboard
            </button>
          </div>
        </div>

        {/* Academic Course Search & Filtering Toolbar (Phase 2 Master's Requirement) */}
        <div
          className="glass-panel"
          style={{
            padding: '1.25rem 1.5rem',
            marginBottom: '1.75rem',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '0.75rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter style={{ width: '1.1rem', height: '1.1rem', color: '#2563eb' }} />
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                Course Search & Filter
              </span>
              <span style={{ fontSize: '0.8rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0.15rem 0.55rem', borderRadius: '1rem', fontWeight: 600 }}>
                Showing {filteredCourses.length} of {courses.length} Published Courses
              </span>
            </div>
            {(searchQuery || selectedCategory !== 'ALL' || selectedLevel !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('ALL');
                  setSelectedLevel('ALL');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.2rem 0.5rem'
                }}
              >
                <X style={{ width: '0.9rem', height: '0.9rem' }} />
                Reset Filters
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.75rem', alignItems: 'center' }}>
            {/* Keyword Search Input */}
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#64748b' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, topic, or keyword..."
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem 0.55rem 2.25rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  outline: 'none',
                  color: '#0f172a',
                  background: '#ffffff'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8'
                  }}
                >
                  <X style={{ width: '0.9rem', height: '0.9rem' }} />
                </button>
              )}
            </div>

            {/* Subject / Category Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <BookOpen style={{ width: '1rem', height: '1rem', color: '#64748b', flexShrink: 0 }} />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  outline: 'none',
                  color: '#0f172a',
                  background: '#ffffff',
                  fontWeight: 500
                }}
              >
                <option value="ALL">All Subjects ({courses.length})</option>
                {distinctCategories.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Level / Preparation Standard Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <SlidersHorizontal style={{ width: '1rem', height: '1rem', color: '#64748b', flexShrink: 0 }} />
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  outline: 'none',
                  color: '#0f172a',
                  background: '#ffffff',
                  fontWeight: 500
                }}
                title="Courses provide comprehensive standard bank recruitment preparation."
              >
                <option value="ALL">Level: All Candidate Levels</option>
                <option value="STANDARD">Level: Standard Bank Syllabus</option>
              </select>
            </div>
          </div>

          {/* Quick-Switch Course Chips */}
          {filteredCourses.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', overflowX: 'auto', paddingBottom: '0.25rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, flexShrink: 0 }}>Courses:</span>
              {filteredCourses.map((c) => {
                const isSelected = selectedCourse?.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => loadCurriculum(c.id)}
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: '1rem',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      border: isSelected ? '1px solid #2563eb' : '1px solid #cbd5e1',
                      background: isSelected ? '#2563eb' : '#f8fafc',
                      color: isSelected ? '#ffffff' : '#334155',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {c.title.length > 36 ? c.title.substring(0, 36) + '...' : c.title}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Empty State when no courses match filter */}
        {filteredCourses.length === 0 && (
          <div
            className="glass-panel"
            style={{
              padding: '3rem 2rem',
              textAlign: 'center',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '0.75rem',
              marginBottom: '2rem'
            }}
          >
            <Search style={{ width: '3rem', height: '3rem', color: '#94a3b8', margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
              {courses.length === 0 ? 'No Published Courses Available' : 'No Courses Match Your Filter'}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '450px', margin: '0 auto 1.25rem' }}>
              {courses.length === 0
                ? 'There are currently no published courses available in the learning syllabus. Please check back later or contact an administrator.'
                : (searchQuery ? `No courses found matching "${searchQuery}". ` : '') + 'Try searching with different keywords or reset your filters to see all published courses.'}
            </p>
            {courses.length > 0 && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('ALL');
                  setSelectedLevel('ALL');
                }}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  padding: '0.55rem 1.25rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Clear Filters & Show All Published Courses
              </button>
            )}
          </div>
        )}

        {/* Course Banner with Progress Bar */}
        {filteredCourses.length > 0 && selectedCourse && (
          <>
          <div className="glass-panel" style={{ padding: '1.5rem 2rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '1rem' }}>
                  {selectedCourse.category_name}
                </span>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                  {selectedCourse.title}
                </h2>
                {selectedCourse.title_bangla && (
                  <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '0.5rem' }}>{selectedCourse.title_bangla}</p>
                )}
                <p style={{ color: '#334155', fontSize: '0.85rem', maxWidth: '750px' }}>{selectedCourse.description}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Lead Faculty:</span>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{selectedCourse.instructor_name || 'Senior Faculty'}</div>
              </div>
            </div>

            {/* Course Completion Progress Bar */}
            <div style={{ background: '#ffffff', padding: '1rem 1.25rem', borderRadius: '0.75rem', border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle style={{ width: '1rem', height: '1rem', color: progressPercentage === 100 ? '#10b981' : '#38bdf8' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>Course Syllabus Completion</span>
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: progressPercentage === 100 ? '#10b981' : '#38bdf8' }}>
                  {progressCount.completed} / {progressCount.total} Lessons ({progressPercentage}%)
                </div>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#ffffff', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${progressPercentage}%`,
                    height: '100%',
                    background: progressPercentage === 100 ? '#10b981' : 'linear-gradient(90deg, #3b82f6, #06b6d4)',
                    transition: 'width 0.4s ease'
                  }}
                />
              </div>
            </div>
          </div>

        {/* Status Notification Toast */}
        {statusMessage && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: statusMessage.type === 'success' ? '#f0fdf4' : '#fef2f2',
              color: statusMessage.type === 'success' ? '#15803d' : '#b91c1c',
              border: statusMessage.type === 'success' ? '1px solid #86efac' : '1px solid #fca5a5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Main Content Layout: Curriculum Left + Lesson Viewer Right */}
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '2rem' }}>
          {/* Left Column: Modules & Lessons Hierarchy */}
          <div className="glass-panel" style={{ padding: '1.25rem', height: 'fit-content' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BookOpen style={{ width: '1.1rem', height: '1.1rem', color: '#2563eb' }} /> Course Structure
            </h3>

            {curriculum?.map((mod: any, mIdx: number) => (
              <div key={mod.id} style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#334155', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {mod.title}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                  {mod.lessons?.map((les: any, lIdx: number) => {
                    const isActive = activeLesson?.id === les.id;
                    const isLessonCompleted = completedLessonIds.includes(les.id);
                    return (
                      <div
                        key={les.id}
                        onClick={() => {
                          setActiveLesson(les);
                          setVideoPlaybackError(null);
                        }}
                        style={{
                          padding: '0.6rem 0.8rem', borderRadius: '0.5rem', cursor: 'pointer',
                          background: isActive ? '#eff6ff' : 'transparent',
                          border: isActive ? '1px solid #3b82f6' : '1px solid transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {isLessonCompleted ? (
                            <CheckCircle style={{ width: '0.95rem', height: '0.95rem', color: '#15803d' }} />
                          ) : (
                            <PlayCircle style={{ width: '0.95rem', height: '0.95rem', color: isActive ? '#1d4ed8' : '#64748b' }} />
                          )}
                          <span style={{ fontSize: '0.85rem', fontWeight: isActive ? 700 : 500, color: isActive ? '#1d4ed8' : (isLessonCompleted ? '#0f172a' : '#334155') }}>
                            {lIdx + 1}. {les.title}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {isLessonCompleted && (
                            <span style={{ fontSize: '0.65rem', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '0.1rem 0.35rem', borderRadius: '0.25rem', fontWeight: 700 }}>
                              DONE
                            </span>
                          )}
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{les.duration_minutes}m</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: Active Lesson Content & Video / Resources */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            {activeLesson ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>{activeLesson.title}</h3>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                      <Clock style={{ width: '0.9rem', height: '0.9rem' }} /> {activeLesson.duration_minutes} Minutes
                    </span>
                  </div>

                  {/* Mark As Complete Button */}
                  <button
                    onClick={() => handleToggleLessonComplete(activeLesson.id)}
                    disabled={actionInProgress}
                    style={{
                      background: completedLessonIds.includes(activeLesson.id) ? '#dcfce7' : '#2563eb',
                      border: completedLessonIds.includes(activeLesson.id) ? '1px solid #86efac' : 'none',
                      color: completedLessonIds.includes(activeLesson.id) ? '#15803d' : '#ffffff',
                      padding: '0.55rem 1.15rem',
                      borderRadius: '0.5rem',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: actionInProgress ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      transition: 'all 0.2s ease',
                      opacity: actionInProgress ? 0.6 : 1
                    }}
                  >
                    <CheckCircle style={{ width: '1rem', height: '1rem' }} />
                    {actionInProgress ? 'Saving...' : (completedLessonIds.includes(activeLesson.id) ? 'Completed (Undo)' : 'Mark as Complete')}
                  </button>
                </div>

                {activeLesson.title_bangla && (
                  <p style={{ color: '#2563eb', fontSize: '1rem', marginBottom: '1.5rem' }}>{activeLesson.title_bangla}</p>
                )}

                {/* Video Player (Supports YouTube Embeds, Secure MP4 Streams, and Fallback Messaging) */}
                {(() => {
                  const videoSource = parseVideoSource(activeLesson.video_url);
                  if (videoSource.type === 'NONE') return null;

                  return (
                    <div style={{ marginBottom: '1.75rem', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid #cbd5e1', background: '#000000', position: 'relative' }}>
                      {videoSource.type === 'YOUTUBE' && videoSource.embedUrl ? (
                        <div>
                          <iframe
                            key={`yt-${videoPlayerKey}-${activeLesson.id}`}
                            src={videoSource.embedUrl}
                            title={activeLesson.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            style={{ width: '100%', height: '420px', border: 'none', display: 'block' }}
                          />
                          {/* Fallback Banner for Restricted or Embedding-Disabled YouTube Videos */}
                          <div style={{
                            padding: '0.6rem 1rem',
                            background: '#0b1329',
                            borderTop: '1px solid #1e293b',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.78rem',
                            color: '#64748b'
                          }}>
                            <span>Having trouble playing this YouTube video inside the browser?</span>
                            <a
                              href={videoSource.directUrl || videoSource.embedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: '#2563eb',
                                fontWeight: 600,
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}
                            >
                              Watch directly on YouTube <ExternalLink style={{ width: '0.75rem', height: '0.75rem' }} />
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {videoPlaybackError ? (
                            <div style={{
                              padding: '2.5rem 1.5rem',
                              textAlign: 'center',
                              background: '#ffffff',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '0.75rem'
                            }}>
                              <AlertTriangle style={{ width: '2rem', height: '2rem', color: '#f59e0b' }} />
                              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                                Video Stream Unavailable
                              </div>
                              <p style={{ color: '#64748b', fontSize: '0.82rem', maxWidth: '420px', margin: 0 }}>
                                {videoPlaybackError}. If this is an uploaded course video, generate a fresh signed stream link below.
                              </p>
                              <button
                                onClick={() => {
                                  setVideoPlaybackError(null);
                                  setVideoPlayerKey(k => k + 1);
                                }}
                                style={{
                                  marginTop: '0.5rem',
                                  background: '#2563eb',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '0.45rem 1rem',
                                  borderRadius: '0.375rem',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem'
                                }}
                              >
                                <RefreshCw style={{ width: '0.85rem', height: '0.85rem' }} /> Retry Video
                              </button>
                            </div>
                          ) : (
                            <video
                              key={`vid-${videoPlayerKey}-${activeLesson.id}`}
                              controls
                              playsInline
                              onError={() => setVideoPlaybackError('The video file could not be loaded or network error occurred')}
                              style={{ width: '100%', maxHeight: '420px', display: 'block' }}
                            >
                              <source src={videoSource.directUrl} type="video/mp4" />
                              Your browser does not support the video tag.
                            </video>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Lesson Description */}
                <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #cbd5e1', marginBottom: '2rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Lecture Overview & Notes</h4>
                  <p style={{ fontSize: '0.95rem', lineHeight: 1.6, color: '#1e293b' }}>{activeLesson.content}</p>
                </div>

                {/* Signed Expiring Handout Download Section */}
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Shield style={{ width: '1.1rem', height: '1.1rem', color: '#10b981' }} /> Protected Course Handouts & Formula Sheets
                  </h4>

                  {activeLesson.resources?.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No attachments for this lesson.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {activeLesson.resources?.map((res: any) => (
                        <div
                          key={res.id}
                          style={{
                            background: '#ffffff', border: '1px solid #cbd5e1', padding: '1rem 1.25rem',
                            borderRadius: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {res.file_type === 'VIDEO' ? (
                              <Video style={{ width: '1.5rem', height: '1.5rem', color: '#2563eb' }} />
                            ) : (
                              <FileText style={{ width: '1.5rem', height: '1.5rem', color: '#ef4444' }} />
                            )}
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{res.title}</div>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Type: {res.file_type} | Size: ~{(res.file_size_bytes / 1024 / 1024).toFixed(1)} MB</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {res.file_type === 'VIDEO' && (
                              <button
                                onClick={async () => {
                                  try {
                                    const token = localStorage.getItem('token');
                                    const linkRes = await axios.get(`http://localhost:5000/api/courses/resources/${res.id}/signed-link`, {
                                      headers: { Authorization: `Bearer ${token}` }
                                    });
                                    if (linkRes.data.signedUrl) {
                                      setActiveLesson({
                                        ...activeLesson,
                                        video_url: linkRes.data.signedUrl
                                      });
                                      setVideoPlaybackError(null);
                                      setVideoPlayerKey(k => k + 1);
                                    }
                                  } catch {
                                    alert('Unable to load video stream for this lesson.');
                                  }
                                }}
                                style={{
                                  background: '#eff6ff',
                                  color: '#2563eb',
                                  border: '1px solid #0284c7',
                                  fontWeight: 600,
                                  padding: '0.5rem 0.9rem',
                                  borderRadius: '0.5rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                  fontSize: '0.85rem'
                                }}
                              >
                                <PlayCircle style={{ width: '0.9rem', height: '0.9rem' }} /> Play Video
                              </button>
                            )}

                            <button
                              onClick={() => fetchSignedLink(res.id)}
                              style={{
                                background: '#2563eb', color: '#ffffff', fontWeight: 600, padding: '0.5rem 1rem',
                                borderRadius: '0.5rem', border: 'none', cursor: 'pointer', display: 'flex',
                                alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem'
                              }}
                            >
                              <Download style={{ width: '0.9rem', height: '0.9rem' }} /> Generate Signed Link
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Generated Signed Link Alert Box */}
                  {signedLinkInfo && (
                    <div style={{ marginTop: '1.25rem', background: '#f0fdf4', border: '1px solid #86efac', padding: '1rem', borderRadius: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ color: '#15803d', fontWeight: 700, fontSize: '0.85rem' }}>✓ 15-Minute Short-Lived Link Active</span>
                        <span style={{ fontSize: '0.75rem', color: '#475569' }}>Expires in {signedLinkInfo.expires} seconds</span>
                      </div>
                      <a
                        href={signedLinkInfo.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#2563eb', wordBreak: 'break-all', fontSize: '0.85rem', textDecoration: 'underline' }}
                      >
                        {signedLinkInfo.url}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p style={{ color: '#64748b' }}>Select a lesson from the curriculum sidebar.</p>
            )}
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
};
