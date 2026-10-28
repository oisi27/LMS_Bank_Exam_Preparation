import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { AppLayout } from './layouts/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardScreen } from './components/DashboardScreen';
import { CoursesScreen } from './components/CoursesScreen';
import { ExamScreen } from './components/ExamScreen';
import { ResultScreen } from './components/ResultScreen';
import { ExamReviewScreen } from './components/ExamReviewScreen';
import { AdminPanel } from './components/AdminPanel';
import { QuestionBankManager } from './components/QuestionBankManager';
import { InstructorCourseBuilder } from './components/InstructorCourseBuilder';
import { InstructorExamBuilder } from './components/InstructorExamBuilder';
import { InstructorDashboard } from './components/InstructorDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { LandingPage } from './components/LandingPage';

function AppContent() {
  const { user, logout } = useAuth();
  const [currentView, setCurrentView] = useState<'dashboard' | 'courses' | 'course-builder' | 'exam-builder' | 'questions' | 'admin' | 'exam' | 'result' | 'review'>('dashboard');
  const [publicView, setPublicView] = useState<'landing' | 'login' | 'register'>('landing');
  const [lang, setLang] = useState<'en' | 'bn'>('en');
  const [adminInitialTab, setAdminInitialTab] = useState<'USERS' | 'LIVE_MONITOR' | 'AUDIT_LOGS' | 'COURSE_MODERATION' | 'GRADE_OVERRIDE' | undefined>(undefined);
  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [lastGrade, setLastGrade] = useState<any>(null);
  const [reviewAttemptId, setReviewAttemptId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'en' ? 'bn' : 'en'));
  };

  if (!user) {
    if (publicView === 'landing') {
      return (
        <LandingPage
          onLoginClick={() => setPublicView('login')}
          onRegisterClick={() => setPublicView('register')}
          lang={lang}
          onToggleLang={toggleLanguage}
        />
      );
    }

    return (
      <AuthScreen
        onSuccess={() => {
          setPublicView('landing');
          setCurrentView('dashboard');
        }}
        onBackToHome={() => setPublicView('landing')}
        initialMode={publicView === 'register' ? 'register' : 'login'}
        lang={lang}
        onToggleLang={toggleLanguage}
      />
    );
  }

  const handleStartExam = (examId: string) => {
    setActiveExamId(examId);
    setCurrentView('exam');
  };

  const handleContinueCourse = (courseId: string) => {
    setSelectedCourseId(courseId);
    setCurrentView('courses');
  };

  const handleExamFinish = (grade: any) => {
    setLastGrade(grade);
    if (grade.attemptId) {
      setReviewAttemptId(grade.attemptId);
    }
    setCurrentView('result');
  };

  const handleViewResult = (grade: any) => {
    setLastGrade(grade);
    if (grade.attemptId) {
      setReviewAttemptId(grade.attemptId);
    }
    setCurrentView('result');
  };

  const handleReviewExam = (attemptId: string) => {
    setReviewAttemptId(attemptId);
    setCurrentView('review');
  };

  // Live Exam View
  if (currentView === 'exam' && activeExamId) {
    return (
      <ExamScreen
        examId={activeExamId}
        onFinish={handleExamFinish}
        onExit={() => setCurrentView('dashboard')}
      />
    );
  }

  // Result View
  if (currentView === 'result' && lastGrade) {
    return (
      <ResultScreen
        grade={lastGrade}
        onRetakeOrExit={() => setCurrentView('dashboard')}
        onReviewAnswers={() => setCurrentView('review')}
      />
    );
  }

  // Review View
  if (currentView === 'review' && reviewAttemptId) {
    return (
      <ExamReviewScreen
        attemptId={reviewAttemptId}
        onBackToDashboard={() => setCurrentView('dashboard')}
      />
    );
  }

  return (
    <AppLayout
      activeTab={currentView}
      onTabChange={(tab: any) => setCurrentView(tab)}
      currentUser={user}
      onLogout={logout}
    >
      {currentView === 'dashboard' && (
        user?.role === 'ADMIN' ? (
          <AdminDashboard
            onNavigateTab={(tab: any, subSection?: any) => {
              if (subSection) {
                setAdminInitialTab(subSection);
              }
              setCurrentView(tab);
            }}
            currentUser={user}
          />
        ) : user?.role === 'INSTRUCTOR' ? (
          <InstructorDashboard
            onNavigateTab={(tab: any) => setCurrentView(tab)}
            currentUser={user}
          />
        ) : (
          <DashboardScreen
            onStartExam={handleStartExam}
            onLogout={logout}
            onContinueCourse={handleContinueCourse}
            onViewResult={handleViewResult}
            onReviewExam={handleReviewExam}
          />
        )
      )}

      {currentView === 'courses' && (
        <CoursesScreen
          onBackToDashboard={() => setCurrentView('dashboard')}
          onTakeExam={(examId) => handleStartExam(examId)}
          initialCourseId={selectedCourseId}
        />
      )}

      {currentView === 'course-builder' && (
        <ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN']} onNavigateAuth={() => setCurrentView('dashboard')}>
          <InstructorCourseBuilder />
        </ProtectedRoute>
      )}

      {currentView === 'exam-builder' && (
        <ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN']} onNavigateAuth={() => setCurrentView('dashboard')}>
          <InstructorExamBuilder />
        </ProtectedRoute>
      )}

      {currentView === 'questions' && (
        <ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN']} onNavigateAuth={() => setCurrentView('dashboard')}>
          <QuestionBankManager />
        </ProtectedRoute>
      )}

      {currentView === 'admin' && (
        <ProtectedRoute allowedRoles={['ADMIN']} onNavigateAuth={() => setCurrentView('dashboard')}>
          <AdminPanel
            onBack={() => {
              setAdminInitialTab(undefined);
              setCurrentView('dashboard');
            }}
            initialTab={adminInitialTab}
          />
        </ProtectedRoute>
      )}
    </AppLayout>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
