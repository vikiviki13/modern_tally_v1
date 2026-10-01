/**
 * Comprehensive Automated Test Suite: Phase 06 Double-Entry Accounting Engine
 *
 * Test Matrix:
 * 1. Balanced Journal Posting (Luca Pacioli invariant, atomic entry + lines + audit log)
 * 2. Unbalanced Journal Rejection (Total Debits != Total Credits fails before persistence)
 * 3. Zero Amount Rejection (Lines with 0.00 amount are strictly prohibited)
 * 4. Negative Amount Rejection (Lines with negative amounts are strictly prohibited)
 * 5. Multiple Debit Lines (Compound journal: Multiple debits matching single credit)
 * 6. Multiple Credit Lines (Compound journal: Single debit matching multiple credits)
 * 7. Closed Period Controls (Blocks regular posting into closed FY, locked period, or prior to freeze date)
 * 8. Authorized Adjustment Workflow (Auditor role with documented reason successfully posts into locked period)
 * 9. Duplicate Posting Prevention (Blocks duplicate voucher numbers within the same financial year)
 * 10. Concurrent Posting Safety (Tenant mutex guarantees serial atomic execution without race conditions)
 * 11. Failed Database Transaction (Atomicity rollback: DB error leaves zero orphan entries or mutated balances)
 * 12. Reversal Engine (Generates exact opposite lines, preserves original with REVERSED status, zero deletions)
 * 13. Double Reversal Prevention (Prevents reversing an already reversed transaction)
 * 14. Financial Precision & Exact Arithmetic (No floating-point drift; exact 0.1 + 0.2 = 0.30)
 * 15. Centralized Rounding Algorithms (ROUND_HALF_UP and ROUND_HALF_EVEN Banker's rounding)
 * 16. Trial Balance Verification (Single financial source of truth: Total Ledger Debits === Total Ledger Credits)
 * 17. Ledger Statement of Account (Running balance and direction calculation)
 * 18. Multi-Tenant Ledger Isolation (Rejects cross-tenant account referencing)
 */

import { postingService, AccountingValidationError, AccountingBalanceError, DuplicateVoucherError } from '../server/domain/accounting/postingService';
import { periodService, AccountingPeriodError } from '../server/domain/accounting/periodService';
import { FinancialAmount } from '../server/domain/accounting/precision';
import { db } from '../server/db/store';
import { PostingContext, PostJournalPayload } from '../shared/types/accounting';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

export async function runAccountingTests(): Promise<{
  passed: boolean;
  total: number;
  passedCount: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];

  async function record(name: string, category: string, fn: () => void | Promise<void>) {
    const start = performance.now();
    try {
      await fn();
      results.push({
        name,
        category,
        passed: true,
        message: 'Assertion passed successfully',
        durationMs: Math.round((performance.now() - start) * 100) / 100,
      });
    } catch (err: unknown) {
      results.push({
        name,
        category,
        passed: false,
        message: err instanceof Error ? err.message : String(err),
        durationMs: Math.round((performance.now() - start) * 100) / 100,
      });
    }
  }

  db.resetToCleanState();

  const tenantId = '018f92a1-7c4a-71b3-8fa9-715d2a901f01'; // Apex Horizon
  const tenantPrefix = tenantId.substring(0, 8);
  const bankLedgerId = `ledg-${tenantPrefix}-bank`;
  const rentLedgerId = `ledg-${tenantPrefix}-rent`;
  const salesLedgerId = `ledg-${tenantPrefix}-sales`;
  const debtorLedgerId = `ledg-${tenantPrefix}-debtors`;
  const creditorLedgerId = `ledg-${tenantPrefix}-creditors`;
  const cgstInLedgerId = `ledg-${tenantPrefix}-cgst-in`;
  const sgstInLedgerId = `ledg-${tenantPrefix}-sgst-in`;
  const cgstOutLedgerId = `ledg-${tenantPrefix}-cgst-out`;
  const sgstOutLedgerId = `ledg-${tenantPrefix}-sgst-out`;

  const accountantContext: PostingContext = {
    userId: '018f92a1-7c4a-71b3-8fa9-715d2a901e01',
    userRole: 'SR_ACCOUNTANT',
    ipAddress: '192.168.1.100',
    userAgent: 'LedgerPulse-Core/1.0',
  };

  const auditorContext: PostingContext = {
    userId: '018f92a1-7c4a-71b3-8fa9-715d2a901e01',
    userRole: 'AUDITOR',
    ipAddress: '192.168.1.101',
    userAgent: 'LedgerPulse-Auditor/1.0',
    isAuthorizedAdjustment: true,
    adjustmentReason: 'Year-end statutory audit adjustment entry per ICAI Standard AS-5.',
  };

  // ------------------------------------------------------------------------
  // 1. Balanced Journal Posting
  // ------------------------------------------------------------------------
  await record('Balanced Journal: Successfully posts valid double-entry transaction', 'Core Double-Entry', async () => {
    const payload: PostJournalPayload = {
      voucherType: 'PAYMENT',
      entryDate: '2026-08-15', // Open period (August 2026)
      narration: 'Office rent payment for August 2026 via HDFC Bank NEFT',
      referenceNumber: 'NEFT-889912',
      lines: [
        {
          ledgerId: rentLedgerId,
          entryDirection: 'DEBIT',
          amount: '45000.00',
          narration: 'Office Rent - Andheri East premises',
        },
        {
          ledgerId: bankLedgerId,
          entryDirection: 'CREDIT',
          amount: '45000.00',
          narration: 'HDFC Current A/c - NEFT payment',
        },
      ],
    };

    const journal = await postingService.postJournal(tenantId, payload, accountantContext);
    if (!journal.id) throw new Error('Expected journal.id to be generated');
    if (journal.postedStatus !== 'POSTED') throw new Error(`Expected status POSTED, got ${journal.postedStatus}`);
    if (journal.totalAmount !== '45000.00') throw new Error(`Expected totalAmount 45000.00, got ${journal.totalAmount}`);
    if (journal.lines.length !== 2) throw new Error(`Expected 2 lines, got ${journal.lines.length}`);

    // Verify Audit Log
    const logs = db.getAuditLogs(tenantId, journal.id);
    if (logs.length === 0) throw new Error('Expected MCA audit log record to be created');
    if (logs[0].action !== 'JOURNAL_POSTED') throw new Error(`Unexpected audit action: ${logs[0].action}`);
  });

  // ------------------------------------------------------------------------
  // 2. Unbalanced Journal Rejection
  // ------------------------------------------------------------------------
  await record('Unbalanced Journal: Strictly rejects posting when Debits != Credits', 'Luca Pacioli Invariant', async () => {
    const payload: PostJournalPayload = {
      voucherType: 'JOURNAL',
      entryDate: '2026-08-16',
      narration: 'Erroneous unbalanced entry attempt',
      lines: [
        {
          ledgerId: rentLedgerId,
          entryDirection: 'DEBIT',
          amount: '10000.00',
        },
        {
          ledgerId: bankLedgerId,
          entryDirection: 'CREDIT',
          amount: '9500.00', // ₹ 500 discrepancy
        },
      ],
    };

    let caught = false;
    try {
      await postingService.postJournal(tenantId, payload, accountantContext);
    } catch (err) {
      if (err instanceof AccountingBalanceError && err.code === 'UNBALANCED_JOURNAL') {
        caught = true;
      }
    }
    if (!caught) throw new Error('Expected AccountingBalanceError (UNBALANCED_JOURNAL) was not thrown');
  });

  // ------------------------------------------------------------------------
  // 3. Zero Amount Rejection
  // ------------------------------------------------------------------------
  await record('Zero Amount: Strictly rejects journal line with 0.00 amount', 'Validation', async () => {
    const payload: PostJournalPayload = {
      voucherType: 'JOURNAL',
      entryDate: '2026-08-16',
      narration: 'Zero amount line attempt',
      lines: [
        {
          ledgerId: rentLedgerId,
          entryDirection: 'DEBIT',
          amount: '0.00',
        },
        {
          ledgerId: bankLedgerId,
          entryDirection: 'CREDIT',
          amount: '0.00',
        },
      ],
    };

    let caught = false;
    try {
      await postingService.postJournal(tenantId, payload, accountantContext);
    } catch (err) {
      if (err instanceof AccountingValidationError && err.code === 'ZERO_AMOUNT_PROHIBITED') {
        caught = true;
      }
    }
    if (!caught) throw new Error('Expected AccountingValidationError (ZERO_AMOUNT_PROHIBITED) was not thrown');
  });

  // ------------------------------------------------------------------------
  // 4. Negative Amount Rejection
  // ------------------------------------------------------------------------
  await record('Negative Amount: Strictly rejects journal line with negative amount', 'Validation', async () => {
    const payload: PostJournalPayload = {
      voucherType: 'JOURNAL',
      entryDate: '2026-08-16',
      narration: 'Negative amount line attempt',
      lines: [
        {
          ledgerId: rentLedgerId,
          entryDirection: 'DEBIT',
          amount: '-5000.00',
        },
        {
          ledgerId: bankLedgerId,
          entryDirection: 'CREDIT',
          amount: '-5000.00',
        },
      ],
    };

    let caught = false;
    try {
      await postingService.postJournal(tenantId, payload, accountantContext);
    } catch (err) {
      if (err instanceof AccountingValidationError && err.code === 'NEGATIVE_AMOUNT_PROHIBITED') {
        caught = true;
      }
    }
    if (!caught) throw new Error('Expected AccountingValidationError (NEGATIVE_AMOUNT_PROHIBITED) was not thrown');
  });

  // ------------------------------------------------------------------------
  // 5. Multiple Debit Lines (Compound Entry)
  // ------------------------------------------------------------------------
  await record('Multiple Debit Lines: Compound entry with 3 debits matching 1 credit', 'Compound Entries', async () => {
    // ₹ 50,000 Rent + ₹ 4,500 CGST + ₹ 4,500 SGST = ₹ 59,000 Total Bank Credit
    const payload: PostJournalPayload = {
      voucherType: 'PAYMENT',
      entryDate: '2026-09-01',
      narration: 'Office Rent with GST input tax credit',
      referenceNumber: 'INV-RENT-SEP26',
      lines: [
        {
          ledgerId: rentLedgerId,
          entryDirection: 'DEBIT',
          amount: '50000.00',
          narration: 'Base Rent Expense',
        },
        {
          ledgerId: cgstInLedgerId,
          entryDirection: 'DEBIT',
          amount: '4500.00',
          narration: 'CGST 9% Input Tax Credit',
        },
        {
          ledgerId: sgstInLedgerId,
          entryDirection: 'DEBIT',
          amount: '4500.00',
          narration: 'SGST 9% Input Tax Credit',
        },
        {
          ledgerId: bankLedgerId,
          entryDirection: 'CREDIT',
          amount: '59000.00',
          narration: 'Total Payment through HDFC Bank',
        },
      ],
    };

    const journal = await postingService.postJournal(tenantId, payload, accountantContext);
    if (journal.lines.length !== 4) throw new Error(`Expected 4 lines, got ${journal.lines.length}`);
    if (journal.totalAmount !== '59000.00') throw new Error(`Expected total 59000.00, got ${journal.totalAmount}`);

    const debitLines = journal.lines.filter((l) => l.entryDirection === 'DEBIT');
    if (debitLines.length !== 3) throw new Error(`Expected 3 debit lines, got ${debitLines.length}`);
  });

  // ------------------------------------------------------------------------
  // 6. Multiple Credit Lines (Compound Entry)
  // ------------------------------------------------------------------------
  await record('Multiple Credit Lines: Compound entry with 1 debit matching 3 credits', 'Compound Entries', async () => {
    // ₹ 1,18,000 Debtor = ₹ 1,00,000 Revenue + ₹ 9,000 CGST Output + ₹ 9,000 SGST Output
    const payload: PostJournalPayload = {
      voucherType: 'SALES',
      entryDate: '2026-09-10',
      narration: 'Tax Invoice raised for Enterprise SaaS License with 18% GST',
      referenceNumber: 'INV/2026/0045',
      lines: [
        {
          ledgerId: debtorLedgerId,
          entryDirection: 'DEBIT',
          amount: '118000.00',
          narration: 'Total receivable from Acme Corp',
        },
        {
          ledgerId: salesLedgerId,
          entryDirection: 'CREDIT',
          amount: '100000.00',
          narration: 'Taxable Service Revenue',
        },
        {
          ledgerId: cgstOutLedgerId,
          entryDirection: 'CREDIT',
          amount: '9000.00',
          narration: 'CGST 9% Output Tax Liability',
        },
        {
          ledgerId: sgstOutLedgerId,
          entryDirection: 'CREDIT',
          amount: '9000.00',
          narration: 'SGST 9% Output Tax Liability',
        },
      ],
    };

    const journal = await postingService.postJournal(tenantId, payload, accountantContext);
    if (journal.lines.length !== 4) throw new Error(`Expected 4 lines, got ${journal.lines.length}`);
    if (journal.totalAmount !== '118000.00') throw new Error(`Expected total 118000.00, got ${journal.totalAmount}`);

    const creditLines = journal.lines.filter((l) => l.entryDirection === 'CREDIT');
    if (creditLines.length !== 3) throw new Error(`Expected 3 credit lines, got ${creditLines.length}`);
  });

  // ------------------------------------------------------------------------
  // 7. Closed Period Controls
  // ------------------------------------------------------------------------
  await record('Closed Period: Rejects regular posting into locked accounting period', 'Period Controls', async () => {
    // April 2026 is locked in our seeded accounting periods
    const payload: PostJournalPayload = {
      voucherType: 'PAYMENT',
      entryDate: '2026-04-15', // Locked period
      narration: 'Attempted backdated entry in locked period',
      lines: [
        { ledgerId: rentLedgerId, entryDirection: 'DEBIT', amount: '12000.00' },
        { ledgerId: bankLedgerId, entryDirection: 'CREDIT', amount: '12000.00' },
      ],
    };

    let caught = false;
    try {
      await postingService.postJournal(tenantId, payload, accountantContext);
    } catch (err) {
      if (err instanceof AccountingPeriodError && (err.code === 'ACCOUNTING_PERIOD_LOCKED' || err.code === 'FREEZE_DATE_BREACH')) {
        caught = true;
      }
    }
    if (!caught) throw new Error('Expected AccountingPeriodError (ACCOUNTING_PERIOD_LOCKED or FREEZE_DATE_BREACH) was not thrown');
  });

  // ------------------------------------------------------------------------
  // 8. Authorized Adjustment Workflow
  // ------------------------------------------------------------------------
  await record('Authorized Adjustment: Permits Auditor to post into locked period with documented justification', 'Period Controls', async () => {
    const payload: PostJournalPayload = {
      voucherType: 'JOURNAL',
      entryDate: '2026-04-30', // In locked period (April 2026)
      narration: 'Auditor year-end depreciation adjustment per statutory audit findings',
      isAuthorizedAdjustment: true,
      adjustmentReason: 'Statutory auditor recognized additional depreciation provision under Section 32 of Income Tax Act.',
      lines: [
        { ledgerId: rentLedgerId, entryDirection: 'DEBIT', amount: '7500.00' },
        { ledgerId: bankLedgerId, entryDirection: 'CREDIT', amount: '7500.00' },
      ],
    };

    const journal = await postingService.postJournal(tenantId, payload, auditorContext);
    if (!journal.isAdjustment) throw new Error('Expected isAdjustment to be true');
    if (!journal.adjustmentReason) throw new Error('Expected adjustmentReason to be populated');

    // Verify statutory audit log
    const logs = db.getAuditLogs(tenantId, journal.id);
    const auditRecord = logs.find((l) => l.action === 'STATUTORY_ADJUSTMENT_POSTED');
    if (!auditRecord) throw new Error('Expected STATUTORY_ADJUSTMENT_POSTED audit log record');
  });

  // ------------------------------------------------------------------------
  // 9. Duplicate Posting Prevention
  // ------------------------------------------------------------------------
  await record('Duplicate Posting: Strictly rejects posting with identical voucher number in same FY', 'Integrity', async () => {
    const uniqueVoucherNumber = `VCH-DUP-${Date.now()}`;

    const payload: PostJournalPayload = {
      voucherType: 'PAYMENT',
      voucherNumber: uniqueVoucherNumber,
      entryDate: '2026-09-15',
      narration: 'First legitimate posting',
      lines: [
        { ledgerId: rentLedgerId, entryDirection: 'DEBIT', amount: '5000.00' },
        { ledgerId: bankLedgerId, entryDirection: 'CREDIT', amount: '5000.00' },
      ],
    };

    // First post must succeed
    await postingService.postJournal(tenantId, payload, accountantContext);

    // Second post with identical voucherNumber must fail
    let caught = false;
    try {
      await postingService.postJournal(tenantId, payload, accountantContext);
    } catch (err) {
      if (err instanceof DuplicateVoucherError && err.code === 'DUPLICATE_VOUCHER') {
        caught = true;
      }
    }
    if (!caught) throw new Error('Expected DuplicateVoucherError (DUPLICATE_VOUCHER) was not thrown');
  });

  // ------------------------------------------------------------------------
  // 10. Concurrent Posting Safety
  // ------------------------------------------------------------------------
  await record('Concurrent Posting: Processes multiple parallel postings atomically without race conditions', 'Concurrency', async () => {
    const initialBankBal = FinancialAmount.from(db.findLedgerAccountById(tenantId, bankLedgerId)!.currentBalance);

    // Launch 5 concurrent postings simultaneously
    const tasks = Array.from({ length: 5 }, (_, i) => {
      const p: PostJournalPayload = {
        voucherType: 'PAYMENT',
        entryDate: '2026-09-20',
        narration: `Concurrent payment test transaction ${i + 1}`,
        lines: [
          { ledgerId: rentLedgerId, entryDirection: 'DEBIT', amount: '1000.00' },
          { ledgerId: bankLedgerId, entryDirection: 'CREDIT', amount: '1000.00' },
        ],
      };
      return postingService.postJournal(tenantId, p, accountantContext);
    });

    const results = await Promise.all(tasks);
    if (results.length !== 5) throw new Error('Expected 5 successful results');

    // Verify all 5 have unique voucher numbers
    const vchNumbers = new Set(results.map((r) => r.voucherNumber));
    if (vchNumbers.size !== 5) throw new Error('Voucher numbers collided under concurrent posting');

    // Verify bank balance was debited by exactly ₹ 5,000.00
    const finalBankBal = FinancialAmount.from(db.findLedgerAccountById(tenantId, bankLedgerId)!.currentBalance);
    const expectedBal = initialBankBal.subtract('5000.00');
    if (!finalBankBal.equals(expectedBal)) {
      throw new Error(`Bank balance mismatch after concurrent postings. Expected ${expectedBal.toString(2)}, got ${finalBankBal.toString(2)}`);
    }
  });

  // ------------------------------------------------------------------------
  // 11. Failed Database Transaction (Atomicity & Complete Rollback)
  // ------------------------------------------------------------------------
  await record('Failed DB Transaction: Rollback guarantees zero orphan records or corrupted balances', 'Atomicity', async () => {
    const preCountJournals = db.schema.journalEntries.length;
    const preCountLines = db.schema.journalLines.length;
    const preRentBalance = db.findLedgerAccountById(tenantId, rentLedgerId)!.currentBalance;

    let transactionFailed = false;
    try {
      db.runTransaction((store) => {
        // Simulate partial insertion of journal and line
        store.schema.journalEntries.push({
          id: 'phantom-entry-id',
          tenantId,
          financialYearId: 'fy-dummy',
          accountingPeriodId: 'per-dummy',
          voucherType: 'JOURNAL',
          voucherNumber: 'PHANTOM-001',
          entryDate: '2026-09-25',
          postingDate: new Date().toISOString(),
          narration: 'Phantom Entry',
          postedStatus: 'POSTED',
          totalAmount: '9999.00',
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Simulate modifying ledger balance
        store.updateLedgerAccountBalance(tenantId, rentLedgerId, '999999.99');

        // Simulate a critical database constraint crash mid-transaction
        throw new Error('SIMULATED_DATABASE_IO_FAILURE_DISK_FULL');
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'SIMULATED_DATABASE_IO_FAILURE_DISK_FULL') {
        transactionFailed = true;
      }
    }

    if (!transactionFailed) throw new Error('Expected simulated failure was not triggered');

    // Confirm complete rollback: Zero phantom journals, zero phantom lines, rent balance perfectly intact
    if (db.schema.journalEntries.length !== preCountJournals) {
      throw new Error('Atomicity violation: Phantom journal entry leaked into database despite transaction failure');
    }
    if (db.schema.journalLines.length !== preCountLines) {
      throw new Error('Atomicity violation: Phantom lines leaked into database');
    }
    const postRentBalance = db.findLedgerAccountById(tenantId, rentLedgerId)!.currentBalance;
    if (postRentBalance !== preRentBalance) {
      throw new Error(`Atomicity violation: Ledger balance mutated despite transaction failure. Pre: ${preRentBalance}, Post: ${postRentBalance}`);
    }
  });

  // ------------------------------------------------------------------------
  // 12. Reversal Engine
  // ------------------------------------------------------------------------
  let postedJournalForReversalId = '';

  await record('Reversal Engine: Generates exact opposite entries, preserves original with REVERSED status', 'Reversal', async () => {
    // 1. Post original payment of ₹ 25,000.00
    const originalPayload: PostJournalPayload = {
      voucherType: 'PAYMENT',
      entryDate: '2026-09-22',
      narration: 'Advance payment to vendor made in error',
      lines: [
        { ledgerId: creditorLedgerId, entryDirection: 'DEBIT', amount: '25000.00', narration: 'Vendor debit' },
        { ledgerId: bankLedgerId, entryDirection: 'CREDIT', amount: '25000.00', narration: 'Bank credit' },
      ],
    };

    const originalJournal = await postingService.postJournal(tenantId, originalPayload, accountantContext);
    postedJournalForReversalId = originalJournal.id;

    const bankBeforeReversal = db.findLedgerAccountById(tenantId, bankLedgerId)!.currentBalance;

    // 2. Execute Reversal
    const { originalJournal: reversedOriginal, reversalJournal } = await postingService.reverseJournal(
      tenantId,
      originalJournal.id,
      {
        reversalReason: 'Wrong vendor account selected. Reversing for reissue.',
        reversalDate: '2026-09-23',
      },
      accountantContext
    );

    // Assert original entry is preserved with status REVERSED and linked
    if (reversedOriginal.postedStatus !== 'REVERSED') {
      throw new Error(`Expected original status REVERSED, got ${reversedOriginal.postedStatus}`);
    }
    if (reversedOriginal.reversedByJournalId !== reversalJournal.id) {
      throw new Error('Original journal reversedByJournalId was not set');
    }

    // Assert reversal entry is POSTED and linked to original
    if (reversalJournal.postedStatus !== 'POSTED') {
      throw new Error(`Expected reversal status POSTED, got ${reversalJournal.postedStatus}`);
    }
    if (reversalJournal.reversalOfJournalId !== originalJournal.id) {
      throw new Error('Reversal journal reversalOfJournalId was not set');
    }

    // Assert opposite line directions:
    // Original had DEBIT Creditor, CREDIT Bank
    // Reversal must have CREDIT Creditor, DEBIT Bank
    const bankLine = reversalJournal.lines.find((l) => l.ledgerId === bankLedgerId)!;
    const creditorLine = reversalJournal.lines.find((l) => l.ledgerId === creditorLedgerId)!;

    if (bankLine.entryDirection !== 'DEBIT') throw new Error(`Expected bank line to be DEBIT, got ${bankLine.entryDirection}`);
    if (creditorLine.entryDirection !== 'CREDIT') throw new Error(`Expected creditor line to be CREDIT, got ${creditorLine.entryDirection}`);

    // Assert bank balance is restored back by ₹ 25,000.00
    const bankAfterReversal = db.findLedgerAccountById(tenantId, bankLedgerId)!.currentBalance;
    const expectedBank = FinancialAmount.from(bankBeforeReversal).add('25000.00').toString(2);
    if (bankAfterReversal !== expectedBank) {
      throw new Error(`Expected bank balance ${expectedBank}, got ${bankAfterReversal}`);
    }
  });

  // ------------------------------------------------------------------------
  // 13. Double Reversal Prevention
  // ------------------------------------------------------------------------
  await record('Double Reversal Prevention: Rejects subsequent reversal attempt on already reversed entry', 'Reversal', async () => {
    let caught = false;
    try {
      await postingService.reverseJournal(
        tenantId,
        postedJournalForReversalId,
        { reversalReason: 'Second reversal attempt should fail' },
        accountantContext
      );
    } catch (err) {
      if (err instanceof AccountingValidationError && err.code === 'INVALID_STATUS_FOR_REVERSAL') {
        caught = true;
      }
    }
    if (!caught) throw new Error('Expected AccountingValidationError (INVALID_STATUS_FOR_REVERSAL) was not thrown');
  });

  // ------------------------------------------------------------------------
  // 14. Financial Precision & Exact Decimal Arithmetic
  // ------------------------------------------------------------------------
  await record('Financial Precision: Avoids binary float drift (exact 0.1 + 0.2 = 0.30)', 'Financial Precision', () => {
    const a = FinancialAmount.from('0.1');
    const b = FinancialAmount.from('0.2');
    const sum = a.add(b);

    if (sum.toString(2) !== '0.30') {
      throw new Error(`Float drift detected: expected 0.30, got ${sum.toString(2)}`);
    }

    // Multiply: 125.55 * 0.18 (18% GST) = 22.599 -> rounded 22.60
    const base = FinancialAmount.from('125.55');
    const rate = FinancialAmount.from('0.18');
    const tax = base.multiply(rate);
    if (tax.toString(2) !== '22.60') {
      throw new Error(`Tax calculation mismatch: expected 22.60, got ${tax.toString(2)}`);
    }

    // High value precision without loss
    const crore = FinancialAmount.from('100000000.55');
    const addition = FinancialAmount.from('0.45');
    const croreSum = crore.add(addition);
    if (croreSum.toString(2) !== '100000001.00') {
      throw new Error(`Crore precision loss: expected 100000001.00, got ${croreSum.toString(2)}`);
    }
  });

  // ------------------------------------------------------------------------
  // 15. Centralized Rounding Algorithms
  // ------------------------------------------------------------------------
  await record('Centralized Rounding: Validates ROUND_HALF_UP and Banker\'s ROUND_HALF_EVEN', 'Financial Precision', () => {
    // ROUND_HALF_UP (Commercial)
    const val1 = FinancialAmount.from('125.555');
    if (val1.round(2, 'ROUND_HALF_UP').toString(2) !== '125.56') {
      throw new Error('Half up 125.555 failed');
    }
    const val2 = FinancialAmount.from('125.554');
    if (val2.round(2, 'ROUND_HALF_UP').toString(2) !== '125.55') {
      throw new Error('Half up 125.554 failed');
    }

    // Banker's Rounding: 2.5 rounds to 2 (even), 3.5 rounds to 4 (even)
    const bank1 = FinancialAmount.from('2.5').round(0, 'ROUND_HALF_EVEN').toString(0);
    const bank2 = FinancialAmount.from('3.5').round(0, 'ROUND_HALF_EVEN').toString(0);
    if (bank1 !== '2') throw new Error(`Banker's rounding 2.5 expected 2, got ${bank1}`);
    if (bank2 !== '4') throw new Error(`Banker's rounding 3.5 expected 4, got ${bank2}`);
  });

  // ------------------------------------------------------------------------
  // 16. Trial Balance Verification
  // ------------------------------------------------------------------------
  await record('Trial Balance: Proves Total Debits === Total Credits across all Chart of Accounts', 'Financial Source of Truth', () => {
    const tb = postingService.getTrialBalance(tenantId);
    if (!tb.isBalanced) {
      throw new Error(`Trial balance is unbalanced! Total Debits: ${tb.totalDebit}, Total Credits: ${tb.totalCredit}`);
    }
    if (tb.rows.length === 0) throw new Error('Expected trial balance rows to be generated');
  });

  // ------------------------------------------------------------------------
  // 17. Ledger Statement of Account
  // ------------------------------------------------------------------------
  await record('Ledger Statement: Computes chronological running balance and statement lines', 'Financial Source of Truth', () => {
    const statement = postingService.getLedgerStatement(tenantId, bankLedgerId);
    if (!statement.ledger.id) throw new Error('Expected statement ledger to exist');
    if (statement.lines.length === 0) throw new Error('Expected statement lines to be present');

    // Verify closing balance matches running balance of last line
    const lastLine = statement.lines[statement.lines.length - 1];
    if (statement.closingBalance !== lastLine.runningBalance) {
      throw new Error(`Closing balance (${statement.closingBalance}) does not match last line balance (${lastLine.runningBalance})`);
    }
  });

  // ------------------------------------------------------------------------
  // 18. Multi-Tenant Ledger Isolation
  // ------------------------------------------------------------------------
  await record('Multi-Tenant Isolation: Strictly prohibits cross-tenant ledger referencing in journal lines', 'Multi-Tenancy', async () => {
    // Create a second tenant
    const tenant2 = db.createTenant({
      name: 'Second Isolated Corp',
      legalName: 'Second Isolated Corporation Ltd',
      businessType: 'PVT_LTD',
      industry: 'Manufacturing',
      country: 'India',
      state: 'Gujarat',
      stateCode: '24',
      address: {
        street: '12 GIDC Estate',
        city: 'Ahmedabad',
        state: 'Gujarat',
        stateCode: '24',
        country: 'India',
        pincode: '380015',
      },
      currency: { code: 'INR', symbol: '₹', decimalPlaces: 2, formatLocale: 'en-IN' },
      financialYear: { name: 'FY 2026-27', startDate: '2026-04-01', endDate: '2027-03-31', isLocked: false },
      booksBeginningDate: '2026-04-01',
      preferences: {
        accounting: {
          inventoryValuation: 'PERPETUAL_FIFO',
          billWiseTracking: true,
          preventNegativeCash: true,
          enforceCreditLimit: true,
          multiCurrency: false,
        },
        inventory: { multiGodown: false, batchTracking: false, orderProcessing: false, separateDiscountCol: false },
        tax: { gstRegistrationType: 'REGULAR', eInvoicingApplicable: false, eWayBillApplicable: false, rcmApplicable: false, defaultGstRate: 18 },
        invoicing: { voucherNumbering: 'AUTO_SEQUENTIAL', prefix: 'INV/', startingNumber: 1, defaultCreditDays: 30, termsAndConditions: '' },
      },
    });

    const tenant2Ledgers = db.getChartOfAccounts(tenant2.id);
    const tenant2Bank = tenant2Ledgers[0].id;

    // Attempt to post in Tenant 1 using Tenant 2's ledger
    const crossPayload: PostJournalPayload = {
      voucherType: 'PAYMENT',
      entryDate: '2026-09-28',
      narration: 'Cross-tenant attack vector attempt',
      lines: [
        { ledgerId: rentLedgerId, entryDirection: 'DEBIT', amount: '1000.00' },
        { ledgerId: tenant2Bank, entryDirection: 'CREDIT', amount: '1000.00' }, // Foreign account!
      ],
    };

    let caught = false;
    try {
      await postingService.postJournal(tenantId, crossPayload, accountantContext);
    } catch (err) {
      if (err instanceof AccountingValidationError && err.code === 'LEDGER_NOT_FOUND') {
        caught = true;
      }
    }
    if (!caught) throw new Error('Expected cross-tenant ledger referencing to be rejected with LEDGER_NOT_FOUND');
  });

  const passedCount = results.filter((r) => r.passed).length;
  return {
    passed: passedCount === results.length,
    total: results.length,
    passedCount,
    results,
  };
}

// Direct CLI invocation
const isDirectCli = process.argv[1] && (path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase());
if (isDirectCli) {
  console.log('\n======================================================');
  console.log(' RUNNING PHASE 06 DOUBLE-ENTRY ACCOUNTING ENGINE TESTS');
  console.log('======================================================\n');
  runAccountingTests().then((res) => {
    res.results.forEach((r, idx) => {
      const status = r.passed ? '✓ PASS' : '✗ FAIL';
      console.log(`[${idx + 1}] ${status} [${r.category}] ${r.name} (${r.durationMs}ms)`);
      if (!r.passed) {
        console.error(`    Error: ${r.message}`);
      }
    });
    console.log('\n------------------------------------------------------');
    console.log(` Summary: ${res.passedCount}/${res.total} tests passed (${Math.round((res.passedCount / res.total) * 100)}%)`);
    console.log('======================================================\n');
    process.exit(res.passed ? 0 : 1);
  });
}
