import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Plus, Check } from 'lucide-react';

export interface ComboboxItem {
  id: string;
  name: string;
  code?: string;
  category?: string;
  balance?: number;
  balanceType?: 'DR' | 'CR';
}

export interface ComboboxProps {
  items: ComboboxItem[];
  value?: string;
  onChange: (item: ComboboxItem) => void;
  onCreateNew?: () => void;
  placeholder?: string;
  label?: string;
  error?: string;
  density?: 'compact' | 'comfortable';
  disabled?: boolean;
}

export const Combobox: React.FC<ComboboxProps> = ({
  items,
  value,
  onChange,
  onCreateNew,
  placeholder = 'Select account / ledger...',
  label,
  error,
  density = 'compact',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedItem = items.find((i) => i.id === value);

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.code && item.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[highlightedIndex]) {
        onChange(filteredItems[highlightedIndex]);
        setIsOpen(false);
        setSearchTerm('');
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.altKey && e.key.toLowerCase() === 'c' && onCreateNew) {
      e.preventDefault();
      onCreateNew();
    }
  };

  const heightClass = density === 'compact' ? 'h-7 text-xs' : 'h-9 text-sm';

  return (
    <div ref={containerRef} className="w-full flex flex-col gap-1 relative">
      {label && (
        <div className="flex items-center justify-between text-[11px] font-medium text-slate-300">
          <span>{label}</span>
          {onCreateNew && (
            <button
              type="button"
              onClick={onCreateNew}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>New (Alt+C)</span>
            </button>
          )}
        </div>
      )}

      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
        className={`w-full bg-slate-900 border rounded flex items-center justify-between px-2 cursor-pointer transition-colors ${
          error ? 'border-rose-500/80' : 'border-slate-700/80 hover:border-slate-600'
        } ${heightClass}`}
      >
        <span className={selectedItem ? 'text-slate-100 font-medium' : 'text-slate-500'}>
          {selectedItem ? selectedItem.name : placeholder}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1 shrink-0" />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded shadow-xl z-50 overflow-hidden flex flex-col max-h-60 animate-in fade-in-50 duration-100">
          <div className="p-1.5 border-b border-slate-800 bg-slate-950 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search by name, code, group..."
              className="w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 outline-none"
            />
          </div>

          <div className="overflow-y-auto divide-y divide-slate-800/40">
            {filteredItems.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500">
                No matching accounts found.
                {onCreateNew && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onCreateNew();
                    }}
                    className="mt-1 block mx-auto text-indigo-400 hover:underline"
                  >
                    Create new account (Alt+C)
                  </button>
                )}
              </div>
            ) : (
              filteredItems.map((item, index) => {
                const isSelected = item.id === value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      onChange(item);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`px-2.5 py-1.5 flex items-center justify-between text-xs cursor-pointer select-none transition-colors ${
                      isHighlighted ? 'bg-indigo-950/60 text-indigo-200' : 'text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-100">{item.name}</span>
                        {item.code && (
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1 py-0.2 rounded">
                            {item.code}
                          </span>
                        )}
                      </div>
                      {item.category && (
                        <span className="text-[10px] text-slate-400">{item.category}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {item.balance !== undefined && (
                        <span className="font-mono text-[11px] tabular-nums text-slate-300">
                          ₹{item.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {item.balanceType}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
      {error && <p className="text-[11px] text-rose-400">{error}</p>}
    </div>
  );
};
