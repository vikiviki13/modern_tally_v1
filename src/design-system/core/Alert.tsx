import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export interface AlertProps {
  title?: string;
  children: React.ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'error';
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  title,
  children,
  variant = 'info',
  onClose,
  className = '',
}) => {
  const icons = {
    info: <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />,
    success: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
    error: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />,
  };

  const variantStyles = {
    info: 'bg-sky-950/40 border-sky-800/80 text-sky-200',
    success: 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200',
    warning: 'bg-amber-950/40 border-amber-800/80 text-amber-200',
    error: 'bg-rose-950/40 border-rose-800/80 text-rose-200',
  };

  return (
    <div
      role="alert"
      className={`p-3 rounded border flex items-start gap-2.5 text-xs ${variantStyles[variant]} ${className}`}
    >
      {icons[variant]}
      <div className="flex-1">
        {title && <h4 className="font-semibold text-slate-100 mb-0.5">{title}</h4>}
        <div className="text-slate-300 leading-relaxed">{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 p-0.5 rounded cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
