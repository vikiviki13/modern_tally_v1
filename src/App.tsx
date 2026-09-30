import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthView } from './components/auth/AuthView';
import { FoundationWorkspace } from './components/dashboard/FoundationWorkspace';
import { CompanySwitcherModal } from './components/dashboard/CompanySwitcherModal';
import { UserProfileDrawer } from './components/dashboard/UserProfileDrawer';
import { CompanyOnboardingWizard } from './components/company/CompanyOnboardingWizard';
import { CompanySettingsView } from './components/company/CompanySettingsView';
import {
  AppLayout,
  Button,
  Input,
  CurrencyInput,
  DatePicker,
  Combobox,
  ComboboxItem,
  Tabs,
  Badge,
  Card,
  Modal,
  Drawer,
  Alert,
  ToastProvider,
  useToast,
  JournalEntryEditor,
  InvoiceBuilder,
  LedgerTable,
  PaymentForm,
  ReceiptForm,
  OutstandingTable,
  StockMovementTable,
  ReconciliationRow,
  AuditHistory,
  CommandItem,
} from './design-system';
import {
  Calculator,
  Receipt,
  FileSpreadsheet,
  Landmark,
  Clock,
  ShieldCheck,
  Plus,
  Sliders,
  Boxes,
  Layers,
  Sparkles,
  LogOut,
  Building2,
} from 'lucide-react';

function AuthenticatedApp() {
  const { user, tenant, logout } = useAuth();
  const [activeModule, setActiveModule] = useState('dashboard');
  const [densityMode, setDensityMode] = useState<'accountant' | 'business'>('accountant');
  const [isAltCModalOpen, setIsAltCModalOpen] = useState(false);
  const [isTokensDrawerOpen, setIsTokensDrawerOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const { showToast } = useToast();

  // Sample master ledgers for Comboboxes & accounting views
  const sampleLedgers: ComboboxItem[] = [
    { id: 'l1', name: 'HDFC Bank Ltd - Current A/c', code: 'BANK-01', category: 'Bank Accounts', balance: 1450000.5, balanceType: 'DR' },
    { id: 'l2', name: 'Petty Cash Account', code: 'CASH-01', category: 'Cash-in-Hand', balance: 42500, balanceType: 'DR' },
    { id: 'l3', name: 'Reliance Industries Ltd', code: 'CUST-041', category: 'Sundry Debtors', balance: 350000, balanceType: 'DR' },
    { id: 'l4', name: 'Tata Consultancy Services', code: 'CUST-089', category: 'Sundry Debtors', balance: 180000, balanceType: 'DR' },
    { id: 'l5', name: 'Dell India Pvt Ltd', code: 'VEND-012', category: 'Sundry Creditors', balance: 240000, balanceType: 'CR' },
    { id: 'l6', name: 'Domestic Sales (18% GST)', code: 'SALES-18', category: 'Direct Incomes' },
    { id: 'l7', name: 'IT Infrastructure Depreciation', code: 'EXP-DEP', category: 'Indirect Expenses' },
    { id: 'l8', name: 'Accumulated Depreciation - Servers', code: 'ASSET-DEP', category: 'Fixed Assets' },
    { id: 'l9', name: 'Office Rent & Maintenance', code: 'EXP-RENT', category: 'Indirect Expenses' },
    { id: 'l10', name: 'CGST Output Tax Ledger', code: 'TAX-CGST', category: 'Duties & Taxes' },
    { id: 'l11', name: 'SGST Output Tax Ledger', code: 'TAX-SGST', category: 'Duties & Taxes' },
  ];

  // Command Palette commands (Alt+G)
  const commands: CommandItem[] = [
    {
      id: 'cmd-foundation',
      title: 'Foundation & Security Dashboard',
      category: 'Overview',
      shortcut: 'Alt+0',
      onSelect: () => setActiveModule('dashboard'),
    },
    {
      id: 'cmd-company-settings',
      title: 'Company Management & Financial Config',
      category: 'Configuration',
      shortcut: 'Alt+9',
      onSelect: () => setActiveModule('company-settings'),
    },
    {
      id: 'cmd-new-company',
      title: 'Onboard New Company Tenant',
      category: 'Configuration',
      onSelect: () => setIsOnboardingOpen(true),
    },
    {
      id: 'cmd-journal',
      title: 'Create General Journal Voucher',
      category: 'Vouchers',
      shortcut: 'F7',
      onSelect: () => setActiveModule('vouchers'),
    },
    {
      id: 'cmd-sales',
      title: 'Create Sales Tax Invoice',
      category: 'Vouchers',
      shortcut: 'F8',
      onSelect: () => setActiveModule('sales'),
    },
    {
      id: 'cmd-payments',
      title: 'Record Payment Voucher',
      category: 'Vouchers',
      shortcut: 'F5',
      onSelect: () => setActiveModule('payments'),
    },
    {
      id: 'cmd-receipts',
      title: 'Record Receipt Voucher',
      category: 'Vouchers',
      shortcut: 'F6',
      onSelect: () => setActiveModule('receipts'),
    },
    {
      id: 'cmd-switch-company',
      title: 'Switch Tenant Organization',
      category: 'Multi-Tenant',
      onSelect: () => setIsCompanyModalOpen(true),
    },
    {
      id: 'cmd-profile',
      title: 'Inspect User Profile & RBAC Role',
      category: 'Security',
      onSelect: () => setIsProfileDrawerOpen(true),
    },
  ];

  const breadcrumbs = [
    { label: tenant?.name || 'LedgerPulse ERP' },
    {
      label:
        activeModule === 'dashboard'
          ? 'Foundation & Auth Workspace'
          : activeModule === 'company-settings'
          ? 'Company & Financial Configuration'
          : activeModule === 'vouchers'
          ? 'Journal Entry (F7)'
          : activeModule === 'sales'
          ? 'Sales Invoicing (F8)'
          : activeModule === 'ledgers'
          ? 'General Ledger'
          : activeModule === 'payments'
          ? 'Payments (F5)'
          : activeModule === 'receipts'
          ? 'Receipts (F6)'
          : activeModule === 'aging'
          ? 'Outstanding Receivables'
          : activeModule === 'inventory'
          ? 'Stock Movements'
          : activeModule === 'banking'
          ? 'Bank Reconciliation (BRS)'
          : activeModule === 'audit-trail'
          ? 'MCA Audit Trail'
          : 'Component Design System',
    },
  ];

  return (
    <AppLayout
      activeModule={activeModule}
      onSelectModule={setActiveModule}
      breadcrumbs={breadcrumbs}
      densityMode={densityMode}
      onToggleDensityMode={setDensityMode}
      commands={commands}
      userName={user?.fullName}
      userRole={user?.role}
      userEmail={user?.email}
      activeCompanyName={tenant?.name}
      activeCompanyGstin={tenant?.gstin}
      onLogout={logout}
      onOpenProfile={() => setIsProfileDrawerOpen(true)}
      onOpenCompanySwitcher={() => setIsCompanyModalOpen(true)}
    >
      {/* Design System & Navigation Ribbon */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded p-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          <Tabs
            tabs={[
              { id: 'dashboard', label: 'Foundation & Auth', icon: <Layers className="w-3.5 h-3.5 text-indigo-400" /> },
              { id: 'company-settings', label: 'Company Config', icon: <Building2 className="w-3.5 h-3.5 text-indigo-400" /> },
              { id: 'vouchers', label: 'Journal (F7)', icon: <Calculator className="w-3.5 h-3.5" /> },
              { id: 'sales', label: 'Sales (F8)', icon: <Receipt className="w-3.5 h-3.5" /> },
              { id: 'payments', label: 'Payment (F5)', icon: <Landmark className="w-3.5 h-3.5" /> },
              { id: 'receipts', label: 'Receipt (F6)', icon: <Receipt className="w-3.5 h-3.5" /> },
              { id: 'ledgers', label: 'Ledger Card', icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
              { id: 'aging', label: 'AR Aging', icon: <Clock className="w-3.5 h-3.5" /> },
              { id: 'inventory', label: 'Stock Register', icon: <Boxes className="w-3.5 h-3.5" /> },
              { id: 'banking', label: 'BRS Recon', icon: <Landmark className="w-3.5 h-3.5" /> },
              { id: 'audit-trail', label: 'MCA Audit', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
              { id: 'core-ui', label: 'Core UI Kit', icon: <Sliders className="w-3.5 h-3.5" /> },
            ]}
            activeTab={activeModule}
            onChange={setActiveModule}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            onClick={() => setIsCompanyModalOpen(true)}
            leftIcon={<Building2 className="w-3 h-3 text-indigo-400" />}
          >
            Switch Company
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => setIsOnboardingOpen(true)}
            leftIcon={<Plus className="w-3 h-3 text-indigo-400" />}
          >
            + Onboard Company
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => setIsAltCModalOpen(true)}
            leftIcon={<Plus className="w-3 h-3" />}
            shortcut="Alt+C"
          >
            Create Master
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setIsTokensDrawerOpen(true)}
          >
            Inspect Tokens
          </Button>
        </div>
      </div>

      {/* Density & Environment Status Alert */}
      <div className="mb-4">
        {densityMode === 'accountant' ? (
          <Alert variant="info">
            <span className="font-semibold text-slate-100">Accountant Mode Active:</span> High-density 40+ row tables, compact form controls, keyboard navigation (F2-F9, Alt+G, Alt+C, Enter), and Luca Pacioli double-entry balance checks.
          </Alert>
        ) : (
          <Alert variant="success">
            <span className="font-semibold text-slate-100">Business Mode Active:</span> Spacious visual cards, executive margin analytics, and streamlined single-action views.
          </Alert>
        )}
      </div>

      {/* MODULE VIEW 0: Company Management & Financial Configuration */}
      {activeModule === 'company-settings' && (
        <CompanySettingsView onOpenOnboarding={() => setIsOnboardingOpen(true)} />
      )}

      {/* MODULE VIEW 1: Foundation & Authentication Workspace */}
      {activeModule === 'dashboard' && (
        <FoundationWorkspace
          onOpenCompanySwitcher={() => setIsCompanyModalOpen(true)}
          onOpenProfileDrawer={() => setIsProfileDrawerOpen(true)}
          onNavigateToCompanySettings={() => setActiveModule('company-settings')}
        />
      )}

      {/* MODULE VIEW 2: Journal Entry (F7) */}
      {activeModule === 'vouchers' && (
        <JournalEntryEditor
          availableLedgers={sampleLedgers}
          onPost={(entry) => {
            showToast({
              type: 'success',
              title: 'Journal Voucher Posted Successfully',
              message: `Voucher #${entry.voucherNumber} posted to General Ledger with zero discrepancy.`,
            });
          }}
          onOpenCreateLedger={() => setIsAltCModalOpen(true)}
        />
      )}

      {/* MODULE VIEW 3: Sales Invoicing (F8) */}
      {activeModule === 'sales' && (
        <InvoiceBuilder
          customers={sampleLedgers.filter((l) => l.category === 'Sundry Debtors')}
          products={sampleLedgers}
          onSave={() => {
            showToast({
              type: 'success',
              title: 'Sales Tax Invoice Generated',
              message: 'Posted to Accounts Receivable and Sales Ledger with Place of Supply CGST+SGST split.',
            });
          }}
          onOpenCreateParty={() => setIsAltCModalOpen(true)}
        />
      )}

      {/* MODULE VIEW 4: General Ledger Table */}
      {activeModule === 'ledgers' && (
        <LedgerTable
          ledgerName="Reliance Industries Ltd"
          groupName="Sundry Debtors"
          openingBalance={350000}
          openingBalanceType="DR"
          density={densityMode === 'accountant' ? 'compact' : 'comfortable'}
          transactions={[
            {
              id: 't1',
              date: '2026-09-02',
              voucherType: 'SALES',
              voucherNumber: 'INV/2026/0401',
              particulars: 'Being sales invoice raised towards server hardware',
              debit: 150000,
              credit: 0,
              runningBalance: 500000,
              balanceType: 'DR',
            },
            {
              id: 't2',
              date: '2026-09-10',
              voucherType: 'RECEIPT',
              voucherNumber: 'REC/2026/0112',
              particulars: 'Amount received via NEFT against Inv #401',
              debit: 0,
              credit: 150000,
              runningBalance: 350000,
              balanceType: 'DR',
            },
            {
              id: 't3',
              date: '2026-09-20',
              voucherType: 'SALES',
              voucherNumber: 'INV/2026/0448',
              particulars: 'Cloud enterprise annual license renewal',
              debit: 85000,
              credit: 0,
              runningBalance: 435000,
              balanceType: 'DR',
            },
            {
              id: 't4',
              date: '2026-09-25',
              voucherType: 'CREDIT_NOTE',
              voucherNumber: 'CN/2026/0014',
              particulars: 'Volume rebate discount credit note approved',
              debit: 0,
              credit: 15000,
              runningBalance: 420000,
              balanceType: 'DR',
            },
          ]}
          onSelectVoucher={(id) => {
            showToast({
              type: 'info',
              title: 'Voucher Drilldown Triggered',
              message: `Opened source transaction record ${id}.`,
            });
          }}
        />
      )}

      {/* MODULE VIEW 5: Payments (F5) */}
      {activeModule === 'payments' && (
        <PaymentForm
          partyLedgers={sampleLedgers.filter((l) => l.category === 'Sundry Creditors')}
          bankLedgers={sampleLedgers.filter((l) => l.category === 'Bank Accounts' || l.category === 'Cash-in-Hand')}
          onPostPayment={() => {
            showToast({
              type: 'success',
              title: 'Payment Voucher Posted (F5)',
              message: 'Outward remittance recorded and settled against vendor bills.',
            });
          }}
        />
      )}

      {/* MODULE VIEW 6: Receipts (F6) */}
      {activeModule === 'receipts' && (
        <ReceiptForm
          customerLedgers={sampleLedgers.filter((l) => l.category === 'Sundry Debtors')}
          bankLedgers={sampleLedgers.filter((l) => l.category === 'Bank Accounts' || l.category === 'Cash-in-Hand')}
          onPostReceipt={() => {
            showToast({
              type: 'success',
              title: 'Receipt Voucher Posted (F6)',
              message: 'Inward collection credited to customer account.',
            });
          }}
        />
      )}

      {/* MODULE VIEW 7: Aging Analysis */}
      {activeModule === 'aging' && (
        <OutstandingTable
          type="RECEIVABLES"
          density={densityMode === 'accountant' ? 'compact' : 'comfortable'}
          records={[
            {
              id: 'r1',
              partyName: 'Reliance Industries Ltd',
              phone: '+91 98200 12345',
              totalPending: 420000,
              bucket0to30: 85000,
              bucket31to60: 200000,
              bucket61to90: 100000,
              bucket90Plus: 35000,
            },
            {
              id: 'r2',
              partyName: 'Tata Consultancy Services',
              phone: '+91 98201 54321',
              totalPending: 180000,
              bucket0to30: 180000,
              bucket31to60: 0,
              bucket61to90: 0,
              bucket90Plus: 0,
            },
            {
              id: 'r3',
              partyName: 'Bharat Forge Precision Ltd',
              phone: '+91 98400 99887',
              totalPending: 310000,
              bucket0to30: 60000,
              bucket31to60: 110000,
              bucket61to90: 80000,
              bucket90Plus: 60000,
            },
          ]}
          onRecordAction={(id) => {
            setActiveModule('receipts');
            showToast({
              type: 'info',
              title: 'Receipt Allocation Triggered',
              message: `Opened receipt voucher allocation for customer ${id}.`,
            });
          }}
        />
      )}

      {/* MODULE VIEW 8: Inventory Stock Movement */}
      {activeModule === 'inventory' && (
        <StockMovementTable
          productName="Server Blade Unit X9 - High Performance"
          sku="SRV-X9-2026"
          uom="NOS"
          hsn="8471"
          density={densityMode === 'accountant' ? 'compact' : 'comfortable'}
          movements={[
            {
              id: 'm1',
              date: '2026-09-01',
              movementType: 'PURCHASE_RECEIPT',
              voucherNumber: 'PB/2026/0011',
              warehouseName: 'Main Warehouse - Mumbai Godown',
              inwardQty: 50,
              inwardRate: 35000,
              outwardQty: 0,
              outwardRate: 0,
              closingQty: 50,
              valuationRate: 35000,
              closingValue: 1750000,
            },
            {
              id: 'm2',
              date: '2026-09-08',
              movementType: 'SALES_DELIVERY',
              voucherNumber: 'INV/2026/0401',
              warehouseName: 'Main Warehouse - Mumbai Godown',
              inwardQty: 0,
              inwardRate: 0,
              outwardQty: 10,
              outwardRate: 45000,
              closingQty: 40,
              valuationRate: 35000,
              closingValue: 1400000,
            },
          ]}
        />
      )}

      {/* MODULE VIEW 9: Bank Reconciliation (BRS) */}
      {activeModule === 'banking' && (
        <div className="space-y-3">
          <div className="bg-slate-900 border border-slate-800 rounded p-3 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-slate-100">
                Bank Reconciliation Statement: HDFC Bank Current A/c (5020001289102)
              </h3>
              <p className="text-[11px] text-slate-400">
                Book Balance: ₹14,50,000.50 | Passbook Statement Balance: ₹14,95,000.50 | Unreconciled: ₹45,000.00
              </p>
            </div>
            <Button variant="primary" size="xs">
              Upload MT940 / CSV Statement
            </Button>
          </div>

          <ReconciliationRow
            bankTx={{
              id: 'btx-1',
              transactionDate: '2026-09-28',
              valueDate: '2026-09-28',
              description: 'UPI/2691823101/RELIANCE IND/HDFC',
              reference: 'UPI2691823',
              amount: 150000,
              direction: 'CR',
            }}
            matchedEntry={{
              voucherId: 'v-101',
              voucherNumber: 'REC/2026/0112',
              voucherDate: '2026-09-27',
              partyName: 'Reliance Industries Ltd',
              amount: 150000,
              direction: 'CR',
            }}
            isReconciled={true}
            clearedDate="2026-09-28"
            onReconcile={() => {}}
          />
        </div>
      )}

      {/* MODULE VIEW 10: MCA Audit Trail Log */}
      {activeModule === 'audit-trail' && (
        <AuditHistory
          voucherNumber="INV/2026/0401"
          logs={[
            {
              id: 'a1',
              action: 'INSERT',
              timestamp: '2026-09-02T10:14:22.182Z',
              userName: user?.fullName || 'Rohit Varma, FCA',
              userRole: user?.role || 'Auditor & Partner',
              ipAddress: '103.21.58.42',
              summary: 'Initial voucher creation and ledger posting',
            },
          ]}
        />
      )}

      {/* MODULE VIEW 11: Core UI Kit */}
      {activeModule === 'core-ui' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card title="Buttons & Actions" subtitle="With keyboard shortcut hints and states">
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" shortcut="Ctrl+S">Save Record</Button>
              <Button variant="secondary" shortcut="Alt+N">New Voucher</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="danger">Void (Alt+D)</Button>
              <Button variant="success">Approve</Button>
              <Button variant="ghost">Dismiss</Button>
            </div>
          </Card>

          <Card title="Badges & Luca Pacioli Statuses" subtitle="Disciplined rectangular micro-badges">
            <div className="flex flex-wrap gap-2">
              <Badge variant="credit" dot>CREDIT (INFLOW)</Badge>
              <Badge variant="debit" dot>DEBIT (OUTFLOW)</Badge>
              <Badge variant="warning" dot>UNRECONCILED</Badge>
              <Badge variant="info">DRAFT VOUCHER</Badge>
              <Badge variant="primary">POSTED (GL)</Badge>
            </div>
          </Card>
        </div>
      )}

      {/* Modals & Drawers */}
      <CompanySwitcherModal
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
      />

      <CompanyOnboardingWizard
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onCompanyCreated={() => {
          showToast({
            type: 'success',
            title: 'Company Created & Initialized',
            message: 'Switched to newly onboarded company tenant.',
          });
        }}
      />

      <UserProfileDrawer
        isOpen={isProfileDrawerOpen}
        onClose={() => setIsProfileDrawerOpen(false)}
      />

      <Modal
        isOpen={isAltCModalOpen}
        onClose={() => setIsAltCModalOpen(false)}
        title="Quick Ledger Master Creation (Alt+C)"
        subtitle="Create customer, vendor, or expense ledger on-the-fly without leaving current transaction"
        footer={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsAltCModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setIsAltCModalOpen(false);
                showToast({
                  type: 'success',
                  title: 'Ledger Created',
                  message: 'New master account saved and selected in active voucher.',
                });
              }}
              shortcut="Ctrl+Enter"
            >
              Save Master
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input label="Ledger Name" placeholder="e.g. Infosys Technologies Ltd" required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Account Code / Alias" placeholder="e.g. CUST-INFY" />
            <div>
              <label className="text-[11px] font-medium text-slate-300 block mb-1">
                Parent Account Group
              </label>
              <select className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-2 text-xs font-mono text-slate-100 outline-none">
                <option>Sundry Debtors (Customers)</option>
                <option>Sundry Creditors (Vendors)</option>
                <option>Bank Accounts</option>
                <option>Direct Expenses</option>
                <option>Indirect Expenses</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="GSTIN (15 characters)" placeholder="27AAACI1234F1Z1" />
            <CurrencyInput label="Opening Balance" value={0} onChange={() => {}} direction="DR" />
          </div>
        </div>
      </Modal>

      <Drawer
        isOpen={isTokensDrawerOpen}
        onClose={() => setIsTokensDrawerOpen(false)}
        title="Design System Architecture & Tokens"
        subtitle="System specifications and ergonomic rules"
      >
        <div className="space-y-4 text-xs">
          <div>
            <h4 className="font-semibold text-slate-200 mb-1">Font Pairings</h4>
            <p className="text-slate-400">
              <strong className="text-slate-200">Body &amp; Display:</strong> Plus Jakarta Sans<br />
              <strong className="text-slate-200">Financial Figures &amp; Tables:</strong> JetBrains Mono (with tabular-nums)
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-slate-200 mb-1">Accounting Density Standards</h4>
            <p className="text-slate-400">
              Dense mode enforces a 28px row height with 11px uppercase headers and 13px tabular numeric values, delivering 35–45 visible ledger transactions per viewport without scroll lag.
            </p>
          </div>
        </div>
      </Drawer>
    </AppLayout>
  );
}

function AppRouter() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-mono tracking-wide text-slate-300">
          Initializing LedgerPulse Security &amp; Auth Engine...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthView />;
  }

  return <AuthenticatedApp />;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ToastProvider>
  );
}
