import React, { useState } from 'react';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  shortcut?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  shortcut,
  position = 'top',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  }[position];

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          role="tooltip"
          className={`absolute ${positionClasses} z-50 pointer-events-none px-2 py-1 bg-slate-950 text-slate-200 border border-slate-700 rounded text-[11px] font-medium whitespace-nowrap shadow-lg flex items-center gap-1.5 animate-in fade-in-50 duration-75`}
        >
          <span>{content}</span>
          {shortcut && (
            <kbd className="px-1 py-0.2 bg-slate-800 border border-slate-600 rounded text-[10px] font-mono text-slate-300">
              {shortcut}
            </kbd>
          )}
        </div>
      )}
    </div>
  );
};
