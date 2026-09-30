import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'credit' | 'debit' | 'neutral' | 'warning' | 'info' | 'primary';
  size?: 'xs' | 'sm';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'xs',
  dot = false,
}) => {
  const sizeClasses = size === 'xs' ? 'text-[10px] px-1.5 py-0.2' : 'text-xs px-2 py-0.5';

  const variantClasses = {
    credit: 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/80',
    debit: 'bg-rose-950/70 text-rose-300 border border-rose-800/80',
    neutral: 'bg-slate-800 text-slate-300 border border-slate-700',
    warning: 'bg-amber-950/70 text-amber-300 border border-amber-800/80',
    info: 'bg-sky-950/70 text-sky-300 border border-sky-800/80',
    primary: 'bg-indigo-950/70 text-indigo-300 border border-indigo-800/80',
  }[variant];

  const dotColors = {
    credit: 'bg-emerald-400',
    debit: 'bg-rose-400',
    neutral: 'bg-slate-400',
    warning: 'bg-amber-400',
    info: 'bg-sky-400',
    primary: 'bg-indigo-400',
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono font-medium rounded-xs select-none tracking-tight ${sizeClasses} ${variantClasses}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors}`} />}
      <span>{children}</span>
    </span>
  );
};
