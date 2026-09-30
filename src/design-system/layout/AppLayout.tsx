import React, { useState, useEffect } from 'react';
import { AppSidebar } from './AppSidebar';
import { TopNavigation } from './TopNavigation';
import { Company } from './CompanySwitcher';
import { BreadcrumbItem } from './Breadcrumbs';
import { NotificationItem } from './NotificationPanel';
import { CommandPalette, CommandItem } from '../core/CommandPalette';

export interface AppLayoutProps {
  children: React.ReactNode;
  activeModule: string;
  onSelectModule: (moduleId: string) => void;
  breadcrumbs: BreadcrumbItem[];
  densityMode: 'accountant' | 'business';
  onToggleDensityMode: (mode: 'accountant' | 'business') => void;
  commands: CommandItem[];
  userName?: string;
  userRole?: string;
  userEmail?: string;
  activeCompanyName?: string;
  activeCompanyGstin?: string;
  onLogout?: () => void;
  onOpenProfile?: () => void;
  onOpenCompanySwitcher?: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  activeModule,
  onSelectModule,
  breadcrumbs,
  densityMode,
  onToggleDensityMode,
  commands,
  userName = 'Rohit Varma, FCA',
  userRole = 'SUPER_ADMIN',
  userEmail = 'admin@apexerp.com',
  activeCompanyName = 'Apex Horizon Technologies Pvt Ltd',
  activeCompanyGstin = '27AABCA1234F1Z1',
  onLogout,
  onOpenProfile,
  onOpenCompanySwitcher,
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isOmniOpen, setIsOmniOpen] = useState(false);

  const companies: Company[] = [
    {
      id: 'comp-1',
      name: activeCompanyName,
      gstin: activeCompanyGstin,
      financialYear: 'FY 2026-27',
      state: 'Maharashtra',
    },
  ];
  const [activeCompanyId, setActiveCompanyId] = useState('comp-1');

  const [notifications] = useState<NotificationItem[]>([
    {
      id: 'n1',
      type: 'TAX',
      title: 'GSTR-1 Monthly Return due in 4 days (Sept 2026)',
      time: '10m ago',
      read: false,
    },
    {
      id: 'n2',
      type: 'ALERT',
      title: '2 Unreconciled HDFC Bank deposits pending match',
      time: '1h ago',
      read: false,
    },
    {
      id: 'n3',
      type: 'APPROVAL',
      title: 'PO #PO/2026/0491 awaiting CA approval (> ₹ 1,00,000)',
      time: '3h ago',
      read: true,
    },
  ]);

  // Global Keyboard Listener for Alt+G / Cmd+K and Voucher Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Omni Search (Alt+G or Cmd+K)
      if ((e.altKey && e.key.toLowerCase() === 'g') || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setIsOmniOpen((prev) => !prev);
        return;
      }

      // Hotkeys for Vouchers
      if (e.key === 'F7') {
        e.preventDefault();
        onSelectModule('vouchers');
      } else if (e.key === 'F8') {
        e.preventDefault();
        onSelectModule('sales');
      } else if (e.key === 'F9') {
        e.preventDefault();
        onSelectModule('purchases');
      } else if (e.key === 'F5') {
        e.preventDefault();
        onSelectModule('payments');
      } else if (e.key === 'F6') {
        e.preventDefault();
        onSelectModule('receipts');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectModule]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar */}
      <AppSidebar
        activeModule={activeModule}
        onSelectModule={onSelectModule}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        density={densityMode === 'accountant' ? 'compact' : 'comfortable'}
      />

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <TopNavigation
          companies={companies}
          activeCompanyId={activeCompanyId}
          onSelectCompany={(c) => {
            setActiveCompanyId(c.id);
            if (onOpenCompanySwitcher) onOpenCompanySwitcher();
          }}
          breadcrumbs={breadcrumbs}
          onOpenOmniSearch={() => setIsOmniOpen(true)}
          densityMode={densityMode}
          onToggleDensityMode={onToggleDensityMode}
          notifications={notifications}
          userName={userName}
          userRole={userRole}
          userEmail={userEmail}
          onLogout={onLogout}
          onSettings={onOpenProfile}
        />

        {/* Workspace Body */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-4 md:p-6">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Omni-Command Palette */}
      <CommandPalette
        isOpen={isOmniOpen}
        onClose={() => setIsOmniOpen(false)}
        commands={commands}
      />
    </div>
  );
};
