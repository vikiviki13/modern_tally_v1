import React from 'react';
import {
  BookOpen,
  FileSpreadsheet,
  Receipt,
  ShoppingCart,
  Landmark,
  Boxes,
  FileCheck2,
  PieChart,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Building2,
} from 'lucide-react';

export interface NavSection {
  title: string;
  items: {
    id: string;
    label: string;
    icon: React.ReactNode;
    shortcut?: string;
    badge?: string;
  }[];
}

export interface AppSidebarProps {
  activeModule: string;
  onSelectModule: (id: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  density?: 'compact' | 'comfortable';
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeModule,
  onSelectModule,
  isCollapsed,
  onToggleCollapse,
  density = 'compact',
}) => {
  const sections: NavSection[] = [
    {
      title: 'Accounting Core',
      items: [
        { id: 'dashboard', label: 'Overview', icon: <TrendingUp className="w-4 h-4" /> },
        { id: 'vouchers', label: 'Journal Entry', icon: <BookOpen className="w-4 h-4" />, shortcut: 'F7' },
        { id: 'ledgers', label: 'General Ledger', icon: <FileSpreadsheet className="w-4 h-4" /> },
        { id: 'chart-of-accounts', label: 'Chart of Accounts', icon: <PieChart className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Commercial Operations',
      items: [
        { id: 'sales', label: 'Sales Invoices', icon: <Receipt className="w-4 h-4" />, shortcut: 'F8' },
        { id: 'purchases', label: 'Purchase Bills', icon: <ShoppingCart className="w-4 h-4" />, shortcut: 'F9' },
        { id: 'payments', label: 'Payments', icon: <Landmark className="w-4 h-4" />, shortcut: 'F5' },
        { id: 'receipts', label: 'Receipts', icon: <Receipt className="w-4 h-4" />, shortcut: 'F6' },
      ],
    },
    {
      title: 'Supply Chain & Banking',
      items: [
        { id: 'inventory', label: 'Stock & Godowns', icon: <Boxes className="w-4 h-4" /> },
        { id: 'banking', label: 'Bank BRS Recon', icon: <Landmark className="w-4 h-4" />, badge: '2 Pending' },
      ],
    },
    {
      title: 'Statutory & Governance',
      items: [
        { id: 'company-settings', label: 'Company Config', icon: <Building2 className="w-4 h-4" /> },
        { id: 'gst-returns', label: 'GST Compliance', icon: <FileCheck2 className="w-4 h-4" />, badge: 'GSTR-1' },
        { id: 'audit-trail', label: 'MCA Audit Trail', icon: <ShieldCheck className="w-4 h-4" /> },
      ],
    },
  ];

  return (
    <aside
      className={`bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between transition-all duration-200 select-none z-30 ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Top brand */}
      <div className="flex flex-col">
        <div className="h-12 border-b border-slate-800/80 flex items-center justify-between px-3">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-white font-bold text-xs tracking-tighter">
                LP
              </div>
              <span className="font-bold text-xs tracking-wider uppercase text-slate-100 font-mono">
                Ledger<span className="text-indigo-400">Pulse</span>
              </span>
            </div>
          )}
          {isCollapsed && (
            <div className="w-7 h-7 mx-auto rounded bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
              LP
            </div>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800 cursor-pointer hidden md:block"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation list */}
        <div className="overflow-y-auto py-3 px-2 space-y-4">
          {sections.map((section) => (
            <div key={section.title} className="space-y-0.5">
              {!isCollapsed && (
                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const isActive = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectModule(item.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer group ${
                      isActive
                        ? 'bg-indigo-600/90 text-white font-medium shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-850/60'
                    }`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}>
                        {item.icon}
                      </span>
                      {!isCollapsed && <span>{item.label}</span>}
                    </div>

                    {!isCollapsed && (
                      <div className="flex items-center gap-1.5">
                        {item.badge && (
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                            {item.badge}
                          </span>
                        )}
                        {item.shortcut && (
                          <kbd
                            className={`text-[10px] font-mono px-1 py-0.2 rounded ${
                              isActive
                                ? 'bg-indigo-700 text-indigo-100'
                                : 'bg-slate-850 border border-slate-700 text-slate-400'
                            }`}
                          >
                            {item.shortcut}
                          </kbd>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer shortcut helper */}
      {!isCollapsed && (
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/80">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Go To Omni-Bar</span>
            </span>
            <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono text-slate-300">
              Alt+G
            </kbd>
          </div>
        </div>
      )}
    </aside>
  );
};
