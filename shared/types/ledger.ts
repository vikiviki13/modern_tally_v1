/**
 * Chart of Accounts & Ledger Domain Types
 * Phase 07 Deliverable — Chart of Accounts and Ledger Management
 */

import { AccountClassification, AccountNormalBalance, EntryDirection } from './accounting';

export interface AccountGroupDTO {
  id: string;
  tenantId: string;
  parentId?: string;
  name: string;
  code: string;
  classification: AccountClassification;
  affectsGrossProfit: boolean;
  isPrimary: boolean;
  sortOrder: number;
  children?: AccountGroupDTO[];
  ledgerCount?: number;
  totalBalance?: string;
  totalBalanceType?: EntryDirection;
}

export interface TaxConfig {
  isTaxAccount: boolean;
  gstType?: 'CGST' | 'SGST' | 'IGST' | 'CESS' | 'NONE';
  taxRatePercent?: number;
  hsnSacCode?: string;
}

export interface BankConfig {
  isBankAccount: boolean;
  bankAccountNumber?: string;
  bankName?: string;
  bankIfsc?: string;
  bankBranch?: string;
  accountType?: 'CURRENT' | 'SAVINGS' | 'OVERDRAFT';
}

export interface LedgerPeriodSummary {
  periodStart: string;
  periodEnd: string;
  openingBalance: string;
  openingBalanceType: EntryDirection;
  periodDebit: string;
  periodCredit: string;
  closingBalance: string;
  closingBalanceType: EntryDirection;
}

export interface LedgerMasterDTO {
  id: string;
  tenantId: string;
  groupId: string;
  groupName: string;
  parentGroupName?: string;
  code: string;
  name: string;
  alias?: string;
  description?: string;
  classification: AccountClassification;
  normalBalance: AccountNormalBalance;
  openingBalance: string;
  openingBalanceType: EntryDirection;
  openingBalanceDate: string;
  currentBalance: string;
  currentBalanceType: EntryDirection;
  isActive: boolean;
  isBillWise?: boolean;
  taxConfig: TaxConfig;
  bankConfig: BankConfig;
  currentPeriod: LedgerPeriodSummary;
  previousPeriod?: LedgerPeriodSummary;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLedgerPayload {
  name: string;
  groupId: string;
  code?: string;
  alias?: string;
  description?: string;
  openingBalance?: string | number;
  openingBalanceType?: EntryDirection;
  openingBalanceDate?: string;
  isBillWise?: boolean;
  taxConfig?: Partial<TaxConfig>;
  bankConfig?: Partial<BankConfig>;
}

export interface UpdateLedgerPayload {
  name?: string;
  groupId?: string;
  code?: string;
  alias?: string;
  description?: string;
  taxConfig?: Partial<TaxConfig>;
  bankConfig?: Partial<BankConfig>;
  isActive?: boolean;
  isBillWise?: boolean;
}

export interface CreateAccountGroupPayload {
  name: string;
  parentId?: string;
  code?: string;
  classification?: AccountClassification;
  affectsGrossProfit?: boolean;
  sortOrder?: number;
}

export interface UpdateAccountGroupPayload {
  name?: string;
  parentId?: string;
  code?: string;
  affectsGrossProfit?: boolean;
  sortOrder?: number;
}

export interface BulkImportLedgerRow {
  name: string;
  groupNameOrCode: string;
  code?: string;
  alias?: string;
  openingBalance?: string | number;
  openingBalanceType?: 'DR' | 'CR' | 'DEBIT' | 'CREDIT';
  gstRate?: number;
  hsnCode?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankName?: string;
}

export interface BulkImportResultDTO {
  totalSubmitted: number;
  importedCount: number;
  failedCount: number;
  isDryRun: boolean;
  createdLedgers: LedgerMasterDTO[];
  errors: Array<{
    rowIndex: number;
    ledgerName: string;
    message: string;
  }>;
}

export interface OpeningBalanceSummaryDTO {
  totalOpeningDebits: string;
  totalOpeningCredits: string;
  difference: string;
  isBalanced: boolean;
  differenceDirection: EntryDirection | 'BALANCED';
  suspenseLedgerId?: string;
  unbalancedLedgersCount: number;
}

export interface ReconcileOpeningBalancePayload {
  suspenseLedgerId: string;
  notes?: string;
}
