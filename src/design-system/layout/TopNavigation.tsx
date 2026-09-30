import React from 'react';
import { Search, Sparkles, Sliders, Briefcase, Calculator } from 'lucide-react';
import { Company, CompanySwitcher } from './CompanySwitcher';
import { BreadcrumbItem, Breadcrumbs } from './Breadcrumbs';
import { NotificationItem, NotificationPanel } from './NotificationPanel';
import { UserProfileMenu } from './UserProfileMenu';

export interface TopNavigationProps {
  companies: Company[];
  activeCompanyId: string;
  onSelectCompany: (company: Company) => void;
  breadcrumbs: BreadcrumbItem[];
  onOpenOmniSearch: () => void;
  densityMode: 'accountant' | 'business';
  onToggleDensityMode: (mode: 'accountant' | 'business') => void;
  notifications: NotificationItem[];
  userName: string;
  userRole: string;
  userEmail: string;
  onLogout?: () => void;
  onSettings?: () => void;
}

export const TopNavigation: React.FC<TopNavigationProps> = ({
  companies,
  activeCompanyId,
  onSelectCompany,
  breadcrumbs,
  onOpenOmniSearch,
  densityMode,
  onToggleDensityMode,
  notifications,
  userName,
  userRole,
  userEmail,
  onLogout,
  onSettings,
}) => {
  return (
    <header className="h-12 bg-slate-950 border-b border-slate-800/80 px-4 flex items-center justify-between select-none shrink-0 z-20">
      {/* Left section: Company Switcher & Breadcrumbs */}
      <div className="flex items-center gap-4">
        <CompanySwitcher
          companies={companies}
          activeCompanyId={activeCompanyId}
          onSelectCompany={onSelectCompany}
        />
        <div className="hidden lg:block h-4 w-px bg-slate-800" />
        <div className="hidden lg:block">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      </div>

      {/* Center: Global Omni-Search Trigger (Alt+G / Cmd+K) */}
      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <button
          type="button"
          onClick={onOpenOmniSearch}
          className="w-full h-8 bg-slate-900 border border-slate-700/80 hover:border-slate-600 rounded px-3 flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400" />
            <span>Search vouchers, reports, accounts...</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
            <kbd className="px-1.5 py-0.5 bg-slate-850 border border-slate-700 rounded">Alt+G</kbd>
            <span>or</span>
            <kbd className="px-1.5 py-0.5 bg-slate-850 border border-slate-700 rounded">⌘K</kbd>
          </div>
        </button>
      </div>

      {/* Right section: Mode Switcher, Notifications, User */}
      <div className="flex items-center gap-3">
        {/* Accountant Mode vs Business Mode Toggle */}
        <div className="flex items-center p-0.5 bg-slate-900 border border-slate-800 rounded">
          <button
            type="button"
            onClick={() => onToggleDensityMode('business')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              densityMode === 'business'
                ? 'bg-slate-800 text-indigo-300 shadow-xs font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Business Mode: Visual dashboards, modern cards, and executive insights"
          >
            <Briefcase className="w-3 h-3" />
            <span className="hidden sm:inline">Business</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleDensityMode('accountant')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              densityMode === 'accountant'
                ? 'bg-slate-800 text-indigo-300 shadow-xs font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Accountant Mode: High-density ledger tables, fast keyboard entry, raw debits/credits"
          >
            <Calculator className="w-3 h-3" />
            <span className="hidden sm:inline">Accountant</span>
          </button>
        </div>

        <NotificationPanel notifications={notifications} />

        <div className="h-4 w-px bg-slate-800" />

        <UserProfileMenu
          userName={userName}
          userRole={userRole}
          userEmail={userEmail}
          onLogout={onLogout}
          onSettings={onSettings}
        />
      </div>
    </header>
  );
};
