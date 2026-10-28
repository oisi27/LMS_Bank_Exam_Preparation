import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Award,
  Clock,
  TrendingUp,
  Play,
  CheckCircle,
  FileText,
  User,
  LogOut,
  Target,
  BarChart3,
  Calendar,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Layers,
  Archive,
  Eye,
  CheckSquare,
  History,
  X,
  Search,
  Filter
} from 'lucide-react';
import axios from 'axios';

interface DashboardProps {
  onStartExam: (examId: string) => void;
  onLogout: () => void;
  onContinueCourse?: (courseId: string) => void;
  onViewResult?: (grade: any) => void;
  onReviewExam?: (attemptId: string) => void;
}

// Canonical Subject Mapping & Helper Functions for Bangladesh Bank Exam Domain
const CANONICAL_SUBJECT_MAP: Record<string, string> = {
  'Math': 'Quantitative Aptitude & Mathematics',
  'Mathematics': 'Quantitative Aptitude & Mathematics',
  'Quantitative Aptitude': 'Quantitative Aptitude & Mathematics',
  'Quantitative Aptitude & Mathematics': 'Quantitative Aptitude & Mathematics',

  'English': 'English Language & Literature',
  'English Language & Literature': 'English Language & Literature',

  'GK': 'General Knowledge & Banking Affairs',
  'General Knowledge': 'General Knowledge & Banking Affairs',
  'Banking and Finance': 'General Knowledge & Banking Affairs',
  'General Knowledge & Banking Affairs': 'General Knowledge & Banking Affairs',
  'General': 'General Knowledge & Banking Affairs',

  'Bangla': 'Bangla Language & Literature',
  'Bangla Language & Literature': 'Bangla Language & Literature',

  'Computer and ICT': 'Computer & Information Technology',
  'Computer & Information Technology': 'Computer & Information Technology',

  'Analytical Reasoning': 'Analytical Reasoning'
};

const getCanonicalSubject = (subject?: string): string => {
  if (!subject) return 'General Knowledge & Banking Affairs';
  const trimmed = subject.trim();
  return CANONICAL_SUBJECT_MAP[trimmed] || trimmed;
};

const CANONICAL_SORT_ORDER = [
  'Quantitative Aptitude & Mathematics',
  'Analytical Reasoning',
  'English Language & Literature',
  'Bangla Language & Literature',
  'General Knowledge & Banking Affairs',
  'Computer & Information Technology'
];

const getTopicRemediationTips = (canonicalSubject: string, chapter?: string, topic?: string): string[] => {
  const normSubj = (canonicalSubject || '').toLowerCase();
  const normTopic = (topic || '').toLowerCase();
  
  if (normSubj.includes('math') || normSubj.includes('quantitative') || normSubj.includes('arithmetic')) {
    return [
      'Write down core formulas and derive basic relationships before attempting speed drills.',
      'Solve 10-15 standard questions with step-by-step methods before using mental arithmetic shortcuts.',
      'Pay special attention to unit conversions (e.g. km/h to m/s, days to hours, ratios and percentages).',
      'Track time per question: aim for under 60 seconds per preliminary math question.'
    ];
  }
  if (normSubj.includes('analytical') || normSubj.includes('reasoning') || normTopic.includes('puzzle') || normTopic.includes('critical')) {
    return [
      'Diagram relationships, seating orders, and conditions systematically before reading the answer choices.',
      'Eliminate contradictory choices first by checking against given constraints.',
      'Practice identifying hidden assumptions and logical fallacies in short arguments.',
      'Avoid making real-world assumptions that are not explicitly stated in the problem statement.'
    ];
  }
  if (normSubj.includes('english')) {
    return [
      'Analyze root words, prefixes, and suffixes to deduce unfamiliar vocabulary meanings.',
      'Review subject-verb agreement, modifier placement, and parallel structure rules.',
      'Practice identifying prepositional collocations and idioms commonly asked in bank recruitment.',
      'Read one editorial article daily to build comprehension speed and contextual inference.'
    ];
  }
  if (normSubj.includes('bangla')) {
    return [
      'Focus on formal grammatical rules (সন্ধি, সমাস, কারক ও বিভক্তি, নত্ব-ষত্ব বিধান).',
      'Memorize major historical literary works, authors, and character names from modern and medieval eras.',
      'Practice identifying appropriate spelling (বানান শুদ্ধিকরণ) and sentence corrections (বাক্য সংকোচন).',
      'Review past 5 years of BCS and Combined Bank recruitment Bangla questions.'
    ];
  }
  if (normSubj.includes('general knowledge') || normSubj.includes('banking') || normSubj.includes('gk')) {
    return [
      'Review Bangladesh Bank monetary policy, repo/reverse repo rates, and inflation targets.',
      'Study key financial abbreviations (CAMELS, RTGS, NPSB, BEFTN, CRR, SLR) and regulatory roles.',
      'Follow national economic indicators: GDP growth, foreign reserves, remittance, and export figures.',
      'Review major international organizations, headquarters, summit venues, and global treaties.'
    ];
  }
  if (normSubj.includes('computer') || normSubj.includes('ict') || normSubj.includes('information')) {
    return [
      'Review computer fundamentals: binary/hex conversions, memory hierarchy, and storage units.',
      'Study networking basics: OSI model layers, IP addressing, common protocols (TCP/IP, DNS, HTTP, SSL).',
      'Familiarize yourself with database fundamentals: primary keys, foreign keys, SQL basic queries.',
      'Understand modern tech terminology: cloud computing, cybersecurity concepts, and encryption.'
    ];
  }
  return [
    'Review the basic theoretical principles and lecture notes for this topic.',
    'Work through step-by-step solved examples before attempting timed tests.',
    'Maintain an error log to record specific misconceptions and mistakes.',
    'Retake targeted practice quizzes once every 3 days to reinforce long-term memory.'
  ];
};

export const DashboardScreen: React.FC<DashboardProps> = ({
  onStartExam,
  onLogout,
  onContinueCourse,
  onViewResult,
  onReviewExam
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Goal Modal State (Phase 1)
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [targetBank, setTargetBank] = useState('Bangladesh Bank');
  const [customBank, setCustomBank] = useState('');
  const [targetPosition, setTargetPosition] = useState('Assistant Director');
  const [customPosition, setCustomPosition] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalMessage, setGoalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Interactive Subject & Weak Topic Modal States
  const [selectedSubjectModal, setSelectedSubjectModal] = useState<any | null>(null);
  const [selectedTopicModal, setSelectedTopicModal] = useState<any | null>(null);
  const [showAllWeakTopics, setShowAllWeakTopics] = useState(false);

  // Keyboard navigation: Escape key closes active modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedTopicModal) {
          setSelectedTopicModal(null);
        } else if (selectedSubjectModal) {
          setSelectedSubjectModal(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTopicModal, selectedSubjectModal]);

  // Canonical Subject Accuracy with strict mathematical summation
  const canonicalSubjectAccuracy = React.useMemo(() => {
    if (!data?.topicAnalytics && !data?.subjectAccuracy) return [];

    const map = new Map<string, {
      canonicalSubject: string;
      totalQuestions: number;
      attemptedCount: number;
      correctCount: number;
      wrongCount: number;
      skippedCount: number;
      accuracyPercentage: number;
      chapters: Array<{
        chapterName: string;
        totalQuestions: number;
        attemptedCount: number;
        correctCount: number;
        wrongCount: number;
        skippedCount: number;
        accuracyPercentage: number;
        topics: any[];
      }>;
    }>();

    if (data?.topicAnalytics && data.topicAnalytics.length > 0) {
      const chaptersMap = new Map<string, Map<string, any>>();

      data.topicAnalytics.forEach((t: any) => {
        const canonical = getCanonicalSubject(t.subject);
        if (!map.has(canonical)) {
          map.set(canonical, {
            canonicalSubject: canonical,
            totalQuestions: 0,
            attemptedCount: 0,
            correctCount: 0,
            wrongCount: 0,
            skippedCount: 0,
            accuracyPercentage: 0,
            chapters: []
          });
          chaptersMap.set(canonical, new Map());
        }

        const subjEntry = map.get(canonical)!;
        subjEntry.totalQuestions += Number(t.totalQuestions || 0);
        subjEntry.attemptedCount += Number(t.attemptedCount || 0);
        subjEntry.correctCount += Number(t.correctCount || 0);
        subjEntry.wrongCount += Number(t.wrongCount || 0);
        subjEntry.skippedCount += Number(t.skippedCount || 0);

        const subChapterMap = chaptersMap.get(canonical)!;
        const chapterKey = t.chapter || 'General Practice';
        if (!subChapterMap.has(chapterKey)) {
          subChapterMap.set(chapterKey, {
            chapterName: chapterKey,
            totalQuestions: 0,
            attemptedCount: 0,
            correctCount: 0,
            wrongCount: 0,
            skippedCount: 0,
            accuracyPercentage: 0,
            topics: []
          });
        }

        const chapEntry = subChapterMap.get(chapterKey)!;
        chapEntry.totalQuestions += Number(t.totalQuestions || 0);
        chapEntry.attemptedCount += Number(t.attemptedCount || 0);
        chapEntry.correctCount += Number(t.correctCount || 0);
        chapEntry.wrongCount += Number(t.wrongCount || 0);
        chapEntry.skippedCount += Number(t.skippedCount || 0);
        chapEntry.topics.push({
          ...t,
          canonicalSubject: canonical
        });
      });

      // Calculate strictly summed percentages and populate chapters
      map.forEach((subj, canonical) => {
        subj.accuracyPercentage = subj.attemptedCount > 0
          ? Math.round((subj.correctCount / subj.attemptedCount) * 100)
          : 0;

        const subChapterMap = chaptersMap.get(canonical)!;
        subChapterMap.forEach((chap) => {
          chap.accuracyPercentage = chap.attemptedCount > 0
            ? Math.round((chap.correctCount / chap.attemptedCount) * 100)
            : 0;
          subj.chapters.push(chap);
        });
      });
    } else if (data?.subjectAccuracy && data.subjectAccuracy.length > 0) {
      data.subjectAccuracy.forEach((s: any) => {
        const canonical = getCanonicalSubject(s.subject);
        if (!map.has(canonical)) {
          map.set(canonical, {
            canonicalSubject: canonical,
            totalQuestions: 0,
            attemptedCount: 0,
            correctCount: 0,
            wrongCount: 0,
            skippedCount: 0,
            accuracyPercentage: 0,
            chapters: []
          });
        }
        const subjEntry = map.get(canonical)!;
        subjEntry.totalQuestions += Number(s.totalQuestions || 0);
        subjEntry.attemptedCount += Number(s.attemptedCount || 0);
        subjEntry.correctCount += Number(s.correctCount || 0);
        subjEntry.wrongCount += Number(s.wrongCount || 0);
        subjEntry.skippedCount += Number(s.skippedCount || 0);
      });

      map.forEach((subj) => {
        subj.accuracyPercentage = subj.attemptedCount > 0
          ? Math.round((subj.correctCount / subj.attemptedCount) * 100)
          : 0;
      });
    }

    const result = Array.from(map.values());
    result.sort((a, b) => {
      const idxA = CANONICAL_SORT_ORDER.indexOf(a.canonicalSubject);
      const idxB = CANONICAL_SORT_ORDER.indexOf(b.canonicalSubject);
      if (idxA === -1 && idxB === -1) return a.canonicalSubject.localeCompare(b.canonicalSubject);
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });

    return result;
  }, [data?.topicAnalytics, data?.subjectAccuracy]);


  // Other Exam Sessions Collapsible State (Phase 2)
  const [showOtherSessions, setShowOtherSessions] = useState(false);
  const [expandedTitles, setExpandedTitles] = useState<Record<string, boolean>>({});

  // Recent Exam Results Collapsible State (Show More / Show Less)
  const [showAllRecentResults, setShowAllRecentResults] = useState(false);

  // Search & Filter State (Phase 2 Master's Proposal Requirement)
  const [dashboardCourseSearch, setDashboardCourseSearch] = useState('');
  const [examSearch, setExamSearch] = useState('');
  const [examStatusFilter, setExamStatusFilter] = useState<'ALL' | 'LIVE' | 'UPCOMING' | 'ENDED'>('ALL');

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('http://localhost:5000/api/dashboard/student-summary', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(res.data);

        // Prepopulate Goal form from server summary
        if (res.data?.goal) {
          const g = res.data.goal;
          const knownBanks = ['Bangladesh Bank', 'Sonali Bank', 'Janata Bank', 'Agrani Bank', 'Rupali Bank', 'Bangladesh Krishi Bank', 'Combined 8 Banks'];
          const knownPositions = ['Assistant Director', 'Senior Officer', 'Officer', 'Officer Cash', 'Officer IT'];

          if (g.targetBank) {
            if (knownBanks.includes(g.targetBank)) {
              setTargetBank(g.targetBank);
              setCustomBank('');
            } else {
              setTargetBank('OTHER');
              setCustomBank(g.targetBank);
            }
          }

          if (g.targetPosition) {
            if (knownPositions.includes(g.targetPosition)) {
              setTargetPosition(g.targetPosition);
              setCustomPosition('');
            } else {
              setTargetPosition('CUSTOM');
              setCustomPosition(g.targetPosition);
            }
          }

          if (g.targetDate) {
            setTargetDate(g.targetDate);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setGoalSaving(true);
    setGoalMessage(null);

    const effectiveBank = targetBank === 'OTHER' ? customBank.trim() : targetBank;
    const effectivePosition = targetPosition === 'CUSTOM' ? customPosition.trim() : targetPosition;

    if (!effectiveBank) {
      setGoalMessage({ type: 'error', text: 'Please enter or select a Target Bank.' });
      setGoalSaving(false);
      return;
    }
    if (!effectivePosition) {
      setGoalMessage({ type: 'error', text: 'Please enter or select a Target Position.' });
      setGoalSaving(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await axios.put(
        'http://localhost:5000/api/auth/goal',
        {
          targetBank: effectiveBank,
          targetPosition: effectivePosition,
          targetDate: targetDate || null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        setGoalMessage({ type: 'success', text: 'Preparation goal saved successfully!' });
        // Update local dashboard data
        setData((prev: any) => ({
          ...prev,
          goal: res.data.goal
        }));

        // Update localStorage user object
        const userJson = localStorage.getItem('user');
        if (userJson) {
          try {
            const parsed = JSON.parse(userJson);
            localStorage.setItem('user', JSON.stringify({
              ...parsed,
              targetBank: res.data.user.targetBank,
              targetPosition: res.data.user.targetPosition,
              targetExam: res.data.user.targetExam,
              targetDate: res.data.user.targetDate
            }));
          } catch {
            // ignore
          }
        }

        setTimeout(() => {
          setIsGoalModalOpen(false);
          setGoalMessage(null);
        }, 1200);
      }
    } catch (err: any) {
      setGoalMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Failed to update preparation goal.'
      });
    } finally {
      setGoalSaving(false);
    }
  };

  const userJson = localStorage.getItem('user');
  const user = userJson ? JSON.parse(userJson) : { name: 'Student Candidate' };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#64748b' }}>Loading candidate preparation analytics...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a' }}>
      {/* Top Navbar */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 3rem', borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '2.25rem', height: '2.25rem', background: '#2563eb', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award style={{ width: '1.25rem', height: '1.25rem', color: '#ffffff' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Bank Exam LMS</h1>
            <span style={{ fontSize: '0.75rem', color: '#2563eb' }}>IIT - University of Dhaka Specialization</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{user.name}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{data?.goal?.targetExam || user.targetExam || 'Bangladesh Bank AD'}</div>
          </div>
          <button
            onClick={onLogout}
            style={{ background: 'transparent', border: '1px solid #cbd5e1', color: '#64748b', padding: '0.4rem 0.8rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <LogOut style={{ width: '0.9rem', height: '0.9rem' }} /> Exit
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 2rem' }}>
        {/* Welcome & Personalized Student Preparation Goal Card (Phase 1) */}
        {(() => {
          const goal = data?.goal || {};
          const currentBank = goal.targetBank || user.targetBank || 'Bangladesh Bank';
          const currentPosition = goal.targetPosition || user.targetPosition || 'Assistant Director';
          const currentDate = goal.targetDate || user.targetDate || null;
          const daysLeft = goal.daysRemaining;

          return (
            <div
              className="glass-panel"
              style={{
                padding: '2rem',
                marginBottom: '2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                border: '1px solid #bfdbfe',
                background: '#ffffff',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                    <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.4rem', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Target style={{ width: '1rem', height: '1rem', color: '#2563eb' }} />
                    </div>
                    <span style={{ color: '#2563eb', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      My Exam Preparation Goal
                    </span>
                  </div>

                  <h2 style={{ fontSize: '1.85rem', fontWeight: 800, margin: '0.25rem 0 0.5rem 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span>{currentBank}</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 600, color: '#64748b' }}>•</span>
                    <span style={{ color: '#2563eb' }}>{currentPosition}</span>
                  </h2>

                  <p style={{ color: '#64748b', margin: 0, fontSize: '0.92rem', maxWidth: '650px', lineHeight: 1.5 }}>
                    Track your preparation progress, practice mock exams, and work toward your selected bank recruitment goal.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Days Remaining Pill */}
                  <div style={{
                    background: '#f8fafc',
                    padding: '1rem 1.4rem',
                    borderRadius: '0.75rem',
                    border: '1px solid #cbd5e1',
                    textAlign: 'center',
                    minWidth: '130px'
                  }}>
                    <span style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontWeight: 600 }}>
                      <Calendar style={{ width: '0.8rem', height: '0.8rem', color: '#2563eb' }} /> Days Remaining
                    </span>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: daysLeft === null ? '#64748b' : (daysLeft < 0 ? '#b91c1c' : daysLeft <= 14 ? '#b45309' : '#1d4ed8') }}>
                      {daysLeft === null ? 'Not Set' : (daysLeft < 0 ? `${Math.abs(daysLeft)}d ago` : `${daysLeft} Days`)}
                    </div>
                    {currentDate && (
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        Target: {currentDate}
                      </span>
                    )}
                  </div>

                  {/* Overall Accuracy */}
                  <div style={{ background: '#f8fafc', padding: '1rem 1.4rem', borderRadius: '0.75rem', border: '1px solid #cbd5e1', textAlign: 'center', minWidth: '120px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>Avg Accuracy</span>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#15803d' }}>{data?.stats?.averageAccuracy || 0}%</div>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      {data?.stats?.totalExamsTaken || 0} exams taken
                    </span>
                  </div>

                  {/* Edit Goal CTA */}
                  <button
                    onClick={() => {
                      setIsGoalModalOpen(true);
                      setGoalMessage(null);
                    }}
                    style={{
                      background: '#eff6ff',
                      border: '1px solid #3b82f6',
                      color: '#1d4ed8',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      padding: '0.75rem 1.1rem',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      transition: 'all 0.2s ease',
                      alignSelf: 'center'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#2563eb';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#eff6ff';
                      e.currentTarget.style.color = '#1d4ed8';
                    }}
                  >
                    <Target style={{ width: '0.95rem', height: '0.95rem' }} /> Set / Edit Goal
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* My Learning Progress Section (with Search & Filtering) */}
        {(() => {
          const allCourses: any[] = data?.courseProgress || [];
          const filteredCourses = allCourses.filter((course: any) => {
            if (!dashboardCourseSearch.trim()) return true;
            const q = dashboardCourseSearch.toLowerCase().trim();
            const titleMatch = (course.title || '').toLowerCase().includes(q);
            const banglaMatch = (course.titleBangla || '').toLowerCase().includes(q);
            return titleMatch || banglaMatch;
          });

          return (
            <div style={{ marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BookOpen style={{ width: '1.25rem', height: '1.25rem', color: '#2563eb' }} />
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>My Learning Progress</h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {allCourses.length > 0 && (
                    <div style={{ position: 'relative', minWidth: '220px' }}>
                      <Search style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', width: '0.9rem', height: '0.9rem', color: '#64748b' }} />
                      <input
                        type="text"
                        value={dashboardCourseSearch}
                        onChange={(e) => setDashboardCourseSearch(e.target.value)}
                        placeholder="Search your courses..."
                        style={{
                          width: '100%',
                          padding: '0.35rem 0.6rem 0.35rem 1.9rem',
                          borderRadius: '0.4rem',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.8rem',
                          outline: 'none',
                          color: '#0f172a',
                          background: '#ffffff'
                        }}
                      />
                      {dashboardCourseSearch && (
                        <button
                          onClick={() => setDashboardCourseSearch('')}
                          style={{
                            position: 'absolute', right: '0.4rem', top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8'
                          }}
                        >
                          <X style={{ width: '0.8rem', height: '0.8rem' }} />
                        </button>
                      )}
                    </div>
                  )}

                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    {filteredCourses.length} of {allCourses.length} Academic Courses
                  </span>
                </div>
              </div>

              {allCourses.length === 0 ? (
                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  <BookOpen style={{ width: '2.5rem', height: '2.5rem', color: '#64748b', margin: '0 auto 0.75rem' }} />
                  <p style={{ margin: 0, fontSize: '0.95rem' }}>No enrolled courses or lesson progress found.</p>
                </div>
              ) : filteredCourses.length === 0 ? (
                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  <Search style={{ width: '2rem', height: '2rem', color: '#94a3b8', margin: '0 auto 0.5rem' }} />
                  <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: '#0f172a' }}>
                    No enrolled courses match "{dashboardCourseSearch}"
                  </p>
                  <button
                    onClick={() => setDashboardCourseSearch('')}
                    style={{
                      background: '#eff6ff',
                      color: '#2563eb',
                      border: '1px solid #bfdbfe',
                      padding: '0.35rem 0.85rem',
                      borderRadius: '0.4rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Clear Search
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.25rem' }}>
                  {filteredCourses.map((course: any) => {
                const isCompleted = course.progressPercentage === 100 && course.totalLessons > 0;
                return (
                  <div
                    key={course.courseId}
                    className="glass-panel"
                    style={{
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      border: isCompleted ? '1px solid #86efac' : '1px solid #e2e8f0',
                      transition: 'transform 0.15s ease, border-color 0.15s ease'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <div>
                          <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: '#0f172a', lineHeight: 1.3 }}>
                            {course.title}
                          </h4>
                          {course.titleBangla && (
                            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
                              {course.titleBangla}
                            </p>
                          )}
                        </div>
                        <span
                          style={{
                            background: isCompleted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                            color: isCompleted ? '#10b981' : '#38bdf8',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '1rem',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {course.progressPercentage}%
                        </span>
                      </div>

                      {/* Progress Stats */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>
                        <span>Lessons Completed</span>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>
                          {course.completedLessons} / {course.totalLessons}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div
                        style={{
                          width: '100%',
                          height: '0.5rem',
                          background: '#ffffff',
                          borderRadius: '9999px',
                          overflow: 'hidden',
                          marginBottom: '1.25rem',
                          border: '1px solid #e2e8f0'
                        }}
                      >
                        <div
                          style={{
                            width: `${course.progressPercentage}%`,
                            height: '100%',
                            background: isCompleted
                              ? '#10b981'
                              : 'linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)',
                            borderRadius: '9999px',
                            transition: 'width 0.4s ease'
                          }}
                        />
                      </div>
                    </div>

                    {/* Continue Learning CTA */}
                    <button
                      onClick={() => onContinueCourse && onContinueCourse(course.courseId)}
                      style={{
                        width: '100%',
                        background: 'rgba(37, 99, 235, 0.12)',
                        border: '1px solid rgba(37, 99, 235, 0.35)',
                        color: '#2563eb',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        padding: '0.6rem 1rem',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        transition: 'background 0.2s, color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#2563eb';
                        e.currentTarget.style.color = '#ffffff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#eff6ff';
                        e.currentTarget.style.color = '#1d4ed8';
                      }}
                    >
                      <BookOpen style={{ width: '0.9rem', height: '0.9rem' }} />
                      Continue Learning →
                    </button>
                  </div>
                );
              })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Recent Exam Results & Performance History */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History style={{ width: '1.25rem', height: '1.25rem', color: '#2563eb' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Recent Exam Results</h3>
            </div>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              {data?.recentResults?.length || 0} Graded Exam Record(s)
            </span>
          </div>

          {(!data?.recentResults || data.recentResults.length === 0) ? (
            <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              <Award style={{ width: '2.5rem', height: '2.5rem', color: '#64748b', margin: '0 auto 0.75rem' }} />
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#0f172a', fontWeight: 600 }}>No Exam Results Yet</p>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>Take any of the live mock exams below to generate your performance records and solution review.</p>
            </div>
          ) : (() => {
            const allResults: any[] = data.recentResults || [];
            const visibleResults = showAllRecentResults ? allResults : allResults.slice(0, 1);
            const hiddenCount = allResults.length - 1;

            return (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {visibleResults.map((result: any) => {
                    const isPassed = Boolean(result.is_passed);
                    const score = Number(result.score);
                    const totalMarks = Number(result.total_marks);
                    const accuracy = result.accuracy_percentage;
                    const releaseMode = result.result_release_mode || 'INSTANT';
                    const examStatus = result.exam_status || 'LIVE';
                    const endsAt = result.ends_at;

                    // Release condition check matching server policy
                    const now = new Date();
                    let isReleased = true;
                    let releaseNotice: string | null = null;

                    if (releaseMode === 'MANUAL' && examStatus !== 'RESULTS_PUBLISHED') {
                      isReleased = false;
                      releaseNotice = 'Pending Instructor Publication';
                    } else if (releaseMode === 'SCHEDULED' && examStatus !== 'RESULTS_PUBLISHED') {
                      if (endsAt && now < new Date(endsAt)) {
                        isReleased = false;
                        releaseNotice = `Scheduled Release on ${new Date(endsAt).toLocaleDateString()}`;
                      }
                    }

                    return (
                      <div
                        key={result.id}
                        className="glass-panel"
                        style={{
                          padding: '1.25rem 1.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '1rem',
                          border: !isReleased ? '1px solid #cbd5e1' : (isPassed ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)')
                        }}
                      >
                        {/* Exam & Date Info */}
                        <div style={{ flex: '1 1 280px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            {isReleased ? (
                              <span
                                style={{
                                  background: isPassed ? '#dcfce7' : '#fee2e2',
                                  color: isPassed ? '#15803d' : '#b91c1c',
                                  border: isPassed ? '1px solid #86efac' : '1px solid #fca5a5',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '999px',
                                  textTransform: 'uppercase'
                                }}
                              >
                                {isPassed ? 'PASSED' : 'FAILED'}
                              </span>
                            ) : (
                              <span
                                style={{
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  border: '1px solid #bfdbfe',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '999px',
                                  textTransform: 'uppercase'
                                }}
                              >
                                PENDING RELEASE
                              </span>
                            )}
                            {result.is_overridden === 1 && (
                              <span
                                style={{
                                  background: '#fffbeb',
                                  color: '#b45309',
                                  border: '1px solid #fde68a',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '999px'
                                }}
                              >
                                OVERRIDDEN
                              </span>
                            )}
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {result.created_at ? new Date(result.created_at).toLocaleDateString() : ''}
                            </span>
                          </div>
                          <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: '#0f172a' }}>
                            {result.exam_title}
                          </h4>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            Category: {result.category || 'BANK_RECRUITMENT'}
                          </div>
                        </div>

                        {/* Score & Accuracy Metrics */}
                        {isReleased ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                            <div>
                              <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Net Score</span>
                              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: isPassed ? '#15803d' : '#b91c1c' }}>
                                {score.toFixed(2)} <span style={{ fontSize: '0.85rem', color: '#64748b' }}>/ {totalMarks}</span>
                              </span>
                            </div>

                            {accuracy !== undefined && accuracy !== null && (
                              <div>
                                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Accuracy</span>
                                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2563eb' }}>
                                  {accuracy}%
                                </span>
                              </div>
                            )}

                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                              <div>Correct: <strong style={{ color: '#10b981' }}>{result.correct_count}</strong></div>
                              <div>Wrong: <strong style={{ color: '#ef4444' }}>{result.wrong_count}</strong></div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#475569', fontSize: '0.85rem' }}>
                            <Clock style={{ width: '1.1rem', height: '1.1rem', color: '#2563eb', flexShrink: 0 }} />
                            <span>Score & analysis withheld pending official publication</span>
                          </div>
                        )}

                        {/* Action Buttons: View Result & Review Answers */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                          {isReleased ? (
                            <>
                              <button
                                onClick={() => {
                                  if (onViewResult) {
                                    onViewResult({
                                      score: result.score,
                                      maximumMarks: result.total_marks,
                                      correctCount: result.correct_count,
                                      wrongCount: result.wrong_count,
                                      skippedCount: result.skipped_count,
                                      accuracyPercentage: result.accuracy_percentage,
                                      isPassed: Boolean(result.is_passed),
                                      timeSpentSeconds: result.time_spent_seconds || 0,
                                      attemptId: result.attempt_id,
                                      examId: result.exam_id
                                    });
                                  }
                                }}
                                style={{
                                  background: '#ffffff',
                                  border: '1px solid #cbd5e1',
                                  color: '#1e293b',
                                  fontWeight: 600,
                                  fontSize: '0.8rem',
                                  padding: '0.5rem 0.9rem',
                                  borderRadius: '0.4rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem'
                                }}
                              >
                                <Eye style={{ width: '0.9rem', height: '0.9rem' }} />
                                View Result
                              </button>

                              <button
                                onClick={() => {
                                  if (onReviewExam) {
                                    onReviewExam(result.attempt_id);
                                  }
                                }}
                                style={{
                                  background: '#f0fdf4',
                                  border: '1px solid rgba(16, 185, 129, 0.35)',
                                  color: '#15803d',
                                  fontWeight: 600,
                                  fontSize: '0.8rem',
                                  padding: '0.5rem 0.9rem',
                                  borderRadius: '0.4rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem'
                                }}
                              >
                                <CheckSquare style={{ width: '0.9rem', height: '0.9rem' }} />
                                Review Answers
                              </button>
                            </>
                          ) : (
                            <div style={{
                              background: '#fffbeb',
                              border: '1px solid #fde68a',
                              padding: '0.45rem 0.85rem',
                              borderRadius: '0.4rem',
                              color: '#b45309',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem'
                            }}>
                              <AlertCircle style={{ width: '0.9rem', height: '0.9rem' }} />
                              {releaseNotice}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {allResults.length > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.25rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowAllRecentResults((prev) => !prev)}
                      aria-expanded={showAllRecentResults}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#2563eb',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        padding: '0.6rem 1.5rem',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#eff6ff';
                        e.currentTarget.style.borderColor = '#93c5fd';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#ffffff';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                      }}
                    >
                      {showAllRecentResults ? '▲ Show Less Results' : `▼ Show More Results (${hiddenCount})`}
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Live / Upcoming Mock Tests Section (Phase 2 Safe Display Improvement) */}
        {(() => {
          const allExams: any[] = data?.upcomingExams || [];
          if (allExams.length === 0) {
            return (
              <div style={{ marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <Calendar style={{ width: '1.25rem', height: '1.25rem', color: '#2563eb' }} />
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Active & Upcoming Mock Exams</h3>
                </div>
                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  No scheduled mock tests available.
                </div>
              </div>
            );
          }

          // Group exams by clean title to identify repeated sessions
          const groupsByTitle = new Map<string, any[]>();
          for (const exam of allExams) {
            const groupKey = (exam.title || 'Untitled Exam').trim();
            if (!groupsByTitle.has(groupKey)) {
              groupsByTitle.set(groupKey, []);
            }
            groupsByTitle.get(groupKey)!.push(exam);
          }

          // Primary Featured Exams: Pick the best active/available session from each title group
          // Priority in group: LIVE (0) > UPCOMING (1) > ENDED (2), then newest starts_at
          const priorityVal = (s: string) => (s === 'LIVE' ? 0 : s === 'UPCOMING' ? 1 : 2);

          const primaryFeaturedExams: any[] = [];
          const otherSessionsByTitle: { title: string; exams: any[] }[] = [];
          let totalOtherSessionsCount = 0;

          groupsByTitle.forEach((examsInGroup, title) => {
            // Sort group internally by status priority then starts_at
            const sortedInGroup = [...examsInGroup].sort((a, b) => {
              const diff = priorityVal(a.calculatedStatus) - priorityVal(b.calculatedStatus);
              if (diff !== 0) return diff;
              return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
            });

            // Primary featured card for this title
            primaryFeaturedExams.push(sortedInGroup[0]);

            // If there are other sessions for this exam title, store in other sessions list
            if (sortedInGroup.length > 1) {
              const remaining = sortedInGroup.slice(1);
              otherSessionsByTitle.push({
                title,
                exams: remaining
              });
              totalOtherSessionsCount += remaining.length;
            }
          });

          // Sort primary featured exams: LIVE first, then UPCOMING, then ENDED
          primaryFeaturedExams.sort((a, b) => {
            const diff = priorityVal(a.calculatedStatus) - priorityVal(b.calculatedStatus);
            if (diff !== 0) return diff;
            return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
          });

          // Filter primary featured exams by search keywords and status
          const filteredFeaturedExams = primaryFeaturedExams.filter((exam: any) => {
            if (examStatusFilter !== 'ALL' && exam.calculatedStatus !== examStatusFilter) {
              return false;
            }
            if (examSearch.trim()) {
              const q = examSearch.toLowerCase().trim();
              const titleMatch = (exam.title || '').toLowerCase().includes(q);
              const banglaMatch = (exam.title_bangla || '').toLowerCase().includes(q);
              const catMatch = (exam.category || '').toLowerCase().includes(q);
              if (!titleMatch && !banglaMatch && !catMatch) {
                return false;
              }
            }
            return true;
          });

          const badgeStyles: Record<string, { bg: string; color: string; border: string; label: string }> = {
            LIVE: { bg: '#dcfce7', color: '#15803d', border: '#86efac', label: 'LIVE NOW' },
            UPCOMING: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: 'UPCOMING' },
            ENDED: { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', label: 'ENDED' }
          };

          return (
            <div style={{ marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar style={{ width: '1.25rem', height: '1.25rem', color: '#2563eb' }} />
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Active & Upcoming Mock Exams</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
                  <span>Showing {filteredFeaturedExams.length} of {primaryFeaturedExams.length} Core Exam Tracks</span>
                  {totalOtherSessionsCount > 0 && (
                    <span style={{ background: '#ffffff', padding: '0.2rem 0.6rem', borderRadius: '1rem', border: '1px solid #cbd5e1', color: '#2563eb' }}>
                      {totalOtherSessionsCount} Archive / Parallel Sessions
                    </span>
                  )}
                </div>
              </div>

              {/* Mock Exam Search & Status Filter Toolbar */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.75rem',
                  padding: '0.75rem 1rem',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  flexWrap: 'wrap'
                }}
              >
                {/* Keyword Search Input */}
                <div style={{ position: 'relative', flex: '1 1 240px' }}>
                  <Search style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', width: '0.95rem', height: '0.95rem', color: '#64748b' }} />
                  <input
                    type="text"
                    value={examSearch}
                    onChange={(e) => setExamSearch(e.target.value)}
                    placeholder="Search mock exams (e.g. Bangladesh Bank, AD, Officer)..."
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.65rem 0.45rem 2rem',
                      borderRadius: '0.4rem',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.82rem',
                      outline: 'none',
                      color: '#0f172a',
                      background: '#ffffff'
                    }}
                  />
                  {examSearch && (
                    <button
                      onClick={() => setExamSearch('')}
                      style={{
                        position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8'
                      }}
                    >
                      <X style={{ width: '0.85rem', height: '0.85rem' }} />
                    </button>
                  )}
                </div>

                {/* Status Filter Buttons */}
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Status:</span>
                  {(['ALL', 'LIVE', 'UPCOMING', 'ENDED'] as const).map((st) => {
                    const isSelected = examStatusFilter === st;
                    const labels: Record<string, string> = { ALL: 'All Sessions', LIVE: '🟢 Live', UPCOMING: '🔵 Upcoming', ENDED: '⚪ Concluded' };
                    return (
                      <button
                        key={st}
                        onClick={() => setExamStatusFilter(st)}
                        style={{
                          padding: '0.3rem 0.65rem',
                          borderRadius: '0.4rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          border: isSelected ? '1px solid #2563eb' : '1px solid #cbd5e1',
                          background: isSelected ? '#2563eb' : '#ffffff',
                          color: isSelected ? '#ffffff' : '#475569',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {labels[st]}
                      </button>
                    );
                  })}
                </div>

                {/* Clear Filter CTA */}
                {(examSearch || examStatusFilter !== 'ALL') && (
                  <button
                    onClick={() => {
                      setExamSearch('');
                      setExamStatusFilter('ALL');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      marginLeft: 'auto'
                    }}
                  >
                    <X style={{ width: '0.85rem', height: '0.85rem' }} />
                    Clear Filter
                  </button>
                )}
              </div>

              {filteredFeaturedExams.length === 0 ? (
                <div className="glass-panel" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: '#64748b', marginBottom: '1.5rem' }}>
                  <Search style={{ width: '2.5rem', height: '2.5rem', color: '#94a3b8', margin: '0 auto 0.75rem' }} />
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.35rem 0' }}>
                    No Mock Exams Match Your Filter
                  </h4>
                  <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem' }}>
                    {examSearch ? `No scheduled examinations found matching "${examSearch}". ` : 'No examinations match the selected status. '}
                    Try resetting your filters.
                  </p>
                  <button
                    onClick={() => {
                      setExamSearch('');
                      setExamStatusFilter('ALL');
                    }}
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      padding: '0.45rem 1rem',
                      borderRadius: '0.4rem',
                      border: 'none',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                /* Primary Featured Exam Cards Grid */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  {filteredFeaturedExams.map((exam: any) => {
                  const status = exam.calculatedStatus || 'ENDED';
                  const isAvailable = exam.isAvailable !== undefined ? exam.isAvailable : status === 'LIVE';
                  const currentBadge = badgeStyles[status] || badgeStyles.ENDED;
                  const siblingCount = (groupsByTitle.get(exam.title)?.length || 1) - 1;

                  return (
                    <div
                      key={exam.id}
                      className="glass-panel"
                      style={{
                        padding: '1.75rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        border: isAvailable ? '1px solid #38bdf8' : '1px solid #e2e8f0'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <span style={{ background: currentBadge.bg, color: currentBadge.color, fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '1rem' }}>
                            {currentBadge.label}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {exam.sessionCode && (
                              <span style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                                #{exam.sessionCode}
                              </span>
                            )}
                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <Clock style={{ width: '0.85rem', height: '0.85rem' }} /> {exam.duration_minutes} Mins
                            </span>
                          </div>
                        </div>

                        <h4 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.4rem', color: '#0f172a', lineHeight: 1.35 }}>
                          {exam.title}
                        </h4>
                        {exam.title_bangla && (
                          <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '0 0 0.75rem 0' }}>{exam.title_bangla}</p>
                        )}

                        {exam.starts_at && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem' }}>
                            Starts: {new Date(exam.starts_at).toLocaleDateString()} {new Date(exam.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#334155', marginBottom: '1.25rem' }}>
                          <span>Total Marks: <strong>{exam.total_marks}</strong></span>
                          <span>Negative Marking: <strong>-0.25</strong></span>
                        </div>

                        {siblingCount > 0 && (
                          <div style={{
                            fontSize: '0.75rem',
                            color: '#1e40af',
                            background: '#eff6ff',
                            padding: '0.45rem 0.75rem',
                            borderRadius: '0.35rem',
                            marginBottom: '1rem',
                            border: '1px solid #bfdbfe',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}>
                            <span style={{ fontWeight: 600 }}>+{siblingCount} other session{siblingCount > 1 ? 's' : ''} available</span>
                            <span style={{ color: '#1d4ed8', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'underline' }}>See section below</span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => isAvailable && onStartExam(exam.id)}
                        disabled={!isAvailable}
                        style={{
                          background: isAvailable ? '#2563eb' : '#f1f5f9',
                          color: isAvailable ? '#ffffff' : '#475569',
                          fontWeight: 700,
                          padding: '0.75rem',
                          borderRadius: '0.5rem',
                          border: isAvailable ? 'none' : '1px solid #cbd5e1',
                          cursor: isAvailable ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          opacity: 1,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <Play style={{ width: '1rem', height: '1rem', color: isAvailable ? '#ffffff' : '#64748b' }} />
                        {status === 'LIVE' ? 'Take Timed Exam Now' : (status === 'UPCOMING' ? 'Exam Not Started Yet' : 'Exam Window Ended')}
                      </button>
                    </div>
                  );
                })}
              </div>
              )}

              {/* Collapsible Other Exam Sessions Section (Preserves every single exam record) */}
              {totalOtherSessionsCount > 0 && (
                <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', border: '1px solid #cbd5e1', borderRadius: '0.75rem' }}>
                  <div
                    onClick={() => setShowOtherSessions(!showOtherSessions)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <Archive style={{ width: '1.1rem', height: '1.1rem', color: '#2563eb' }} />
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                        Other Exam Sessions & Test Batches
                      </span>
                      <span style={{ background: '#ffffff', color: '#64748b', fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '1rem' }}>
                        {totalOtherSessionsCount} sessions
                      </span>
                    </div>

                    <button
                      type="button"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#2563eb',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.85rem',
                        fontWeight: 600
                      }}
                    >
                      {showOtherSessions ? (
                        <>Hide Sessions <ChevronUp style={{ width: '1rem', height: '1rem' }} /></>
                      ) : (
                        <>Browse All Sessions <ChevronDown style={{ width: '1rem', height: '1rem' }} /></>
                      )}
                    </button>
                  </div>

                  {showOtherSessions && (
                    <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
                      <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0 0 1rem 0' }}>
                        Each exam below is an authentic distinct session in the database with its own verified exam ID, question configuration, and schedule.
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {otherSessionsByTitle.map((group) => {
                          const isExpanded = expandedTitles[group.title] || false;
                          const displayExams = isExpanded ? group.exams : group.exams.slice(0, 3);
                          const remainingHidden = group.exams.length - 3;

                          return (
                            <div key={group.title} style={{ background: '#f8fafc', borderRadius: '0.5rem', padding: '1rem', border: '1px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                                  {group.title} ({group.exams.length} parallel session{group.exams.length > 1 ? 's' : ''})
                                </div>
                                {remainingHidden > 0 && (
                                  <button
                                    onClick={() => setExpandedTitles(prev => ({ ...prev, [group.title]: !prev[group.title] }))}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: '#2563eb',
                                      fontSize: '0.78rem',
                                      cursor: 'pointer',
                                      fontWeight: 600
                                    }}
                                  >
                                    {isExpanded ? 'Show Less' : `+${remainingHidden} more`}
                                  </button>
                                )}
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                                {displayExams.map((sExam: any) => {
                                  const sStatus = sExam.calculatedStatus || 'ENDED';
                                  const sAvailable = sExam.isAvailable !== undefined ? sExam.isAvailable : sStatus === 'LIVE';
                                  const sBadge = badgeStyles[sStatus] || badgeStyles.ENDED;

                                  return (
                                    <div
                                      key={sExam.id}
                                      style={{
                                        background: '#ffffff',
                                        borderRadius: '0.4rem',
                                        padding: '0.75rem',
                                        border: '1px solid #cbd5e1',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        gap: '0.5rem'
                                      }}
                                    >
                                      <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                          <span style={{ background: sBadge.bg, color: sBadge.color, fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '0.3rem' }}>
                                            {sBadge.label}
                                          </span>
                                          <span style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>
                                            ID: #{sExam.sessionCode}
                                          </span>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#334155' }}>
                                          Start: {sExam.starts_at ? new Date(sExam.starts_at).toLocaleDateString() : 'N/A'} • {sExam.duration_minutes}m
                                        </div>
                                      </div>

                                      <button
                                        onClick={() => sAvailable && onStartExam(sExam.id)}
                                        disabled={!sAvailable}
                                        style={{
                                          background: sAvailable ? '#2563eb' : '#f1f5f9',
                                          color: sAvailable ? '#ffffff' : '#475569',
                                          fontWeight: 700,
                                          fontSize: '0.75rem',
                                          padding: '0.4rem 0.6rem',
                                          borderRadius: '0.35rem',
                                          border: sAvailable ? 'none' : '1px solid #cbd5e1',
                                          cursor: sAvailable ? 'pointer' : 'not-allowed',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '0.3rem',
                                          opacity: 1
                                        }}
                                      >
                                        <Play style={{ width: '0.75rem', height: '0.75rem', color: sAvailable ? '#ffffff' : '#64748b' }} />
                                        {sStatus === 'LIVE' ? 'Enter Session' : (sStatus === 'UPCOMING' ? 'Upcoming' : 'Ended')}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Dynamic Subject & Chapter Accuracy Analytics (Phase 7 Milestone 1 Step 4) */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart3 style={{ width: '1.25rem', height: '1.25rem', color: '#2563eb' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Subject Performance Overview</h3>
            </div>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              {data?.topicAnalytics?.length ? `${data.topicAnalytics.length} Topics Evaluated` : 'Based on Finalized Mock Tests'}
            </span>
          </div>

          {/* Empty State: Student has not taken/finalized any exam yet */}
          {(!data?.topicAnalytics || data.topicAnalytics.length === 0) ? (
            <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
              <BarChart3 style={{ width: '2.5rem', height: '2.5rem', color: '#64748b', margin: '0 auto 0.75rem' }} />
              <h4 style={{ color: '#0f172a', fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
                No Exam Analytics Available Yet
              </h4>
              <p style={{ margin: '0 auto', maxWidth: '520px', fontSize: '0.9rem', color: '#64748b' }}>
                Take and submit a timed mock exam from the list above. Your accuracy breakdown across Quantitative Aptitude, English, Bangla, and Banking Affairs will appear here automatically.
              </p>
            </div>
          ) : (
            <div>
              {/* Topics Needing Attention (Weak Topics) Alert Area */}
              {data.weakTopics && data.weakTopics.length > 0 && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fca5a5',
                    borderRadius: '0.75rem',
                    padding: '1.25rem 1.5rem',
                    marginBottom: '1.75rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <AlertTriangle style={{ width: '1.2rem', height: '1.2rem', color: '#dc2626' }} />
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#991b1b', margin: 0 }}>
                      Topics Needing Attention (Accuracy &lt; 50%)
                    </h4>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0 0 1rem 0' }}>
                    Based on your mock exam attempts, review the lecture notes and practice exercises for these specific areas:
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                    {(showAllWeakTopics ? data.weakTopics : data.weakTopics.slice(0, 4)).map((wt: any, idx: number) => {
                      const canonicalSubj = getCanonicalSubject(wt.subject);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedTopicModal({ ...wt, canonicalSubject: canonicalSubj })}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #fecaca',
                            borderRadius: '0.5rem',
                            padding: '0.75rem 1rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            width: '100%',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 10px rgba(220, 38, 38, 0.15)';
                            e.currentTarget.style.borderColor = '#f87171';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                            e.currentTarget.style.borderColor = '#fecaca';
                          }}
                        >
                          <div style={{ minWidth: 0, paddingRight: '0.5rem' }}>
                            <span style={{ fontSize: '0.72rem', color: '#b91c1c', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>
                              {canonicalSubj}
                            </span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                              {wt.topic}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 500 }}>
                              {wt.correctCount} of {wt.attemptedCount} correct &bull; <span style={{ color: '#dc2626', fontWeight: 600 }}>Remediation tips &rarr;</span>
                            </span>
                          </div>
                          <span
                            style={{
                              background: '#fee2e2',
                              color: '#991b1b',
                              border: '1px solid #fca5a5',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.5rem',
                              borderRadius: '0.4rem',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {wt.accuracyPercentage}%
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {data.weakTopics.length > 4 && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                      <button
                        type="button"
                        onClick={() => setShowAllWeakTopics(prev => !prev)}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #fca5a5',
                          color: '#991b1b',
                          fontWeight: 600,
                          fontSize: '0.82rem',
                          padding: '0.45rem 1rem',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#fee2e2';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#ffffff';
                        }}
                      >
                        {showAllWeakTopics ? (
                          <>
                            Show Less <ChevronUp style={{ width: '0.9rem', height: '0.9rem' }} />
                          </>
                        ) : (
                          <>
                            View All Weak Topics (+{data.weakTopics.length - 4} more) <ChevronDown style={{ width: '0.9rem', height: '0.9rem' }} />
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Subject Accuracy Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
                {canonicalSubjectAccuracy.map((subj: any, i: number) => {
                  const hasAttempted = subj.attemptedCount > 0;
                  const isHigh = hasAttempted && subj.accuracyPercentage >= 70;
                  const isMedium = hasAttempted && subj.accuracyPercentage >= 50 && subj.accuracyPercentage < 70;
                  
                  const color = !hasAttempted 
                    ? '#64748b' 
                    : (isHigh ? '#15803d' : (isMedium ? '#0284c7' : '#b91c1c'));
                  const bg = !hasAttempted 
                    ? '#f1f5f9' 
                    : (isHigh ? '#f0fdf4' : (isMedium ? '#f0f9ff' : '#fef2f2'));
                  const label = !hasAttempted 
                    ? 'Not Attempted' 
                    : `${subj.accuracyPercentage}% Accuracy`;

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedSubjectModal(subj)}
                      className="glass-panel"
                      style={{
                        padding: '1.25rem',
                        textAlign: 'left',
                        cursor: 'pointer',
                        border: '1px solid #cbd5e1',
                        borderRadius: '0.75rem',
                        background: '#ffffff',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                        width: '100%',
                        display: 'block'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 12px rgba(37, 99, 235, 0.12)';
                        e.currentTarget.style.borderColor = '#93c5fd';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Subject</span>
                        <span style={{ background: bg, color, fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '0.4rem' }}>
                          {label}
                        </span>
                      </div>
                      <h5 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: '#0f172a', lineHeight: 1.3 }}>
                        {subj.canonicalSubject}
                      </h5>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>
                        <span>Performance</span>
                        <span style={{ color: '#1e293b', fontWeight: 600 }}>
                          {subj.correctCount} / {subj.attemptedCount} answered
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '0.35rem', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden', marginBottom: '0.6rem' }}>
                        <div
                          style={{
                            width: `${hasAttempted ? subj.accuracyPercentage : 0}%`,
                            height: '100%',
                            background: color,
                            borderRadius: '9999px',
                            transition: 'width 0.4s ease'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: '#2563eb', fontWeight: 600 }}>
                        <span>{subj.chapters?.length || 0} chapters</span>
                        <span>View breakdown &rarr;</span>
                      </div>
                    </button>
                  );
                })}
              </div>

            </div>
          )}
        </div>
      </div>


      {/* Subject Performance & Chapter Breakdown Modal */}
      {selectedSubjectModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem'
          }}
          onClick={() => setSelectedSubjectModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="subject-modal-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '1rem',
              width: '800px',
              maxWidth: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1.75rem',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '0.6rem',
                    background: '#eff6ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <BarChart3 style={{ width: '1.4rem', height: '1.4rem', color: '#2563eb' }} />
                </div>
                <div>
                  <h3
                    id="subject-modal-title"
                    style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0f172a' }}
                  >
                    {selectedSubjectModal.canonicalSubject}
                  </h3>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                    Comprehensive Chapter &amp; Topic Performance Analytics
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span
                  style={{
                    background: selectedSubjectModal.attemptedCount === 0
                      ? '#f1f5f9'
                      : (selectedSubjectModal.accuracyPercentage >= 70 ? '#f0fdf4' : (selectedSubjectModal.accuracyPercentage >= 50 ? '#f0f9ff' : '#fef2f2')),
                    color: selectedSubjectModal.attemptedCount === 0
                      ? '#64748b'
                      : (selectedSubjectModal.accuracyPercentage >= 70 ? '#15803d' : (selectedSubjectModal.accuracyPercentage >= 50 ? '#0284c7' : '#b91c1c')),
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.65rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #cbd5e1'
                  }}
                >
                  {selectedSubjectModal.attemptedCount === 0
                    ? 'Not Attempted'
                    : `${selectedSubjectModal.accuracyPercentage}% Accuracy`}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedSubjectModal(null)}
                  aria-label="Close subject details modal"
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    borderRadius: '0.5rem',
                    width: '2rem',
                    height: '2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: 700
                  }}
                >
                  <X style={{ width: '1.1rem', height: '1.1rem' }} />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ padding: '1.75rem', overflowY: 'auto', flex: 1 }}>
              {/* KPI Summary Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '0.75rem',
                  marginBottom: '1.5rem'
                }}
              >
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total In Bank</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                    {selectedSubjectModal.totalQuestions}
                  </div>
                </div>

                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#1d4ed8', fontWeight: 600, textTransform: 'uppercase' }}>Attempted</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e40af', marginTop: '0.2rem' }}>
                    {selectedSubjectModal.attemptedCount}
                  </div>
                </div>

                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 600, textTransform: 'uppercase' }}>Correct</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#166534', marginTop: '0.2rem' }}>
                    {selectedSubjectModal.correctCount}
                  </div>
                </div>

                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 600, textTransform: 'uppercase' }}>Wrong</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#991b1b', marginTop: '0.2rem' }}>
                    {selectedSubjectModal.wrongCount}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600, textTransform: 'uppercase' }}>Skipped</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#334155', marginTop: '0.2rem' }}>
                    {selectedSubjectModal.skippedCount}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ marginBottom: '1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.4rem' }}>
                  <span>Cumulative Accuracy</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>
                    {selectedSubjectModal.attemptedCount > 0 ? `${selectedSubjectModal.accuracyPercentage}%` : 'No attempts recorded'}
                  </span>
                </div>
                <div style={{ width: '100%', height: '0.55rem', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${selectedSubjectModal.attemptedCount > 0 ? selectedSubjectModal.accuracyPercentage : 0}%`,
                      height: '100%',
                      background: selectedSubjectModal.accuracyPercentage >= 70
                        ? '#15803d'
                        : (selectedSubjectModal.accuracyPercentage >= 50 ? '#0284c7' : '#b91c1c'),
                      borderRadius: '9999px',
                      transition: 'width 0.4s ease'
                    }}
                  />
                </div>
              </div>

              {/* Chapter-wise Breakdown */}
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.85rem' }}>
                Chapter &amp; Topic Breakdown ({selectedSubjectModal.chapters?.length || 0} Chapters)
              </h4>

              {(!selectedSubjectModal.chapters || selectedSubjectModal.chapters.length === 0) ? (
                <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '0.75rem', border: '1px dashed #cbd5e1' }}>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
                    No chapter-level attempts recorded for this subject yet. Complete a timed mock exam to generate granular chapter metrics.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {selectedSubjectModal.chapters.map((chap: any, cIdx: number) => {
                    const chapAttempted = chap.attemptedCount > 0;
                    const chapColor = !chapAttempted
                      ? '#64748b'
                      : (chap.accuracyPercentage >= 70 ? '#15803d' : (chap.accuracyPercentage >= 50 ? '#0284c7' : '#b91c1c'));
                    const chapBg = !chapAttempted
                      ? '#f1f5f9'
                      : (chap.accuracyPercentage >= 70 ? '#f0fdf4' : (chap.accuracyPercentage >= 50 ? '#f0f9ff' : '#fef2f2'));

                    return (
                      <div
                        key={cIdx}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '0.75rem',
                          padding: '1rem',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Chapter</span>
                            <h5 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', margin: '0.1rem 0 0 0' }}>
                              {chap.chapterName}
                            </h5>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                              {chap.correctCount} / {chap.attemptedCount} correct
                            </span>
                            <span
                              style={{
                                background: chapBg,
                                color: chapColor,
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.5rem',
                                borderRadius: '0.4rem',
                                border: '1px solid #cbd5e1'
                              }}
                            >
                              {chapAttempted ? `${chap.accuracyPercentage}%` : 'Not Attempted'}
                            </span>
                          </div>
                        </div>

                        {/* Topics under this chapter */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {chap.topics?.map((top: any, tIdx: number) => {
                            const topAttempted = top.attemptedCount > 0;
                            const isWeak = top.isWeak || (topAttempted && top.accuracyPercentage < 50);

                            return (
                              <div
                                key={tIdx}
                                style={{
                                  background: '#ffffff',
                                  border: isWeak ? '1px solid #fca5a5' : '1px solid #e2e8f0',
                                  borderRadius: '0.5rem',
                                  padding: '0.65rem 0.85rem',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: '0.5rem'
                                }}
                              >
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>
                                      {top.topic}
                                    </span>
                                    {isWeak && (
                                      <span
                                        style={{
                                          background: '#fee2e2',
                                          color: '#991b1b',
                                          fontSize: '0.68rem',
                                          fontWeight: 700,
                                          padding: '0.1rem 0.35rem',
                                          borderRadius: '0.25rem'
                                        }}
                                      >
                                        ⚠ Needs Practice
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                                    Correct: <strong style={{ color: '#15803d' }}>{top.correctCount}</strong> &bull; Wrong: <strong style={{ color: '#b91c1c' }}>{top.wrongCount}</strong> &bull; Skipped: <strong>{top.skippedCount}</strong> ({top.totalQuestions} in bank)
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                  <span
                                    style={{
                                      fontSize: '0.8rem',
                                      fontWeight: 700,
                                      color: topAttempted ? (top.accuracyPercentage >= 70 ? '#15803d' : (top.accuracyPercentage >= 50 ? '#0284c7' : '#b91c1c')) : '#64748b'
                                    }}
                                  >
                                    {topAttempted ? `${top.accuracyPercentage}%` : 'N/A'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedTopicModal(top)}
                                    style={{
                                      background: '#eff6ff',
                                      border: '1px solid #bfdbfe',
                                      color: '#1d4ed8',
                                      fontSize: '0.72rem',
                                      fontWeight: 600,
                                      padding: '0.25rem 0.55rem',
                                      borderRadius: '0.35rem',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Study Tips &rarr;
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '1rem 1.75rem',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                * Metrics calculated across all submitted mock exam attempts.
              </span>
              <button
                type="button"
                onClick={() => setSelectedSubjectModal(null)}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.55rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Topic Remediation & Study Guidance Modal */}
      {selectedTopicModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            padding: '1rem'
          }}
          onClick={() => setSelectedTopicModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="topic-modal-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '1rem',
              width: '640px',
              maxWidth: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1.75rem',
                borderBottom: '1px solid #e2e8f0',
                background: '#fef2f2'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '0.6rem',
                    background: '#fee2e2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <AlertTriangle style={{ width: '1.4rem', height: '1.4rem', color: '#dc2626' }} />
                </div>
                <div>
                  <h3
                    id="topic-modal-title"
                    style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#0f172a' }}
                  >
                    {selectedTopicModal.topic}
                  </h3>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#7f1d1d', fontWeight: 600 }}>
                    {getCanonicalSubject(selectedTopicModal.subject || selectedTopicModal.canonicalSubject)} &bull; {selectedTopicModal.chapter || 'General Practice'}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span
                  style={{
                    background: '#fee2e2',
                    color: '#991b1b',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.65rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #fca5a5'
                  }}
                >
                  {selectedTopicModal.accuracyPercentage}% Accuracy
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTopicModal(null)}
                  aria-label="Close topic remediation modal"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #fca5a5',
                    color: '#991b1b',
                    borderRadius: '0.5rem',
                    width: '2rem',
                    height: '2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: 700
                  }}
                >
                  <X style={{ width: '1.1rem', height: '1.1rem' }} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.75rem', overflowY: 'auto', flex: 1 }}>
              {/* Performance Diagnostics Box */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                  marginBottom: '1.5rem'
                }}
              >
                <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#334155', margin: '0 0 0.85rem 0', textTransform: 'uppercase' }}>
                  Mock Exam Performance Diagnostics
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', textAlign: 'center' }}>
                  <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '0.5rem', padding: '0.6rem' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Attempted</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>{selectedTopicModal.attemptedCount}</div>
                  </div>
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '0.5rem', padding: '0.6rem' }}>
                    <div style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 600 }}>Correct</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#15803d' }}>{selectedTopicModal.correctCount}</div>
                  </div>
                  <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '0.5rem', padding: '0.6rem' }}>
                    <div style={{ fontSize: '0.7rem', color: '#b91c1c', fontWeight: 600 }}>Wrong</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#b91c1c' }}>{selectedTopicModal.wrongCount}</div>
                  </div>
                  <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '0.5rem', padding: '0.6rem' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Skipped</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#475569' }}>{selectedTopicModal.skippedCount}</div>
                  </div>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <div style={{ width: '100%', height: '0.5rem', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${selectedTopicModal.accuracyPercentage}%`,
                        height: '100%',
                        background: selectedTopicModal.accuracyPercentage >= 50 ? '#0284c7' : '#dc2626',
                        borderRadius: '9999px'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
                    <span>Target Mastery: &ge; 70%</span>
                    <span>Current: {selectedTopicModal.accuracyPercentage}%</span>
                  </div>
                </div>
              </div>

              {/* Actionable Study Guidance */}
              <div style={{ marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Target style={{ width: '1.1rem', height: '1.1rem', color: '#2563eb' }} />
                  Tailored Study &amp; Remediation Plan
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {getTopicRemediationTips(
                    selectedTopicModal.subject || selectedTopicModal.canonicalSubject,
                    selectedTopicModal.chapter,
                    selectedTopicModal.topic
                  ).map((tip: string, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.5rem',
                        padding: '0.75rem 1rem',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.65rem'
                      }}
                    >
                      <span
                        style={{
                          background: '#eff6ff',
                          color: '#2563eb',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          borderRadius: '50%',
                          width: '1.25rem',
                          height: '1.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: '0.1rem'
                        }}
                      >
                        {idx + 1}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.5 }}>
                        {tip}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendation Note */}
              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '0.5rem',
                  padding: '0.85rem 1rem',
                  fontSize: '0.8rem',
                  color: '#1e40af',
                  lineHeight: 1.5
                }}
              >
                <strong>Pro-Tip:</strong> Review lecture notes and re-attempt practice exercises for <strong>{selectedTopicModal.topic}</strong>. Once you feel confident, take another full-length Model Test to observe your accuracy increase in real time.
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '1rem 1.75rem',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center'
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedTopicModal(null)}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.55rem 1.35rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close Guidance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preparation Goal Setting Modal (Phase 1) */}
      {isGoalModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '1rem',
            padding: '2rem',
            width: '480px',
            maxWidth: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Target style={{ width: '1.2rem', height: '1.2rem', color: '#2563eb' }} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Set Preparation Goal
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsGoalModalOpen(false);
                  setGoalMessage(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  padding: '0.25rem'
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Choose your target recruitment bank, position, and expected exam date to calculate countdown milestones and personalize your preparation metrics.
            </p>

            {goalMessage && (
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                marginBottom: '1.25rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: goalMessage.type === 'success' ? '#f0fdf4' : '#fef2f2',
                border: goalMessage.type === 'success' ? '1px solid #86efac' : '1px solid #fca5a5',
                color: goalMessage.type === 'success' ? '#15803d' : '#b91c1c'
              }}>
                {goalMessage.type === 'success' ? <CheckCircle2 style={{ width: '1rem', height: '1rem' }} /> : <AlertCircle style={{ width: '1rem', height: '1rem' }} />}
                <span>{goalMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveGoal} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Target Bank */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#334155', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Target Bank *
                </label>
                <select
                  value={targetBank}
                  onChange={(e) => setTargetBank(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.9rem',
                    borderRadius: '0.5rem',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    outline: 'none',
                    fontSize: '0.9rem'
                  }}
                >
                  <option value="Bangladesh Bank">Bangladesh Bank (Central Bank)</option>
                  <option value="Sonali Bank">Sonali Bank PLC</option>
                  <option value="Janata Bank">Janata Bank PLC</option>
                  <option value="Agrani Bank">Agrani Bank PLC</option>
                  <option value="Rupali Bank">Rupali Bank PLC</option>
                  <option value="Bangladesh Krishi Bank">Bangladesh Krishi Bank</option>
                  <option value="Combined 8 Banks">Combined 8/9 Senior Officer & Officer</option>
                  <option value="OTHER">Other Bank / Specialized Institution</option>
                </select>

                {targetBank === 'OTHER' && (
                  <input
                    type="text"
                    placeholder="Enter Institution Name (e.g. Pubali Bank, BASIC Bank)..."
                    value={customBank}
                    onChange={(e) => setCustomBank(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      marginTop: '0.5rem',
                      padding: '0.75rem 0.9rem',
                      borderRadius: '0.5rem',
                      background: '#ffffff',
                      border: '1px solid #3b82f6',
                      color: '#0f172a',
                      outline: 'none',
                      fontSize: '0.9rem'
                    }}
                  />
                )}
              </div>

              {/* Target Position */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#334155', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Target Position *
                </label>
                <select
                  value={targetPosition}
                  onChange={(e) => setTargetPosition(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.9rem',
                    borderRadius: '0.5rem',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    outline: 'none',
                    fontSize: '0.9rem'
                  }}
                >
                  <option value="Assistant Director">Assistant Director (AD)</option>
                  <option value="Senior Officer">Senior Officer (SO)</option>
                  <option value="Officer">Officer (General)</option>
                  <option value="Officer Cash">Officer (Cash)</option>
                  <option value="Officer IT">Officer (IT / Programmer)</option>
                  <option value="CUSTOM">Custom Position / Special Cadre</option>
                </select>

                {targetPosition === 'CUSTOM' && (
                  <input
                    type="text"
                    placeholder="Enter Position Title (e.g. Assistant Director - Research)..."
                    value={customPosition}
                    onChange={(e) => setCustomPosition(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      marginTop: '0.5rem',
                      padding: '0.75rem 0.9rem',
                      borderRadius: '0.5rem',
                      background: '#ffffff',
                      border: '1px solid #3b82f6',
                      color: '#0f172a',
                      outline: 'none',
                      fontSize: '0.9rem'
                    }}
                  />
                )}
              </div>

              {/* Expected Exam Date */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#334155', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Expected Exam Date (Student-Estimated)
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.9rem',
                    borderRadius: '0.5rem',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    outline: 'none',
                    fontSize: '0.9rem'
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: '0.35rem' }}>
                  * Countdown calculates days remaining according to the Asia/Dhaka calendar.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsGoalModalOpen(false);
                    setGoalMessage(null);
                  }}
                  style={{
                    padding: '0.65rem 1.25rem',
                    borderRadius: '0.5rem',
                    background: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={goalSaving}
                  style={{
                    padding: '0.65rem 1.4rem',
                    borderRadius: '0.5rem',
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    cursor: goalSaving ? 'not-allowed' : 'pointer',
                    opacity: goalSaving ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <Target style={{ width: '0.9rem', height: '0.9rem' }} />
                  {goalSaving ? 'Saving...' : 'Save Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
