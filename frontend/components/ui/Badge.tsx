import { HTMLAttributes } from 'react';

type BadgeVariant = 'default' | 'accent' | 'warning' | 'danger' | 'info';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-surface-soft text-text-secondary',
  accent: 'bg-accent-soft text-accent',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

export function Badge({ variant = 'default', children, className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[0.75rem] font-medium rounded-[var(--radius-sm)] ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
