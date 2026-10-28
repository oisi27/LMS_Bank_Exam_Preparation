import React from 'react';

interface ExamLayoutProps {
  children: React.ReactNode;
  examTitle: string;
  timeRemainingDisplay: string;
  onExitRequest?: () => void;
  onSubmitRequest?: () => void;
}

export const ExamLayout: React.FC<ExamLayoutProps> = ({
  children,
  examTitle,
  timeRemainingDisplay,
  onExitRequest,
  onSubmitRequest
}) => {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0a0f1d',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* High-Stakes Exam HUD Bar */}
      <header
        style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(15, 23, 42, 0.95)',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 50
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              background: '#ef4444',
              color: '#ffffff',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.05em'
            }}
          >
            LIVE EXAM
          </span>
          <span style={{ fontWeight: 600, fontSize: '1rem', color: '#f1f5f9' }}>
            {examTitle}
          </span>
        </div>

        {/* Server Clock HUD */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              fontFamily: 'monospace',
              fontSize: '1.2rem',
              fontWeight: 700
            }}
          >
            ⏱ {timeRemainingDisplay}
          </div>

          {onSubmitRequest && (
            <button
              onClick={onSubmitRequest}
              style={{
                background: '#10b981',
                color: '#ffffff',
                border: 'none',
                padding: '8px 18px',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Submit Exam
            </button>
          )}
        </div>
      </header>

      {/* Main Exam Viewport */}
      <main style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  );
};
