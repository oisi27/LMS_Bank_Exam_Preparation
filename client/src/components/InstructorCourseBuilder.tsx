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
  ChevronLeft,
  ExternalLink,
  Download,
  Send,
  Clock,
  XCircle,
  HelpCircle,
  Search,
  X,
  Tag,
  User,
  Filter,
  Archive,
  RotateCcw
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
  instructor_name?: string;
  created_at?: string;
  is_archived?: number;
  archived_at?: string;
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
  const isAdmin = user?.role === 'ADMIN' || (() => {
    try {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u).role === 'ADMIN' : false;
    } catch {
      return false;
    }
  })();

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

  // Course List UI State (Search, Filters, Pagination)
  const [courseSearch, setCourseSearch] = useState<string>('');
  // Requirement 1: For ADMIN users, make the Course Builder catalog initially display PUBLISHED courses under All Categories.
  // Instructors initially see ALL their courses.
  const [courseStatusFilter, setCourseStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT' | 'ARCHIVED' | 'PENDING_REVIEW'>(() => {
    try {
      const u = localStorage.getItem('user');
      if (u && JSON.parse(u).role === 'ADMIN') return 'PUBLISHED';
    } catch {
      // fallback
    }
    return user?.role === 'ADMIN' ? 'PUBLISHED' : 'ALL';
  });
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const COURSES_PER_PAGE = 10;

  // Predictable initial view on page refresh: align default filter once user role is confirmed
  const initialFilterSet = React.useRef(false);
  useEffect(() => {
    if (user && !initialFilterSet.current) {
      initialFilterSet.current = true;
      if (user.role === 'ADMIN') {
        setCourseStatusFilter('PUBLISHED');
      }
    }
  }, [user]);

  // Status badge styling helper
  const getStatusBadgeStyle = (status: string, isArchived?: number) => {
    if (isArchived) {
      return {
        bg: '#f1f5f9',
        color: '#475569',
        border: '1px solid #cbd5e1',
        label: 'Archived'
      };
    }
    switch (status) {
      case 'PUBLISHED':
        return {
          bg: '#f0fdf4',
          color: '#15803d',
          border: '1px solid #bbf7d0',
          label: 'Published'
        };
      case 'PENDING_REVIEW':
        return {
          bg: '#fffbeb',
          color: '#b45309',
          border: '1px solid #fde68a',
          label: 'In Review'
        };
      case 'REJECTED':
        return {
          bg: '#fef2f2',
          color: '#b91c1c',
          border: '1px solid #fecaca',
          label: 'Rejected'
        };
      case 'DRAFT':
      default:
        return {
          bg: '#f8fafc',
          color: '#475569',
          border: '1px solid #cbd5e1',
          label: 'Draft'
        };
    }
  };

  // Group categories by distinct normalized name to handle database duplication gracefully
  // Different category IDs may share the same display name.
  // This aggregation preserves all categoryIds for filtering and disambiguation.
  const distinctCategories = React.useMemo(() => {
    const map = new Map<string, {
      key: string;
      displayName: string;
      categoryIds: Set<string>;
      primaryId: string;
      totalCount: number;
      publishedCount: number;
      draftCount: number;
    }>();

    // 1. Initialize from categories list
    categories.forEach((cat) => {
      const rawName = (cat.name || 'General').trim();
      const key = rawName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          key,
          displayName: rawName,
          categoryIds: new Set<string>([cat.id]),
          primaryId: cat.id,
          totalCount: 0,
          publishedCount: 0,
          draftCount: 0
        });
      } else {
        map.get(key)!.categoryIds.add(cat.id);
      }
    });

    // 2. Count courses by status
    courses.forEach((c) => {
      const rawName = (c.category_name || '').trim();
      let key = rawName.toLowerCase();
      let entry = map.get(key);

      // If category_name didn't match directly, locate by category_id
      if (!entry && c.category_id) {
        for (const item of map.values()) {
          if (item.categoryIds.has(c.category_id)) {
            entry = item;
            key = item.key;
            break;
          }
        }
      }

      if (entry) {
        entry.totalCount++;
        if (c.status === 'PUBLISHED' && !c.is_archived) {
          entry.publishedCount++;
        } else if (c.status === 'DRAFT' && !c.is_archived) {
          entry.draftCount++;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [categories, courses]);

  // Status counts dynamically calculated respecting active category and search filter
  const statusCounts = React.useMemo(() => {
    let published = 0;
    let draft = 0;
    let archived = 0;
    let pending = 0;
    let total = 0;

    courses.forEach((c) => {
      // 1. Check category filter
      if (selectedCategoryFilter !== 'ALL') {
        const activeCategory = distinctCategories.find((dc) => dc.key === selectedCategoryFilter);
        if (activeCategory) {
          const matchesId = activeCategory.categoryIds.has(c.category_id);
          const matchesName = (c.category_name || '').trim().toLowerCase() === activeCategory.key;
          if (!matchesId && !matchesName) return;
        }
      }

      // 2. Check search filter
      if (courseSearch.trim()) {
        const query = courseSearch.trim().toLowerCase();
        const matchesTitle = c.title.toLowerCase().includes(query);
        const matchesBangla = c.title_bangla?.toLowerCase().includes(query) ?? false;
        const matchesCategory = c.category_name?.toLowerCase().includes(query) ?? false;
        const matchesInstructor = c.instructor_name?.toLowerCase().includes(query) ?? false;
        const matchesId = c.id.toLowerCase().includes(query);
        if (!matchesTitle && !matchesBangla && !matchesCategory && !matchesInstructor && !matchesId) {
          return;
        }
      }

      total++;
      if (c.is_archived) {
        archived++;
      } else {
        if (c.status === 'PUBLISHED') published++;
        else if (c.status === 'DRAFT') draft++;
        else if (c.status === 'PENDING_REVIEW') pending++;
      }
    });

    return { published, draft, archived, pending, total };
  }, [courses, selectedCategoryFilter, courseSearch, distinctCategories]);

  // Filtered courses based on status, category (matching all categoryIds for that name), and search query
  const filteredCourses = React.useMemo(() => {
    return courses.filter((c) => {
      // 1. Status Filter
      if (courseStatusFilter === 'PUBLISHED') {
        if (c.status !== 'PUBLISHED' || c.is_archived) return false;
      } else if (courseStatusFilter === 'DRAFT') {
        if (c.status !== 'DRAFT' || c.is_archived) return false;
      } else if (courseStatusFilter === 'ARCHIVED') {
        if (!c.is_archived) return false;
      } else if (courseStatusFilter === 'PENDING_REVIEW') {
        if (c.status !== 'PENDING_REVIEW' || c.is_archived) return false;
      }
      // If courseStatusFilter === 'ALL', all courses are shown

      // 2. Category Filter (matches ALL category IDs sharing the normalized category name)
      if (selectedCategoryFilter !== 'ALL') {
        const activeCategory = distinctCategories.find((dc) => dc.key === selectedCategoryFilter);
        if (activeCategory) {
          const matchesId = activeCategory.categoryIds.has(c.category_id);
          const matchesName = (c.category_name || '').trim().toLowerCase() === activeCategory.key;
          if (!matchesId && !matchesName) {
            return false;
          }
        }
      }
      // 3. Search query (matches title, bengali title, category name, instructor name, and course ID)
      if (courseSearch.trim()) {
        const query = courseSearch.trim().toLowerCase();
        const matchesTitle = c.title.toLowerCase().includes(query);
        const matchesBangla = c.title_bangla?.toLowerCase().includes(query) ?? false;
        const matchesCategory = c.category_name?.toLowerCase().includes(query) ?? false;
        const matchesInstructor = c.instructor_name?.toLowerCase().includes(query) ?? false;
        const matchesId = c.id.toLowerCase().includes(query);
        return matchesTitle || matchesBangla || matchesCategory || matchesInstructor || matchesId;
      }
      return true;
    });
  }, [courses, courseStatusFilter, selectedCategoryFilter, courseSearch, distinctCategories]);

  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / COURSES_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedCourses = React.useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * COURSES_PER_PAGE;
    return filteredCourses.slice(startIndex, startIndex + COURSES_PER_PAGE);
  }, [filteredCourses, safeCurrentPage]);

  // Automatically synchronize selectedCourse with the active filtered list (Requirements 2 & 3)
  // When switching between Published, Drafts, Archived, etc., ensures right-side editor stays consistent
  useEffect(() => {
    if (loading || courses.length === 0) return;

    const isCurrentValid = selectedCourse
      ? filteredCourses.some((c) => c.id === selectedCourse.id)
      : false;

    if (!isCurrentValid) {
      if (filteredCourses.length > 0) {
        selectCourse(filteredCourses[0]);
      } else if (selectedCourse !== null) {
        setSelectedCourse(null);
        setCurriculum([]);
      }
    }
  }, [filteredCourses, loading]);

  // Check if selected course is in the filtered list, but on a different pagination page
  const isSelectedCourseOnAnotherPage = selectedCourse
    ? !paginatedCourses.some((c) => c.id === selectedCourse.id) && filteredCourses.some((c) => c.id === selectedCourse.id)
    : false;

  // Safe "Locate in Catalog" handler that brings the selected course into view
  const handleLocateSelectedCourse = () => {
    if (!selectedCourse) return;
    setCourseSearch('');
    setSelectedCategoryFilter('ALL');

    if (selectedCourse.is_archived) {
      setCourseStatusFilter('ARCHIVED');
    } else if (selectedCourse.status === 'PUBLISHED') {
      setCourseStatusFilter('PUBLISHED');
    } else if (selectedCourse.status === 'DRAFT') {
      setCourseStatusFilter('DRAFT');
    } else {
      setCourseStatusFilter('ALL');
    }

    const isTargetArchived = Boolean(selectedCourse.is_archived);
    const targetStatus = selectedCourse.status;
    const matchingCourses = courses.filter((c) => {
      if (isTargetArchived) return Boolean(c.is_archived);
      if (targetStatus === 'PUBLISHED') return c.status === 'PUBLISHED' && !c.is_archived;
      if (targetStatus === 'DRAFT') return c.status === 'DRAFT' && !c.is_archived;
      return true;
    });
    const idx = matchingCourses.findIndex((c) => c.id === selectedCourse.id);
    if (idx !== -1) {
      setCurrentPage(Math.floor(idx / COURSES_PER_PAGE) + 1);
    } else {
      setCurrentPage(1);
    }
  };

  // Reversible Archive Course (Admin only)
  const handleArchiveCourse = async (course: Course) => {
    if (!window.confirm(`Archive "${course.title}"? It will be moved to the Archived tab and hidden from active lists.`)) return;
    setActionLoading(true);
    try {
      await axios.put(`http://localhost:5000/api/courses/${course.id}/archive`, {}, {
        headers: getAuthHeader()
      });
      setSuccess(`Course "${course.title}" moved to archive.`);
      await fetchCoursesAndCategories();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to archive course.');
    } finally {
      setActionLoading(false);
    }
  };

  // Reversible Restore Course from Archive (Admin only)
  const handleRestoreCourse = async (course: Course) => {
    setActionLoading(true);
    try {
      await axios.put(`http://localhost:5000/api/courses/${course.id}/restore`, {}, {
        headers: getAuthHeader()
      });
      setSuccess(`Course "${course.title}" restored to active drafts.`);
      await fetchCoursesAndCategories();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to restore course.');
    } finally {
      setActionLoading(false);
    }
  };

  // Ensure current page is valid when totalPages changes
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

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
        if (isAdmin) {
          // Requirement 1: When Admin opens Course Builder, automatically select the first published non-archived course
          const firstPublished = fetchedCourses.find(c => c.status === 'PUBLISHED' && !c.is_archived);
          if (firstPublished) {
            selectCourse(firstPublished);
          } else {
            selectCourse(fetchedCourses[0]);
          }
        } else {
          // For instructors, select their first active course
          const firstActive = fetchedCourses.find(c => !c.is_archived);
          selectCourse(firstActive || fetchedCourses[0]);
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
    if (courseForm.id) {
      const targetCourse = courses.find((c) => c.id === courseForm.id);
      if (targetCourse?.is_archived) {
        setError('Archived courses cannot be modified. Restore to Draft first.');
        return;
      }
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
    if (course.is_archived) {
      setError('Archived courses cannot be submitted for review. Restore to Draft first.');
      return;
    }
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
    if (course.is_archived) {
      setError('Archived courses cannot be published. Restore to Draft first.');
      return;
    }
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
    const target = courses.find((c) => c.id === courseId);
    if (target?.is_archived) {
      setError('Archived courses cannot be deleted directly. Restore to Draft first.');
      return;
    }
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
    if (selectedCourse.is_archived) {
      setError('Archived courses are read-only. Restore to Draft first.');
      return;
    }
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
    if (selectedCourse?.is_archived) {
      setError('Archived courses are read-only. Restore to Draft first.');
      return;
    }
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
    if (selectedCourse.is_archived) {
      setError('Archived courses are read-only. Restore to Draft first.');
      return;
    }
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
    if (selectedCourse?.is_archived) {
      setError('Archived courses are read-only. Restore to Draft first.');
      return;
    }
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
    if (selectedCourse?.is_archived) {
      setError('Archived courses are read-only. Restore to Draft first.');
      return;
    }
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
    if (selectedCourse?.is_archived) {
      setError('Archived courses are read-only. Restore to Draft first.');
      return;
    }
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
    if (selectedCourse?.is_archived) {
      setError('Archived courses are read-only. Restore to Draft first.');
      return;
    }
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
    if (selectedCourse?.is_archived) {
      setError('Archived courses are read-only. Restore to Draft first.');
      return;
    }
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
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 380px) 1fr', gap: '24px', alignItems: 'start' }}>
          {/* Left Column: Courses List */}
          <div>
            <Card style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Header with Title and Category Dropdown */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    Course Catalog
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                    {filteredCourses.length === courses.length
                      ? `${courses.length} total courses`
                      : `Showing ${filteredCourses.length} of ${courses.length} courses`}
                  </p>
                </div>
                {distinctCategories.length > 0 && (
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => {
                      setSelectedCategoryFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      fontSize: '0.78rem',
                      padding: '5px 8px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      color: '#334155',
                      maxWidth: '150px',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                    title="Filter by category"
                  >
                    <option value="ALL">All Categories ({courses.length})</option>
                    {distinctCategories.map((cat) => (
                      <option key={cat.key} value={cat.key}>
                        {cat.displayName} ({cat.totalCount})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Live Search Bar */}
              <div style={{ position: 'relative' }}>
                <Search
                  size={15}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                    pointerEvents: 'none'
                  }}
                />
                <input
                  type="text"
                  placeholder="Search title, instructor, ID..."
                  value={courseSearch}
                  onChange={(e) => {
                    setCourseSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '7px 28px 7px 32px',
                    fontSize: '0.82rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                {courseSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setCourseSearch('');
                      setCurrentPage(1);
                    }}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Status Filter Segmented Pills (Requirement 2: Published, Drafts, Archived, Under Review, All Courses) */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { key: 'PUBLISHED' as const, label: 'Published', count: statusCounts.published },
                  { key: 'DRAFT' as const, label: 'Drafts', count: statusCounts.draft },
                  { key: 'ARCHIVED' as const, label: 'Archived', count: statusCounts.archived },
                  { key: 'PENDING_REVIEW' as const, label: 'Under Review', count: statusCounts.pending },
                  { key: 'ALL' as const, label: 'All Courses', count: statusCounts.total }
                ].map((tab) => {
                  const isActive = courseStatusFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => {
                        const nextFilter = tab.key;
                        setCourseStatusFilter(nextFilter as any);
                        setCurrentPage(1);

                        // Immediate selection sync on tab click (Requirements 2 & 3)
                        const nextFiltered = courses.filter((c) => {
                          if (nextFilter === 'PUBLISHED') return c.status === 'PUBLISHED' && !c.is_archived;
                          if (nextFilter === 'DRAFT') return c.status === 'DRAFT' && !c.is_archived;
                          if (nextFilter === 'ARCHIVED') return Boolean(c.is_archived);
                          if (nextFilter === 'PENDING_REVIEW') return c.status === 'PENDING_REVIEW' && !c.is_archived;
                          return true;
                        });

                        const isStillValid = selectedCourse ? nextFiltered.some((c) => c.id === selectedCourse.id) : false;
                        if (!isStillValid) {
                          if (nextFiltered.length > 0) {
                            selectCourse(nextFiltered[0]);
                          } else {
                            setSelectedCourse(null);
                            setCurriculum([]);
                          }
                        }
                      }}
                      style={{
                        flex: '1 1 auto',
                        padding: '4px 6px',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: isActive ? 700 : 500,
                        background: isActive ? '#2563eb' : '#f1f5f9',
                        color: isActive ? '#ffffff' : '#475569',
                        border: isActive ? '1px solid #1d4ed8' : '1px solid #e2e8f0',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                        display: 'inline-flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <span>{tab.label}</span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '1px 5px',
                          borderRadius: '9999px',
                          background: isActive ? 'rgba(255, 255, 255, 0.25)' : '#e2e8f0',
                          color: isActive ? '#ffffff' : '#64748b',
                          fontWeight: 700
                        }}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Pagination Helper: When selected course is inside filtered results but on another pagination page */}

              {/* Banner B: When selected course is inside filtered results but on another pagination page */}
              {selectedCourse && isSelectedCourseOnAnotherPage && (
                <div
                  style={{
                    padding: '8px 10px',
                    background: '#f0f9ff',
                    border: '1px dashed #7dd3fc',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}
                >
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    <span style={{ color: '#0369a1', fontWeight: 600 }}>In Editor: </span>
                    <span style={{ fontWeight: 700, color: '#0c4a6e' }}>{selectedCourse.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const idx = filteredCourses.findIndex((c) => c.id === selectedCourse.id);
                      if (idx !== -1) {
                        setCurrentPage(Math.floor(idx / COURSES_PER_PAGE) + 1);
                      }
                    }}
                    style={{
                      background: '#e0f2fe',
                      border: '1px solid #bae6fd',
                      color: '#0284c7',
                      fontSize: '0.70rem',
                      fontWeight: 600,
                      borderRadius: '4px',
                      padding: '2px 6px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Jump to Page {Math.floor(filteredCourses.findIndex((c) => c.id === selectedCourse.id) / COURSES_PER_PAGE) + 1}
                  </button>
                </div>
              )}

              {/* Course Cards Container */}
              {loading ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                  Loading courses...
                </div>
              ) : courses.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                  No courses created yet.
                </div>
              ) : filteredCourses.length === 0 ? (
                <div
                  style={{
                    padding: '24px 16px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px dashed #cbd5e1'
                  }}
                >
                  <Filter size={24} style={{ color: '#94a3b8', marginBottom: '8px' }} />
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>No matching courses</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                    {courseStatusFilter === 'PUBLISHED' && selectedCategoryFilter !== 'ALL'
                      ? `No published courses in category "${distinctCategories.find(d => d.key === selectedCategoryFilter)?.displayName || 'selected'}".`
                      : 'Try adjusting your search query or status filter.'}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
                    {selectedCategoryFilter !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategoryFilter('ALL');
                          setCurrentPage(1);
                        }}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: '1px solid #93c5fd',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Reset Category
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setCourseSearch('');
                        setCourseStatusFilter('ALL');
                        setSelectedCategoryFilter('ALL');
                        setCurrentPage(1);
                      }}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#475569',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Clear All Filters
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {paginatedCourses.map((c) => {
                    const isSelected = selectedCourse?.id === c.id;
                    const badgeStyle = getStatusBadgeStyle(c.status, c.is_archived);
                    const shortId = c.id ? c.id.slice(0, 8) : '';
                    return (
                      <div
                        key={c.id}
                        onClick={() => selectCourse(c)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          background: isSelected ? '#eff6ff' : '#ffffff',
                          border: isSelected ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                          borderLeft: isSelected ? '4px solid #2563eb' : '4px solid transparent',
                          boxShadow: isSelected ? '0 1px 3px rgba(37, 99, 235, 0.12)' : '0 1px 2px rgba(0, 0, 0, 0.02)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = '#f8fafc';
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
                        {/* Top row: Title and Status Badge */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
                          <span
                            style={{
                              fontWeight: isSelected ? 700 : 600,
                              fontSize: '0.88rem',
                              color: isSelected ? '#1d4ed8' : '#0f172a',
                              lineHeight: 1.35,
                              flex: 1,
                              wordBreak: 'break-word'
                            }}
                          >
                            {c.title}
                          </span>
                          <span
                            style={{
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '0.70rem',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              background: badgeStyle.bg,
                              color: badgeStyle.color,
                              border: badgeStyle.border
                            }}
                          >
                            {badgeStyle.label}
                          </span>
                        </div>

                        {/* Bengali Title if present */}
                        {c.title_bangla && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '6px' }}>
                            {c.title_bangla}
                          </div>
                        )}

                        {/* Metadata chips */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '8px',
                            fontSize: '0.72rem',
                            color: '#64748b',
                            marginTop: '6px'
                          }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Tag size={11} style={{ color: '#94a3b8' }} />
                            {c.category_name || 'General'}
                          </span>

                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '0.68rem',
                              background: '#f1f5f9',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              color: '#475569'
                            }}
                            title={`Course ID: ${c.id}`}
                          >
                            #{shortId}
                          </span>

                          {c.instructor_name && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <User size={11} style={{ color: '#94a3b8' }} />
                              {c.instructor_name}
                            </span>
                          )}

                          {c.created_at && (
                            <span style={{ color: '#94a3b8', fontSize: '0.68rem', marginLeft: 'auto' }}>
                              {new Date(c.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '12px',
                    borderTop: '1px solid #e2e8f0',
                    marginTop: '4px'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safeCurrentPage <= 1}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      background: safeCurrentPage <= 1 ? '#f8fafc' : '#ffffff',
                      color: safeCurrentPage <= 1 ? '#cbd5e1' : '#334155',
                      border: '1px solid #e2e8f0',
                      cursor: safeCurrentPage <= 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>

                  <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
                    Page {safeCurrentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage >= totalPages}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      background: safeCurrentPage >= totalPages ? '#f8fafc' : '#ffffff',
                      color: safeCurrentPage >= totalPages ? '#cbd5e1' : '#334155',
                      border: '1px solid #e2e8f0',
                      cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Next <ChevronRight size={14} />
                  </button>
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
                              selectedCourse.is_archived
                                ? '#f1f5f9'
                                : selectedCourse.status === 'PUBLISHED'
                                ? '#dcfce7'
                                : selectedCourse.status === 'PENDING_REVIEW'
                                ? '#fffbeb'
                                : selectedCourse.status === 'REJECTED'
                                ? '#fee2e2'
                                : '#f1f5f9',
                            color:
                              selectedCourse.is_archived
                                ? '#475569'
                                : selectedCourse.status === 'PUBLISHED'
                                ? '#15803d'
                                : selectedCourse.status === 'PENDING_REVIEW'
                                ? '#b45309'
                                : selectedCourse.status === 'REJECTED'
                                ? '#b91c1c'
                                : '#475569',
                            border:
                              selectedCourse.is_archived
                                ? '1px solid #cbd5e1'
                                : selectedCourse.status === 'PUBLISHED'
                                ? '1px solid #86efac'
                                : selectedCourse.status === 'PENDING_REVIEW'
                                ? '1px solid #fde68a'
                                : selectedCourse.status === 'REJECTED'
                                ? '1px solid #fca5a5'
                                : '1px solid #cbd5e1'
                          }}
                        >
                          {selectedCourse.is_archived ? (
                            <>
                              <Archive size={13} /> ARCHIVED
                            </>
                          ) : (
                            <>
                              {selectedCourse.status === 'PUBLISHED' && <CheckCircle2 size={13} />}
                              {selectedCourse.status === 'PENDING_REVIEW' && <Clock size={13} />}
                              {selectedCourse.status === 'REJECTED' && <XCircle size={13} />}
                              {selectedCourse.status === 'DRAFT' && <HelpCircle size={13} />}
                              {selectedCourse.status === 'PENDING_REVIEW' ? 'PENDING REVIEW' : selectedCourse.status}
                            </>
                          )}
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
                      {!isAdmin && !selectedCourse.is_archived && (selectedCourse.status === 'DRAFT' || selectedCourse.status === 'REJECTED') && (
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
                      {isAdmin && !selectedCourse.is_archived && (
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

                      {/* Admin Archival Controls: Reversible Archive / Restore */}
                      {isAdmin && selectedCourse.is_archived === 1 && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRestoreCourse(selectedCourse)}
                          disabled={actionLoading}
                        >
                          <RotateCcw size={14} /> Restore to Draft
                        </Button>
                      )}

                      {isAdmin && !selectedCourse.is_archived && selectedCourse.status === 'DRAFT' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleArchiveCourse(selectedCourse)}
                          disabled={actionLoading}
                        >
                          <Archive size={14} /> Archive Course
                        </Button>
                      )}

                      {!selectedCourse.is_archived && (
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
                      )}

                      {!selectedCourse.is_archived && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteCourse(selectedCourse.id)}
                          disabled={actionLoading}
                        >
                          <Trash2 size={14} /> Delete
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Reversible Archival Notice Banner */}
                  {selectedCourse.is_archived === 1 && (
                    <div
                      style={{
                        marginTop: '16px',
                        padding: '14px 18px',
                        borderRadius: '8px',
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#475569', fontSize: '0.86rem' }}>
                        <Archive size={18} color="#64748b" style={{ flexShrink: 0 }} />
                        <div>
                          <strong style={{ color: '#1e293b' }}>Archived Course (Read-Only)</strong>
                          <div style={{ fontSize: '0.80rem', color: '#64748b', marginTop: '2px' }}>
                            This course is locked against accidental modification. Curriculum modules, lessons, and resources are preserved. Restore to Draft to enable editing.
                            {selectedCourse.archived_at && ` (Archived at: ${new Date(selectedCourse.archived_at).toLocaleString()})`}
                          </div>
                        </div>
                      </div>
                      {isAdmin && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRestoreCourse(selectedCourse)}
                          disabled={actionLoading}
                        >
                          <RotateCcw size={14} /> Restore to Draft
                        </Button>
                      )}
                    </div>
                  )}

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

                    {!selectedCourse.is_archived && (
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
                    )}
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

                            {!selectedCourse.is_archived && (
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
                            )}
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

                                    {!selectedCourse.is_archived && (
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
                                    )}
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
                                          {!selectedCourse.is_archived && (
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
                                          )}
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
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                    <BookOpen size={24} />
                  </div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    {filteredCourses.length === 0 ? 'No Courses in This View' : 'No Course Selected'}
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0, lineHeight: 1.5 }}>
                    {filteredCourses.length === 0
                      ? `There are no courses matching the "${courseStatusFilter === 'DRAFT' ? 'Drafts' : courseStatusFilter === 'PUBLISHED' ? 'Published' : courseStatusFilter === 'ARCHIVED' ? 'Archived' : courseStatusFilter === 'PENDING_REVIEW' ? 'Under Review' : 'active'}" filter.`
                      : 'Select a course from the left panel to view or manage its curriculum modules, lessons, and resources.'}
                  </p>
                  {courseStatusFilter === 'DRAFT' && isAdmin && (
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
                        <Plus size={16} /> Create New Draft Course
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
                    {distinctCategories.map((cat) => {
                      const optionVal = cat.categoryIds.has(courseForm.categoryId)
                        ? courseForm.categoryId
                        : cat.primaryId;
                      return (
                        <option key={cat.key} value={optionVal}>
                          {cat.displayName}
                        </option>
                      );
                    })}
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
