interface AvatarProps {
  initials: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeStyles = {
  sm: 'w-7 h-7 text-[0.6875rem]',
  md: 'w-9 h-9 text-[0.8125rem]',
  lg: 'w-11 h-11 text-[0.9375rem]',
};

export function Avatar({ initials, size = 'md', className = '' }: AvatarProps) {
  return (
    <div
      className={`inline-flex items-center justify-center rounded-[var(--radius-md)] bg-accent-soft text-accent font-[family-name:var(--font-heading)] font-semibold ${sizeStyles[size]} ${className}`}
    >
      {initials}
    </div>
  );
}
