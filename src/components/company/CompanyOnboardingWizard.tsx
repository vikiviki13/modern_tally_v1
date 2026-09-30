import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { companyClient } from '../../services/companyClient';
import { Modal, Button, Input, Alert, Badge } from '../../design-system';
import {
  Building2,
  FileCheck2,
  Calendar,
  Sliders,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Shield,
  HelpCircle,
} from 'lucide-react';
import {
  BusinessType,
  InventoryValuationMethod,
  GstRegistrationType,
  VoucherNumberingMode,
  CreateCompanyPayload,
} from '../../../shared/types/company';

interface CompanyOnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCompanyCreated: (companyId: string) => void;
}

const INDIAN_STATES = [
  { code: '27', name: 'Maharashtra' },
  { code: '24', name: 'Gujarat' },
  { code: '29', name: 'Karnataka' },
  { code: '07', name: 'Delhi' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '36', name: 'Telangana' },
  { code: '19', name: 'West Bengal' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '08', name: 'Rajasthan' },
  { code: '06', name: 'Haryana' },
  { code: '03', name: 'Punjab' },
  { code: '32', name: 'Kerala' },
  { code: '10', name: 'Bihar' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '21', name: 'Odisha' },
];

export function CompanyOnboardingWizard({
  isOpen,
  onClose,
  onCompanyCreated,
}: CompanyOnboardingWizardProps) {
  const { switchTenant } = useAuth();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 1: Entity Identity
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('PVT_LTD');
  const [industry, setIndustry] = useState('Information Technology & Software');

  // Step 2: Statutory & Jurisdiction
  const [country, setCountry] = useState('India');
  const [selectedState, setSelectedState] = useState(INDIAN_STATES[0]);
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');

  // Step 3: Financial Calendar & Base Currency
  const [currencyCode, setCurrencyCode] = useState('INR');
  const [financialYearStart, setFinancialYearStart] = useState('2026-04-01');
  const [financialYearEnd, setFinancialYearEnd] = useState('2027-03-31');
  const [booksBeginningDate, setBooksBeginningDate] = useState('2026-04-01');

  // Step 4: Accounting & Invoicing Preferences
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

  // Auto extract PAN and state code when GSTIN changes
  const handleGstinChange = (val: string) => {
    const clean = val.toUpperCase().trim();
    setGstin(clean);
    if (clean.length >= 2) {
      const statePrefix = clean.substring(0, 2);
      const matchedState = INDIAN_STATES.find((s) => s.code === statePrefix);
      if (matchedState) {
        setSelectedState(matchedState);
      }
    }
    if (clean.length >= 12) {
      const extractedPan = clean.substring(2, 12);
      setPan(extractedPan);
    }
  };

  const handleFYStartChange = (dateVal: string) => {
    setFinancialYearStart(dateVal);
    // Auto-advance FY End by 1 year minus 1 day
    try {
      const start = new Date(dateVal);
      if (!isNaN(start.getTime())) {
        const end = new Date(start);
        end.setFullYear(end.getFullYear() + 1);
        end.setDate(end.getDate() - 1);
        const yyyy = end.getFullYear();
        const mm = String(end.getMonth() + 1).padStart(2, '0');
        const dd = String(end.getDate()).padStart(2, '0');
        setFinancialYearEnd(`${yyyy}-${mm}-${dd}`);
        // If booksBeginningDate is earlier than new start, sync it
        if (new Date(booksBeginningDate) < start) {
          setBooksBeginningDate(dateVal);
        }
      }
    } catch {
      // Ignore
    }
  };

  const validateStep = (step: number): boolean => {
    setErrorMsg(null);
    if (step === 1) {
      if (!name.trim()) {
        setErrorMsg('Business Name is required.');
        return false;
      }
    } else if (step === 2) {
      if (gstin && gstin.trim().length > 0) {
        if (gstin.length !== 15) {
          setErrorMsg('GSTIN must be exactly 15 characters (e.g. 27AABCA1234F1Z1).');
          return false;
        }
        if (gstin.substring(0, 2) !== selectedState.code) {
          setErrorMsg(`GSTIN state prefix (${gstin.substring(0, 2)}) does not match ${selectedState.name} (${selectedState.code}).`);
          return false;
        }
      }
      if (pan && pan.trim().length > 0 && pan.length !== 10) {
        setErrorMsg('PAN must be exactly 10 alphanumeric characters (e.g. AABCA1234F).');
        return false;
      }
    } else if (step === 3) {
      if (!financialYearStart || !financialYearEnd) {
        setErrorMsg('Financial Year Start and End dates are required.');
        return false;
      }
      if (new Date(financialYearEnd) <= new Date(financialYearStart)) {
        setErrorMsg('Financial Year End date must be strictly after Financial Year Start date.');
        return false;
      }
      if (!booksBeginningDate) {
        setErrorMsg('Books Beginning Date is required.');
        return false;
      }
      if (new Date(booksBeginningDate) < new Date(financialYearStart)) {
        setErrorMsg('Books Beginning Date cannot be earlier than Financial Year Start Date.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handleBack = () => {
    setErrorMsg(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleFinalSubmit = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    const payload: CreateCompanyPayload = {
      name: name.trim(),
      legalName: legalName.trim() || undefined,
      businessType,
      industry,
      country,
      state: selectedState.name,
      stateCode: selectedState.code,
      street: street.trim() || undefined,
      city: city.trim() || undefined,
      pincode: pincode.trim() || undefined,
      gstin: gstin.trim() || undefined,
      pan: pan.trim() || undefined,
      currencyCode,
      financialYearStart,
      financialYearEnd,
      booksBeginningDate,
      preferences: {
        accounting: {
          inventoryValuation,
          billWiseTracking,
          preventNegativeCash,
          enforceCreditLimit,
          multiCurrency: currencyCode !== 'INR',
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
          termsAndConditions: 'Payment due per agreed invoice credit period. Zero tolerance on statutory taxes.',
        },
      },
    };

    try {
      const createdCompany = await companyClient.createCompany(payload);
      // Automatically switch active context to newly created company
      await switchTenant(createdCompany.id);
      onCompanyCreated(createdCompany.id);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Company creation failed';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillSensibleDefaults = () => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setName('Apex Digital Innovations');
    setLegalName('Apex Digital Innovations Private Limited');
    setBusinessType('PVT_LTD');
    setIndustry('Information Technology');
    setSelectedState(INDIAN_STATES[0]); // Maharashtra 27
    setStreet('Block B, Mindspace IT Park, Airoli');
    setCity('Navi Mumbai');
    setPincode('400708');
    handleGstinChange(`27AAACA${randomSuffix}Q1ZB`);
    setFinancialYearStart('2026-04-01');
    setFinancialYearEnd('2027-03-31');
    setBooksBeginningDate('2026-04-01');
    setInventoryValuation('PERPETUAL_FIFO');
    setBillWiseTracking(true);
    setPreventNegativeCash(true);
    setEnforceCreditLimit(true);
    setMultiGodown(true);
    setEInvoicingApplicable(true);
    setPrefix('ADI/{FY}/');
    setErrorMsg(null);
  };

  const steps = [
    { num: 1, label: 'Entity Identity' },
    { num: 2, label: 'Statutory & Tax' },
    { num: 3, label: 'Financial Calendar' },
    { num: 4, label: 'Accounting Config' },
    { num: 5, label: 'Review & Confirm' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Company Setup & Financial Configuration Wizard"
      subtitle="Guided multi-tenant onboarding adhering to Luca Pacioli double-entry & MCA compliance"
    >
      <div className="space-y-4">
        {/* Step Progress Tracker */}
        <div className="grid grid-cols-5 gap-1.5 p-1 bg-slate-900/80 rounded border border-slate-800 text-center">
          {steps.map((s) => {
            const isDone = currentStep > s.num;
            const isCurrent = currentStep === s.num;
            return (
              <div
                key={s.num}
                className={`py-1.5 px-1 rounded transition-colors ${
                  isCurrent
                    ? 'bg-indigo-600 text-white font-semibold'
                    : isDone
                    ? 'bg-slate-800/80 text-emerald-400 font-medium'
                    : 'text-slate-400'
                }`}
              >
                <div className="text-[10px] uppercase font-mono tracking-wider">
                  Step {s.num}
                </div>
                <div className="text-[11px] truncate">{s.label}</div>
              </div>
            );
          })}
        </div>

        {/* Error notification banner */}
        {errorMsg && (
          <Alert variant="error">
            <span className="font-semibold text-rose-300">Configuration Error:</span> {errorMsg}
          </Alert>
        )}

        {/* STEP 1: ENTITY IDENTITY */}
        {currentStep === 1 && (
          <div className="space-y-3.5 py-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-400" />
                <span>Basic Business Identity</span>
              </h3>
              <button
                type="button"
                onClick={fillSensibleDefaults}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Pre-fill Sensible Demo Defaults</span>
              </button>
            </div>

            <Input
              label="Business / Trade Name"
              placeholder="e.g. Acme Precision Dynamics"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!legalName) {
                  setLegalName(`${e.target.value} Private Limited`);
                }
              }}
              required
              helperText="The trade name printed on vouchers and shown in company switcher"
            />

            <Input
              label="Registered Legal Entity Name"
              placeholder="e.g. Acme Precision Dynamics Private Limited"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              helperText="Official legal entity name recorded in MCA / corporate registry"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Business Entity Type
                </label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value as BusinessType)}
                  className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-2 text-xs font-mono text-slate-100 outline-none focus:border-indigo-500"
                >
                  <option value="PVT_LTD">Private Limited Company</option>
                  <option value="PUBLIC_LTD">Public Limited Company</option>
                  <option value="LLP">Limited Liability Partnership (LLP)</option>
                  <option value="PARTNERSHIP">Partnership Firm</option>
                  <option value="SOLE_PROPRIETORSHIP">Sole Proprietorship</option>
                  <option value="TRUST">Trust / Society</option>
                  <option value="OTHER">Other Commercial Entity</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Industry Classification
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-2 text-xs font-mono text-slate-100 outline-none focus:border-indigo-500"
                >
                  <option value="Information Technology & Software">Information Technology &amp; Software</option>
                  <option value="Manufacturing & Heavy Engineering">Manufacturing &amp; Engineering</option>
                  <option value="Retail & Wholesale Trading">Retail &amp; Wholesale Trading</option>
                  <option value="Construction & Real Estate">Construction &amp; Real Estate</option>
                  <option value="Healthcare & Pharmaceuticals">Healthcare &amp; Pharmaceuticals</option>
                  <option value="Professional & Financial Services">Professional &amp; Financial Services</option>
                  <option value="Logistics & Supply Chain">Logistics &amp; Supply Chain</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: STATUTORY & JURISDICTION */}
        {currentStep === 2 && (
          <div className="space-y-3.5 py-1">
            <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <FileCheck2 className="w-4 h-4 text-indigo-400" />
              <span>Tax Registration &amp; Place of Supply</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  State / Jurisdiction (Place of Supply)
                </label>
                <select
                  value={selectedState.code}
                  onChange={(e) => {
                    const st = INDIAN_STATES.find((s) => s.code === e.target.value);
                    if (st) setSelectedState(st);
                  }}
                  className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-2 text-xs font-mono text-slate-100 outline-none focus:border-indigo-500"
                >
                  {INDIAN_STATES.map((st) => (
                    <option key={st.code} value={st.code}>
                      {st.code} - {st.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Country
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-2 text-xs font-mono text-slate-100 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="GSTIN (15 characters)"
                placeholder="e.g. 27AABCA1234F1Z1"
                value={gstin}
                onChange={(e) => handleGstinChange(e.target.value)}
                helperText="Auto-validates state code & extracts PAN"
              />

              <Input
                label="Permanent Account Number (PAN)"
                placeholder="e.g. AABCA1234F"
                value={pan}
                onChange={(e) => setPan(e.target.value.toUpperCase())}
                helperText="10 alphanumeric characters"
              />
            </div>

            <div className="space-y-2">
              <Input
                label="Registered Street Address"
                placeholder="e.g. Unit 401, Tech Park, MIDC Industrial Area"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="City"
                  placeholder="e.g. Mumbai"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                <Input
                  label="Pincode / Postal Code"
                  placeholder="e.g. 400069"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: FINANCIAL CALENDAR & CURRENCY */}
        {currentStep === 3 && (
          <div className="space-y-3.5 py-1">
            <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>Financial Year Calendar &amp; Books Inception</span>
            </h3>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Base Accounting Currency
                </label>
                <select
                  value={currencyCode}
                  onChange={(e) => setCurrencyCode(e.target.value)}
                  className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-2 text-xs font-mono text-slate-100 outline-none"
                >
                  <option value="INR">INR (₹) - Indian Rupee</option>
                  <option value="USD">USD ($) - US Dollar</option>
                  <option value="EUR">EUR (€) - Euro</option>
                  <option value="GBP">GBP (£) - British Pound</option>
                  <option value="AED">AED (د.إ) - UAE Dirham</option>
                  <option value="SGD">SGD (S$) - Singapore Dollar</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Financial Year From
                </label>
                <input
                  type="date"
                  value={financialYearStart}
                  onChange={(e) => handleFYStartChange(e.target.value)}
                  className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-2 text-xs font-mono text-slate-100 outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Financial Year To
                </label>
                <input
                  type="date"
                  value={financialYearEnd}
                  onChange={(e) => setFinancialYearEnd(e.target.value)}
                  className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-2 text-xs font-mono text-slate-100 outline-none"
                  required
                />
              </div>
            </div>

            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded space-y-2">
              <label className="text-[11px] font-medium text-slate-200 block">
                Books Beginning From
              </label>
              <input
                type="date"
                value={booksBeginningDate}
                onChange={(e) => setBooksBeginningDate(e.target.value)}
                min={financialYearStart}
                className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-2 text-xs font-mono text-slate-100 outline-none"
                required
              />
              <p className="text-[11px] text-slate-400">
                In Indian Accounting &amp; Tally parity: If you migrate mid-year, books beginning date can be on or after {financialYearStart}. Transactions before this date will not be accepted.
              </p>
            </div>
          </div>
        )}

        {/* STEP 4: ACCOUNTING & INVOICING PREFERENCES */}
        {currentStep === 4 && (
          <div className="space-y-3.5 py-1">
            <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Accounting, Inventory &amp; Tax Configuration</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Inventory Valuation Standard
                </label>
                <select
                  value={inventoryValuation}
                  onChange={(e) => setInventoryValuation(e.target.value as InventoryValuationMethod)}
                  className="w-full h-7 bg-slate-900 border border-slate-700/80 rounded px-2 text-xs font-mono text-slate-100 outline-none"
                >
                  <option value="PERPETUAL_FIFO">Perpetual - FIFO (First-In, First-Out)</option>
                  <option value="PERPETUAL_WEIGHTED_AVG">Perpetual - Moving Weighted Average</option>
                  <option value="PERIODIC">Periodic Stock Valuation</option>
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
                  <option value="REGULAR">Regular Taxpayer (Monthly / QRMP)</option>
                  <option value="COMPOSITION">Composition Scheme</option>
                  <option value="SEZ">Special Economic Zone (SEZ Developer/Unit)</option>
                  <option value="UNREGISTERED">Unregistered / Consumer</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Sales Invoice Numbering Prefix"
                placeholder="e.g. INV/{FY}/"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                helperText="Generates e.g. INV/26-27/0001"
              />
              <Input
                label="Standard Credit Terms (Days)"
                type="number"
                value={String(defaultCreditDays)}
                onChange={(e) => setDefaultCreditDays(parseInt(e.target.value) || 0)}
                helperText="Default payment due window"
              />
            </div>

            {/* Checkbox Preference Toggles */}
            <div className="space-y-2 p-2.5 bg-slate-900/60 border border-slate-800 rounded text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={billWiseTracking}
                  onChange={(e) => setBillWiseTracking(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span>Maintain Bill-by-Bill allocations for Sundry Debtors &amp; Creditors</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={preventNegativeCash}
                  onChange={(e) => setPreventNegativeCash(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span>Prevent &amp; Warn on negative cash balance in Day Book</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={multiGodown}
                  onChange={(e) => setMultiGodown(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span>Enable Multi-Godown / Multi-Warehouse stock transfers</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={eInvoicingApplicable}
                  onChange={(e) => setEInvoicingApplicable(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span>Enable E-Invoicing (IRN &amp; Signed QR Code generation)</span>
              </label>
            </div>
          </div>
        )}

        {/* STEP 5: REVIEW & CONFIRM */}
        {currentStep === 5 && (
          <div className="space-y-3.5 py-1">
            <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Review Company Configuration</span>
            </h3>

            <div className="p-3 bg-slate-900 border border-slate-800 rounded space-y-2 text-xs font-mono">
              <div className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Business Name:</span>
                <span className="text-slate-100 font-semibold">{name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Legal Name:</span>
                <span className="text-slate-200 truncate max-w-[240px]">{legalName || `${name} Ltd`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Business Type / Industry:</span>
                <span className="text-slate-300">{businessType} &bull; {industry}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">State / State Code:</span>
                <span className="text-slate-300">{selectedState.name} ({selectedState.code})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">GSTIN / PAN:</span>
                <span className="text-slate-300">{gstin || 'UNREGISTERED'} &bull; {pan || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Financial Year:</span>
                <span className="text-indigo-300">{financialYearStart} to {financialYearEnd}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Books Beginning From:</span>
                <span className="text-indigo-300">{booksBeginningDate}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1.5">
                <span className="text-slate-400">Inventory Valuation:</span>
                <span className="text-emerald-400">{inventoryValuation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Invoice Voucher Prefix:</span>
                <span className="text-slate-300 font-bold">{prefix}0001</span>
              </div>
            </div>

            <div className="p-2.5 bg-indigo-950/30 border border-indigo-500/30 rounded flex items-center gap-2 text-xs text-indigo-300">
              <Shield className="w-4 h-4 shrink-0 text-indigo-400" />
              <span>
                Isolated tenant boundary will be created. All general ledger charts, cash accounts, and journal sequences will be scoped strictly to this company.
              </span>
            </div>
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBack}
                leftIcon={<ArrowLeft className="w-3 h-3" />}
              >
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>

            {currentStep < 5 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={handleNext}
                rightIcon={<ArrowRight className="w-3 h-3" />}
              >
                Continue
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                rightIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                {isSubmitting ? 'Initializing Books...' : 'Create Company & Initialize Books'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
