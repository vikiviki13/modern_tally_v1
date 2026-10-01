import {
  BusinessType,
  CompanyAddress,
  CompanyCurrency,
  CompanyPreferences,
  FinancialYearConfig,
} from '../../shared/types/company';
import {
  VoucherType,
  EntryDirection,
  JournalStatus,
  AccountClassification,
  AccountNormalBalance,
  SourceDocumentReference,
} from '../../shared/types/accounting';

export interface TenantRecord {
  id: string;
  name: string;
  legalName: string;
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
  booksBeginningDate: string;
  preferences: CompanyPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string; // scrypt hash with salt
  salt: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'AUDITOR' | 'SR_ACCOUNTANT' | 'SALES' | 'WAREHOUSE';
  tenantId: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface SessionRecord {
  id: string;
  token: string;
  userId: string;
  tenantId: string;
  expiresAt: string;
  createdAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface PasswordResetTokenRecord {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

export interface IsolatedLedgerRecord {
  id: string;
  tenantId: string; // Strict Tenant Boundary
  name: string;
  groupName: string;
  openingBalance: number;
  balanceType: 'DR' | 'CR';
  createdAt: string;
}

export interface IsolatedVoucherRecord {
  id: string;
  tenantId: string; // Strict Tenant Boundary
  voucherType: string;
  voucherNumber: string;
  date: string;
  amount: number;
  narration: string;
  createdAt: string;
}

import { TaxConfig, BankConfig } from '../../shared/types/ledger';

export interface AccountGroupRecord {
  id: string;
  tenantId: string;
  parentId?: string;
  name: string;
  code: string;
  classification: AccountClassification;
  affectsGrossProfit: boolean;
  isPrimary?: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt?: string;
}

export interface LedgerAccountRecord {
  id: string;
  tenantId: string;
  groupId: string;
  groupName: string;
  code: string;
  name: string;
  alias?: string;
  description?: string;
  classification: AccountClassification;
  normalBalance: AccountNormalBalance;
  openingBalance: string;
  openingBalanceType: EntryDirection;
  openingBalanceDate?: string;
  currentBalance: string; // Projected running balance in base currency
  isActive: boolean;
  isBillWise?: boolean;
  taxConfig?: TaxConfig;
  bankConfig?: BankConfig;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialYearRecord {
  id: string;
  tenantId: string;
  code: string; // e.g. FY 2026-27
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isClosed: boolean;
  closedAt?: string;
  closedBy?: string;
  freezeDate?: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
}

export interface AccountingPeriodRecord {
  id: string;
  tenantId: string;
  financialYearId: string;
  periodNumber: number; // 1 to 12
  name: string; // e.g. 'April 2026'
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isLocked: boolean;
  lockedAt?: string;
  lockedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntryRecord {
  id: string;
  tenantId: string;
  financialYearId: string;
  accountingPeriodId: string;
  voucherType: VoucherType;
  voucherNumber: string;
  entryDate: string; // YYYY-MM-DD
  postingDate: string; // ISO timestamp
  narration: string;
  referenceNumber?: string;
  referenceDate?: string;
  sourceDocument?: SourceDocumentReference;
  postedStatus: JournalStatus;
  totalAmount: string; // Exact decimal string
  createdBy: string;
  postedBy?: string;
  reversalOfJournalId?: string;
  reversedByJournalId?: string;
  isAdjustment?: boolean;
  adjustmentReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JournalLineRecord {
  id: string;
  tenantId: string;
  journalEntryId: string;
  ledgerId: string;
  ledgerName: string;
  lineNumber: number;
  entryDirection: EntryDirection;
  debitAmount: string;
  creditAmount: string;
  amount: string;
  narration?: string;
  currency: string;
  exchangeRate: number;
  costCenterId?: string;
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  action: string;
  performedBy: string;
  ipAddress?: string;
  userAgent?: string;
  oldState?: unknown;
  newState?: unknown;
  details?: Record<string, unknown>;
  hash: string;
  createdAt: string;
}

export interface DatabaseSchema {
  tenants: TenantRecord[];
  users: UserRecord[];
  sessions: SessionRecord[];
  passwordResets: PasswordResetTokenRecord[];
  ledgers: IsolatedLedgerRecord[];
  vouchers: IsolatedVoucherRecord[];
  accountGroups: AccountGroupRecord[];
  chartOfAccounts: LedgerAccountRecord[];
  financialYears: FinancialYearRecord[];
  accountingPeriods: AccountingPeriodRecord[];
  journalEntries: JournalEntryRecord[];
  journalLines: JournalLineRecord[];
  auditLogs: AuditLogRecord[];
}
