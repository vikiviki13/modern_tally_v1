import React, { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

export interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  label?: string;
  density?: 'compact' | 'comfortable';
  error?: string;
  disabled?: boolean;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  label,
  density = 'compact',
  error,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Quick accounting date setters
  const setToday = () => {
    const today = new Date().toISOString().split('T')[0];
    onChange(today);
    setIsOpen(false);
  };

  const setYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    onChange(d.toISOString().split('T')[0]);
    setIsOpen(false);
  };

  const setMonthEnd = () => {
    const d = new Date();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    onChange(end.toISOString().split('T')[0]);
    setIsOpen(false);
  };

  const heightClass = density === 'compact' ? 'h-7 text-xs' : 'h-9 text-sm';

  return (
    <div className="w-full flex flex-col gap-1 relative">
      {label && (
        <label className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
          <span>{label}</span>
          <kbd className="text-[10px] text-slate-500 font-mono">F2</kbd>
        </label>
      )}
      <div className="relative flex items-center">
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full bg-slate-900 border rounded font-mono tabular-nums text-slate-100 pl-7 pr-2 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-950 disabled:text-slate-600 ${
            error ? 'border-rose-500/80' : 'border-slate-700/80'
          } ${heightClass}`}
        />
        <CalendarIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
      </div>
      {error && <p className="text-[11px] text-rose-400">{error}</p>}
    </div>
  );
};
