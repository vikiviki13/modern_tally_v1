import React, { useState, useEffect, useRef } from 'react';
import { Search, ArrowRight, CornerDownLeft, Sparkles } from 'lucide-react';

export interface CommandItem {
  id: string;
  title: string;
  category: string;
  shortcut?: string;
  icon?: React.ReactNode;
  onSelect: () => void;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, commands }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(query.toLowerCase()) ||
      cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredCommands.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].onSelect();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  if (!isOpen) return null;

  // Group by category
  const categories = Array.from(new Set(filteredCommands.map((c) => c.category)));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-100">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
        {/* Search header */}
        <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-slate-800 bg-slate-950/60">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Go To: Type a report, voucher (F4-F9), or ledger..."
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none font-sans"
          />
          <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono text-slate-400">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="overflow-y-auto p-2 divide-y divide-slate-800/40">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No matching commands or ledgers found.
            </div>
          ) : (
            categories.map((cat) => {
              const catCommands = filteredCommands.filter((c) => c.category === cat);
              return (
                <div key={cat} className="py-1">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {cat}
                  </div>
                  {catCommands.map((cmd) => {
                    const globalIdx = filteredCommands.indexOf(cmd);
                    const isSelected = globalIdx === selectedIndex;

                    return (
                      <div
                        key={cmd.id}
                        onClick={() => {
                          cmd.onSelect();
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={`flex items-center justify-between px-2.5 py-2 rounded text-xs cursor-pointer select-none transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 text-white font-medium'
                            : 'text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {cmd.icon || <ArrowRight className="w-3.5 h-3.5 opacity-60" />}
                          <span>{cmd.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {cmd.shortcut && (
                            <kbd
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                isSelected
                                  ? 'bg-indigo-700 text-indigo-100'
                                  : 'bg-slate-800 border border-slate-700 text-slate-400'
                              }`}
                            >
                              {cmd.shortcut}
                            </kbd>
                          )}
                          {isSelected && <CornerDownLeft className="w-3 h-3 opacity-80" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-3.5 py-2 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              Navigate <kbd className="font-mono text-slate-400">↑↓</kbd>
            </span>
            <span>
              Select <kbd className="font-mono text-slate-400">↵</kbd>
            </span>
            <span>
              Close <kbd className="font-mono text-slate-400">Esc</kbd>
            </span>
          </div>
          <span className="flex items-center gap-1 text-slate-400">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>Alt+G Omni-Search</span>
          </span>
        </div>
      </div>
    </div>
  );
};
