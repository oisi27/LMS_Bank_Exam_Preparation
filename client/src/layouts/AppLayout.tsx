import React from 'react';
import { Badge } from '../design-system';

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentUser?: { name: string; role: string; targetExam?: string } | null;
  onLogout?: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  currentUser,
  onLogout
}) => {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column', background: '#f8fafc' }}>
      {/* Top Navbar */}
      <header
        style={{
          borderBottom: '1px solid #e2e8f0',
          background: '#ffffff',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
          padding: '12px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 40
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            onClick={() => onTabChange('dashboard')}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                color: '#fff',
                fontSize: '18px'
              }}
            >
              ৳
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a', letterSpacing: '-0.02em' }}>
                Bank Exam LMS
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                IIT, University of Dhaka • Bangladesh Bank Prep
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => onTabChange('dashboard')}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'dashboard' ? '#eff6ff' : 'transparent',
              color: activeTab === 'dashboard' ? '#1d4ed8' : '#475569',
              fontWeight: activeTab === 'dashboard' ? 700 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            Dashboard
          </button>
          <button
            onClick={() => onTabChange('courses')}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'courses' ? '#eff6ff' : 'transparent',
              color: activeTab === 'courses' ? '#1d4ed8' : '#475569',
              fontWeight: activeTab === 'courses' ? 700 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            Syllabus & Courses
          </button>
          {(currentUser?.role === 'INSTRUCTOR' || currentUser?.role === 'ADMIN') && (
            <>
              <button
                onClick={() => onTabChange('course-builder')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeTab === 'course-builder' ? '#eff6ff' : 'transparent',
                  color: activeTab === 'course-builder' ? '#1d4ed8' : '#475569',
                  fontWeight: activeTab === 'course-builder' ? 700 : 500,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                Course Builder
              </button>
              <button
                onClick={() => onTabChange('exam-builder')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeTab === 'exam-builder' ? '#eff6ff' : 'transparent',
                  color: activeTab === 'exam-builder' ? '#1d4ed8' : '#475569',
                  fontWeight: activeTab === 'exam-builder' ? 700 : 500,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                Exam Builder
              </button>
              <button
                onClick={() => onTabChange('questions')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeTab === 'questions' ? '#eff6ff' : 'transparent',
                  color: activeTab === 'questions' ? '#1d4ed8' : '#475569',
                  fontWeight: activeTab === 'questions' ? 700 : 500,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                Question Bank
              </button>
            </>
          )}
          {currentUser?.role === 'ADMIN' && (
            <button
              onClick={() => onTabChange('admin')}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'admin' ? '#eff6ff' : 'transparent',
                color: activeTab === 'admin' ? '#1d4ed8' : '#475569',
                fontWeight: activeTab === 'admin' ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              Admin Governance
            </button>
          )}
        </nav>

        {/* User Identity HUD */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{currentUser.name}</div>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '2px' }}>
                  <Badge text={currentUser.role} type={currentUser.role === 'ADMIN' ? 'danger' : 'info'} />
                </div>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Logout
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => onTabChange('auth')}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '28px', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>
        {children}
      </main>

      {/* System Footer */}
      <footer
        style={{
          borderTop: '1px solid #e2e8f0',
          background: '#ffffff',
          padding: '16px 28px',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: '#64748b'
        }}
      >
        Bank Exam Preparation LMS • Master's Project Fall 2026 • IIT, University of Dhaka
      </footer>
    </div>
  );
};
