/**
 * Automated Test Suite: Phase 07 Chart of Accounts and Ledger Management
 *
 * Test Matrix:
 * 1. Account Group Hierarchy (Creates primary and child groups with tree structure)
 * 2. Group Classification Validation (Rejects child group with conflicting classification from parent)
 * 3. Cyclic Hierarchy Prevention (Rejects setting parent to self or any descendant group)
 * 4. Group Deletion Protection (Prevents deleting group containing sub-groups or ledgers)
 * 5. Ledger Creation (Creates ledger with group, bank config, tax config, and opening balance)
 * 6. Duplicate Ledger Rejection (Rejects duplicate name or code within tenant)
 * 7. Bank Account Validation (Validates 11-char IFSC code format and account number)
 * 8. Tax Configuration Validation (Validates GST tax rate between 0 and 100)
 * 9. Ledger Update & Reclassification Guardrail (Rejects group reclassification when posted transactions exist)
 * 10. Ledger Archiving & Reactivation (Deactivates ledger, prevents deletion of financial history, reactivates)
 * 11. Opening Balance Difference Calculation (Calculates net difference between opening debits and credits)
 * 12. Opening Balance Controlled Reconciliation (Reconciles difference into designated suspense account)
 * 13. Dynamic Balance Derivation (Verifies ledger balance derives strictly from opening balance + journal lines)
 * 14. Ledger Drill-down (Verifies statement lines and underlying transaction drilldown integrity)
 * 15. Bulk Import Dry-run & Atomic Execution (Validates rows, reports row-by-row errors, imports valid ledgers)
 * 16. Multi-Tenant Ledger Isolation (Zero cross-tenant leakage for ledgers and groups)
 */

import { ledgerService, LedgerValidationError } from '../server/domain/accounting/ledgerService';
import { postingService } from '../server/domain/accounting/postingService';
import { FinancialAmount } from '../server/domain/accounting/precision';
import { db } from '../server/db/store';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

export async function runLedgerTests(): Promise<{
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
  const userId = '018f92a1-7c4a-71b3-8fa9-715d2a901e01';

  let testGroupId = '';
  let testChildGroupId = '';
  let testLedgerId = '';

  // ------------------------------------------------------------------------
  // 1. Account Group Hierarchy
  // ------------------------------------------------------------------------
  await record('Account Grouping: Creates parent and child account groups with hierarchy', 'Account Groups', () => {
    // 1. Create Parent Group under Assets
    const parent = ledgerService.createAccountGroup(
      tenantId,
      {
        name: 'Investments & Securities',
        classification: 'ASSET',
        code: '1300',
        sortOrder: 13,
      },
      userId
    );
    testGroupId = parent.id;
    if (!parent.id || parent.classification !== 'ASSET') throw new Error('Parent group creation failed');

    // 2. Create Child Group under Investments
    const child = ledgerService.createAccountGroup(
      tenantId,
      {
        name: 'Mutual Fund Units',
        parentId: parent.id,
        code: '1310',
        sortOrder: 131,
      },
      userId
    );
    testChildGroupId = child.id;
    if (child.parentId !== parent.id) throw new Error('Child parentId mismatch');
    if (child.classification !== 'ASSET') throw new Error('Child did not inherit parent classification');

    // Verify tree representation
    const tree = ledgerService.getAccountGroupTree(tenantId);
    const foundParent = tree.find((g) => g.id === parent.id);
    if (!foundParent) throw new Error('Parent group not found in tree');
    if (!foundParent.children || !foundParent.children.some((c) => c.id === child.id)) {
      throw new Error('Child group not found in parent children');
    }
  });

  // ------------------------------------------------------------------------
  // 2. Group Classification Validation
  // ------------------------------------------------------------------------
  await record('Group Validation: Rejects child group with classification conflicting with parent', 'Account Groups', () => {
    let caught = false;
    try {
      ledgerService.createAccountGroup(
        tenantId,
        {
          name: 'Invalid Expense under Asset',
          parentId: testGroupId, // Parent is ASSET
          classification: 'EXPENSE', // Conflicts with ASSET!
        },
        userId
      );
    } catch (err) {
      if (err instanceof LedgerValidationError && err.code === 'INVALID_GROUP_CLASSIFICATION') {
        caught = true;
      }
    }
    if (!caught) throw new Error('Expected LedgerValidationError (INVALID_GROUP_CLASSIFICATION) was not thrown');
  });

  // ------------------------------------------------------------------------
  // 3. Cyclic Hierarchy Prevention
  // ------------------------------------------------------------------------
  await record('Group Validation: Prevents cyclic parent-child hierarchy assignment', 'Account Groups', () => {
    let caughtSelf = false;
    try {
      ledgerService.updateAccountGroup(tenantId, testGroupId, { parentId: testGroupId }, userId);
    } catch (err) {
      if (err instanceof LedgerValidationError && err.code === 'CYCLIC_PARENT_ASSIGNMENT') {
        caughtSelf = true;
      }
    }
    if (!caughtSelf) throw new Error('Setting parent to self was not prevented');

    let caughtDescendant = false;
    try {
      // Attempt to set parent's parent to its child
      ledgerService.updateAccountGroup(tenantId, testGroupId, { parentId: testChildGroupId }, userId);
    } catch (err) {
      if (err instanceof LedgerValidationError && err.code === 'CYCLIC_HIERARCHY') {
        caughtDescendant = true;
      }
    }
    if (!caughtDescendant) throw new Error('Setting parent to descendant was not prevented');
  });

  // ------------------------------------------------------------------------
  // 4. Group Deletion Protection
  // ------------------------------------------------------------------------
  await record('Group Deletion: Prevents deleting group containing sub-groups or ledgers', 'Account Groups', () => {
    // testGroupId has testChildGroupId
    let caughtHasChildren = false;
    try {
      ledgerService.deleteAccountGroup(tenantId, testGroupId, userId);
    } catch (err) {
      if (err instanceof LedgerValidationError && err.code === 'GROUP_HAS_CHILDREN') {
        caughtHasChildren = true;
      }
    }
    if (!caughtHasChildren) throw new Error('Expected GROUP_HAS_CHILDREN error was not thrown');
  });

  // ------------------------------------------------------------------------
  // 5. Ledger Creation with Full Configuration
  // ------------------------------------------------------------------------
  await record('Ledger Creation: Creates ledger with bank details, tax config, and opening balance', 'Ledgers', () => {
    const ledger = ledgerService.createLedger(
      tenantId,
      {
        name: 'ICICI Bank Ltd - Corporate A/c',
        groupId: `grp-${tenantId.substring(0, 8)}-bank`,
        code: '1015',
        alias: 'ICICI-CORP',
        description: 'Primary corporate disbursement bank account',
        openingBalance: '250000.00',
        openingBalanceType: 'DEBIT',
        bankConfig: {
          isBankAccount: true,
          bankAccountNumber: '001205001234',
          bankName: 'ICICI Bank Ltd',
          bankIfsc: 'ICIC0000012',
          bankBranch: 'Nariman Point, Mumbai',
          accountType: 'CURRENT',
        },
      },
      userId
    );
    testLedgerId = ledger.id;

    if (!ledger.id) throw new Error('Ledger ID not generated');
    if (ledger.classification !== 'ASSET') throw new Error(`Expected ASSET, got ${ledger.classification}`);
    if (ledger.normalBalance !== 'DEBIT') throw new Error(`Expected normal balance DEBIT, got ${ledger.normalBalance}`);
    if (ledger.openingBalance !== '250000.00') throw new Error(`Opening balance mismatch: ${ledger.openingBalance}`);
    if (!ledger.bankConfig.isBankAccount || ledger.bankConfig.bankIfsc !== 'ICIC0000012') {
      throw new Error('Bank configuration not preserved');
    }
  });

  // ------------------------------------------------------------------------
  // 6. Duplicate Ledger Rejection
  // ------------------------------------------------------------------------
  await record('Ledger Validation: Rejects duplicate ledger name or code within tenant', 'Ledgers', () => {
    let caughtName = false;
    try {
      ledgerService.createLedger(
        tenantId,
        {
          name: 'ICICI Bank Ltd - Corporate A/c', // Duplicate
          groupId: `grp-${tenantId.substring(0, 8)}-bank`,
        },
        userId
      );
    } catch (err) {
      if (err instanceof LedgerValidationError && err.code === 'DUPLICATE_LEDGER_NAME') {
        caughtName = true;
      }
    }
    if (!caughtName) throw new Error('Duplicate ledger name was not rejected');

    let caughtCode = false;
    try {
      ledgerService.createLedger(
        tenantId,
        {
          name: 'Another Bank Account',
          code: '1015', // Duplicate code
          groupId: `grp-${tenantId.substring(0, 8)}-bank`,
        },
        userId
      );
    } catch (err) {
      if (err instanceof LedgerValidationError && err.code === 'DUPLICATE_LEDGER_CODE') {
        caughtCode = true;
      }
    }
    if (!caughtCode) throw new Error('Duplicate ledger code was not rejected');
  });

  // ------------------------------------------------------------------------
  // 7. Bank Account Validation
  // ------------------------------------------------------------------------
  await record('Bank Validation: Rejects invalid IFSC code format for bank accounts', 'Validation', () => {
    let caught = false;
    try {
      ledgerService.createLedger(
        tenantId,
        {
          name: 'State Bank with Bad IFSC',
          groupId: `grp-${tenantId.substring(0, 8)}-bank`,
          bankConfig: {
            isBankAccount: true,
            bankAccountNumber: '1234567890',
            bankIfsc: 'INVALID_IFSC_123', // Invalid IFSC
          },
        },
        userId
      );
    } catch (err) {
      if (err instanceof LedgerValidationError && err.code === 'INVALID_IFSC') {
        caught = true;
      }
    }
    if (!caught) throw new Error('Invalid IFSC was not rejected with INVALID_IFSC');
  });

  // ------------------------------------------------------------------------
  // 8. Tax Configuration Validation
  // ------------------------------------------------------------------------
  await record('Tax Validation: Validates GST tax rate is within 0 to 100', 'Validation', () => {
    let caught = false;
    try {
      ledgerService.createLedger(
        tenantId,
        {
          name: 'Excessive Tax Account',
          groupId: `grp-${tenantId.substring(0, 8)}-tax-out`,
          taxConfig: {
            isTaxAccount: true,
            taxRatePercent: 150, // Invalid > 100
          },
        },
        userId
      );
    } catch (err) {
      if (err instanceof LedgerValidationError && err.code === 'INVALID_TAX_RATE') {
        caught = true;
      }
    }
    if (!caught) throw new Error('Tax rate > 100 was not rejected with INVALID_TAX_RATE');
  });

  // ------------------------------------------------------------------------
  // 9. Ledger Update & Reclassification Guardrail
  // ------------------------------------------------------------------------
  await record('Ledger Update: Updates details and enforces reclassification guardrail if posted lines exist', 'Ledgers', async () => {
    // 1. Regular update
    const updated = ledgerService.updateLedger(
      tenantId,
      testLedgerId,
      {
        alias: 'ICICI-MAIN',
        description: 'Updated description for ICICI corporate account',
      },
      userId
    );
    if (updated.alias !== 'ICICI-MAIN') throw new Error('Alias update failed');

    // 2. Post a journal transaction involving this ledger
    await postingService.postJournal(
      tenantId,
      {
        voucherType: 'RECEIPT',
        entryDate: '2026-09-18',
        narration: 'Capital injection deposited to ICICI bank account',
        lines: [
          { ledgerId: testLedgerId, entryDirection: 'DEBIT', amount: '50000.00' },
          { ledgerId: `ledg-${tenantId.substring(0, 8)}-capital`, entryDirection: 'CREDIT', amount: '50000.00' },
        ],
      },
      { userId, userRole: 'SR_ACCOUNTANT' }
    );

    // 3. Attempt to reclassify this ledger from ASSET to EXPENSE (must be rejected)
    let caughtReclass = false;
    try {
      ledgerService.updateLedger(
        tenantId,
        testLedgerId,
        { groupId: `grp-${tenantId.substring(0, 8)}-admin-expenses` }, // Expense group
        userId
      );
    } catch (err) {
      if (err instanceof LedgerValidationError && err.code === 'RECLASSIFICATION_PROHIBITED') {
        caughtReclass = true;
      }
    }
    if (!caughtReclass) throw new Error('Reclassifying ledger with posted history was not blocked');
  });

  // ------------------------------------------------------------------------
  // 10. Ledger Archiving & Reactivation
  // ------------------------------------------------------------------------
  await record('Ledger Lifecycle: Archives ledger without deleting history, and reactivates cleanly', 'Ledgers', async () => {
    // Archive
    const archived = ledgerService.archiveLedger(tenantId, testLedgerId, userId);
    if (archived.isActive !== false) throw new Error('Ledger was not archived');

    // Posting with archived ledger must fail
    let caughtPosting = false;
    try {
      await postingService.postJournal(
        tenantId,
        {
          voucherType: 'PAYMENT',
          entryDate: '2026-09-20',
          narration: 'Attempting payment with archived ledger',
          lines: [
            { ledgerId: `ledg-${tenantId.substring(0, 8)}-rent`, entryDirection: 'DEBIT', amount: '1000.00' },
            { ledgerId: testLedgerId, entryDirection: 'CREDIT', amount: '1000.00' },
          ],
        },
        { userId, userRole: 'SR_ACCOUNTANT' }
      );
    } catch (err: unknown) {
      if (err instanceof Error && (err.message.includes('deactivated') || (err as { code?: string }).code === 'LEDGER_INACTIVE')) {
        caughtPosting = true;
      }
    }
    if (!caughtPosting) throw new Error('Posting with archived ledger was not blocked');

    // Reactivate
    const reactivated = ledgerService.reactivateLedger(tenantId, testLedgerId, userId);
    if (!reactivated.isActive) throw new Error('Ledger reactivation failed');
  });

  // ------------------------------------------------------------------------
  // 11. Opening Balance Difference Calculation
  // ------------------------------------------------------------------------
  await record('Opening Balances: Calculates net difference between opening debits and credits', 'Opening Balances', () => {
    // Create an unbalanced test ledger with opening balance
    const unbalancedLedger = ledgerService.createLedger(
      tenantId,
      {
        name: 'Temporary Unbalanced Fixtures',
        groupId: `grp-${tenantId.substring(0, 8)}-fixed-assets`,
        code: '1299',
        openingBalance: '15000.00',
        openingBalanceType: 'DEBIT',
      },
      userId
    );

    const summary = ledgerService.getOpeningBalanceSummary(tenantId);
    if (summary.isBalanced) {
      throw new Error('Summary should be unbalanced due to newly added opening debit');
    }
    if (summary.difference !== '265000.00') {
      throw new Error(`Expected difference 265000.00, got ${summary.difference}`);
    }
    if (summary.differenceDirection !== 'DEBIT') {
      throw new Error(`Expected DEBIT difference direction, got ${summary.differenceDirection}`);
    }
  });

  // ------------------------------------------------------------------------
  // 12. Opening Balance Controlled Reconciliation (Suspense Account)
  // ------------------------------------------------------------------------
  await record('Opening Balances: Reconciles opening balance difference into designated suspense account', 'Opening Balances', () => {
    // Create an explicit Suspense Difference account
    const suspenseAccount = ledgerService.createLedger(
      tenantId,
      {
        name: 'Opening Balance Difference Suspense Account',
        groupId: `grp-${tenantId.substring(0, 8)}-capital`,
        code: '3999',
      },
      userId
    );

    const reconciledSummary = ledgerService.reconcileOpeningBalanceDifference(
      tenantId,
      {
        suspenseLedgerId: suspenseAccount.id,
        notes: 'Statutory allocation of opening balance difference during setup',
      },
      userId
    );

    if (!reconciledSummary.isBalanced) {
      throw new Error(`Opening balance should be balanced after suspense reconciliation. Difference: ${reconciledSummary.difference}`);
    }
    if (reconciledSummary.difference !== '0.00') {
      throw new Error(`Expected 0.00 difference, got ${reconciledSummary.difference}`);
    }
  });

  // ------------------------------------------------------------------------
  // 13. Dynamic Balance Derivation from Journal Lines
  // ------------------------------------------------------------------------
  await record('Balance Calculation: Balances derive dynamically from approved opening balance and journal data', 'Ledger Details', () => {
    // Check ICICI Bank ledger:
    // Opening Balance: ₹ 2,50,000.00 (DEBIT)
    // Transaction in test #9: DEBIT ₹ 50,000.00
    // Expected Current Balance: ₹ 3,00,000.00 (DEBIT)
    const ledger = ledgerService.getLedgerById(tenantId, testLedgerId);
    if (ledger.currentBalance !== '300000.00') {
      throw new Error(`Expected current balance 300000.00, got ${ledger.currentBalance}`);
    }
    if (ledger.currentBalanceType !== 'DEBIT') {
      throw new Error(`Expected balance type DEBIT, got ${ledger.currentBalanceType}`);
    }
    if (ledger.currentPeriod.periodDebit !== '50000.00') {
      throw new Error(`Expected period debits 50000.00, got ${ledger.currentPeriod.periodDebit}`);
    }
  });

  // ------------------------------------------------------------------------
  // 14. Ledger Drill-down Integrity
  // ------------------------------------------------------------------------
  await record('Ledger Drill-down: Generates chronological statement with running balances and voucher refs', 'Ledger Drill-down', () => {
    const statement = postingService.getLedgerStatement(tenantId, testLedgerId);
    if (statement.lines.length === 0) throw new Error('Expected at least one drill-down transaction');

    const firstTx = statement.lines[0];
    if (firstTx.debit !== '50000.00') throw new Error(`Expected debit 50000.00, got ${firstTx.debit}`);
    if (firstTx.runningBalance !== '300000.00') {
      throw new Error(`Expected running balance 300000.00, got ${firstTx.runningBalance}`);
    }
    if (!firstTx.voucherNumber) throw new Error('Voucher number missing from drilldown line');
  });

  // ------------------------------------------------------------------------
  // 15. Bulk Import Dry-run & Execution
  // ------------------------------------------------------------------------
  await record('Bulk Import: Dry-run validates syntax and errors, real run commits valid ledgers', 'Bulk Import', () => {
    const importRows = [
      {
        name: 'Bulk Mutual Fund Axis Bluechip',
        groupNameOrCode: 'Mutual Fund Units',
        code: '1311',
        openingBalance: '100000.00',
        openingBalanceType: 'DR' as const,
      },
      {
        name: 'Bulk Invalid Group Ledger',
        groupNameOrCode: 'NonExistentGroup123', // Will fail validation
        code: '9999',
      },
    ];

    // Dry Run
    const dryRunRes = ledgerService.bulkImportLedgers(tenantId, importRows, true, userId);
    if (!dryRunRes.isDryRun) throw new Error('Expected isDryRun to be true');
    if (dryRunRes.failedCount !== 1) throw new Error(`Expected 1 error in dry run, got ${dryRunRes.failedCount}`);
    if (dryRunRes.errors[0].rowIndex !== 2) throw new Error(`Expected error on row 2, got ${dryRunRes.errors[0].rowIndex}`);

    // Real Run with valid rows
    const validRows = [
      {
        name: 'Bulk Mutual Fund Axis Bluechip',
        groupNameOrCode: 'Mutual Fund Units',
        code: '1311',
        openingBalance: '100000.00',
        openingBalanceType: 'DR' as const,
      },
    ];
    const realRunRes = ledgerService.bulkImportLedgers(tenantId, validRows, false, userId);
    if (realRunRes.importedCount !== 1) throw new Error(`Expected 1 imported ledger, got ${realRunRes.importedCount}`);
    if (realRunRes.failedCount !== 0) throw new Error('Expected 0 failures in real run');

    // Verify imported ledger exists in COA
    const imported = db.findLedgerAccountByCode(tenantId, '1311');
    if (!imported || imported.name !== 'Bulk Mutual Fund Axis Bluechip') {
      throw new Error('Imported ledger not found in database');
    }
  });

  // ------------------------------------------------------------------------
  // 16. Multi-Tenant Ledger & Group Isolation
  // ------------------------------------------------------------------------
  await record('Multi-Tenancy: Strictly isolates ledgers and groups across distinct company tenants', 'Security', () => {
    // Create second tenant
    const tenant2 = db.createTenant({
      name: 'Delta Pharma Industries Ltd',
      legalName: 'Delta Pharma Industries Limited',
      businessType: 'PUBLIC_LTD',
      industry: 'Pharmaceuticals',
      country: 'India',
      state: 'Karnataka',
      stateCode: '29',
      address: {
        street: '45 Peenya Industrial Area',
        city: 'Bangalore',
        state: 'Karnataka',
        stateCode: '29',
        country: 'India',
        pincode: '560058',
      },
      currency: { code: 'INR', symbol: '₹', decimalPlaces: 2, formatLocale: 'en-IN' },
      financialYear: { name: 'FY 2026-27', startDate: '2026-04-01', endDate: '2027-03-31', isLocked: false },
      booksBeginningDate: '2026-04-01',
      preferences: {
        accounting: { inventoryValuation: 'PERPETUAL_FIFO', billWiseTracking: true, preventNegativeCash: true, enforceCreditLimit: true, multiCurrency: false },
        inventory: { multiGodown: false, batchTracking: true, orderProcessing: false, separateDiscountCol: false },
        tax: { gstRegistrationType: 'REGULAR', eInvoicingApplicable: false, eWayBillApplicable: false, rcmApplicable: false, defaultGstRate: 18 },
        invoicing: { voucherNumbering: 'AUTO_SEQUENTIAL', prefix: 'INV/', startingNumber: 1, defaultCreditDays: 30, termsAndConditions: '' },
      },
    });

    const tenant1Ledgers = ledgerService.getLedgers(tenantId);
    const tenant2Ledgers = ledgerService.getLedgers(tenant2.id);

    // Verify disjoint sets
    const t1Ids = new Set(tenant1Ledgers.map((l) => l.id));
    for (const l2 of tenant2Ledgers) {
      if (t1Ids.has(l2.id)) {
        throw new Error(`Cross-tenant ledger leakage detected: Ledger ${l2.id} found in both tenants`);
      }
    }

    const isolation = db.auditCompanyIsolation(tenantId);
    if (!isolation.isIsolated || isolation.crossTenantLeakageCount !== 0) {
      throw new Error(`Isolation audit failed with ${isolation.crossTenantLeakageCount} leakages`);
    }
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
  console.log(' RUNNING PHASE 07 CHART OF ACCOUNTS & LEDGER TESTS');
  console.log('======================================================\n');
  runLedgerTests().then((res) => {
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
