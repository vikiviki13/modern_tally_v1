/**
 * Accounting Domain Types & Contracts
 * Phase 06 Deliverable — Double-Entry Accounting Engine
 */

export type VoucherType =
  | 'JOURNAL'
  | 'PAYMENT'
  | 'RECEIPT'
  | 'CONTRA'
  | 'SALES'
  | 'PURCHASE'
  | 'DEBIT_NOTE'
  | 'CREDIT_NOTE';

export type EntryDirection = 'DEBIT' | 'CREDIT';

export type JournalStatus = 'DRAFT' | 'POSTED' | 'REVERSED';

export type AccountClassification =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'REVENUE'
  | 'EXPENSE';

export type AccountNormalBalance = 'DEBIT' | 'CREDIT';

export interface SourceDocumentReference {
  id: string;
  type: string;
  referenceNumber?: string;
  metadata?: Record<string, unknown>;
}

export interface JournalLineInput {
  lineNumber?: number;
  ledgerId: string;
  entryDirection: EntryDirection;
  amount: string | number;
  narration?: string;
  currency?: string;
  exchangeRate?: number;
  costCenterId?: string;
}

export interface JournalLineDTO {
  id: string;
  journalEntryId: string;
  tenantId: string;
  lineNumber: number;
  ledgerId: string;
  ledgerName: string;
  entryDirection: EntryDirection;
  debitAmount: string;
  creditAmount: string;
  amount: string;
  narration?: string;
  currency: string;
  exchangeRate: number;
  costCenterId?: string;
}

export interface PostJournalPayload {
  voucherType: VoucherType;
  voucherNumber?: string;
  entryDate: string; // YYYY-MM-DD
  narration: string;
  referenceNumber?: string;
  referenceDate?: string;
  sourceDocument?: SourceDocumentReference;
  lines: JournalLineInput[];
  isAuthorizedAdjustment?: boolean;
  adjustmentReason?: string;
}

export interface JournalEntryDTO {
  id: string;
  tenantId: string;
  voucherType: VoucherType;
  voucherNumber: string;
  entryDate: string;
  postingDate: string;
  financialYearId: string;
  accountingPeriodId: string;
  narration: string;
  referenceNumber?: string;
  referenceDate?: string;
  sourceDocument?: SourceDocumentReference;
  postedStatus: JournalStatus;
  totalAmount: string;
  createdBy: string;
  postedBy?: string;
  lines: JournalLineDTO[];
  reversalOfJournalId?: string;
  reversedByJournalId?: string;
  isAdjustment?: boolean;
  adjustmentReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReverseJournalOptions {
  reversalDate?: string; // YYYY-MM-DD
  reversalReason: string;
  isAuthorizedAdjustment?: boolean;
  adjustmentReason?: string;
}

export interface PostingContext {
  userId: string;
  userRole: 'SUPER_ADMIN' | 'AUDITOR' | 'SR_ACCOUNTANT' | 'SALES' | 'WAREHOUSE';
  ipAddress?: string;
  userAgent?: string;
  isAuthorizedAdjustment?: boolean;
  adjustmentReason?: string;
}

export interface LedgerAccountDTO {
  id: string;
  tenantId: string;
  groupId: string;
  groupName: string;
  code: string;
  name: string;
  classification: AccountClassification;
  normalBalance: AccountNormalBalance;
  openingBalance: string;
  openingBalanceType: EntryDirection;
  currentBalance: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialYearDTO {
  id: string;
  tenantId: string;
  code: string; // e.g. FY 2026-27
  name: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  closedAt?: string;
  closedBy?: string;
  freezeDate?: string;
}

export interface AccountingPeriodDTO {
  id: string;
  tenantId: string;
  financialYearId: string;
  periodNumber: number; // 1 - 12
  name: string; // e.g. 'April 2026'
  startDate: string;
  endDate: string;
  isLocked: boolean;
  lockedAt?: string;
  lockedBy?: string;
}

export interface LedgerStatementLine {
  journalEntryId: string;
  voucherNumber: string;
  voucherType: VoucherType;
  date: string;
  narration: string;
  referenceNumber?: string;
  debit: string;
  credit: string;
  runningBalance: string;
  runningBalanceType: EntryDirection;
}

export interface LedgerStatementDTO {
  ledger: LedgerAccountDTO;
  periodStart: string;
  periodEnd: string;
  openingBalance: string;
  openingBalanceType: EntryDirection;
  lines: LedgerStatementLine[];
  totalDebits: string;
  totalCredits: string;
  closingBalance: string;
  closingBalanceType: EntryDirection;
}

export interface TrialBalanceRowDTO {
  ledgerId: string;
  ledgerCode: string;
  ledgerName: string;
  groupName: string;
  classification: AccountClassification;
  debit: string;
  credit: string;
}

export interface TrialBalanceDTO {
  tenantId: string;
  asOfDate: string;
  rows: TrialBalanceRowDTO[];
  totalDebit: string;
  totalCredit: string;
  isBalanced: boolean;
}
