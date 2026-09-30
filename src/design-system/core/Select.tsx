import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  density?: 'compact' | 'comfortable';
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, density = 'compact', className = '', ...props }, ref) => {
    const heightClass = density === 'compact' ? 'h-7 text-xs' : 'h-9 text-sm';

    return (
      <div className="w-full flex flex-col gap-1">
        {label && (
          <label className="text-[11px] font-medium text-slate-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          <select
            ref={ref}
            className={`w-full appearance-none bg-slate-900 border rounded text-slate-100 pl-2.5 pr-7 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-950 disabled:text-slate-600 ${
              error ? 'border-rose-500/80' : 'border-slate-700/80'
            } ${heightClass} ${className}`}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-100">
                {opt.label} {opt.sublabel ? `(${opt.sublabel})` : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
        </div>
        {error && <p className="text-[11px] text-rose-400">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
