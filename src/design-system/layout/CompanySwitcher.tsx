import React, { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Check, Plus } from 'lucide-react';

export interface Company {
  id: string;
  name: string;
  gstin: string;
  financialYear: string;
  state: string;
}

export interface CompanySwitcherProps {
  companies: Company[];
  activeCompanyId: string;
  onSelectCompany: (company: Company) => void;
  onCreateNew?: () => void;
}

export const CompanySwitcher: React.FC<CompanySwitcherProps> = ({
  companies,
  activeCompanyId,
  onSelectCompany,
  onCreateNew,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeCompany = companies.find((c) => c.id === activeCompanyId) || companies[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded hover:bg-slate-800 transition-colors text-left cursor-pointer border border-slate-800 hover:border-slate-700 bg-slate-900/60"
      >
        <div className="w-6 h-6 rounded bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
          <Building2 className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-100 leading-tight truncate max-w-[150px]">
            {activeCompany?.name}
          </span>
          <span className="text-[10px] font-mono text-slate-400 leading-none">
            {activeCompany?.financialYear} · {activeCompany?.state}
          </span>
        </div>
        <ChevronDown className="w-3 h-3 text-slate-400 shrink-0 ml-1" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-slate-900 border border-slate-700 rounded shadow-2xl z-50 py-1 overflow-hidden animate-in fade-in-50 duration-100">
          <div className="px-3 py-1.5 text-[10px] uppercase font-semibold text-slate-400 tracking-wider border-b border-slate-800">
            Switch Operating Company
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/40">
            {companies.map((c) => {
              const isSelected = c.id === activeCompanyId;
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    onSelectCompany(c);
                    setIsOpen(false);
                  }}
                  className={`px-3 py-2 flex items-center justify-between cursor-pointer text-xs select-none transition-colors ${
                    isSelected ? 'bg-indigo-950/60 text-indigo-200' : 'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-100">{c.name}</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      GST: {c.gstin} · {c.financialYear}
                    </span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-indigo-400 shrink-0 ml-2" />}
                </div>
              );
            })}
          </div>

          {onCreateNew && (
            <div className="p-1 border-t border-slate-800 bg-slate-950/50">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onCreateNew();
                }}
                className="w-full px-2.5 py-1.5 text-xs text-indigo-400 hover:bg-slate-850 rounded flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Company</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
