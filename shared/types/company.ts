/**
 * Shared Company & Financial Configuration Types
 * Used across Frontend (src/) and Backend (server/)
 */

export type BusinessType =
  | 'PVT_LTD'
  | 'PUBLIC_LTD'
  | 'LLP'
  | 'PARTNERSHIP'
  | 'SOLE_PROPRIETORSHIP'
  | 'TRUST'
  | 'OTHER';

export type InventoryValuationMethod =
  | 'PERPETUAL_FIFO'
  | 'PERPETUAL_WEIGHTED_AVG'
  | 'PERIODIC';

export type GstRegistrationType =
  | 'REGULAR'
  | 'COMPOSITION'
  | 'SEZ'
  | 'OVERSEAS'
  | 'UNREGISTERED';

export type VoucherNumberingMode =
  | 'AUTO_SEQUENTIAL'
  | 'MANUAL';

export interface CompanyAddress {
  street: string;
  city: string;
  state: string;
  stateCode: string;
  country: string;
  pincode: string;
}

export interface CompanyCurrency {
  code: string;           // e.g. 'INR', 'USD', 'EUR'
  symbol: string;         // e.g. '₹', '$', '€'
  decimalPlaces: number;  // standard: 2
  formatLocale: string;   // e.g. 'en-IN', 'en-US'
}

export interface FinancialYearConfig {
  name: string;           // e.g. 'FY 2026-27'
  startDate: string;      // YYYY-MM-DD e.g. '2026-04-01'
  endDate: string;        // YYYY-MM-DD e.g. '2027-03-31'
  isLocked: boolean;      // Period lock
  freezeDate?: string;    // Transactions on or before this date are immutable
}

export interface AccountingPreferences {
  inventoryValuation: InventoryValuationMethod;
  billWiseTracking: boolean;        // Maintain bill-by-bill balances for debtors/creditors
  preventNegativeCash: boolean;     // Block vouchers that cause cash balance < 0
  enforceCreditLimit: boolean;      // Warn/block if customer outstanding exceeds limit
  multiCurrency: boolean;           // Allow forex transactions
}

export interface InventoryPreferences {
  multiGodown: boolean;             // Multi-warehouse stock tracking
  batchTracking: boolean;           // Batch-wise details and manufacturing/expiry dates
  orderProcessing: boolean;         // Sales orders & purchase orders integration
  separateDiscountCol: boolean;     // Separate trade discount % in line items
}

export interface TaxPreferences {
  gstRegistrationType: GstRegistrationType;
  eInvoicingApplicable: boolean;    // Rule 48(4) e-invoice mandate
  eWayBillApplicable: boolean;      // E-way bill requirement (> ₹50,000)
  rcmApplicable: boolean;           // Reverse Charge Mechanism tracking
  defaultGstRate: number;           // Standard tax rate e.g. 18
}

export interface InvoicingPreferences {
  voucherNumbering: VoucherNumberingMode;
  prefix: string;                   // e.g. 'INV/{FY}/'
  suffix?: string;
  startingNumber: number;           // e.g. 1
  defaultCreditDays: number;        // e.g. 30 days
  termsAndConditions: string;       // Printed terms at bottom of invoice
  bankAccountDetails?: string;      // Bank name, A/c, IFSC for wire remittance
}

export interface CompanyPreferences {
  accounting: AccountingPreferences;
  inventory: InventoryPreferences;
  tax: TaxPreferences;
  invoicing: InvoicingPreferences;
}

export interface CompanyDTO {
  id: string;
  name: string;                     // Business / Trade name
  legalName: string;                // Registered legal entity name
  businessType: BusinessType;
  industry: string;
  country: string;
  state: string;
  stateCode: string;
  address: CompanyAddress;
  gstin?: string;
  pan?: string;
  currency: CompanyCurrency;
  financialYear: FinancialYearConfig;
  booksBeginningDate: string;       // Date from which books are kept (>= FY start)
  preferences: CompanyPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyPayload {
  name: string;
  legalName?: string;
  businessType: BusinessType;
  industry: string;
  country: string;
  state: string;
  stateCode: string;
  street?: string;
  city?: string;
  pincode?: string;
  gstin?: string;
  pan?: string;
  currencyCode?: string;
  financialYearStart: string;       // YYYY-MM-DD
  financialYearEnd: string;         // YYYY-MM-DD
  booksBeginningDate: string;       // YYYY-MM-DD
  preferences?: Partial<CompanyPreferences>;
}

export type { ApiResponse } from './auth';

export interface UpdateCompanyPayload {
  name?: string;
  legalName?: string;
  businessType?: BusinessType;
  industry?: string;
  address?: Partial<CompanyAddress>;
  street?: string;
  city?: string;
  pincode?: string;
  gstin?: string;
  pan?: string;
  financialYear?: Partial<FinancialYearConfig>;
  booksBeginningDate?: string;
  preferences?: Partial<CompanyPreferences>;
}

export interface CompanyIsolationAuditDTO {
  companyId: string;
  companyName: string;
  totalLedgersCount: number;
  totalTransactionsCount: number;
  isIsolated: boolean;
  crossTenantLeakageCount: number;
  auditTimestamp: string;
}
