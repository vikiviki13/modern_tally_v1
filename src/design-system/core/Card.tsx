import React from 'react';

export interface CardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  density?: 'compact' | 'comfortable';
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  action,
  children,
  footer,
  className = '',
  density = 'compact',
}) => {
  const padClass = density === 'compact' ? 'p-3' : 'p-4';

  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded shadow-xs flex flex-col ${className}`}
    >
      {(title || action) && (
        <div
          className={`flex items-center justify-between border-b border-slate-800/80 ${padClass} bg-slate-950/40`}
        >
          <div className="flex flex-col">
            {typeof title === 'string' ? (
              <h3 className="text-xs font-semibold text-slate-200">{title}</h3>
            ) : (
              title
            )}
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={`flex-1 ${padClass}`}>{children}</div>
      {footer && (
        <div
          className={`border-t border-slate-800/80 ${padClass} bg-slate-950/40 flex items-center justify-between text-xs text-slate-400`}
        >
          {footer}
        </div>
      )}
    </div>
  );
};
