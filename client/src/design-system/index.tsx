import React from 'react';

export const Button: React.FC<{
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}> = ({
  variant = 'primary',
  size = 'md',
  children,
  onClick,
  disabled = false,
  className = '',
  type = 'button'
}) => {
  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    borderRadius: '8px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'all 0.15s ease-in-out',
    border: 'none',
    outline: 'none',
    gap: '8px',
    fontFamily: 'inherit'
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: '6px 12px', fontSize: '0.85rem' },
    md: { padding: '10px 18px', fontSize: '0.95rem' },
    lg: { padding: '14px 24px', fontSize: '1.05rem' }
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: { background: '#2563eb', color: '#ffffff', border: '1px solid #1d4ed8' },
    secondary: { background: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1' },
    outline: { background: '#ffffff', border: '1px solid #cbd5e1', color: '#334155' },
    danger: { background: '#dc2626', color: '#ffffff', border: '1px solid #b91c1c' }
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{ ...baseStyles, ...sizeStyles[size], ...variantStyles[variant] }}
      className={className}
    >
      {children}
    </button>
  );
};

export const Card: React.FC<{
  children: React.ReactNode;
  elevated?: boolean;
  style?: React.CSSProperties;
  className?: string;
}> = ({ children, elevated = false, style, className = '' }) => {
  return (
    <div
      className={`${elevated ? 'glass-panel-elevated' : 'glass-panel'} ${className}`}
      style={{ padding: '24px', ...style }}
    >
      {children}
    </div>
  );
};

export const Badge: React.FC<{
  text: string;
  type?: 'info' | 'success' | 'warning' | 'danger';
}> = ({ text, type = 'info' }) => {
  const badgeColors: Record<string, { bg: string; color: string; border: string }> = {
    info: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    success: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
    warning: { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
    danger: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' }
  };

  const style = badgeColors[type];

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        backgroundColor: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`
      }}
    >
      {text}
    </span>
  );
};
