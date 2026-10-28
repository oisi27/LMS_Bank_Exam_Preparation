import React from 'react';
import { Card, Badge, Button } from '../../design-system';

export const DashboardPlaceholder: React.FC<{
  onStartExam?: () => void;
  onExploreCourses?: () => void;
}> = ({ onStartExam, onExploreCourses }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Welcome Banner */}
      <Card elevated>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Badge text="Target: Bangladesh Bank AD" type="info" />
              <Badge text="Exam Date: Dec 2026" type="warning" />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', marginBottom: '8px' }}>
              Candidate Preparation Portal
            </h1>
            <p style={{ color: '#94a3b8', maxWidth: '600px', fontSize: '0.95rem' }}>
              Disciplined practice environment featuring negative marking, server-timed mock tests, and subject-wise accuracy tracking.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {onStartExam && (
              <Button variant="primary" onClick={onStartExam}>
                Take Live Mock Test
              </Button>
            )}
            {onExploreCourses && (
              <Button variant="outline" onClick={onExploreCourses}>
                View Syllabus
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Overview Metric Placeholders */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
        <Card>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Enrolled Target Syllabus</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f1f5f9' }}>Combined 8 Banks</div>
          <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px' }}>English • Math • Bangla • GK • Banking</div>
        </Card>
        <Card>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Mock Tests Completed</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f1f5f9' }}>1 Attempt</div>
          <div style={{ fontSize: '0.75rem', color: '#60a5fa', marginTop: '4px' }}>Average Accuracy: 84.5%</div>
        </Card>
        <Card>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Server Clock Sync</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>Synchronized</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>UTC (Dhaka +06:00)</div>
        </Card>
      </div>
    </div>
  );
};
