/**
 * Automated Test Suite: Phase 05 Company Management & Financial Configuration
 *
 * Invariants Tested:
 * 1. Company Creation with full configuration (entity, statutory, FY calendar, preferences)
 * 2. Validation: Rejects missing business name
 * 3. Validation: Rejects invalid Financial Year dates (End <= Start)
 * 4. Validation: Rejects Books Beginning Date earlier than Financial Year Start
 * 5. Statutory Validation: Rejects invalid GSTIN format
 * 6. Statutory Validation: Rejects GSTIN state code mismatch
 * 7. Statutory Validation: Rejects duplicate GSTIN registration
 * 8. PAN Derivation: Automatically extracts 10-character PAN from GSTIN
 * 9. Financial Preferences: Updates perpetual vs periodic inventory and bill-wise tracking
 * 10. Invoicing Preferences: Configures auto-sequential voucher numbering prefix & credit days
 * 11. Period Locking: Supports financial year freezeDate for compliance
 * 12. Company Switching: Anchors user session to newly selected tenant
 * 13. Company Isolation: Data created in Company A is strictly invisible to Company B
 * 14. Company Isolation: Zero cross-tenant leakage invariant confirmed by isolation audit
 */

import { companyService } from '../server/domain/companyService';
import { authService } from '../server/domain/authService';
import { db } from '../server/db/store';
import { CreateCompanyPayload } from '../shared/types/company';

export interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

export async function runCompanyTests(): Promise<{
  passed: boolean;
  total: number;
  passedCount: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];

  function record(name: string, category: string, fn: () => void | Promise<void>) {
    const start = performance.now();
    try {
      fn();
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

  const testUserId = '018f92a1-7c4a-71b3-8fa9-715d2a901e01'; // Default admin
  const rand = Math.floor(1000 + Math.random() * 9000);
  const gstinA = `27AAACZ${rand}Q1ZB`;
  const panA = `AAACZ${rand}Q`;
  const gstinB = `24AABCR${rand}P1Z4`;
  let companyAId = '';
  let companyBId = '';

  // --- 1. Company Creation ---
  record('Company Creation: Successfully creates company with complete financial configuration', 'Company Creation', () => {
    const payload: CreateCompanyPayload = {
      name: 'Tata Consultancy Services Ltd',
      legalName: 'Tata Consultancy Services Limited',
      businessType: 'PUBLIC_LTD',
      industry: 'Information Technology & Consulting',
      country: 'India',
      state: 'Maharashtra',
      stateCode: '27',
      street: 'TCS House, Raveline Street, Fort',
      city: 'Mumbai',
      pincode: '400001',
      gstin: gstinA,
      financialYearStart: '2026-04-01',
      financialYearEnd: '2027-03-31',
      booksBeginningDate: '2026-04-01',
      currencyCode: 'INR',
      preferences: {
        accounting: {
          inventoryValuation: 'PERPETUAL_FIFO',
          billWiseTracking: true,
          preventNegativeCash: true,
          enforceCreditLimit: true,
          multiCurrency: true,
        },
      },
    };

    const company = companyService.createCompany(testUserId, payload);
    if (!company.id) throw new Error('Company ID was not assigned');
    if (company.name !== payload.name) throw new Error('Company name mismatch');
    if (company.pan !== panA) throw new Error('PAN was not correctly extracted from GSTIN');
    if (company.preferences.accounting.inventoryValuation !== 'PERPETUAL_FIFO') throw new Error('Accounting preferences not saved');
    if (!company.financialYear.name.includes('2026')) throw new Error('Financial year name was not derived');

    companyAId = company.id;
  });

  // --- 2. Validation Checks ---
  record('Validation: Rejects missing business name', 'Validation', () => {
    let threw = false;
    try {
      companyService.createCompany(testUserId, {
        name: '', // Empty
        businessType: 'PVT_LTD',
        industry: 'Retail',
        country: 'India',
        state: 'Maharashtra',
        stateCode: '27',
        financialYearStart: '2026-04-01',
        financialYearEnd: '2027-03-31',
        booksBeginningDate: '2026-04-01',
      });
    } catch (err: unknown) {
      threw = true;
      if (!(err instanceof Error) || !err.message.includes('Business Name is required')) {
        throw new Error(`Unexpected error message: ${err}`);
      }
    }
    if (!threw) throw new Error('Expected validation to fail on empty business name');
  });

  record('Validation: Rejects invalid Financial Year dates (End <= Start)', 'Validation', () => {
    let threw = false;
    try {
      companyService.createCompany(testUserId, {
        name: 'Invalid FY Corp',
        businessType: 'PVT_LTD',
        industry: 'Retail',
        country: 'India',
        state: 'Maharashtra',
        stateCode: '27',
        financialYearStart: '2026-04-01',
        financialYearEnd: '2026-03-31', // Before start
        booksBeginningDate: '2026-04-01',
      });
    } catch (err: unknown) {
      threw = true;
      if (!(err instanceof Error) || !err.message.includes('End date must be strictly after')) {
        throw new Error(`Unexpected error message: ${err}`);
      }
    }
    if (!threw) throw new Error('Expected validation to fail when FY End <= FY Start');
  });

  record('Validation: Rejects Books Beginning Date earlier than Financial Year Start', 'Validation', () => {
    let threw = false;
    try {
      companyService.createCompany(testUserId, {
        name: 'Early Books Corp',
        businessType: 'PVT_LTD',
        industry: 'Retail',
        country: 'India',
        state: 'Maharashtra',
        stateCode: '27',
        financialYearStart: '2026-04-01',
        financialYearEnd: '2027-03-31',
        booksBeginningDate: '2026-01-01', // Earlier than FY start
      });
    } catch (err: unknown) {
      threw = true;
      if (!(err instanceof Error) || !err.message.includes('cannot be earlier than Financial Year Start Date')) {
        throw new Error(`Unexpected error message: ${err}`);
      }
    }
    if (!threw) throw new Error('Expected validation to fail when Books Date < FY Start');
  });

  // --- 3. Statutory & GSTIN Validation ---
  record('Statutory Validation: Rejects malformed GSTIN format', 'Statutory Validation', () => {
    let threw = false;
    try {
      companyService.createCompany(testUserId, {
        name: 'Bad GSTIN Corp',
        businessType: 'PVT_LTD',
        industry: 'Manufacturing',
        country: 'India',
        state: 'Maharashtra',
        stateCode: '27',
        gstin: 'INVALID_GSTIN_123',
        financialYearStart: '2026-04-01',
        financialYearEnd: '2027-03-31',
        booksBeginningDate: '2026-04-01',
      });
    } catch (err: unknown) {
      threw = true;
      if (!(err instanceof Error) || !err.message.includes('Invalid GSTIN format')) {
        throw new Error(`Unexpected error message: ${err}`);
      }
    }
    if (!threw) throw new Error('Expected validation to fail on invalid GSTIN format');
  });

  record('Statutory Validation: Rejects mismatch between state code and GSTIN prefix', 'Statutory Validation', () => {
    let threw = false;
    try {
      companyService.createCompany(testUserId, {
        name: 'State Mismatch Corp',
        businessType: 'PVT_LTD',
        industry: 'Manufacturing',
        country: 'India',
        state: 'Gujarat',
        stateCode: '24', // Gujarat is 24
        gstin: gstinA, // Prefix is 27 (Maharashtra)
        financialYearStart: '2026-04-01',
        financialYearEnd: '2027-03-31',
        booksBeginningDate: '2026-04-01',
      });
    } catch (err: unknown) {
      threw = true;
      if (!(err instanceof Error) || !err.message.includes('does not match selected State Code')) {
        throw new Error(`Unexpected error message: ${err}`);
      }
    }
    if (!threw) throw new Error('Expected validation to fail on state code mismatch');
  });

  record('Statutory Validation: Rejects duplicate GSTIN registration', 'Statutory Validation', () => {
    let threw = false;
    try {
      companyService.createCompany(testUserId, {
        name: 'Duplicate GSTIN Corp',
        businessType: 'PVT_LTD',
        industry: 'Consulting',
        country: 'India',
        state: 'Maharashtra',
        stateCode: '27',
        gstin: gstinA, // Duplicate of Company A
        financialYearStart: '2026-04-01',
        financialYearEnd: '2027-03-31',
        booksBeginningDate: '2026-04-01',
      });
    } catch (err: unknown) {
      threw = true;
      if (!(err instanceof Error) || !err.message.includes('already registered')) {
        throw new Error(`Unexpected error message: ${err}`);
      }
    }
    if (!threw) throw new Error('Expected validation to fail on duplicate GSTIN');
  });

  // --- 4. Configuration Updates ---
  record('Configuration: Updates accounting & invoicing preferences and period lock', 'Configuration Updates', () => {
    const updated = companyService.updateCompany(companyAId, {
      preferences: {
        accounting: {
          inventoryValuation: 'PERPETUAL_WEIGHTED_AVG',
          billWiseTracking: true,
          preventNegativeCash: true,
          enforceCreditLimit: false,
          multiCurrency: true,
        },
        invoicing: {
          voucherNumbering: 'AUTO_SEQUENTIAL',
          prefix: 'TCS/{FY}/',
          startingNumber: 100,
          defaultCreditDays: 45,
          termsAndConditions: 'TCS Enterprise SLA Net 45 Terms.',
        },
      },
      financialYear: {
        isLocked: true,
        freezeDate: '2026-06-30',
      },
    });

    if (updated.preferences.accounting.inventoryValuation !== 'PERPETUAL_WEIGHTED_AVG') {
      throw new Error('Inventory valuation was not updated');
    }
    if (updated.preferences.invoicing.prefix !== 'TCS/{FY}/') {
      throw new Error('Invoice numbering prefix was not updated');
    }
    if (!updated.financialYear.isLocked) {
      throw new Error('Financial year period lock was not enabled');
    }
  });

  // --- 5. Company B Creation & Multi-Tenant Switching ---
  record('Multi-Tenancy: Creates second distinct company (Reliance Retail) for isolation tests', 'Multi-Tenancy', () => {
    const payload: CreateCompanyPayload = {
      name: 'Reliance Retail Ventures Ltd',
      legalName: 'Reliance Retail Ventures Limited',
      businessType: 'PUBLIC_LTD',
      industry: 'Retail & Consumer Goods',
      country: 'India',
      state: 'Gujarat',
      stateCode: '24',
      street: 'Reliance Corporate Park, Ghansoli',
      city: 'Navi Mumbai',
      pincode: '400701',
      gstin: gstinB,
      financialYearStart: '2026-04-01',
      financialYearEnd: '2027-03-31',
      booksBeginningDate: '2026-04-01',
      preferences: {
        inventory: {
          multiGodown: true,
          batchTracking: true,
          orderProcessing: true,
          separateDiscountCol: true,
        },
      },
    };

    const companyB = companyService.createCompany(testUserId, payload);
    companyBId = companyB.id;
    if (companyB.id === companyAId) throw new Error('Company IDs must be unique');
  });

  record('Company Switching: User context seamlessly switches active tenant', 'Company Switching', () => {
    const switched = authService.switchTenant(testUserId, companyBId);
    if (switched.tenant.id !== companyBId) throw new Error('Tenant was not switched to Company B');
    if (switched.tenant.name !== 'Reliance Retail Ventures Ltd') throw new Error('Company name mismatch on switch');
  });

  // --- 6. Strict Company Data Isolation Verification ---
  record('Company Isolation: Data created in Company A is strictly isolated from Company B', 'Company Isolation', () => {
    // 1. Create a ledger specifically for Company A
    db.createLedgerForTenant({
      tenantId: companyAId,
      name: 'TCS Consulting Revenue - North America',
      groupName: 'Direct Incomes',
      openingBalance: 0,
      balanceType: 'CR',
    });

    // 2. Create a ledger specifically for Company B
    db.createLedgerForTenant({
      tenantId: companyBId,
      name: 'Reliance Retail Hypermarket Inventory Ledger',
      groupName: 'Stock-in-Hand',
      openingBalance: 5000000,
      balanceType: 'DR',
    });

    // 3. Query Company A's ledgers
    const ledgersA = db.getLedgersForTenant(companyAId);
    const hasTcsLedger = ledgersA.some((l) => l.name === 'TCS Consulting Revenue - North America');
    const leaksRelianceLedger = ledgersA.some((l) => l.name === 'Reliance Retail Hypermarket Inventory Ledger');

    if (!hasTcsLedger) throw new Error('Company A does not contain its own ledger');
    if (leaksRelianceLedger) throw new Error('CRITICAL LEAK: Company A contains Company B ledger!');

    // 4. Query Company B's ledgers
    const ledgersB = db.getLedgersForTenant(companyBId);
    const hasRelianceLedger = ledgersB.some((l) => l.name === 'Reliance Retail Hypermarket Inventory Ledger');
    const leaksTcsLedger = ledgersB.some((l) => l.name === 'TCS Consulting Revenue - North America');

    if (!hasRelianceLedger) throw new Error('Company B does not contain its own ledger');
    if (leaksTcsLedger) throw new Error('CRITICAL LEAK: Company B contains Company A ledger!');
  });

  record('Company Isolation: Audit confirms 100% boundary with zero cross-tenant leakage', 'Company Isolation', () => {
    const auditA = companyService.auditCompanyIsolation(companyAId);
    if (!auditA.isIsolated) throw new Error('Company A isolation audit failed');
    if (auditA.crossTenantLeakageCount !== 0) throw new Error('Company A crossTenantLeakageCount must be 0');

    const auditB = companyService.auditCompanyIsolation(companyBId);
    if (!auditB.isIsolated) throw new Error('Company B isolation audit failed');
    if (auditB.crossTenantLeakageCount !== 0) throw new Error('Company B crossTenantLeakageCount must be 0');
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
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('\n======================================================');
  console.log(' RUNNING PHASE 05 COMPANY & FINANCIAL CONFIG TESTS');
  console.log('======================================================\n');
  runCompanyTests().then((res) => {
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
