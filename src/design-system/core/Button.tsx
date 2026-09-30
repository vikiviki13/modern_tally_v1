import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  shortcut?: string; // e.g., "Enter", "F2", "Alt+S"
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'secondary',
      size = 'sm',
      isLoading = false,
      leftIcon,
      rightIcon,
      shortcut,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      xs: 'h-6 px-2 text-[11px] gap-1',
      sm: 'h-7 px-2.5 text-xs gap-1.5',
      md: 'h-8 px-3.5 text-sm gap-2',
      lg: 'h-10 px-4 text-sm gap-2',
    }[size];

    const variantClasses = {
      primary:
        'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium shadow-sm border border-indigo-500/30 focus-visible:ring-2 focus-visible:ring-indigo-400',
      secondary:
        'bg-slate-800 hover:bg-slate-700 active:bg-slate-850 text-slate-200 border border-slate-700/80 hover:border-slate-600 focus-visible:ring-2 focus-visible:ring-slate-500',
      outline:
        'bg-transparent hover:bg-slate-800/60 active:bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-500 focus-visible:ring-2 focus-visible:ring-slate-500',
      danger:
        'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/80 active:bg-rose-900 focus-visible:ring-2 focus-visible:ring-rose-500',
      success:
        'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/80 active:bg-emerald-900 focus-visible:ring-2 focus-visible:ring-emerald-500',
      ghost:
        'bg-transparent hover:bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-transparent focus-visible:ring-1 focus-visible:ring-slate-500',
    }[variant];

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`inline-flex items-center justify-center rounded transition-colors duration-150 select-none outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${sizeClasses} ${variantClasses} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {!isLoading && leftIcon}
        <span>{children}</span>
        {!isLoading && rightIcon}
        {shortcut && (
          <kbd className="ml-1 px-1 py-0.2 bg-slate-900/80 border border-slate-700/80 rounded text-[10px] font-mono text-slate-400 tracking-tight leading-none">
            {shortcut}
          </kbd>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
