import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  density?: 'compact' | 'comfortable';
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftElement,
      rightElement,
      density = 'compact',
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const heightClass = density === 'compact' ? 'h-7 text-xs' : 'h-9 text-sm';

    return (
      <div className="w-full flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[11px] font-medium text-slate-300 flex items-center justify-between"
          >
            <span>{label}</span>
            {props.required && <span className="text-rose-400 text-[10px]">*</span>}
          </label>
        )}
        <div className="relative flex items-center w-full">
          {leftElement && (
            <div className="absolute left-2 flex items-center pointer-events-none text-slate-400">
              {leftElement}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full bg-slate-900 border rounded font-mono tabular-nums text-slate-100 placeholder:text-slate-500 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-950 disabled:text-slate-600 disabled:border-slate-800 ${
              error ? 'border-rose-500/80 focus:ring-rose-500 focus:border-rose-500' : 'border-slate-700/80'
            } ${leftElement ? 'pl-7' : 'px-2.5'} ${rightElement ? 'pr-7' : 'px-2.5'} ${heightClass} ${className}`}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-2 flex items-center pointer-events-none text-slate-400">
              {rightElement}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-[11px] text-rose-400">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-slate-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
