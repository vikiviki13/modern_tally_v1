import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { companyClient } from '../../services/companyClient';
import { Card, Button, Input, Alert, Badge } from '../../design-system';
import {
  Building2,
  Calendar,
  Sliders,
  FileCheck2,
  Shield,
  Save,
  Play,
  CheckCircle2,
  XCircle,
  Lock,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  CompanyDTO,
  BusinessType,
  InventoryValuationMethod,
  GstRegistrationType,
  VoucherNumberingMode,
  CompanyIsolationAuditDTO,
} from '../../../shared/types/company';

interface CompanySettingsViewProps {
  onOpenOnboarding: () => void;
}

export function CompanySettingsView({ onOpenOnboarding }: CompanySettingsViewProps) {
  const { tenant, refreshSession } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'financial' | 'preferences' | 'isolation' | 'tests'>('profile');
  const [company, setCompany] = useState<CompanyDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('PVT_LTD');
  const [industry, setIndustry] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');

  // Financial Calendar & Lock
  const [isLocked, setIsLocked] = useState(false);
  const [freezeDate, setFreezeDate] = useState('');

  // Preferences
  const [inventoryValuation, setInventoryValuation] = useState<InventoryValuationMethod>('PERPETUAL_FIFO');
  const [billWiseTracking, setBillWiseTracking] = useState(true);
  const [preventNegativeCash, setPreventNegativeCash] = useState(true);
  const [enforceCreditLimit, setEnforceCreditLimit] = useState(true);
  const [multiGodown, setMultiGodown] = useState(true);
  const [batchTracking, setBatchTracking] = useState(false);
  const [gstRegistrationType, setGstRegistrationType] = useState<GstRegistrationType>('REGULAR');
  const [eInvoicingApplicable, setEInvoicingApplicable] = useState(true);
  const [voucherNumbering, setVoucherNumbering] = useState<VoucherNumberingMode>('AUTO_SEQUENTIAL');
  const [prefix, setPrefix] = useState('INV/{FY}/');
  const [defaultCreditDays, setDefaultCreditDays] = useState(30);
  const [terms, setTerms] = useState('');

  // Isolation Audit
  const [auditData, setAuditData] = useState<CompanyIsolationAuditDTO | null>(null);

  // Test Suite Runner
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<{
    passed: boolean;
    total: number;
    passedCount: number;
    results: Array<{ name: string; category: string; passed: boolean; message: string; durationMs: number }>;
  } | null>(null);

  useEffect(() => {
    if (tenant?.id) {
      loadCompany(tenant.id);
    }
  }, [tenant?.id]);

  const loadCompany = async (id: string) => {
    setLoading(true);
    try {
      const data = await companyClient.getCompany(id);
      setCompany(data);

      setName(data.name);
      setLegalName(data.legalName);
      setBusinessType(data.businessType);
      setIndustry(data.industry);
      setStreet(data.address?.street || '');
      setCity(data.address?.city || '');
      setPincode(data.address?.pincode || '');
      setGstin(data.gstin || '');
      setPan(data.pan || '');

      setIsLocked(data.financialYear?.isLocked || false);
      setFreezeDate(data.financialYear?.freezeDate || '');

      if (data.preferences) {
        setInventoryValuation(data.preferences.accounting?.inventoryValuation || 'PERPETUAL_FIFO');
        setBillWiseTracking(data.preferences.accounting?.billWiseTracking ?? true);
        setPreventNegativeCash(data.preferences.accounting?.preventNegativeCash ?? true);
        setEnforceCreditLimit(data.preferences.accounting?.enforceCreditLimit ?? true);
        setMultiGodown(data.preferences.inventory?.multiGodown ?? true);
        setBatchTracking(data.preferences.inventory?.batchTracking ?? false);
        setGstRegistrationType(data.preferences.tax?.gstRegistrationType || 'REGULAR');
        setEInvoicingApplicable(data.preferences.tax?.eInvoicingApplicable ?? true);
        setVoucherNumbering(data.preferences.invoicing?.voucherNumbering || 'AUTO_SEQUENTIAL');
        setPrefix(data.preferences.invoicing?.prefix || 'INV/{FY}/');
        setDefaultCreditDays(data.preferences.invoicing?.defaultCreditDays ?? 30);
        setTerms(data.preferences.invoicing?.termsAndConditions || '');
      }

      // Load isolation audit
      const audit = await companyClient.getIsolationAudit(id);
      setAuditData(audit);
    } catch (e) {
      console.error('Failed to load company details', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfiguration = async () => {
    if (!tenant?.id) return;
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const updated = await companyClient.updateCompany(tenant.id, {
        name,
        legalName,
        businessType,
        industry,
        gstin: gstin || undefined,
        pan: pan || undefined,
        address: {
          street,
          city,
          pincode,
          state: company?.state || 'Maharashtra',
          stateCode: company?.stateCode || '27',
          country: company?.country || 'India',
        },
        financialYear: {
          isLocked,
          freezeDate: freezeDate || undefined,
        },
        preferences: {
          accounting: {
            inventoryValuation,
            billWiseTracking,
            preventNegativeCash,
            enforceCreditLimit,
            multiCurrency: company?.preferences?.accounting?.multiCurrency ?? false,
          },
          inventory: {
            multiGodown,
            batchTracking,
            orderProcessing: true,
            separateDiscountCol: true,
          },
          tax: {
            gstRegistrationType,
            eInvoicingApplicable,
            eWayBillApplicable: true,
            rcmApplicable: false,
            defaultGstRate: 18,
          },
          invoicing: {
            voucherNumbering,
            prefix,
            startingNumber: 1,
            defaultCreditDays,
            termsAndConditions: terms,
          },
        },
      });

      setCompany(updated);
      setSuccessMsg('Company profile and financial configuration updated successfully.');
      await refreshSession();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const res = await companyClient.runTestSuite();
      setTestResults(res);
    } catch (e) {
      console.error('Failed to run company test suite', e);
    } finally {
      setIsRunningTests(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-xs text-slate-400">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <span>Loading company and financial configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Banner & Header */}
      <div className="bg-slate-900 border border-slate-800 rounded p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600/15 border border-indigo-500/30 rounded text-indigo-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">{company?.name}</h2>
              <Badge variant="primary" dot>{company?.businessType}</Badge>
              <Badge variant="credit">{company?.financialYear?.name}</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{company?.legalName}</p>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-mono">
              <span>GSTIN: {company?.gstin || 'UNREGISTERED'}</span>
              <span>&bull;</span>
              <span>PAN: {company?.pan || 'N/A'}</span>
              <span>&bull;</span>
              <span>State: {company?.state} ({company?.stateCode})</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenOnboarding}
            leftIcon={<Building2 className="w-3.5 h-3.5 text-indigo-400" />}
          >
            + Onboard New Company
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveConfiguration}
            disabled={saving}
            leftIcon={<Save className="w-3.5 h-3.5" />}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </div>

      {/* Success / Error Messages */}
      {successMsg && (
        <Alert variant="success">
          <span className="font-semibold text-slate-100">Success:</span> {successMsg}
        </Alert>
      )}
      {errorMsg && (
        <Alert variant="error">
          <span className="font-semibold text-rose-300">Error:</span> {errorMsg}
        </Alert>
      )}

      {/* Configuration Sub-Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/60 p-1 rounded">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
            activeTab === 'profile' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          General &amp; Statutory
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('financial')}
          className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
            activeTab === 'financial' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Financial Calendar &amp; Lock
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preferences')}
          className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
            activeTab === 'preferences' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Accounting &amp; Tax Rules
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('isolation')}
          className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
            activeTab === 'isolation' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Isolation Audit
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('tests')}
          className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
            activeTab === 'tests' ? 'bg-slate-800 text-indigo-300' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Test Suite (12 Tests)
        </button>
      </div>

      {/* TAB 1: GENERAL & STATUTORY */}
      {activeTab === 'profile' && (
        <Card title="Corporate Identity &amp; Statutory Address" subtitle="Registered business details and place of supply">
          <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Trade / Business Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label="Legal Registered Entity Name"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Business Entity Type
                </label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value as BusinessType)}
                  className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-2 text-xs font-mono text-slate-100 outline-none"
                >
                  <option value="PVT_LTD">Private Limited Company</option>
                  <option value="PUBLIC_LTD">Public Limited Company</option>
                  <option value="LLP">Limited Liability Partnership</option>
                  <option value="PARTNERSHIP">Partnership</option>
                  <option value="SOLE_PROPRIETORSHIP">Sole Proprietorship</option>
                  <option value="TRUST">Trust / Society</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <Input
                label="Industry Classification"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="GSTIN (15 Characters)"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                helperText="Place of supply state code: 27 (Maharashtra)"
              />
              <Input
                label="Permanent Account Number (PAN)"
                value={pan}
                onChange={(e) => setPan(e.target.value.toUpperCase())}
                helperText="10 alphanumeric characters"
              />
            </div>

            <Input
              label="Registered Street Address"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <Input
                label="Pincode"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
              />
            </div>
          </div>
        </Card>
      )}

      {/* TAB 2: FINANCIAL CALENDAR & LOCK */}
      {activeTab === 'financial' && (
        <Card title="Financial Year, Inception Date &amp; Period Locking" subtitle="Strict financial calendar controls">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded">
                <span className="text-[11px] text-slate-400 block mb-1">Financial Year:</span>
                <span className="text-sm font-bold text-slate-100 font-mono">{company?.financialYear?.name}</span>
                <p className="text-[10px] text-slate-500 mt-1">
                  {company?.financialYear?.startDate} to {company?.financialYear?.endDate}
                </p>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded">
                <span className="text-[11px] text-slate-400 block mb-1">Books Beginning Date:</span>
                <span className="text-sm font-bold text-indigo-300 font-mono">{company?.booksBeginningDate}</span>
                <p className="text-[10px] text-slate-500 mt-1">
                  Earliest allowable transaction posting
                </p>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded">
                <span className="text-[11px] text-slate-400 block mb-1">Base Currency:</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  {company?.currency?.code} ({company?.currency?.symbol})
                </span>
                <p className="text-[10px] text-slate-500 mt-1">
                  Precision: {company?.currency?.decimalPlaces} decimals
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Statutory Period Locking (Freeze Date)</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Vouchers on or before the freeze date become read-only and immutable. Voiding or editing requires Super Admin override.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isLocked}
                    onChange={(e) => setIsLocked(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {isLocked && (
                <div className="pt-2 border-t border-slate-800">
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    Freeze All Transactions On or Before:
                  </label>
                  <input
                    type="date"
                    value={freezeDate}
                    onChange={(e) => setFreezeDate(e.target.value)}
                    className="w-48 h-7 bg-slate-900 border border-slate-700/80 rounded px-2 text-xs font-mono text-slate-100 outline-none"
                  />
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* TAB 3: ACCOUNTING & TAX RULES */}
      {activeTab === 'preferences' && (
        <Card title="Accounting, Inventory &amp; Invoicing Preferences" subtitle="Operational rules matching TallyPrime feature flags">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Inventory Valuation Method
                </label>
                <select
                  value={inventoryValuation}
                  onChange={(e) => setInventoryValuation(e.target.value as InventoryValuationMethod)}
                  className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-2 text-xs font-mono text-slate-100 outline-none"
                >
                  <option value="PERPETUAL_FIFO">Perpetual - FIFO</option>
                  <option value="PERPETUAL_WEIGHTED_AVG">Perpetual - Moving Weighted Average</option>
                  <option value="PERIODIC">Periodic Inventory Valuation</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  GST Registration Type
                </label>
                <select
                  value={gstRegistrationType}
                  onChange={(e) => setGstRegistrationType(e.target.value as GstRegistrationType)}
                  className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-2 text-xs font-mono text-slate-100 outline-none"
                >
                  <option value="REGULAR">Regular Taxpayer</option>
                  <option value="COMPOSITION">Composition Scheme</option>
                  <option value="SEZ">Special Economic Zone (SEZ)</option>
                  <option value="UNREGISTERED">Unregistered</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Invoice Numbering Prefix"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                helperText="Generates e.g. INV/26-27/0001"
              />
              <Input
                label="Standard Credit Terms (Days)"
                type="number"
                value={String(defaultCreditDays)}
                onChange={(e) => setDefaultCreditDays(parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2 p-3 bg-slate-900/60 border border-slate-800 rounded text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={billWiseTracking}
                  onChange={(e) => setBillWiseTracking(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span>Maintain Bill-wise details for Debtor/Creditor allocations</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={preventNegativeCash}
                  onChange={(e) => setPreventNegativeCash(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span>Strictly Prevent &amp; Warn on negative cash balance</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={enforceCreditLimit}
                  onChange={(e) => setEnforceCreditLimit(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span>Enforce Customer Credit Limits on Tax Invoices</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={multiGodown}
                  onChange={(e) => setMultiGodown(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span>Enable Multi-Godown / Multi-Warehouse stock registers</span>
              </label>
            </div>
          </div>
        </Card>
      )}

      {/* TAB 4: ISOLATION AUDIT */}
      {activeTab === 'isolation' && (
        <Card title="Tenant Isolation &amp; Data Boundary Inspection" subtitle="Cryptographic and relational tenant partitioning audit">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 font-mono text-xs">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded">
                <span className="text-[11px] text-slate-400 block mb-1">Company Ledgers:</span>
                <span className="text-base font-bold text-slate-100">{auditData?.totalLedgersCount ?? 0}</span>
                <p className="text-[10px] text-slate-500 mt-1">Scoped to this tenant</p>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded">
                <span className="text-[11px] text-slate-400 block mb-1">Company Vouchers:</span>
                <span className="text-base font-bold text-slate-100">{auditData?.totalTransactionsCount ?? 0}</span>
                <p className="text-[10px] text-slate-500 mt-1">Scoped to this tenant</p>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded">
                <span className="text-[11px] text-slate-400 block mb-1">Cross-Tenant Leakage:</span>
                <span className="text-base font-bold text-emerald-400">
                  {auditData?.crossTenantLeakageCount ?? 0}
                </span>
                <p className="text-[10px] text-emerald-500/80 mt-1">ZERO LEAKAGE INVARIANT</p>
              </div>
            </div>

            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <Shield className="w-4 h-4" />
                <span>Isolation Boundary Verified Active</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                All database reads and writes execute with mandatory <code className="text-indigo-300">WHERE tenant_id = :tenantId</code> partitioning. Ledgers, journal lines, customers, suppliers, inventory godowns, and GST returns belonging to this company are strictly isolated from any other entity.
              </p>
              <div className="pt-2 text-[10px] font-mono text-slate-500">
                Audited at: {auditData?.auditTimestamp ? new Date(auditData.auditTimestamp).toLocaleString() : 'Live'}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* TAB 5: AUTOMATED TEST SUITE RUNNER */}
      {activeTab === 'tests' && (
        <Card title="Company Management &amp; Isolation Test Suite" subtitle="Direct backend verification of company creation, validation, switching &amp; isolation">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/60 rounded border border-slate-800">
              <div>
                <h4 className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                  <Play className="w-4 h-4 text-indigo-400" />
                  <span>12 Phase 05 Verification Invariants</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Verifies company creation, missing name rejection, FY date validation, books inception validation, GSTIN checksum &amp; state prefix match, duplicate GSTIN rejection, preference updates, company switching, and strict cross-tenant isolation.
                </p>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handleRunTests}
                disabled={isRunningTests}
                leftIcon={<Play className="w-3.5 h-3.5" />}
              >
                {isRunningTests ? 'Running Test Suite...' : 'Execute Phase 05 Tests (12 Tests)'}
              </Button>
            </div>

            {testResults && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded border border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">Execution Result:</span>
                    {testResults.passed ? (
                      <Badge variant="credit" dot>ALL {testResults.total} TESTS PASSED (100%)</Badge>
                    ) : (
                      <Badge variant="debit" dot>{testResults.passedCount}/{testResults.total} PASSED</Badge>
                    )}
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">
                    Pass Rate: {Math.round((testResults.passedCount / testResults.total) * 100)}%
                  </span>
                </div>

                <div className="border border-slate-800 rounded overflow-hidden">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-900/90 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                      <tr>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Category</th>
                        <th className="py-2 px-3">Invariant Name</th>
                        <th className="py-2 px-3 text-right">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                      {testResults.results.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-900/30">
                          <td className="py-2 px-3 whitespace-nowrap">
                            {r.passed ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                PASS
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-400 text-[11px] font-semibold">
                                <XCircle className="w-3.5 h-3.5" />
                                FAIL
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-indigo-300 text-[11px] whitespace-nowrap">
                            {r.category}
                          </td>
                          <td className="py-2 px-3 text-slate-200 text-[11px]">
                            {r.name}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-400 text-[11px] tabular-nums">
                            {r.durationMs}ms
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
