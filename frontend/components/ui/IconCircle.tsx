interface IconCircleProps {
  children: React.ReactNode;
  color?: 'accent' | 'warning' | 'danger' | 'info' | 'default';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const colorStyles = {
  accent: 'bg-accent-soft text-accent',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  default: 'bg-surface-soft text-text-secondary',
};

const sizeStyles = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

export function IconCircle({ children, color = 'default', size = 'md', className = '' }: IconCircleProps) {
  return (
    <div
      className={`inline-flex items-center justify-center rounded-[var(--radius-md)] flex-shrink-0 ${colorStyles[color]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </div>
  );
}
