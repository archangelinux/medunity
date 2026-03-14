'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ icon, className = '', ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          className={`w-full bg-surface-soft rounded-[var(--radius-lg)] px-4 py-3 text-[0.9375rem] text-text-primary placeholder:text-text-tertiary border border-transparent focus:outline-none focus:border-accent/30 focus:bg-surface transition-all duration-150 ${icon ? 'pl-11' : ''} ${className}`}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = 'Input';
