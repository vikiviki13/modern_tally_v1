import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, Settings, Shield, ChevronDown } from 'lucide-react';

export interface UserProfileMenuProps {
  userName: string;
  userRole: string;
  userEmail: string;
  onLogout?: () => void;
  onSettings?: () => void;
}

export const UserProfileMenu: React.FC<UserProfileMenuProps> = ({
  userName,
  userRole,
  userEmail,
  onLogout,
  onSettings,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
        className="flex items-center gap-2 p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer select-none"
      >
        <div className="w-7 h-7 rounded bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-xs font-semibold text-indigo-300">
          {userName.charAt(0)}
        </div>
        <div className="hidden md:flex flex-col text-left">
          <span className="text-xs font-medium text-slate-200 leading-tight">{userName}</span>
          <span className="text-[10px] text-slate-400 font-mono leading-none">{userRole}</span>
        </div>
        <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-56 bg-slate-900 border border-slate-700 rounded shadow-2xl z-50 py-1 overflow-hidden animate-in fade-in-50 duration-100">
          <div className="px-3 py-2 border-b border-slate-800 bg-slate-950/50">
            <p className="text-xs font-semibold text-slate-100">{userName}</p>
            <p className="text-[11px] text-slate-400 truncate">{userEmail}</p>
            <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-indigo-400 font-mono">
              <Shield className="w-3 h-3" />
              <span>Role: {userRole}</span>
            </div>
          </div>

          <div className="py-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onSettings?.();
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2 text-slate-300 hover:bg-slate-800 hover:text-white text-left cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              <span>Accounting Preferences</span>
            </button>
            <div className="my-1 border-t border-slate-800" />
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onLogout?.();
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2 text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 text-left cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
