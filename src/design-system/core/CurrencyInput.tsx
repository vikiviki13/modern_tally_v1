import React, { useState, useEffect } from 'react';

export interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  currencySymbol?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  density?: 'compact' | 'comfortable';
  allowNegative?: boolean;
  placeholder?: string;
  className?: string;
  shortcut?: string;
  direction?: 'DR' | 'CR';
  onDirectionChange?: (dir: 'DR' | 'CR') => void;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  currencySymbol = '₹',
  label,
  error,
  disabled = false,
  density = 'compact',
  allowNegative = false,
  placeholder = '0.00',
  className = '',
  shortcut,
  direction,
  onDirectionChange,
}) => {
  const [displayValue, setDisplayValue] = useState<string>(
    value ? value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
  );
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      if (value === 0 && !displayValue) {
        setDisplayValue('');
      } else {
        setDisplayValue(
          value
            ? value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : ''
        );
      }
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    // When focused, show raw number for easy keyboard editing
    setDisplayValue(value ? String(value) : '');
  };

  const handleBlur = () => {
    setIsFocused(false);
    const cleaned = displayValue.replace(/,/g, '');
    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      const finalVal = allowNegative ? num : Math.max(0, num);
      onChange(Math.round(finalVal * 100) / 100);
    } else {
      onChange(0);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow digits, single decimal point, and optional leading minus if enabled
    if (/^-?\d*\.?\d*$/.test(val.replace(/,/g, ''))) {
      setDisplayValue(val);
      const parsed = parseFloat(val.replace(/,/g, ''));
      if (!isNaN(parsed)) {
        onChange(Math.round(parsed * 100) / 100);
      } else if (val === '' || val === '-') {
        onChange(0);
      }
    }
  };

  const heightClass = density === 'compact' ? 'h-7 text-xs' : 'h-9 text-sm';

  return (
    <div className="w-full flex flex-col gap-1">
      {label && (
        <div className="flex items-center justify-between text-[11px] font-medium text-slate-300">
          <span>{label}</span>
          {shortcut && (
            <kbd className="text-[10px] text-slate-500 font-mono">{shortcut}</kbd>
          )}
        </div>
      )}
      <div className="relative flex items-center w-full">
        <span className="absolute left-2 text-slate-400 font-mono text-xs select-none">
          {currencySymbol}
        </span>
        <input
          type="text"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full bg-slate-900 border rounded font-mono tabular-nums text-right pr-2 pl-6 text-slate-100 placeholder:text-slate-600 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-950 disabled:text-slate-600 ${
            error ? 'border-rose-500/80 focus:ring-rose-500' : 'border-slate-700/80'
          } ${heightClass} ${className}`}
        />
        {direction && onDirectionChange && (
          <button
            type="button"
            onClick={() => onDirectionChange(direction === 'DR' ? 'CR' : 'DR')}
            className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider select-none border transition-colors ${
              direction === 'DR'
                ? 'bg-rose-950/60 text-rose-300 border-rose-800 hover:bg-rose-900'
                : 'bg-emerald-950/60 text-emerald-300 border-emerald-800 hover:bg-emerald-900'
            }`}
          >
            {direction}
          </button>
        )}
      </div>
      {error && <p className="text-[11px] text-rose-400">{error}</p>}
    </div>
  );
};
