import React, { useState, useRef, useEffect } from 'react';
import { Bell, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';

export interface NotificationItem {
  id: string;
  type: 'ALERT' | 'TAX' | 'APPROVAL';
  title: string;
  time: string;
  read: boolean;
}

export interface NotificationPanelProps {
  notifications: NotificationItem[];
  onMarkAllAsRead?: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  onMarkAllAsRead,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

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
        className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors relative cursor-pointer"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-slate-900" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-80 bg-slate-900 border border-slate-700 rounded shadow-2xl z-50 overflow-hidden animate-in fade-in-50 duration-100">
          <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <span className="text-xs font-semibold text-slate-100">
              Statutory &amp; System Alerts
            </span>
            {unreadCount > 0 && onMarkAllAsRead && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="text-[10px] text-indigo-400 hover:underline cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No active notifications or alerts.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 text-xs hover:bg-slate-850/60 transition-colors flex items-start gap-2.5 ${
                    !n.read ? 'bg-indigo-950/20' : ''
                  }`}
                >
                  {n.type === 'ALERT' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  ) : n.type === 'TAX' ? (
                    <FileText className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="text-slate-200 font-medium leading-snug">{n.title}</p>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                      {n.time}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
