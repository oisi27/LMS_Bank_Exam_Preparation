import React from 'react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../../../shared';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  onNavigateAuth: () => void;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  onNavigateAuth
}) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ color: '#64748b', fontSize: '0.95rem' }}>Verifying authenticated session...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px' }}>
        <h3 style={{ fontSize: '1.25rem', color: '#b91c1c', marginBottom: '8px' }}>Access Restricted</h3>
        <p style={{ color: '#64748b', marginBottom: '16px' }}>Please sign in to access this portal area.</p>
        <button
          onClick={onNavigateAuth}
          style={{
            background: '#2563eb',
            color: '#ffffff',
            padding: '8px 18px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Go to Sign In
        </button>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px' }}>
        <h3 style={{ fontSize: '1.25rem', color: '#b91c1c', marginBottom: '8px' }}>Permission Denied</h3>
        <p style={{ color: '#64748b' }}>
          Your role ({user.role}) is not authorized to access this section.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
