import React from 'react';
import { Search, X } from 'lucide-react';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  density?: 'compact' | 'comfortable';
  onClear?: () => void;
  autoFocus?: boolean;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search records, ledgers, items...',
  className = '',
  density = 'compact',
  onClear,
  autoFocus,
}) => {
  const heightClass = density === 'compact' ? 'h-7 text-xs' : 'h-9 text-sm';

  return (
    <div className={`relative flex items-center w-full ${className}`}>
      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`w-full bg-slate-900 border border-slate-700/80 rounded pl-8 pr-7 text-slate-100 placeholder:text-slate-500 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 ${heightClass}`}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            onClear?.();
          }}
          className="absolute right-2 text-slate-400 hover:text-slate-200 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
