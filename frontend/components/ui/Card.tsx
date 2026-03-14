import { HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

const paddingStyles = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable = false, padding = 'md', children, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-card
        className={`bg-surface rounded-[var(--radius-lg)] shadow-sm transition-shadow duration-200 ${hoverable ? 'hover:shadow-md cursor-pointer' : ''} ${paddingStyles[padding]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
