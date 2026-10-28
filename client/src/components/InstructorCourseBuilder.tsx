import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge } from '../design-system';
import {
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  FolderPlus,
  FilePlus,
  Upload,
  ArrowUp,
  ArrowDown,
  FileText,
  Video,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Layers,
  ChevronRight,
  ExternalLink,
  Download,
  Send,
  Clock,
  XCircle,
  HelpCircle
} from 'lucide-react';

interface Course {
  id: string;
  category_id: string;
  category_name?: string;
  title: string;
  title_bangla?: string;
  slug: string;
  description?: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'REJECTED' | 'PUBLISHED';
  rejection_reason?: string;
  instructor_id: string;
}

interface Category {
  id: string;
  name: string;
  name_bangla?: string;
  slug: string;
}

interface LessonResource {
  id: string;
  lesson_id: string;
  title: string;
  file_type: string;
  file_size_bytes: number;
}

interface Lesson {
  id: string;
  module_id: string;
  title: string;
  title_bangla?: string;
  content?: string;
  video_url?: string;
  duration_minutes: number;
  is_free_preview: boolean;
  sort_order: number;
  resources: LessonResource[];
}

interface CourseModule {
  id: string;
  course_id: string;
  title: string;
  title_bangla?: string;
  sort_order: number;
  lessons: Lesson[];
}

export const InstructorCourseBuilder: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // Navigation / State
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [curriculum, setCurriculum] = useState<CourseModule[]>([]);

  // Feedback states
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Course Submission Modal State (Milestone 3 Step 2C)
  const [submitConfirmCourse, setSubmitConfirmCourse] = useState<Course | null>(null);

  // Course Modal state
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [courseForm, setCourseForm] = useState({
    id: '',
    categoryId: '',
    title: '',
    titleBangla: '',
    slug: '',
    description: '',
    status: 'DRAFT' as 'DRAFT' | 'PENDING_REVIEW' | 'REJECTED' | 'PUBLISHED'
  });

  // Module Modal state
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [moduleForm, setModuleForm] = useState({
    id: '',
    title: '',
    titleBangla: '',
    sortOrder: 1
  });

  // Lesson Modal state
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [activeModuleId, setActiveModuleId] = useState<string>('');
  const [lessonForm, setLessonForm] = useState({
    id: '',
    title: '',
    titleBangla: '',
    content: '',
    videoUrl: '',
    durationMinutes: 20,
    isFreePreview: false,
    sortOrder: 1
  });

  // Resource Upload Modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [activeLessonId, setActiveLessonId] = useState<string>('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachAsLessonVideo, setAttachAsLessonVideo] = useState(false);

  const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  };

  // Clear messages automatically
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  // Initial Fetch
  const fetchCoursesAndCategories = async () => {
    setLoading(true);
    try {
      const [coursesRes, catsRes] = await Promise.all([
        axios.get('http://localhost:5000/api/courses?mine=true', { headers: getAuthHeader() }),
        axios.get('http://localhost:5000/api/courses/categories', { headers: getAuthHeader() })
      ]);
      const fetchedCourses: Course[] = coursesRes.data.courses || [];
      setCourses(fetchedCourses);
      setCategories(catsRes.data.categories || []);

      if (fetchedCourses.length > 0) {
        // If currently selected course is still in the fetched list, preserve it; otherwise select first owned course
        const currentStillExists = fetchedCourses.find(c => c.id === selectedCourse?.id);
        if (currentStillExists) {
          selectCourse(currentStillExists);
        } else {
          selectCourse(fetchedCourses[0]);
        }
      } else {
        setSelectedCourse(null);
        setCurriculum([]);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch course builder data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoursesAndCategories();
  }, []);

  const selectCourse = async (course: Course) => {
    setSelectedCourse(course);
    setActionLoading(true);
    try {
      const res = await axios.get(`http://localhost:5000/api/courses/${course.id}/curriculum`, {
        headers: getAuthHeader()
      });
      setCurriculum(res.data.modules || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load course curriculum.');
    } finally {
      setActionLoading(false);
    }
  };

  // Course Save / Edit
  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseForm.title || !courseForm.categoryId || !courseForm.slug) {
      setError('Please fill in required fields (Title, Category, Slug).');
      return;
    }

    setActionLoading(true);
    try {
      if (courseForm.id) {
        // Edit course
        await axios.put(`http://localhost:5000/api/courses/${courseForm.id}`, courseForm, {
          headers: getAuthHeader()
        });
        setSuccess('Course updated successfully.');
      } else {
        // Create course
        const res = await axios.post('http://localhost:5000/api/courses', courseForm, {
          headers: getAuthHeader()
        });
        setSuccess('Course created successfully.');
        courseForm.id = res.data.courseId;
      }
      setIsCourseModalOpen(false);
      await fetchCoursesAndCategories();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save course.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Course for Administrative Review (Milestone 3 Step 2C)
  const handleSubmitForReview = async (course: Course) => {
    setActionLoading(true);
    setError('');
    try {
      const res = await axios.post(
        `http://localhost:5000/api/courses/${course.id}/submit`,
        {},
        { headers: getAuthHeader() }
      );
      setSuccess(`Course '${course.title}' submitted for administrative review.`);
      setSubmitConfirmCourse(null);
      if (selectedCourse?.id === course.id) {
        setSelectedCourse(res.data.course);
      }
      await fetchCoursesAndCategories();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit course for review.');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Publish / Draft (Preserved for ADMIN accounts)
  const handleTogglePublish = async (course: Course) => {
    const newStatus = course.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    setActionLoading(true);
    try {
      await axios.put(
        `http://localhost:5000/api/courses/${course.id}`,
        { status: newStatus },
        { headers: getAuthHeader() }
      );
      setSuccess(`Course ${newStatus === 'PUBLISHED' ? 'published' : 'saved as draft'}.`);
      if (selectedCourse?.id === course.id) {
        setSelectedCourse({ ...selectedCourse, status: newStatus });
      }
      await fetchCoursesAndCategories();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update course publish state.');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Course
  const handleDeleteCourse = async (courseId: string) => {
    if (!window.confirm('Are you sure you want to delete this course and its complete curriculum?')) return;
    setActionLoading(true);
    try {
      await axios.delete(`http://localhost:5000/api/courses/${courseId}`, { headers: getAuthHeader() });
      setSuccess('Course deleted successfully.');
      setSelectedCourse(null);
      setCurriculum([]);
      await fetchCoursesAndCategories();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete course.');
    } finally {
      setActionLoading(false);
    }
  };

  // Module Save (Create / Edit)
  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setActionLoading(true);
    try {
      if (moduleForm.id) {
        await axios.put(`http://localhost:5000/api/courses/modules/${moduleForm.id}`, moduleForm, {
          headers: getAuthHeader()
        });
        setSuccess('Module updated.');
      } else {
        await axios.post(`http://localhost:5000/api/courses/${selectedCourse.id}/modules`, {
          title: moduleForm.title,
          titleBangla: moduleForm.titleBangla || null,
          sortOrder: curriculum.length + 1
        }, { headers: getAuthHeader() });
        setSuccess('Module added.');
      }
      setIsModuleModalOpen(false);
      selectCourse(selectedCourse);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save module.');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Module
  const handleDeleteModule = async (moduleId: string) => {
    if (!window.confirm('Delete this module and all its lessons?')) return;
    setActionLoading(true);
    try {
      await axios.delete(`http://localhost:5000/api/courses/modules/${moduleId}`, { headers: getAuthHeader() });
      setSuccess('Module deleted.');
      if (selectedCourse) selectCourse(selectedCourse);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete module.');
    } finally {
      setActionLoading(false);
    }
  };

  // Reorder Modules
  const handleMoveModule = async (index: number, direction: 'UP' | 'DOWN') => {
    if (!selectedCourse || curriculum.length <= 1) return;
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= curriculum.length) return;

    const newCurriculum = [...curriculum];
    const temp = newCurriculum[index];
    newCurriculum[index] = newCurriculum[targetIndex];
    newCurriculum[targetIndex] = temp;

    setCurriculum(newCurriculum);

    try {
      const moduleIds = newCurriculum.map(m => m.id);
      await axios.patch(`http://localhost:5000/api/courses/${selectedCourse.id}/modules/reorder`, {
        ids: moduleIds
      }, { headers: getAuthHeader() });
      setSuccess('Module order updated.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reorder modules.');
      selectCourse(selectedCourse); // rollback on error
    }
  };

  // Lesson Save (Create / Edit)
  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      if (lessonForm.id) {
        await axios.put(`http://localhost:5000/api/courses/lessons/${lessonForm.id}`, lessonForm, {
          headers: getAuthHeader()
        });
        setSuccess('Lesson updated.');
      } else {
        await axios.post(`http://localhost:5000/api/courses/modules/${activeModuleId}/lessons`, lessonForm, {
          headers: getAuthHeader()
        });
        setSuccess('Lesson created.');
      }
      setIsLessonModalOpen(false);
      if (selectedCourse) selectCourse(selectedCourse);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save lesson.');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Lesson
  const handleDeleteLesson = async (lessonId: string) => {
    if (!window.confirm('Delete this lesson and its resources?')) return;
    setActionLoading(true);
    try {
      await axios.delete(`http://localhost:5000/api/courses/lessons/${lessonId}`, { headers: getAuthHeader() });
      setSuccess('Lesson deleted.');
      if (selectedCourse) selectCourse(selectedCourse);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete lesson.');
    } finally {
      setActionLoading(false);
    }
  };

  // Reorder Lessons
  const handleMoveLesson = async (moduleId: string, lessonIndex: number, direction: 'UP' | 'DOWN') => {
    const mod = curriculum.find(m => m.id === moduleId);
    if (!mod || mod.lessons.length <= 1) return;

    const targetIndex = direction === 'UP' ? lessonIndex - 1 : lessonIndex + 1;
    if (targetIndex < 0 || targetIndex >= mod.lessons.length) return;

    const newLessons = [...mod.lessons];
    const temp = newLessons[lessonIndex];
    newLessons[lessonIndex] = newLessons[targetIndex];
    newLessons[targetIndex] = temp;

    // Local state update
    setCurriculum(curriculum.map(m => m.id === moduleId ? { ...m, lessons: newLessons } : m));

    try {
      const lessonIds = newLessons.map(l => l.id);
      await axios.patch(`http://localhost:5000/api/courses/modules/${moduleId}/lessons/reorder`, {
        ids: lessonIds
      }, { headers: getAuthHeader() });
      setSuccess('Lesson order updated.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reorder lessons.');
      if (selectedCourse) selectCourse(selectedCourse);
    }
  };

  // Resource Upload
  const handleUploadResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', uploadTitle || selectedFile.name);

    setActionLoading(true);
    try {
      const uploadRes = await axios.post(
        `http://localhost:5000/api/courses/lessons/${activeLessonId}/resources/upload`,
        formData,
        {
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      const isMp4 = selectedFile.name.toLowerCase().endsWith('.mp4') || selectedFile.type === 'video/mp4';

      // If requested or if it's an MP4 video, attach as the lesson's video stream
      if (attachAsLessonVideo && isMp4 && uploadRes.data?.resource?.id) {
        const linkRes = await axios.get(
          `http://localhost:5000/api/courses/resources/${uploadRes.data.resource.id}/signed-link`,
          { headers: getAuthHeader() }
        );
        if (linkRes.data?.signedUrl) {
          await axios.put(
            `http://localhost:5000/api/courses/lessons/${activeLessonId}`,
            { videoUrl: linkRes.data.signedUrl },
            { headers: getAuthHeader() }
          );
        }
      }

      setSuccess(
        attachAsLessonVideo && isMp4
          ? 'MP4 video uploaded and attached as the primary Lesson Video!'
          : 'Resource uploaded successfully!'
      );
      setIsUploadModalOpen(false);
      setSelectedFile(null);
      setUploadTitle('');
      setAttachAsLessonVideo(false);
      if (selectedCourse) selectCourse(selectedCourse);
    } catch (err: any) {
      setError(err.response?.data?.error || 'File upload failed. Check format and size (max 25MB).');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Resource
  const handleDeleteResource = async (resourceId: string) => {
    if (!window.confirm('Delete this resource attachment?')) return;
    setActionLoading(true);
    try {
      await axios.delete(`http://localhost:5000/api/courses/resources/${resourceId}`, {
        headers: getAuthHeader()
      });
      setSuccess('Resource deleted.');
      if (selectedCourse) selectCourse(selectedCourse);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete resource.');
    } finally {
      setActionLoading(false);
    }
  };

  // Open/Download Resource via Secure Signed Link
  const handleOpenResource = async (resourceId: string) => {
    setActionLoading(true);
    try {
      const res = await axios.get(`http://localhost:5000/api/courses/resources/${resourceId}/signed-link`, {
        headers: getAuthHeader()
      });
      if (res.data?.signedUrl) {
        window.open(res.data.signedUrl, '_blank', 'noopener,noreferrer');
      } else {
        setError('Failed to generate secure signed link for this resource.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to open resource. Access denied or link expired.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '90vh', background: '#f8fafc', color: '#0f172a', padding: '1.5rem 2.5rem' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header HUD */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Layers size={28} color="#3b82f6" />
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                Instructor Course Builder
              </h1>
              <Badge text="Admin / Instructor Mode" type="info" />
            </div>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
              Design courses, manage curriculum modules, lessons, ordering, and upload secure resources.
            </p>
          </div>

          <Button
            variant="primary"
            onClick={() => {
              setCourseForm({
                id: '',
                categoryId: categories[0]?.id || '',
                title: '',
                titleBangla: '',
                slug: '',
                description: '',
                status: 'DRAFT'
              });
              setIsCourseModalOpen(true);
            }}
          >
            <Plus size={16} /> Create New Course
          </Button>
        </div>

        {/* Notifications */}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            color: '#b91c1c',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600
          }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}
        {success && (
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #86efac',
            color: '#15803d',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600
          }}>
            <CheckCircle size={18} /> {success}
          </div>
        )}

        {/* Main Builder Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
          {/* Left Column: Courses List */}
          <div>
            <Card style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 12px 0', color: '#1e293b' }}>
                Your Courses ({courses.length})
              </h3>
              {loading ? (
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Loading courses...</div>
              ) : courses.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>No courses created yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {courses.map((c) => {
                    const isSelected = selectedCourse?.id === c.id;
                    return (
                      <div
                        key={c.id}
                        onClick={() => selectCourse(c)}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          background: isSelected ? '#eff6ff' : '#ffffff',
                          border: isSelected ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                          boxShadow: isSelected ? '0 1px 3px rgba(37, 99, 235, 0.1)' : '0 1px 2px rgba(0, 0, 0, 0.03)',
                          cursor: 'pointer',
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.92rem', color: isSelected ? '#1d4ed8' : '#0f172a', flex: 1 }}>
                            {c.title}
                          </span>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              background:
                                c.status === 'PUBLISHED'
                                  ? '#f0fdf4'
                                  : c.status === 'PENDING_REVIEW'
                                  ? '#fffbeb'
                                  : c.status === 'REJECTED'
                                  ? '#fef2f2'
                                  : '#f1f5f9',
                              color:
                                c.status === 'PUBLISHED'
                                  ? '#15803d'
                                  : c.status === 'PENDING_REVIEW'
                                  ? '#b45309'
                                  : c.status === 'REJECTED'
                                  ? '#b91c1c'
                                  : '#475569',
                              border:
                                c.status === 'PUBLISHED'
                                  ? '1px solid #bbf7d0'
                                  : c.status === 'PENDING_REVIEW'
                                  ? '1px solid #fde68a'
                                  : c.status === 'REJECTED'
                                  ? '1px solid #fecaca'
                                  : '1px solid #cbd5e1'
                            }}
                          >
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                          Category: {c.category_name || 'General'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Right Column: Selected Course Workspace & Curriculum Builder */}
          <div>
            {selectedCourse ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Course Metadata Banner */}
                <Card style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ flex: '1 1 350px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
                          {selectedCourse.title}
                        </h2>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            background:
                              selectedCourse.status === 'PUBLISHED'
                                ? '#dcfce7'
                                : selectedCourse.status === 'PENDING_REVIEW'
                                ? '#fffbeb'
                                : selectedCourse.status === 'REJECTED'
                                ? '#fee2e2'
                                : '#f1f5f9',
                            color:
                              selectedCourse.status === 'PUBLISHED'
                                ? '#15803d'
                                : selectedCourse.status === 'PENDING_REVIEW'
                                ? '#b45309'
                                : selectedCourse.status === 'REJECTED'
                                ? '#b91c1c'
                                : '#475569',
                            border:
                              selectedCourse.status === 'PUBLISHED'
                                ? '1px solid #86efac'
                                : selectedCourse.status === 'PENDING_REVIEW'
                                ? '1px solid #fde68a'
                                : selectedCourse.status === 'REJECTED'
                                ? '1px solid #fca5a5'
                                : '1px solid #cbd5e1'
                          }}
                        >
                          {selectedCourse.status === 'PUBLISHED' && <CheckCircle2 size={13} />}
                          {selectedCourse.status === 'PENDING_REVIEW' && <Clock size={13} />}
                          {selectedCourse.status === 'REJECTED' && <XCircle size={13} />}
                          {selectedCourse.status === 'DRAFT' && <HelpCircle size={13} />}
                          {selectedCourse.status === 'PENDING_REVIEW' ? 'PENDING REVIEW' : selectedCourse.status}
                        </span>
                      </div>
                      {selectedCourse.title_bangla && (
                        <div style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '2px' }}>
                          {selectedCourse.title_bangla}
                        </div>
                      )}
                      <p style={{ color: '#334155', fontSize: '0.88rem', margin: '8px 0 0 0' }}>
                        {selectedCourse.description || 'No description provided.'}
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {/* Submit for Review Button (Instructors when DRAFT or REJECTED) */}
                      {!isAdmin && (selectedCourse.status === 'DRAFT' || selectedCourse.status === 'REJECTED') && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setSubmitConfirmCourse(selectedCourse)}
                          disabled={actionLoading}
                        >
                          <Send size={14} /> Submit for Review
                        </Button>
                      )}

                      {/* Pending Review Badge Button / Indicator for Instructors */}
                      {!isAdmin && selectedCourse.status === 'PENDING_REVIEW' && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            background: '#fffbeb',
                            border: '1px solid #fde68a',
                            color: '#b45309'
                          }}
                        >
                          <Clock size={14} /> Awaiting Admin Review
                        </span>
                      )}

                      {/* Admin Direct Publishing Toggle */}
                      {isAdmin && (
                        <Button
                          variant={selectedCourse.status === 'PUBLISHED' ? 'secondary' : 'primary'}
                          size="sm"
                          onClick={() => handleTogglePublish(selectedCourse)}
                          disabled={actionLoading}
                        >
                          {selectedCourse.status === 'PUBLISHED' ? (
                            <>
                              <EyeOff size={14} /> Unpublish to Draft
                            </>
                          ) : (
                            <>
                              <Eye size={14} /> Publish Course (Admin)
                            </>
                          )}
                        </Button>
                      )}

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setCourseForm({
                            id: selectedCourse.id,
                            categoryId: selectedCourse.category_id,
                            title: selectedCourse.title,
                            titleBangla: selectedCourse.title_bangla || '',
                            slug: selectedCourse.slug,
                            description: selectedCourse.description || '',
                            status: selectedCourse.status
                          });
                          setIsCourseModalOpen(true);
                        }}
                      >
                        <Edit2 size={14} /> Edit Course
                      </Button>

                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteCourse(selectedCourse.id)}
                        disabled={actionLoading}
                      >
                        <Trash2 size={14} /> Delete
                      </Button>
                    </div>
                  </div>

                  {/* Rejection Feedback Alert Banner */}
                  {selectedCourse.status === 'REJECTED' && (
                    <div
                      style={{
                        marginTop: '16px',
                        padding: '14px 16px',
                        borderRadius: '8px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', fontWeight: 700, fontSize: '0.9rem' }}>
                        <XCircle size={18} /> Course Submission Needs Revision
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#991b1b' }}>
                        <strong style={{ color: '#7f1d1d' }}>Admin Feedback: </strong>
                        {selectedCourse.rejection_reason || 'No specific rejection reason provided by admin.'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#334155', marginTop: '2px' }}>
                        You can update your course title, curriculum, lessons, and resources, then click <strong>"Submit for Review"</strong> to request approval again.
                      </div>
                    </div>
                  )}

                  {/* Pending Review Notice Banner */}
                  {selectedCourse.status === 'PENDING_REVIEW' && (
                    <div
                      style={{
                        marginTop: '16px',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                    >
                      <Clock size={18} color="#b45309" style={{ flexShrink: 0 }} />
                      <div style={{ fontSize: '0.85rem', color: '#92400e' }}>
                        This course is currently in the <strong style={{ color: '#78350f' }}>Admin Moderation Queue</strong>. An administrator will review its structure, syllabus, and resources before approving it for student enrollment.
                      </div>
                    </div>
                  )}
                </Card>

                {/* Modules & Lessons Hierarchy Builder */}
                <Card style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                        Curriculum Structure
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        Organize modules and lessons in logical sequential learning order.
                      </span>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setModuleForm({
                          id: '',
                          title: '',
                          titleBangla: '',
                          sortOrder: curriculum.length + 1
                        });
                        setIsModuleModalOpen(true);
                      }}
                    >
                      <FolderPlus size={16} /> Add Module
                    </Button>
                  </div>

                  {curriculum.length === 0 ? (
                    <div style={{
                      padding: '36px',
                      textAlign: 'center',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px dashed rgba(255, 255, 255, 0.1)'
                    }}>
                      <BookOpen size={36} color="#64748b" style={{ margin: '0 auto 8px auto' }} />
                      <p style={{ color: '#64748b', margin: 0 }}>This course has no modules yet.</p>
                      <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                        Click "Add Module" to begin creating chapters or syllabus sections.
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {curriculum.map((mod, modIdx) => (
                        <div
                          key={mod.id}
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '16px'
                          }}
                        >
                          {/* Module Header & Controls */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                width: '24px',
                                height: '24px',
                                background: '#3b82f6',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 700
                              }}>
                                {modIdx + 1}
                              </span>
                              <div>
                                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>
                                  {mod.title}
                                </span>
                                {mod.title_bangla && (
                                  <span style={{ color: '#64748b', fontSize: '0.82rem', marginLeft: '8px' }}>
                                    ({mod.title_bangla})
                                  </span>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                onClick={() => handleMoveModule(modIdx, 'UP')}
                                disabled={modIdx === 0}
                                style={{
                                  background: modIdx === 0 ? '#f8fafc' : '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '4px',
                                  padding: '4px 8px',
                                  cursor: modIdx === 0 ? 'not-allowed' : 'pointer',
                                  color: modIdx === 0 ? '#94a3b8' : '#1e293b'
                                }}
                                title="Move Module Up"
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                onClick={() => handleMoveModule(modIdx, 'DOWN')}
                                disabled={modIdx === curriculum.length - 1}
                                style={{
                                  background: modIdx === curriculum.length - 1 ? '#f8fafc' : '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '4px',
                                  padding: '4px 8px',
                                  cursor: modIdx === curriculum.length - 1 ? 'not-allowed' : 'pointer',
                                  color: modIdx === curriculum.length - 1 ? '#94a3b8' : '#1e293b'
                                }}
                                title="Move Module Down"
                              >
                                <ArrowDown size={14} />
                              </button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setActiveModuleId(mod.id);
                                  setLessonForm({
                                    id: '',
                                    title: '',
                                    titleBangla: '',
                                    content: '',
                                    videoUrl: '',
                                    durationMinutes: 20,
                                    isFreePreview: false,
                                    sortOrder: mod.lessons.length + 1
                                  });
                                  setIsLessonModalOpen(true);
                                }}
                              >
                                <FilePlus size={14} /> Add Lesson
                              </Button>
                              <button
                                onClick={() => handleDeleteModule(mod.id)}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '6px 8px',
                                  cursor: 'pointer',
                                  color: '#f87171'
                                }}
                                title="Delete Module"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Lessons List inside Module */}
                          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {mod.lessons.length === 0 ? (
                              <div style={{ fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic', padding: '6px 0' }}>
                                No lessons in this module. Click "Add Lesson" above.
                              </div>
                            ) : (
                              mod.lessons.map((lesson, lessonIdx) => (
                                <div
                                  key={lesson.id}
                                  style={{
                                    background: '#f8fafc',
                                    borderRadius: '6px',
                                    border: '1px solid #e2e8f0',
                                    padding: '10px 14px'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{lessonIdx + 1}.</span>
                                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
                                        {lesson.title}
                                      </span>
                                      {lesson.is_free_preview && (
                                        <Badge text="Free Preview" type="info" />
                                      )}
                                      {lesson.video_url && (
                                        <span style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          fontSize: '0.72rem',
                                          background: '#eff6ff',
                                          color: '#1d4ed8',
                                          border: '1px solid #bfdbfe',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontWeight: 600
                                        }}>
                                          <Video size={11} /> Video
                                        </span>
                                      )}
                                      <span style={{ color: '#64748b', fontSize: '0.78rem' }}>
                                        ({lesson.duration_minutes} min)
                                      </span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <button
                                        onClick={() => handleMoveLesson(mod.id, lessonIdx, 'UP')}
                                        disabled={lessonIdx === 0}
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          cursor: lessonIdx === 0 ? 'not-allowed' : 'pointer',
                                          color: lessonIdx === 0 ? '#cbd5e1' : '#334155'
                                        }}
                                        title="Move Lesson Up"
                                      >
                                        <ArrowUp size={13} />
                                      </button>
                                      <button
                                        onClick={() => handleMoveLesson(mod.id, lessonIdx, 'DOWN')}
                                        disabled={lessonIdx === mod.lessons.length - 1}
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          cursor: lessonIdx === mod.lessons.length - 1 ? 'not-allowed' : 'pointer',
                                          color: lessonIdx === mod.lessons.length - 1 ? '#cbd5e1' : '#334155'
                                        }}
                                        title="Move Lesson Down"
                                      >
                                        <ArrowDown size={13} />
                                      </button>
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                          setActiveModuleId(mod.id);
                                          setLessonForm({
                                            id: lesson.id,
                                            title: lesson.title,
                                            titleBangla: lesson.title_bangla || '',
                                            content: lesson.content || '',
                                            videoUrl: lesson.video_url || '',
                                            durationMinutes: lesson.duration_minutes || 20,
                                            isFreePreview: Boolean((lesson as any).isFreePreview ?? lesson.is_free_preview),
                                            sortOrder: lesson.sort_order || (lessonIdx + 1)
                                          });
                                          setIsLessonModalOpen(true);
                                        }}
                                      >
                                        <Edit2 size={12} /> Edit
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setActiveLessonId(lesson.id);
                                          setSelectedFile(null);
                                          setUploadTitle('');
                                          setAttachAsLessonVideo(false);
                                          setIsUploadModalOpen(true);
                                        }}
                                      >
                                        <Upload size={12} /> Upload Resource
                                      </Button>
                                      <button
                                        onClick={() => handleDeleteLesson(lesson.id)}
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          cursor: 'pointer',
                                          color: '#ef4444'
                                        }}
                                        title="Delete Lesson"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Attached Resources */}
                                  {lesson.resources && lesson.resources.length > 0 && (
                                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.04)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                      {lesson.resources.map(res => (
                                        <div
                                          key={res.id}
                                          style={{
                                            background: 'rgba(59, 130, 246, 0.08)',
                                            border: '1px solid rgba(59, 130, 246, 0.2)',
                                            borderRadius: '6px',
                                            padding: '4px 10px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            fontSize: '0.8rem',
                                            transition: 'all 0.15s ease'
                                          }}
                                        >
                                          <div
                                            onClick={() => handleOpenResource(res.id)}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '6px',
                                              cursor: 'pointer',
                                              color: '#93c5fd'
                                            }}
                                            title="Click to view or download resource via secure signed link"
                                          >
                                            {res.file_type === 'VIDEO' ? (
                                              <Video size={13} color="#38bdf8" />
                                            ) : (
                                              <FileText size={13} color="#60a5fa" />
                                            )}
                                            <span style={{ fontWeight: 600, textDecoration: 'underline' }}>{res.title}</span>
                                            <span style={{ color: '#64748b', fontSize: '0.72rem' }}>({res.file_type})</span>
                                            <ExternalLink size={12} color="#38bdf8" style={{ marginLeft: '2px' }} />
                                          </div>
                                          <button
                                            onClick={() => handleDeleteResource(res.id)}
                                            style={{
                                              background: 'transparent',
                                              border: 'none',
                                              color: '#ef4444',
                                              cursor: 'pointer',
                                              padding: '0 2px',
                                              marginLeft: '6px',
                                              fontSize: '1rem',
                                              lineHeight: 1
                                            }}
                                            title="Delete Resource"
                                          >
                                            ×
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            ) : (
              <Card style={{ padding: '48px 24px', textAlign: 'center', background: '#f8fafc' }}>
                <div style={{ maxWidth: '420px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                    <Plus size={24} />
                  </div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    {courses.length === 0 ? 'No Courses Found' : 'No Course Selected'}
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0, lineHeight: 1.5 }}>
                    {courses.length === 0
                      ? 'You have not created any courses yet. Click the button below to create your first course and start building curriculum.'
                      : 'Select a course from the left panel to edit its curriculum modules, lessons, and resources.'}
                  </p>
                  {courses.length === 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setCourseForm({
                            id: '',
                            categoryId: categories[0]?.id || '',
                            title: '',
                            titleBangla: '',
                            slug: '',
                            description: '',
                            status: 'DRAFT'
                          });
                          setIsCourseModalOpen(true);
                        }}
                      >
                        <Plus size={16} /> Create Your First Course
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Modal: Create/Edit Course */}
        {isCourseModalOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}>
            <Card style={{ width: '500px', maxWidth: '90%' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 16px 0' }}>
                {courseForm.id ? 'Edit Course' : 'Create New Course'}
              </h3>
              <form onSubmit={handleSaveCourse} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                    Category *
                  </label>
                  <select
                    value={courseForm.categoryId}
                    onChange={(e) => setCourseForm({ ...courseForm, categoryId: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a'
                    }}
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                    Course Title (English) *
                  </label>
                  <input
                    type="text"
                    value={courseForm.title}
                    onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                    placeholder="e.g. Comprehensive Bank Math Mastery"
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                    Course Title (বাংলা)
                  </label>
                  <input
                    type="text"
                    value={courseForm.titleBangla}
                    onChange={(e) => setCourseForm({ ...courseForm, titleBangla: e.target.value })}
                    placeholder="e.g. সম্পূর্ণ ব্যাংক গণিত প্রস্তুতি"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                    URL Slug *
                  </label>
                  <input
                    type="text"
                    value={courseForm.slug}
                    onChange={(e) => setCourseForm({ ...courseForm, slug: e.target.value })}
                    placeholder="e.g. bank-math-mastery"
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={courseForm.description}
                    onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                    placeholder="Target exam syllabus, eligibility, and topics covered..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                    Status
                  </label>
                  {isAdmin ? (
                    <select
                      value={courseForm.status}
                      onChange={(e) => setCourseForm({ ...courseForm, status: e.target.value as any })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#0f172a'
                      }}
                    >
                      <option value="DRAFT">DRAFT (Hidden from Students)</option>
                      <option value="PENDING_REVIEW">PENDING_REVIEW (Moderation Queue)</option>
                      <option value="REJECTED">REJECTED (Needs Revision)</option>
                      <option value="PUBLISHED">PUBLISHED (Live for Students)</option>
                    </select>
                  ) : (
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#64748b',
                        fontSize: '0.9rem'
                      }}
                    >
                      {courseForm.status === 'PUBLISHED' && 'PUBLISHED (Live for Students)'}
                      {courseForm.status === 'PENDING_REVIEW' && 'PENDING_REVIEW (Under Admin Review)'}
                      {courseForm.status === 'REJECTED' && 'REJECTED (Needs Revision & Resubmission)'}
                      {courseForm.status === 'DRAFT' && 'DRAFT (Use "Submit for Review" once ready)'}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                  <Button variant="secondary" onClick={() => setIsCourseModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={actionLoading}>
                    {actionLoading ? 'Saving...' : 'Save Course'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Modal: Create/Edit Module */}
        {isModuleModalOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}>
            <Card style={{ width: '450px', maxWidth: '90%' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 16px 0' }}>
                Add Module / Section
              </h3>
              <form onSubmit={handleSaveModule} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                    Module Title *
                  </label>
                  <input
                    type="text"
                    value={moduleForm.title}
                    onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                    placeholder="e.g. Module 1: Number Systems & HCF/LCM"
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                    Module Title (বাংলা)
                  </label>
                  <input
                    type="text"
                    value={moduleForm.titleBangla}
                    onChange={(e) => setModuleForm({ ...moduleForm, titleBangla: e.target.value })}
                    placeholder="e.g. অধ্যায় ১: লসাগু ও গসাগু"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                  <Button variant="secondary" onClick={() => setIsModuleModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={actionLoading}>
                    Save Module
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Modal: Create/Edit Lesson */}
        {isLessonModalOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}>
            <Card style={{ width: '500px', maxWidth: '90%' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 16px 0' }}>
                Add Lesson
              </h3>
              <form onSubmit={handleSaveLesson} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                    Lesson Title *
                  </label>
                  <input
                    type="text"
                    value={lessonForm.title}
                    onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                    placeholder="e.g. Unit Digit Tricks & Divisibility Rules"
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                    Lesson Title (বাংলা)
                  </label>
                  <input
                    type="text"
                    value={lessonForm.titleBangla}
                    onChange={(e) => setLessonForm({ ...lessonForm, titleBangla: e.target.value })}
                    placeholder="e.g. একক স্থানীয় অংক নির্ণয়ের শর্টকাট"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                    Lecture Content / Notes
                  </label>
                  <textarea
                    rows={3}
                    value={lessonForm.content}
                    onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })}
                    placeholder="Enter summary notes, formulas, or key instructions..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a'
                    }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.85rem', color: '#334155' }}>
                      Lesson Video URL (YouTube or MP4 Stream)
                    </label>
                    {lessonForm.videoUrl && (
                      <span style={{ fontSize: '0.72rem', color: '#38bdf8' }}>
                        {lessonForm.videoUrl.includes('youtu') ? '✓ YouTube link recognized' : '✓ Video source set'}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={lessonForm.videoUrl}
                    onChange={(e) => setLessonForm({ ...lessonForm, videoUrl: e.target.value })}
                    placeholder="e.g. https://www.youtube.com/watch?v=... or https://youtu.be/..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a'
                    }}
                  />
                  <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                    Supports youtube.com/watch, youtu.be, youtube.com/embed, youtube.com/shorts, or uploaded MP4 streaming links.
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                      Duration (Minutes)
                    </label>
                    <input
                      type="number"
                      value={lessonForm.durationMinutes}
                      onChange={(e) => setLessonForm({ ...lessonForm, durationMinutes: parseInt(e.target.value) || 15 })}
                      min={1}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#0f172a'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                      Free Preview
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={lessonForm.isFreePreview}
                        onChange={(e) => setLessonForm({ ...lessonForm, isFreePreview: e.target.checked })}
                      />
                      <span style={{ fontSize: '0.85rem', color: '#334155' }}>Allow free trial access</span>
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                  <Button variant="secondary" onClick={() => setIsLessonModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={actionLoading}>
                    Save Lesson
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Modal: Multipart Real Resource Upload */}
        {isUploadModalOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}>
            <Card style={{ width: '480px', maxWidth: '90%' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 16px 0' }}>
                Upload Lesson Resource
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 16px 0' }}>
                Files are stored privately and served exclusively via secure 15-minute time-expiring signed tokens. Supported: PDF, MP4, Word, PPT (Max 25MB).
              </p>

              <form onSubmit={handleUploadResource} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                    Resource Title
                  </label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="e.g. Bangladesh Bank Math Formulas Cheat Sheet"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                    Select File *
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.mp4,.doc,.docx,.ppt,.pptx,.txt"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        setSelectedFile(file);
                        if (!uploadTitle) setUploadTitle(file.name);
                        if (file.name.toLowerCase().endsWith('.mp4') || file.type === 'video/mp4') {
                          setAttachAsLessonVideo(true);
                        }
                      }
                    }}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a'
                    }}
                  />
                </div>

                {selectedFile && (selectedFile.name.toLowerCase().endsWith('.mp4') || selectedFile.type === 'video/mp4') && (
                  <div style={{
                    background: 'rgba(56, 189, 248, 0.1)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '6px',
                    padding: '10px 12px'
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={attachAsLessonVideo}
                        onChange={(e) => setAttachAsLessonVideo(e.target.checked)}
                      />
                      <span style={{ fontSize: '0.82rem', color: '#38bdf8', fontWeight: 600 }}>
                        Set as active Lesson Video for students
                      </span>
                    </label>
                    <span style={{ display: 'block', fontSize: '0.74rem', color: '#64748b', marginTop: '4px' }}>
                      Enabling this attaches the MP4 to this lesson's video player with browser streaming.
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                  <Button variant="secondary" onClick={() => setIsUploadModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={actionLoading || !selectedFile}>
                    {actionLoading ? 'Uploading...' : 'Upload & Attach'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Modal: Confirm Submit for Review */}
        {submitConfirmCourse && (
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
              zIndex: 1000,
              backdropFilter: 'blur(4px)'
            }}
          >
            <Card style={{ width: '500px', maxWidth: '90%', padding: '24px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#818cf8'
                  }}
                >
                  <Send size={20} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                  Submit Course for Review
                </h3>
              </div>

              <p style={{ color: '#334155', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '16px' }}>
                Are you ready to submit <strong>"{submitConfirmCourse.title}"</strong> to the administration team?
              </p>

              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '12px',
                  fontSize: '0.85rem',
                  color: '#64748b',
                  marginBottom: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div>• The course status will change to <strong>PENDING_REVIEW</strong>.</div>
                <div>• Platform administrators will evaluate syllabus completeness, quality, and attached resources.</div>
                <div>• Once approved, your course will be live in the student catalog.</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <Button
                  variant="secondary"
                  onClick={() => setSubmitConfirmCourse(null)}
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleSubmitForReview(submitConfirmCourse)}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Submitting...' : 'Yes, Submit for Review'}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};
