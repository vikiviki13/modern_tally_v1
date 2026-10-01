/**
 * Centralized Double-Entry Posting Service & Reversal Engine
 * Phase 06 Deliverable — Double-Entry Accounting Engine
 *
 * Core Financial Source of Truth:
 * - Workflow: Transaction -> Validation -> Journal Generation -> Balance Verification -> Period Validation -> DB Transaction -> Posting -> Audit Record
 * - Atomic database transactions with complete rollback on any error
 * - Luca Pacioli invariant: SUM(Debits) === SUM(Credits) enforced with exact decimal precision
 * - Permanent ledger immutability: zero deletions, reversals generate equal opposite entries
 * - Multi-tenant isolation and concurrency safety
 */

import { db } from '../../db/store';
import { FinancialAmount } from './precision';
import { periodService, AccountingPeriodError } from './periodService';
import {
  PostJournalPayload,
  JournalEntryDTO,
  JournalLineDTO,
  ReverseJournalOptions,
  PostingContext,
  VoucherType,
  TrialBalanceDTO,
  TrialBalanceRowDTO,
  LedgerStatementDTO,
  LedgerStatementLine,
  EntryDirection,
} from '../../../shared/types/accounting';
import { JournalEntryRecord, JournalLineRecord, LedgerAccountRecord } from '../../db/types';

export class AccountingValidationError extends Error {
  public code: string;
  constructor(message: string, code = 'ACCOUNTING_VALIDATION_ERROR') {
    super(message);
    this.name = 'AccountingValidationError';
    this.code = code;
  }
}

export class AccountingBalanceError extends Error {
  public code = 'UNBALANCED_JOURNAL';
  constructor(message: string) {
    super(message);
    this.name = 'AccountingBalanceError';
  }
}

export class DuplicateVoucherError extends Error {
  public code = 'DUPLICATE_VOUCHER';
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateVoucherError';
  }
}

/**
 * In-memory Tenant Mutex ensuring atomic serialization of concurrent postings per tenant
 */
class TenantMutex {
  private queue: Promise<void> = Promise.resolve();

  public async acquire<T>(fn: () => Promise<T> | T): Promise<T> {
    let release: () => void;
    const currentLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previousQueue = this.queue;
    this.queue = previousQueue.then(() => currentLock);

    await previousQueue;
    try {
      return await fn();
    } finally {
      release!();
    }
  }
}

export class PostingService {
  private tenantLocks = new Map<string, TenantMutex>();

  private getTenantMutex(tenantId: string): TenantMutex {
    let mutex = this.tenantLocks.get(tenantId);
    if (!mutex) {
      mutex = new TenantMutex();
      this.tenantLocks.set(tenantId, mutex);
    }
    return mutex;
  }

  /**
   * Centralized Posting Pipeline
   */
  public async postJournal(
    tenantId: string,
    payload: PostJournalPayload,
    context: PostingContext
  ): Promise<JournalEntryDTO> {
    const mutex = this.getTenantMutex(tenantId);
    return mutex.acquire(() => this.executePostJournal(tenantId, payload, context));
  }

  private executePostJournal(
    tenantId: string,
    payload: PostJournalPayload,
    context: PostingContext
  ): JournalEntryDTO {
    // ------------------------------------------------------------------------
    // Step 1: Business Transaction Validation
    // ------------------------------------------------------------------------
    const tenant = db.findTenantById(tenantId);
    if (!tenant) {
      throw new AccountingValidationError(`Tenant "${tenantId}" does not exist.`, 'TENANT_NOT_FOUND');
    }

    if (!payload.entryDate || !/^\d{4}-\d{2}-\d{2}$/.test(payload.entryDate)) {
      throw new AccountingValidationError('Transaction entry date is required in YYYY-MM-DD format.', 'INVALID_ENTRY_DATE');
    }

    if (!payload.narration || payload.narration.trim().length < 3) {
      throw new AccountingValidationError('Transaction narration is required (minimum 3 characters).', 'INVALID_NARRATION');
    }

    if (!Array.isArray(payload.lines) || payload.lines.length < 2) {
      throw new AccountingValidationError(
        `Double-entry requirement failure: A journal entry must possess at least 2 balanced lines. Received ${payload.lines?.length || 0}.`,
        'MINIMUM_LINES_REQUIRED'
      );
    }

    let hasDebit = false;
    let hasCredit = false;

    // Validate each line item
    payload.lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      if (!line.ledgerId) {
        throw new AccountingValidationError(`Line ${lineNum}: Account reference (ledgerId) is required.`, 'MISSING_LEDGER');
      }

      const ledger = db.findLedgerAccountById(tenantId, line.ledgerId);
      if (!ledger) {
        throw new AccountingValidationError(
          `Line ${lineNum}: Account "${line.ledgerId}" does not exist in tenant "${tenantId}". Cross-tenant referencing is prohibited.`,
          'LEDGER_NOT_FOUND'
        );
      }

      if (!ledger.isActive) {
        throw new AccountingValidationError(`Line ${lineNum}: Ledger "${ledger.name}" is deactivated.`, 'LEDGER_INACTIVE');
      }

      if (line.entryDirection !== 'DEBIT' && line.entryDirection !== 'CREDIT') {
        throw new AccountingValidationError(`Line ${lineNum}: Entry direction must be 'DEBIT' or 'CREDIT'.`, 'INVALID_DIRECTION');
      }

      if (line.entryDirection === 'DEBIT') hasDebit = true;
      if (line.entryDirection === 'CREDIT') hasCredit = true;

      // Validate amounts using FinancialAmount (strictly positive non-zero)
      try {
        const amt = FinancialAmount.from(line.amount);
        if (amt.isZero()) {
          throw new AccountingValidationError(
            `Line ${lineNum} (${ledger.name}): Amount must be strictly greater than zero. Received: 0.00.`,
            'ZERO_AMOUNT_PROHIBITED'
          );
        }
        if (amt.isNegative()) {
          throw new AccountingValidationError(
            `Line ${lineNum} (${ledger.name}): Negative amounts are strictly prohibited in double-entry lines. Specify entry direction instead. Received: ${line.amount}.`,
            'NEGATIVE_AMOUNT_PROHIBITED'
          );
        }
      } catch (err: unknown) {
        if (err instanceof AccountingValidationError) throw err;
        throw new AccountingValidationError(
          `Line ${lineNum}: Invalid monetary amount "${line.amount}".`,
          'INVALID_AMOUNT'
        );
      }
    });

    if (!hasDebit || !hasCredit) {
      throw new AccountingValidationError(
        'Double-entry failure: Journal entry must contain at least one DEBIT line and at least one CREDIT line.',
        'MISSING_DEBIT_OR_CREDIT'
      );
    }

    // ------------------------------------------------------------------------
    // Step 2 & 3: Journal Generation & Balance Verification
    // ------------------------------------------------------------------------
    let totalDebit = FinancialAmount.zero();
    let totalCredit = FinancialAmount.zero();

    const normalizedLines = payload.lines.map((line, idx) => {
      const lineNum = idx + 1;
      const ledger = db.findLedgerAccountById(tenantId, line.ledgerId)!;
      const amt = FinancialAmount.from(line.amount).round(2, 'ROUND_HALF_UP');

      const isDebit = line.entryDirection === 'DEBIT';
      const debitStr = isDebit ? amt.toString(2) : '0.00';
      const creditStr = isDebit ? '0.00' : amt.toString(2);

      if (isDebit) {
        totalDebit = totalDebit.add(amt);
      } else {
        totalCredit = totalCredit.add(amt);
      }

      return {
        tenantId,
        ledgerId: ledger.id,
        ledgerName: ledger.name,
        lineNumber: lineNum,
        entryDirection: line.entryDirection,
        debitAmount: debitStr,
        creditAmount: creditStr,
        amount: amt.toString(2),
        narration: line.narration?.trim() || undefined,
        currency: line.currency || tenant.currency.code || 'INR',
        exchangeRate: line.exchangeRate || 1.0,
        costCenterId: line.costCenterId,
      };
    });

    // Enforce Luca Pacioli Invariant: Total Debits == Total Credits
    if (!totalDebit.equals(totalCredit)) {
      const discrepancy = totalDebit.subtract(totalCredit).abs().toString(2);
      throw new AccountingBalanceError(
        `Double-entry imbalance: Total debits (₹ ${totalDebit.toString(2)}) do not equal total credits (₹ ${totalCredit.toString(2)}). Discrepancy of ₹ ${discrepancy}. Journal rejected.`
      );
    }

    // ------------------------------------------------------------------------
    // Step 4: Period Validation & Governance
    // ------------------------------------------------------------------------
    const periodValidation = periodService.validatePostingPeriod(
      tenantId,
      payload.entryDate,
      payload.isAuthorizedAdjustment || context.isAuthorizedAdjustment,
      context.userRole,
      payload.adjustmentReason || context.adjustmentReason
    );

    const { financialYear, accountingPeriod, isAuthorizedAdjustment, adjustmentReason } = periodValidation;

    // Generate or format sequential voucher number
    const voucherNumber = payload.voucherNumber?.trim() || this.generateVoucherNumber(
      tenantId,
      financialYear.id,
      payload.voucherType
    );

    // ------------------------------------------------------------------------
    // Step 5, 6 & 7: Database Transaction, Posting & Audit Record
    // ------------------------------------------------------------------------
    return db.runTransaction((store) => {
      // 1. Check duplicate voucher number within financial year
      const existingVoucher = store.findJournalEntryByVoucher(
        tenantId,
        financialYear.id,
        payload.voucherType,
        voucherNumber
      );
      if (existingVoucher) {
        throw new DuplicateVoucherError(
          `Voucher number "${voucherNumber}" of type "${payload.voucherType}" already exists in Financial Year "${financialYear.code}". Duplicate posting rejected.`
        );
      }

      // 2. Insert Journal Entry & Lines
      const { entry, lines } = store.insertJournalWithLines(
        {
          tenantId,
          financialYearId: financialYear.id,
          accountingPeriodId: accountingPeriod.id,
          voucherType: payload.voucherType,
          voucherNumber,
          entryDate: payload.entryDate,
          postingDate: new Date().toISOString(),
          narration: payload.narration.trim(),
          referenceNumber: payload.referenceNumber?.trim(),
          referenceDate: payload.referenceDate,
          sourceDocument: payload.sourceDocument,
          postedStatus: 'POSTED',
          totalAmount: totalDebit.toString(2),
          createdBy: context.userId,
          postedBy: context.userId,
          isAdjustment: isAuthorizedAdjustment,
          adjustmentReason: isAuthorizedAdjustment ? adjustmentReason : undefined,
        },
        normalizedLines
      );

      // 3. Atomically Update Projected Ledger Balances
      for (const line of lines) {
        this.applyLineToLedgerBalance(store, tenantId, line.ledgerId, line.entryDirection, line.amount, false);
      }

      // 4. Record Immutable MCA 2013 Statutory Audit Record
      store.appendAuditLog({
        tenantId,
        entityType: 'JOURNAL_ENTRY',
        entityId: entry.id,
        action: isAuthorizedAdjustment ? 'STATUTORY_ADJUSTMENT_POSTED' : 'JOURNAL_POSTED',
        performedBy: context.userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: {
          voucherNumber: entry.voucherNumber,
          voucherType: entry.voucherType,
          entryDate: entry.entryDate,
          totalAmount: entry.totalAmount,
          linesCount: lines.length,
          isAuthorizedAdjustment,
          adjustmentReason,
        },
        newState: {
          journal: entry,
          lines,
        },
      });

      return this.mapToDTO(entry, lines);
    });
  }

  /**
   * Reversal Engine
   * Generates corresponding opposite entries and retains the original transaction history.
   * Never silently deletes posted financial entries.
   */
  public async reverseJournal(
    tenantId: string,
    journalId: string,
    options: ReverseJournalOptions,
    context: PostingContext
  ): Promise<{ originalJournal: JournalEntryDTO; reversalJournal: JournalEntryDTO }> {
    const mutex = this.getTenantMutex(tenantId);
    return mutex.acquire(() => this.executeReverseJournal(tenantId, journalId, options, context));
  }

  private executeReverseJournal(
    tenantId: string,
    journalId: string,
    options: ReverseJournalOptions,
    context: PostingContext
  ): { originalJournal: JournalEntryDTO; reversalJournal: JournalEntryDTO } {
    const originalEntry = db.findJournalEntryById(tenantId, journalId);
    if (!originalEntry) {
      throw new AccountingValidationError(`Journal entry "${journalId}" not found for tenant "${tenantId}".`, 'NOT_FOUND');
    }

    if (originalEntry.postedStatus !== 'POSTED') {
      throw new AccountingValidationError(
        `Cannot reverse journal entry in "${originalEntry.postedStatus}" status. Only POSTED entries can be reversed.`,
        'INVALID_STATUS_FOR_REVERSAL'
      );
    }

    if (originalEntry.reversedByJournalId) {
      throw new AccountingValidationError(
        `Journal entry "${originalEntry.voucherNumber}" has already been reversed by journal "${originalEntry.reversedByJournalId}". Double reversals are prohibited.`,
        'ALREADY_REVERSED'
      );
    }

    if (!options.reversalReason || options.reversalReason.trim().length < 5) {
      throw new AccountingValidationError(
        'A clear reason for reversal is mandatory (minimum 5 characters).',
        'REVERSAL_REASON_REQUIRED'
      );
    }

    const reversalDate = options.reversalDate || new Date().toISOString().split('T')[0];

    // Period validation for the reversal date
    const periodValidation = periodService.validatePostingPeriod(
      tenantId,
      reversalDate,
      options.isAuthorizedAdjustment || context.isAuthorizedAdjustment,
      context.userRole,
      options.adjustmentReason || context.adjustmentReason || options.reversalReason
    );

    const { financialYear, accountingPeriod, isAuthorizedAdjustment, adjustmentReason } = periodValidation;

    const originalLines = db.getJournalLines(originalEntry.id);
    if (originalLines.length === 0) {
      throw new AccountingValidationError(`No journal lines found for original entry "${journalId}".`, 'CORRUPTED_JOURNAL');
    }

    // Generate exact opposite lines:
    // Original DEBIT -> Reversal CREDIT
    // Original CREDIT -> Reversal DEBIT
    const oppositeLines = originalLines.map((line, idx) => {
      const oppositeDirection: EntryDirection = line.entryDirection === 'DEBIT' ? 'CREDIT' : 'DEBIT';
      const isDebit = oppositeDirection === 'DEBIT';
      return {
        tenantId,
        ledgerId: line.ledgerId,
        ledgerName: line.ledgerName,
        lineNumber: idx + 1,
        entryDirection: oppositeDirection,
        debitAmount: isDebit ? line.amount : '0.00',
        creditAmount: isDebit ? '0.00' : line.amount,
        amount: line.amount,
        narration: `Reversal of [${originalEntry.voucherNumber} line ${line.lineNumber}]: ${options.reversalReason.trim()}`,
        currency: line.currency,
        exchangeRate: line.exchangeRate,
        costCenterId: line.costCenterId,
      };
    });

    const reversalVoucherNumber = `REV-${originalEntry.voucherNumber}`;

    return db.runTransaction((store) => {
      // 1. Insert Reversal Journal Entry & Opposite Lines
      const { entry: reversalEntry, lines: reversalLines } = store.insertJournalWithLines(
        {
          tenantId,
          financialYearId: financialYear.id,
          accountingPeriodId: accountingPeriod.id,
          voucherType: originalEntry.voucherType,
          voucherNumber: reversalVoucherNumber,
          entryDate: reversalDate,
          postingDate: new Date().toISOString(),
          narration: `REVERSAL of ${originalEntry.voucherNumber}: ${options.reversalReason.trim()}`,
          referenceNumber: originalEntry.voucherNumber,
          referenceDate: originalEntry.entryDate,
          postedStatus: 'POSTED',
          totalAmount: originalEntry.totalAmount,
          createdBy: context.userId,
          postedBy: context.userId,
          reversalOfJournalId: originalEntry.id,
          isAdjustment: isAuthorizedAdjustment,
          adjustmentReason: isAuthorizedAdjustment ? adjustmentReason : undefined,
        },
        oppositeLines
      );

      // 2. Mark Original Entry as REVERSED and link to Reversal Entry (NEVER delete)
      const updatedOriginal = store.updateJournalEntry(originalEntry.id, {
        postedStatus: 'REVERSED',
        reversedByJournalId: reversalEntry.id,
      });

      // 3. Atomically Update Projected Ledger Balances with opposite lines
      for (const line of reversalLines) {
        this.applyLineToLedgerBalance(store, tenantId, line.ledgerId, line.entryDirection, line.amount, false);
      }

      // 4. MCA 2013 Statutory Audit Logs for Reversal
      store.appendAuditLog({
        tenantId,
        entityType: 'JOURNAL_ENTRY',
        entityId: originalEntry.id,
        action: 'JOURNAL_REVERSED',
        performedBy: context.userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: {
          originalVoucher: originalEntry.voucherNumber,
          reversalVoucher: reversalEntry.voucherNumber,
          reversalJournalId: reversalEntry.id,
          reason: options.reversalReason.trim(),
        },
      });

      store.appendAuditLog({
        tenantId,
        entityType: 'JOURNAL_ENTRY',
        entityId: reversalEntry.id,
        action: 'REVERSAL_JOURNAL_POSTED',
        performedBy: context.userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: {
          reversalVoucher: reversalEntry.voucherNumber,
          originalVoucher: originalEntry.voucherNumber,
          reversalOfJournalId: originalEntry.id,
          totalAmount: reversalEntry.totalAmount,
          reason: options.reversalReason.trim(),
        },
      });

      return {
        originalJournal: this.mapToDTO(updatedOriginal || originalEntry, originalLines),
        reversalJournal: this.mapToDTO(reversalEntry, reversalLines),
      };
    });
  }

  /**
   * Applies line item financial impact to running ledger balance
   */
  private applyLineToLedgerBalance(
    store: typeof db,
    tenantId: string,
    ledgerId: string,
    direction: EntryDirection,
    amountStr: string,
    isReverting: boolean
  ): void {
    const ledger = store.findLedgerAccountById(tenantId, ledgerId);
    if (!ledger) return;

    const currentBal = FinancialAmount.from(ledger.currentBalance || ledger.openingBalance || '0.00');
    const amt = FinancialAmount.from(amountStr);

    let newBal: FinancialAmount;

    // Golden Rule of Ledger Balance Direction:
    // ASSET & EXPENSE (Normal Balance: DEBIT):
    // Balance = Opening + SUM(Debits) - SUM(Credits)
    // LIABILITY, EQUITY & REVENUE (Normal Balance: CREDIT):
    // Balance = Opening + SUM(Credits) - SUM(Debits)
    if (ledger.normalBalance === 'DEBIT') {
      if (!isReverting) {
        newBal = direction === 'DEBIT' ? currentBal.add(amt) : currentBal.subtract(amt);
      } else {
        newBal = direction === 'DEBIT' ? currentBal.subtract(amt) : currentBal.add(amt);
      }
    } else {
      if (!isReverting) {
        newBal = direction === 'CREDIT' ? currentBal.add(amt) : currentBal.subtract(amt);
      } else {
        newBal = direction === 'CREDIT' ? currentBal.subtract(amt) : currentBal.add(amt);
      }
    }

    store.updateLedgerAccountBalance(tenantId, ledgerId, newBal.toString(2));
  }

  /**
   * Generates next sequential voucher number
   */
  private generateVoucherNumber(tenantId: string, fyId: string, voucherType: VoucherType): string {
    const existing = db.getJournalEntries(tenantId, { voucherType })
      .filter((j) => j.financialYearId === fyId);
    const seq = existing.length + 1;
    const prefixMap: Record<VoucherType, string> = {
      JOURNAL: 'JV',
      PAYMENT: 'PMT',
      RECEIPT: 'RCT',
      CONTRA: 'CNT',
      SALES: 'INV',
      PURCHASE: 'PUR',
      DEBIT_NOTE: 'DN',
      CREDIT_NOTE: 'CN',
    };
    const prefix = prefixMap[voucherType] || 'VCH';
    return `${prefix}-${seq.toString().padStart(4, '0')}`;
  }

  // --- Financial Source-of-Truth Projections ---

  /**
   * Computes the complete Trial Balance directly from underlying posted journal lines.
   * Proves mathematically that Total Debits === Total Credits across all ledgers.
   */
  public getTrialBalance(tenantId: string, asOfDate?: string): TrialBalanceDTO {
    const ledgers = db.getChartOfAccounts(tenantId);
    const entries = db.getJournalEntries(tenantId, {
      status: 'POSTED',
      toDate: asOfDate,
    });

    const entryIds = new Set(entries.map((e) => e.id));
    const allLines = db.schema.journalLines.filter((l) => l.tenantId === tenantId && entryIds.has(l.journalEntryId));

    let grandTotalDebit = FinancialAmount.zero();
    let grandTotalCredit = FinancialAmount.zero();

    const rows: TrialBalanceRowDTO[] = [];

    for (const ledger of ledgers) {
      const ledgerLines = allLines.filter((l) => l.ledgerId === ledger.id);

      let totalDr = FinancialAmount.zero();
      let totalCr = FinancialAmount.zero();

      // Incorporate opening balance
      const opAmt = FinancialAmount.from(ledger.openingBalance || '0.00');
      if (ledger.openingBalanceType === 'DEBIT') {
        totalDr = totalDr.add(opAmt);
      } else {
        totalCr = totalCr.add(opAmt);
      }

      for (const line of ledgerLines) {
        const lineAmt = FinancialAmount.from(line.amount);
        if (line.entryDirection === 'DEBIT') {
          totalDr = totalDr.add(lineAmt);
        } else {
          totalCr = totalCr.add(lineAmt);
        }
      }

      // Net balance determination
      let netDebit = FinancialAmount.zero();
      let netCredit = FinancialAmount.zero();

      if (totalDr.compareTo(totalCr) > 0) {
        netDebit = totalDr.subtract(totalCr);
      } else if (totalCr.compareTo(totalDr) > 0) {
        netCredit = totalCr.subtract(totalDr);
      }

      grandTotalDebit = grandTotalDebit.add(netDebit);
      grandTotalCredit = grandTotalCredit.add(netCredit);

      rows.push({
        ledgerId: ledger.id,
        ledgerCode: ledger.code,
        ledgerName: ledger.name,
        groupName: ledger.groupName,
        classification: ledger.classification,
        debit: netDebit.toString(2),
        credit: netCredit.toString(2),
      });
    }

    return {
      tenantId,
      asOfDate: asOfDate || new Date().toISOString().split('T')[0],
      rows,
      totalDebit: grandTotalDebit.toString(2),
      totalCredit: grandTotalCredit.toString(2),
      isBalanced: grandTotalDebit.equals(grandTotalCredit),
    };
  }

  /**
   * Generates chronologically running statement of account for any ledger
   */
  public getLedgerStatement(
    tenantId: string,
    ledgerId: string,
    fromDate?: string,
    toDate?: string
  ): LedgerStatementDTO {
    const ledger = db.findLedgerAccountById(tenantId, ledgerId);
    if (!ledger) {
      throw new AccountingValidationError(`Ledger "${ledgerId}" not found.`, 'NOT_FOUND');
    }

    const postedJournals = db.getJournalEntries(tenantId, { status: 'POSTED' })
      .filter((j) => {
        if (fromDate && j.entryDate < fromDate) return false;
        if (toDate && j.entryDate > toDate) return false;
        return true;
      })
      .sort((a, b) => a.entryDate.localeCompare(b.entryDate));

    const journalMap = new Map(postedJournals.map((j) => [j.id, j]));

    const lines = db.getJournalLinesForLedger(tenantId, ledgerId)
      .filter((l) => journalMap.has(l.journalEntryId))
      .sort((a, b) => {
        const jA = journalMap.get(a.journalEntryId)!;
        const jB = journalMap.get(b.journalEntryId)!;
        return jA.entryDate.localeCompare(jB.entryDate) || a.lineNumber - b.lineNumber;
      });

    let runningBal = FinancialAmount.from(ledger.openingBalance || '0.00');
    let totalDebits = FinancialAmount.zero();
    let totalCredits = FinancialAmount.zero();

    const statementLines: LedgerStatementLine[] = [];

    for (const line of lines) {
      const journal = journalMap.get(line.journalEntryId)!;
      const amt = FinancialAmount.from(line.amount);

      const isDebit = line.entryDirection === 'DEBIT';
      if (isDebit) {
        totalDebits = totalDebits.add(amt);
      } else {
        totalCredits = totalCredits.add(amt);
      }

      if (ledger.normalBalance === 'DEBIT') {
        runningBal = isDebit ? runningBal.add(amt) : runningBal.subtract(amt);
      } else {
        runningBal = !isDebit ? runningBal.add(amt) : runningBal.subtract(amt);
      }

      const balDirection: EntryDirection = runningBal.compareTo('0.00') >= 0
        ? ledger.normalBalance
        : ledger.normalBalance === 'DEBIT' ? 'CREDIT' : 'DEBIT';

      statementLines.push({
        journalEntryId: journal.id,
        voucherNumber: journal.voucherNumber,
        voucherType: journal.voucherType,
        date: journal.entryDate,
        narration: line.narration || journal.narration,
        referenceNumber: journal.referenceNumber,
        debit: isDebit ? amt.toString(2) : '0.00',
        credit: !isDebit ? amt.toString(2) : '0.00',
        runningBalance: runningBal.abs().toString(2),
        runningBalanceType: balDirection,
      });
    }

    const closingDirection: EntryDirection = runningBal.compareTo('0.00') >= 0
      ? ledger.normalBalance
      : ledger.normalBalance === 'DEBIT' ? 'CREDIT' : 'DEBIT';

    return {
      ledger: {
        id: ledger.id,
        tenantId: ledger.tenantId,
        groupId: ledger.groupId,
        groupName: ledger.groupName,
        code: ledger.code,
        name: ledger.name,
        classification: ledger.classification,
        normalBalance: ledger.normalBalance,
        openingBalance: ledger.openingBalance,
        openingBalanceType: ledger.openingBalanceType,
        currentBalance: runningBal.abs().toString(2),
        isActive: ledger.isActive,
        createdAt: ledger.createdAt,
        updatedAt: ledger.updatedAt,
      },
      periodStart: fromDate || ledger.createdAt.split('T')[0],
      periodEnd: toDate || new Date().toISOString().split('T')[0],
      openingBalance: ledger.openingBalance,
      openingBalanceType: ledger.openingBalanceType,
      lines: statementLines,
      totalDebits: totalDebits.toString(2),
      totalCredits: totalCredits.toString(2),
      closingBalance: runningBal.abs().toString(2),
      closingBalanceType: closingDirection,
    };
  }

  // --- Helpers ---
  public getJournalById(tenantId: string, id: string): JournalEntryDTO | undefined {
    const entry = db.findJournalEntryById(tenantId, id);
    if (!entry) return undefined;
    const lines = db.getJournalLines(entry.id);
    return this.mapToDTO(entry, lines);
  }

  public getJournals(
    tenantId: string,
    filters?: {
      status?: string;
      voucherType?: string;
      fromDate?: string;
      toDate?: string;
      reversalOfJournalId?: string;
    }
  ): JournalEntryDTO[] {
    const entries = db.getJournalEntries(tenantId, filters);
    return entries.map((e) => {
      const lines = db.getJournalLines(e.id);
      return this.mapToDTO(e, lines);
    });
  }

  private mapToDTO(entry: JournalEntryRecord, lines: JournalLineRecord[]): JournalEntryDTO {
    return {
      id: entry.id,
      tenantId: entry.tenantId,
      voucherType: entry.voucherType,
      voucherNumber: entry.voucherNumber,
      entryDate: entry.entryDate,
      postingDate: entry.postingDate,
      financialYearId: entry.financialYearId,
      accountingPeriodId: entry.accountingPeriodId,
      narration: entry.narration,
      referenceNumber: entry.referenceNumber,
      referenceDate: entry.referenceDate,
      sourceDocument: entry.sourceDocument,
      postedStatus: entry.postedStatus,
      totalAmount: entry.totalAmount,
      createdBy: entry.createdBy,
      postedBy: entry.postedBy,
      reversalOfJournalId: entry.reversalOfJournalId,
      reversedByJournalId: entry.reversedByJournalId,
      isAdjustment: entry.isAdjustment,
      adjustmentReason: entry.adjustmentReason,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      lines: lines.map((l) => ({
        id: l.id,
        journalEntryId: l.journalEntryId,
        tenantId: l.tenantId,
        lineNumber: l.lineNumber,
        ledgerId: l.ledgerId,
        ledgerName: l.ledgerName,
        entryDirection: l.entryDirection,
        debitAmount: l.debitAmount,
        creditAmount: l.creditAmount,
        amount: l.amount,
        narration: l.narration,
        currency: l.currency,
        exchangeRate: l.exchangeRate,
        costCenterId: l.costCenterId,
      })),
    };
  }
}

export const postingService = new PostingService();
