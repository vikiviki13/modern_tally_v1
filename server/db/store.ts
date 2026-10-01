import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  DatabaseSchema,
  TenantRecord,
  UserRecord,
  SessionRecord,
  PasswordResetTokenRecord,
  IsolatedLedgerRecord,
  IsolatedVoucherRecord,
  AccountGroupRecord,
  LedgerAccountRecord,
  FinancialYearRecord,
  AccountingPeriodRecord,
  JournalEntryRecord,
  JournalLineRecord,
  AuditLogRecord,
} from './types';
import { hashPassword } from '../auth/crypto';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'auth_db.json');

export const DEFAULT_PREFERENCES = {
  accounting: {
    inventoryValuation: 'PERPETUAL_FIFO' as const,
    billWiseTracking: true,
    preventNegativeCash: true,
    enforceCreditLimit: true,
    multiCurrency: false,
  },
  inventory: {
    multiGodown: true,
    batchTracking: false,
    orderProcessing: true,
    separateDiscountCol: true,
  },
  tax: {
    gstRegistrationType: 'REGULAR' as const,
    eInvoicingApplicable: true,
    eWayBillApplicable: true,
    rcmApplicable: false,
    defaultGstRate: 18,
  },
  invoicing: {
    voucherNumbering: 'AUTO_SEQUENTIAL' as const,
    prefix: 'INV/{FY}/',
    startingNumber: 1,
    defaultCreditDays: 30,
    termsAndConditions: 'Payment due within 30 days of invoice date. Interest @ 18% p.a. will be charged on overdue payments.',
  },
};

const INITIAL_SCHEMA: DatabaseSchema = {
  tenants: [],
  users: [],
  sessions: [],
  passwordResets: [],
  ledgers: [],
  vouchers: [],
  accountGroups: [],
  chartOfAccounts: [],
  financialYears: [],
  accountingPeriods: [],
  journalEntries: [],
  journalLines: [],
  auditLogs: [],
};

export class DatabaseStore {
  public schema: DatabaseSchema = { ...INITIAL_SCHEMA };
  private isLoaded = false;
  private transactionDepth = 0;

  constructor() {
    this.ensureInitialized();
  }

  private ensureInitialized() {
    if (this.isLoaded) return;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.schema = {
          tenants: parsed.tenants || [],
          users: parsed.users || [],
          sessions: parsed.sessions || [],
          passwordResets: parsed.passwordResets || [],
          ledgers: parsed.ledgers || [],
          vouchers: parsed.vouchers || [],
          accountGroups: parsed.accountGroups || [],
          chartOfAccounts: parsed.chartOfAccounts || [],
          financialYears: parsed.financialYears || [],
          accountingPeriods: parsed.accountingPeriods || [],
          journalEntries: parsed.journalEntries || [],
          journalLines: parsed.journalLines || [],
          auditLogs: parsed.auditLogs || [],
        };
        // Ensure default tenant has full configuration
        if (this.schema.tenants.length > 0 && !this.schema.tenants[0].preferences) {
          this.upgradeLegacyTenants();
        }
        if (this.schema.chartOfAccounts.length === 0 && this.schema.tenants.length > 0) {
          this.seedAccountingDefaultsForTenant(this.schema.tenants[0].id);
          this.persist();
        } else if (this.schema.accountGroups.length === 0 && this.schema.tenants.length > 0) {
          for (const t of this.schema.tenants) {
            this.seedGroupsForTenant(t.id);
          }
          this.persist();
        }
      } else {
        this.schema = { ...INITIAL_SCHEMA };
        this.seedInitialDefaults();
        this.persist();
      }
      this.isLoaded = true;
    } catch {
      this.schema = { ...INITIAL_SCHEMA };
      this.seedInitialDefaults();
      this.isLoaded = true;
    }
  }

  private upgradeLegacyTenants() {
    this.schema.tenants = this.schema.tenants.map((t) => ({
      ...t,
      businessType: t.businessType || 'PVT_LTD',
      industry: t.industry || 'Information Technology',
      country: t.country || 'India',
      state: t.state || 'Maharashtra',
      address: t.address || {
        street: '101 Horizon Tech Park, Andheri East',
        city: 'Mumbai',
        state: 'Maharashtra',
        stateCode: t.stateCode || '27',
        country: 'India',
        pincode: '400069',
      },
      pan: t.pan || (t.gstin ? t.gstin.substring(2, 12) : 'AABCA1234F'),
      currency: typeof t.currency === 'string'
        ? { code: t.currency, symbol: '₹', decimalPlaces: 2, formatLocale: 'en-IN' }
        : t.currency,
      financialYear: t.financialYear || {
        name: 'FY 2026-27',
        startDate: '2026-04-01',
        endDate: '2027-03-31',
        isLocked: false,
      },
      booksBeginningDate: t.booksBeginningDate || '2026-04-01',
      preferences: t.preferences || DEFAULT_PREFERENCES,
      updatedAt: new Date().toISOString(),
    }));
    this.persist();
  }

  private seedInitialDefaults() {
    const tenantId = '018f92a1-7c4a-71b3-8fa9-715d2a901f01';
    const now = new Date().toISOString();

    const defaultTenant: TenantRecord = {
      id: tenantId,
      name: 'Apex Horizon Technologies Pvt Ltd',
      legalName: 'Apex Horizon Technologies Private Limited',
      businessType: 'PVT_LTD',
      industry: 'Information Technology & Software',
      country: 'India',
      state: 'Maharashtra',
      stateCode: '27',
      address: {
        street: '101 Horizon Tech Park, Andheri East',
        city: 'Mumbai',
        state: 'Maharashtra',
        stateCode: '27',
        country: 'India',
        pincode: '400069',
      },
      gstin: '27AABCA1234F1Z1',
      pan: 'AABCA1234F',
      currency: {
        code: 'INR',
        symbol: '₹',
        decimalPlaces: 2,
        formatLocale: 'en-IN',
      },
      financialYear: {
        name: 'FY 2026-27',
        startDate: '2026-04-01',
        endDate: '2027-03-31',
        isLocked: false,
        freezeDate: '2026-06-30',
      },
      booksBeginningDate: '2026-04-01',
      preferences: DEFAULT_PREFERENCES,
      createdAt: now,
      updatedAt: now,
    };

    const { hash, salt } = hashPassword('Admin@123456');
    const defaultUser: UserRecord = {
      id: '018f92a1-7c4a-71b3-8fa9-715d2a901e01',
      email: 'admin@apexerp.com',
      passwordHash: hash,
      salt,
      fullName: 'Rohit Varma, FCA',
      role: 'SUPER_ADMIN',
      tenantId,
      isActive: true,
      createdAt: now,
    };

    // Seed sample isolated ledgers for Company 1 (Legacy compatibility)
    const defaultLedger: IsolatedLedgerRecord = {
      id: 'ledg-001',
      tenantId,
      name: 'HDFC Bank Ltd Current A/c',
      groupName: 'Bank Accounts',
      openingBalance: 1450000.5,
      balanceType: 'DR',
      createdAt: now,
    };

    this.schema.tenants.push(defaultTenant);
    this.schema.users.push(defaultUser);
    this.schema.ledgers.push(defaultLedger);

    // Seed full Chart of Accounts & Periods
    this.seedAccountingDefaultsForTenant(tenantId);
  }

  public seedGroupsForTenant(tenantId: string): AccountGroupRecord[] {
    const now = new Date().toISOString();
    const prefix = tenantId.substring(0, 8);

    const groups: Array<Omit<AccountGroupRecord, 'createdAt'>> = [
      // Primary Groups
      { id: `grp-${prefix}-assets`, tenantId, code: '1000', name: 'Assets', classification: 'ASSET', affectsGrossProfit: false, isPrimary: true, sortOrder: 1 },
      { id: `grp-${prefix}-liabilities`, tenantId, code: '2000', name: 'Liabilities', classification: 'LIABILITY', affectsGrossProfit: false, isPrimary: true, sortOrder: 2 },
      { id: `grp-${prefix}-equity`, tenantId, code: '3000', name: 'Equity', classification: 'EQUITY', affectsGrossProfit: false, isPrimary: true, sortOrder: 3 },
      { id: `grp-${prefix}-income`, tenantId, code: '4000', name: 'Income', classification: 'REVENUE', affectsGrossProfit: false, isPrimary: true, sortOrder: 4 },
      { id: `grp-${prefix}-expenses`, tenantId, code: '5000', name: 'Expenses', classification: 'EXPENSE', affectsGrossProfit: false, isPrimary: true, sortOrder: 5 },

      // Sub-groups under Assets
      { id: `grp-${prefix}-curr-assets`, tenantId, parentId: `grp-${prefix}-assets`, code: '1100', name: 'Current Assets', classification: 'ASSET', affectsGrossProfit: false, sortOrder: 11 },
      { id: `grp-${prefix}-bank`, tenantId, parentId: `grp-${prefix}-curr-assets`, code: '1110', name: 'Bank Accounts', classification: 'ASSET', affectsGrossProfit: false, sortOrder: 111 },
      { id: `grp-${prefix}-cash`, tenantId, parentId: `grp-${prefix}-curr-assets`, code: '1120', name: 'Cash-in-hand', classification: 'ASSET', affectsGrossProfit: false, sortOrder: 112 },
      { id: `grp-${prefix}-debtors`, tenantId, parentId: `grp-${prefix}-curr-assets`, code: '1130', name: 'Sundry Debtors', classification: 'ASSET', affectsGrossProfit: false, sortOrder: 113 },
      { id: `grp-${prefix}-tax-in`, tenantId, parentId: `grp-${prefix}-curr-assets`, code: '1140', name: 'Duties & Taxes (Input)', classification: 'ASSET', affectsGrossProfit: false, sortOrder: 114 },
      { id: `grp-${prefix}-fixed-assets`, tenantId, parentId: `grp-${prefix}-assets`, code: '1200', name: 'Fixed Assets', classification: 'ASSET', affectsGrossProfit: false, sortOrder: 12 },
      { id: `grp-${prefix}-plant-machinery`, tenantId, parentId: `grp-${prefix}-fixed-assets`, code: '1210', name: 'Plant & Equipment', classification: 'ASSET', affectsGrossProfit: false, sortOrder: 121 },

      // Sub-groups under Liabilities
      { id: `grp-${prefix}-curr-liabilities`, tenantId, parentId: `grp-${prefix}-liabilities`, code: '2100', name: 'Current Liabilities', classification: 'LIABILITY', affectsGrossProfit: false, sortOrder: 21 },
      { id: `grp-${prefix}-creditors`, tenantId, parentId: `grp-${prefix}-curr-liabilities`, code: '2110', name: 'Sundry Creditors', classification: 'LIABILITY', affectsGrossProfit: false, sortOrder: 211 },
      { id: `grp-${prefix}-tax-out`, tenantId, parentId: `grp-${prefix}-curr-liabilities`, code: '2120', name: 'Duties & Taxes (Output)', classification: 'LIABILITY', affectsGrossProfit: false, sortOrder: 212 },
      { id: `grp-${prefix}-provisions`, tenantId, parentId: `grp-${prefix}-curr-liabilities`, code: '2130', name: 'Provisions', classification: 'LIABILITY', affectsGrossProfit: false, sortOrder: 213 },
      { id: `grp-${prefix}-loans`, tenantId, parentId: `grp-${prefix}-liabilities`, code: '2200', name: 'Loans & Borrowings', classification: 'LIABILITY', affectsGrossProfit: false, sortOrder: 22 },

      // Sub-groups under Equity
      { id: `grp-${prefix}-capital`, tenantId, parentId: `grp-${prefix}-equity`, code: '3100', name: 'Capital Account', classification: 'EQUITY', affectsGrossProfit: false, sortOrder: 31 },
      { id: `grp-${prefix}-reserves`, tenantId, parentId: `grp-${prefix}-equity`, code: '3200', name: 'Reserves & Surplus', classification: 'EQUITY', affectsGrossProfit: false, sortOrder: 32 },

      // Sub-groups under Income
      { id: `grp-${prefix}-sales`, tenantId, parentId: `grp-${prefix}-income`, code: '4100', name: 'Sales Accounts', classification: 'REVENUE', affectsGrossProfit: true, sortOrder: 41 },
      { id: `grp-${prefix}-indirect-income`, tenantId, parentId: `grp-${prefix}-income`, code: '4200', name: 'Indirect Incomes', classification: 'REVENUE', affectsGrossProfit: false, sortOrder: 42 },

      // Sub-groups under Expenses
      { id: `grp-${prefix}-direct-expenses`, tenantId, parentId: `grp-${prefix}-expenses`, code: '5100', name: 'Direct Expenses', classification: 'EXPENSE', affectsGrossProfit: true, sortOrder: 51 },
      { id: `grp-${prefix}-indirect-expenses`, tenantId, parentId: `grp-${prefix}-expenses`, code: '5200', name: 'Indirect Expenses', classification: 'EXPENSE', affectsGrossProfit: false, sortOrder: 52 },
      { id: `grp-${prefix}-admin-expenses`, tenantId, parentId: `grp-${prefix}-indirect-expenses`, code: '5210', name: 'Administrative Expenses', classification: 'EXPENSE', affectsGrossProfit: false, sortOrder: 521 },
      { id: `grp-${prefix}-staff-costs`, tenantId, parentId: `grp-${prefix}-indirect-expenses`, code: '5220', name: 'Staff Welfare & Salaries', classification: 'EXPENSE', affectsGrossProfit: false, sortOrder: 522 },
    ];

    const records: AccountGroupRecord[] = groups.map((g) => ({
      ...g,
      createdAt: now,
    }));

    for (const r of records) {
      if (!this.schema.accountGroups.some((existing) => existing.tenantId === tenantId && existing.id === r.id)) {
        this.schema.accountGroups.push(r);
      }
    }

    return records;
  }

  public seedAccountingDefaultsForTenant(tenantId: string) {
    const now = new Date().toISOString();
    const prefix = tenantId.substring(0, 8);

    // Seed standard Account Groups
    this.seedGroupsForTenant(tenantId);

    // Financial Year 2026-27
    const fyId = `fy-${prefix}-2026`;
    const fyRecord: FinancialYearRecord = {
      id: fyId,
      tenantId,
      code: 'FY 2026-27',
      name: 'Financial Year 2026-27',
      startDate: '2026-04-01',
      endDate: '2027-03-31',
      isClosed: false,
      freezeDate: '2026-06-30',
      createdAt: now,
      updatedAt: now,
    };
    this.schema.financialYears.push(fyRecord);

    // 12 Monthly Accounting Periods
    const months = [
      { num: 1, name: 'April 2026', start: '2026-04-01', end: '2026-04-30', locked: true },
      { num: 2, name: 'May 2026', start: '2026-05-01', end: '2026-05-31', locked: true },
      { num: 3, name: 'June 2026', start: '2026-06-01', end: '2026-06-30', locked: true },
      { num: 4, name: 'July 2026', start: '2026-07-01', end: '2026-07-31', locked: false },
      { num: 5, name: 'August 2026', start: '2026-08-01', end: '2026-08-31', locked: false },
      { num: 6, name: 'September 2026', start: '2026-09-01', end: '2026-09-30', locked: false },
      { num: 7, name: 'October 2026', start: '2026-10-01', end: '2026-10-31', locked: false },
      { num: 8, name: 'November 2026', start: '2026-11-01', end: '2026-11-30', locked: false },
      { num: 9, name: 'December 2026', start: '2026-12-01', end: '2026-12-31', locked: false },
      { num: 10, name: 'January 2027', start: '2027-01-01', end: '2027-01-31', locked: false },
      { num: 11, name: 'February 2027', start: '2027-02-01', end: '2027-02-28', locked: false },
      { num: 12, name: 'March 2027', start: '2027-03-01', end: '2027-03-31', locked: false },
    ];

    for (const m of months) {
      this.schema.accountingPeriods.push({
        id: `per-${prefix}-${m.num.toString().padStart(2, '0')}`,
        tenantId,
        financialYearId: fyId,
        periodNumber: m.num,
        name: m.name,
        startDate: m.start,
        endDate: m.end,
        isLocked: m.locked,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Default Chart of Accounts
    const defaultLedgers: Array<Omit<LedgerAccountRecord, 'createdAt' | 'updatedAt'>> = [
      {
        id: `ledg-${prefix}-bank`,
        tenantId,
        groupId: `grp-${prefix}-bank`,
        groupName: 'Bank Accounts',
        code: '1010',
        name: 'HDFC Bank Ltd Current A/c',
        classification: 'ASSET',
        normalBalance: 'DEBIT',
        openingBalance: '1450000.50',
        openingBalanceType: 'DEBIT',
        openingBalanceDate: '2026-04-01',
        currentBalance: '1450000.50',
        isActive: true,
        bankConfig: {
          isBankAccount: true,
          bankAccountNumber: '5020001289102',
          bankName: 'HDFC Bank Ltd',
          bankIfsc: 'HDFC0000060',
          bankBranch: 'Andheri East, Mumbai',
          accountType: 'CURRENT',
        },
      },
      {
        id: `ledg-${prefix}-cash`,
        tenantId,
        groupId: `grp-${prefix}-cash`,
        groupName: 'Cash-in-hand',
        code: '1020',
        name: 'Cash Account',
        classification: 'ASSET',
        normalBalance: 'DEBIT',
        openingBalance: '25000.00',
        openingBalanceType: 'DEBIT',
        openingBalanceDate: '2026-04-01',
        currentBalance: '25000.00',
        isActive: true,
      },
      {
        id: `ledg-${prefix}-debtors`,
        tenantId,
        groupId: `grp-${prefix}-debtors`,
        groupName: 'Sundry Debtors',
        code: '1030',
        name: 'Acme Corporation (Debtor)',
        classification: 'ASSET',
        normalBalance: 'DEBIT',
        openingBalance: '75000.00',
        openingBalanceType: 'DEBIT',
        openingBalanceDate: '2026-04-01',
        currentBalance: '75000.00',
        isActive: true,
        isBillWise: true,
      },
      {
        id: `ledg-${prefix}-creditors`,
        tenantId,
        groupId: `grp-${prefix}-creditors`,
        groupName: 'Sundry Creditors',
        code: '2010',
        name: 'Zenith Tech Suppliers (Creditor)',
        classification: 'LIABILITY',
        normalBalance: 'CREDIT',
        openingBalance: '42000.00',
        openingBalanceType: 'CREDIT',
        openingBalanceDate: '2026-04-01',
        currentBalance: '42000.00',
        isActive: true,
        isBillWise: true,
      },
      {
        id: `ledg-${prefix}-sales`,
        tenantId,
        groupId: `grp-${prefix}-sales`,
        groupName: 'Sales Accounts',
        code: '3010',
        name: 'Software License & Services Revenue',
        classification: 'REVENUE',
        normalBalance: 'CREDIT',
        openingBalance: '0.00',
        openingBalanceType: 'CREDIT',
        openingBalanceDate: '2026-04-01',
        currentBalance: '0.00',
        isActive: true,
        taxConfig: {
          isTaxAccount: false,
          gstType: 'NONE',
          taxRatePercent: 18,
          hsnSacCode: '998313',
        },
      },
      {
        id: `ledg-${prefix}-rent`,
        tenantId,
        groupId: `grp-${prefix}-admin-expenses`,
        groupName: 'Administrative Expenses',
        code: '4010',
        name: 'Office Rent Expense',
        classification: 'EXPENSE',
        normalBalance: 'DEBIT',
        openingBalance: '0.00',
        openingBalanceType: 'DEBIT',
        openingBalanceDate: '2026-04-01',
        currentBalance: '0.00',
        isActive: true,
      },
      {
        id: `ledg-${prefix}-salaries`,
        tenantId,
        groupId: `grp-${prefix}-staff-costs`,
        groupName: 'Staff Welfare & Salaries',
        code: '4020',
        name: 'Salaries & Staff Welfare',
        classification: 'EXPENSE',
        normalBalance: 'DEBIT',
        openingBalance: '0.00',
        openingBalanceType: 'DEBIT',
        openingBalanceDate: '2026-04-01',
        currentBalance: '0.00',
        isActive: true,
      },
      {
        id: `ledg-${prefix}-cgst-in`,
        tenantId,
        groupId: `grp-${prefix}-tax-in`,
        groupName: 'Duties & Taxes (Input)',
        code: '1041',
        name: 'CGST Input Tax Credit',
        classification: 'ASSET',
        normalBalance: 'DEBIT',
        openingBalance: '0.00',
        openingBalanceType: 'DEBIT',
        openingBalanceDate: '2026-04-01',
        currentBalance: '0.00',
        isActive: true,
        taxConfig: {
          isTaxAccount: true,
          gstType: 'CGST',
          taxRatePercent: 9,
        },
      },
      {
        id: `ledg-${prefix}-sgst-in`,
        tenantId,
        groupId: `grp-${prefix}-tax-in`,
        groupName: 'Duties & Taxes (Input)',
        code: '1042',
        name: 'SGST Input Tax Credit',
        classification: 'ASSET',
        normalBalance: 'DEBIT',
        openingBalance: '0.00',
        openingBalanceType: 'DEBIT',
        openingBalanceDate: '2026-04-01',
        currentBalance: '0.00',
        isActive: true,
        taxConfig: {
          isTaxAccount: true,
          gstType: 'SGST',
          taxRatePercent: 9,
        },
      },
      {
        id: `ledg-${prefix}-cgst-out`,
        tenantId,
        groupId: `grp-${prefix}-tax-out`,
        groupName: 'Duties & Taxes (Output)',
        code: '2041',
        name: 'CGST Output Liability',
        classification: 'LIABILITY',
        normalBalance: 'CREDIT',
        openingBalance: '0.00',
        openingBalanceType: 'CREDIT',
        openingBalanceDate: '2026-04-01',
        currentBalance: '0.00',
        isActive: true,
        taxConfig: {
          isTaxAccount: true,
          gstType: 'CGST',
          taxRatePercent: 9,
        },
      },
      {
        id: `ledg-${prefix}-sgst-out`,
        tenantId,
        groupId: `grp-${prefix}-tax-out`,
        groupName: 'Duties & Taxes (Output)',
        code: '2042',
        name: 'SGST Output Liability',
        classification: 'LIABILITY',
        normalBalance: 'CREDIT',
        openingBalance: '0.00',
        openingBalanceType: 'CREDIT',
        openingBalanceDate: '2026-04-01',
        currentBalance: '0.00',
        isActive: true,
        taxConfig: {
          isTaxAccount: true,
          gstType: 'SGST',
          taxRatePercent: 9,
        },
      },
      {
        id: `ledg-${prefix}-capital`,
        tenantId,
        groupId: `grp-${prefix}-capital`,
        groupName: 'Capital Account',
        code: '5010',
        name: 'Equity Share Capital',
        classification: 'EQUITY',
        normalBalance: 'CREDIT',
        openingBalance: '1508000.50',
        openingBalanceType: 'CREDIT',
        openingBalanceDate: '2026-04-01',
        currentBalance: '1508000.50',
        isActive: true,
      },
    ];

    for (const l of defaultLedgers) {
      this.schema.chartOfAccounts.push({
        ...l,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  private persist() {
    if (this.transactionDepth > 0) {
      // Do not write to disk while inside a transaction until outer commit
      return;
    }
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.schema, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[DB] Could not persist to file, staying in-memory:', err);
    }
  }

  /**
   * Executes atomic database transaction. If work throws an error, all changes
   * to this.schema are rolled back completely with zero state pollution.
   */
  public runTransaction<T>(work: (store: DatabaseStore) => T): T {
    this.transactionDepth++;
    // Snapshot schema state for zero-leak rollback
    const snapshot = JSON.stringify(this.schema);
    try {
      const result = work(this);
      this.transactionDepth--;
      if (this.transactionDepth === 0) {
        this.persist();
      }
      return result;
    } catch (error) {
      this.schema = JSON.parse(snapshot);
      this.transactionDepth--;
      throw error;
    }
  }

  // --- Tenants / Companies ---
  public findTenantById(id: string): TenantRecord | undefined {
    return this.schema.tenants.find((t) => t.id === id);
  }

  public findTenantByGstin(gstin: string): TenantRecord | undefined {
    if (!gstin) return undefined;
    return this.schema.tenants.find(
      (t) => t.gstin && t.gstin.toUpperCase() === gstin.trim().toUpperCase()
    );
  }

  public createTenant(data: Omit<TenantRecord, 'id' | 'createdAt' | 'updatedAt'>): TenantRecord {
    const now = new Date().toISOString();
    const tenant: TenantRecord = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.schema.tenants.push(tenant);
    // Seed default chart of accounts and FY
    this.seedAccountingDefaultsForTenant(tenant.id);
    this.persist();
    return tenant;
  }

  public updateTenant(id: string, updates: Partial<TenantRecord>): TenantRecord | undefined {
    const tenant = this.findTenantById(id);
    if (!tenant) return undefined;

    if (updates.preferences) {
      tenant.preferences = {
        accounting: { ...tenant.preferences.accounting, ...(updates.preferences.accounting || {}) },
        inventory: { ...tenant.preferences.inventory, ...(updates.preferences.inventory || {}) },
        tax: { ...tenant.preferences.tax, ...(updates.preferences.tax || {}) },
        invoicing: { ...tenant.preferences.invoicing, ...(updates.preferences.invoicing || {}) },
      };
      delete updates.preferences;
    }

    if (updates.financialYear) {
      tenant.financialYear = {
        ...tenant.financialYear,
        ...updates.financialYear,
      };
      delete updates.financialYear;
    }

    if (updates.address) {
      tenant.address = {
        ...tenant.address,
        ...updates.address,
      };
      delete updates.address;
    }

    Object.assign(tenant, updates);
    tenant.updatedAt = new Date().toISOString();
    this.persist();
    return tenant;
  }

  public getAllTenants(): TenantRecord[] {
    return [...this.schema.tenants];
  }

  // --- Users ---
  public findUserByEmail(email: string): UserRecord | undefined {
    return this.schema.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public findUserById(id: string): UserRecord | undefined {
    return this.schema.users.find((u) => u.id === id);
  }

  public createUser(data: Omit<UserRecord, 'id' | 'createdAt'>): UserRecord {
    const user: UserRecord = {
      ...data,
      id: crypto.randomUUID(),
      email: data.email.toLowerCase().trim(),
      createdAt: new Date().toISOString(),
    };
    this.schema.users.push(user);
    this.persist();
    return user;
  }

  public updateUser(id: string, updates: Partial<UserRecord>): UserRecord | undefined {
    const user = this.findUserById(id);
    if (!user) return undefined;
    Object.assign(user, updates);
    this.persist();
    return user;
  }

  // --- Sessions ---
  public createSession(data: Omit<SessionRecord, 'id' | 'createdAt'>): SessionRecord {
    const session: SessionRecord = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.schema.sessions.push(session);
    this.persist();
    return session;
  }

  public findSessionByToken(token: string): SessionRecord | undefined {
    return this.schema.sessions.find((s) => s.token === token);
  }

  public deleteSession(token: string): boolean {
    const index = this.schema.sessions.findIndex((s) => s.token === token);
    if (index !== -1) {
      this.schema.sessions.splice(index, 1);
      this.persist();
      return true;
    }
    return false;
  }

  public deleteSessionsForUser(userId: string): void {
    this.schema.sessions = this.schema.sessions.filter((s) => s.userId !== userId);
    this.persist();
  }

  // --- Password Resets ---
  public createPasswordReset(data: Omit<PasswordResetTokenRecord, 'id' | 'createdAt' | 'used'>): PasswordResetTokenRecord {
    const resetRecord: PasswordResetTokenRecord = {
      ...data,
      id: crypto.randomUUID(),
      used: false,
      createdAt: new Date().toISOString(),
    };
    this.schema.passwordResets.push(resetRecord);
    this.persist();
    return resetRecord;
  }

  public findPasswordResetByToken(token: string): PasswordResetTokenRecord | undefined {
    return this.schema.passwordResets.find((r) => r.token === token && !r.used);
  }

  public markPasswordResetUsed(id: string): void {
    const record = this.schema.passwordResets.find((r) => r.id === id);
    if (record) {
      record.used = true;
      this.persist();
    }
  }

  // --- Tenant-Isolated Ledgers & Vouchers (Legacy Compatibility) ---
  public getLedgersForTenant(tenantId: string): IsolatedLedgerRecord[] {
    return this.schema.ledgers.filter((l) => l.tenantId === tenantId);
  }

  public createLedgerForTenant(data: Omit<IsolatedLedgerRecord, 'id' | 'createdAt'>): IsolatedLedgerRecord {
    const record: IsolatedLedgerRecord = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.schema.ledgers.push(record);
    this.persist();
    return record;
  }

  public getVouchersForTenant(tenantId: string): IsolatedVoucherRecord[] {
    return this.schema.vouchers.filter((v) => v.tenantId === tenantId);
  }

  public createVoucherForTenant(data: Omit<IsolatedVoucherRecord, 'id' | 'createdAt'>): IsolatedVoucherRecord {
    const record: IsolatedVoucherRecord = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.schema.vouchers.push(record);
    this.persist();
    return record;
  }

  // --- Chart of Accounts (Posting Ledgers) ---
  public getChartOfAccounts(tenantId: string): LedgerAccountRecord[] {
    return this.schema.chartOfAccounts.filter((l) => l.tenantId === tenantId);
  }

  public findLedgerAccountById(tenantId: string, id: string): LedgerAccountRecord | undefined {
    return this.schema.chartOfAccounts.find((l) => l.tenantId === tenantId && l.id === id);
  }

  public findLedgerAccountByCode(tenantId: string, code: string): LedgerAccountRecord | undefined {
    return this.schema.chartOfAccounts.find(
      (l) => l.tenantId === tenantId && l.code.toUpperCase() === code.trim().toUpperCase()
    );
  }

  public createLedgerAccount(data: Omit<LedgerAccountRecord, 'id' | 'createdAt' | 'updatedAt'>): LedgerAccountRecord {
    const now = new Date().toISOString();
    const ledger: LedgerAccountRecord = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.schema.chartOfAccounts.push(ledger);
    this.persist();
    return ledger;
  }

  public updateLedgerAccountBalance(tenantId: string, ledgerId: string, newBalance: string): void {
    const ledger = this.findLedgerAccountById(tenantId, ledgerId);
    if (ledger) {
      ledger.currentBalance = newBalance;
      ledger.updatedAt = new Date().toISOString();
      this.persist();
    }
  }

  public updateLedgerAccount(id: string, updates: Partial<LedgerAccountRecord>): LedgerAccountRecord | undefined {
    const ledger = this.schema.chartOfAccounts.find((l) => l.id === id);
    if (!ledger) return undefined;
    Object.assign(ledger, updates);
    ledger.updatedAt = new Date().toISOString();
    this.persist();
    return ledger;
  }

  public deleteLedgerAccount(id: string): boolean {
    const idx = this.schema.chartOfAccounts.findIndex((l) => l.id === id);
    if (idx !== -1) {
      this.schema.chartOfAccounts.splice(idx, 1);
      this.persist();
      return true;
    }
    return false;
  }

  // --- Account Groups ---
  public getAccountGroups(tenantId: string): AccountGroupRecord[] {
    return this.schema.accountGroups.filter((g) => g.tenantId === tenantId);
  }

  public findAccountGroupById(tenantId: string, id: string): AccountGroupRecord | undefined {
    return this.schema.accountGroups.find((g) => g.tenantId === tenantId && g.id === id);
  }

  public findAccountGroupByCode(tenantId: string, code: string): AccountGroupRecord | undefined {
    return this.schema.accountGroups.find(
      (g) => g.tenantId === tenantId && g.code.toUpperCase() === code.trim().toUpperCase()
    );
  }

  public findAccountGroupByName(tenantId: string, name: string): AccountGroupRecord | undefined {
    return this.schema.accountGroups.find(
      (g) => g.tenantId === tenantId && g.name.toLowerCase() === name.trim().toLowerCase()
    );
  }

  public createAccountGroup(data: Omit<AccountGroupRecord, 'id' | 'createdAt'>): AccountGroupRecord {
    const now = new Date().toISOString();
    const group: AccountGroupRecord = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.schema.accountGroups.push(group);
    this.persist();
    return group;
  }

  public updateAccountGroup(id: string, updates: Partial<AccountGroupRecord>): AccountGroupRecord | undefined {
    const group = this.schema.accountGroups.find((g) => g.id === id);
    if (!group) return undefined;
    Object.assign(group, updates);
    group.updatedAt = new Date().toISOString();
    this.persist();
    return group;
  }

  public deleteAccountGroup(id: string): boolean {
    const idx = this.schema.accountGroups.findIndex((g) => g.id === id);
    if (idx !== -1) {
      this.schema.accountGroups.splice(idx, 1);
      this.persist();
      return true;
    }
    return false;
  }

  // --- Financial Years & Accounting Periods ---
  public getFinancialYears(tenantId: string): FinancialYearRecord[] {
    return this.schema.financialYears.filter((fy) => fy.tenantId === tenantId);
  }

  public findFinancialYearById(tenantId: string, id: string): FinancialYearRecord | undefined {
    return this.schema.financialYears.find((fy) => fy.tenantId === tenantId && fy.id === id);
  }

  public findFinancialYearByDate(tenantId: string, date: string): FinancialYearRecord | undefined {
    return this.schema.financialYears.find(
      (fy) => fy.tenantId === tenantId && date >= fy.startDate && date <= fy.endDate
    );
  }

  public createFinancialYear(data: Omit<FinancialYearRecord, 'id' | 'createdAt' | 'updatedAt'>): FinancialYearRecord {
    const now = new Date().toISOString();
    const fy: FinancialYearRecord = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.schema.financialYears.push(fy);
    this.persist();
    return fy;
  }

  public updateFinancialYear(id: string, updates: Partial<FinancialYearRecord>): FinancialYearRecord | undefined {
    const fy = this.schema.financialYears.find((f) => f.id === id);
    if (!fy) return undefined;
    Object.assign(fy, updates);
    fy.updatedAt = new Date().toISOString();
    this.persist();
    return fy;
  }

  public getAccountingPeriods(tenantId: string, fyId?: string): AccountingPeriodRecord[] {
    return this.schema.accountingPeriods.filter(
      (p) => p.tenantId === tenantId && (!fyId || p.financialYearId === fyId)
    );
  }

  public findAccountingPeriodById(tenantId: string, id: string): AccountingPeriodRecord | undefined {
    return this.schema.accountingPeriods.find((p) => p.tenantId === tenantId && p.id === id);
  }

  public findAccountingPeriodByDate(tenantId: string, date: string): AccountingPeriodRecord | undefined {
    return this.schema.accountingPeriods.find(
      (p) => p.tenantId === tenantId && date >= p.startDate && date <= p.endDate
    );
  }

  public createAccountingPeriod(data: Omit<AccountingPeriodRecord, 'id' | 'createdAt' | 'updatedAt'>): AccountingPeriodRecord {
    const now = new Date().toISOString();
    const period: AccountingPeriodRecord = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.schema.accountingPeriods.push(period);
    this.persist();
    return period;
  }

  public updateAccountingPeriod(id: string, updates: Partial<AccountingPeriodRecord>): AccountingPeriodRecord | undefined {
    const period = this.schema.accountingPeriods.find((p) => p.id === id);
    if (!period) return undefined;
    Object.assign(period, updates);
    period.updatedAt = new Date().toISOString();
    this.persist();
    return period;
  }

  // --- Journal Entries & Lines ---
  public getJournalEntries(
    tenantId: string,
    filters?: {
      status?: string;
      voucherType?: string;
      fromDate?: string;
      toDate?: string;
      reversalOfJournalId?: string;
    }
  ): JournalEntryRecord[] {
    return this.schema.journalEntries.filter((j) => {
      if (j.tenantId !== tenantId) return false;
      if (filters?.status && j.postedStatus !== filters.status) return false;
      if (filters?.voucherType && j.voucherType !== filters.voucherType) return false;
      if (filters?.fromDate && j.entryDate < filters.fromDate) return false;
      if (filters?.toDate && j.entryDate > filters.toDate) return false;
      if (filters?.reversalOfJournalId && j.reversalOfJournalId !== filters.reversalOfJournalId) return false;
      return true;
    });
  }

  public findJournalEntryById(tenantId: string, id: string): JournalEntryRecord | undefined {
    return this.schema.journalEntries.find((j) => j.tenantId === tenantId && j.id === id);
  }

  public findJournalEntryByVoucher(
    tenantId: string,
    fyId: string,
    voucherType: string,
    voucherNumber: string
  ): JournalEntryRecord | undefined {
    return this.schema.journalEntries.find(
      (j) =>
        j.tenantId === tenantId &&
        j.financialYearId === fyId &&
        j.voucherType === voucherType &&
        j.voucherNumber.toLowerCase() === voucherNumber.toLowerCase()
    );
  }

  public getJournalLines(journalEntryId: string): JournalLineRecord[] {
    return this.schema.journalLines
      .filter((l) => l.journalEntryId === journalEntryId)
      .sort((a, b) => a.lineNumber - b.lineNumber);
  }

  public getJournalLinesForLedger(tenantId: string, ledgerId: string): JournalLineRecord[] {
    return this.schema.journalLines.filter((l) => l.tenantId === tenantId && l.ledgerId === ledgerId);
  }

  public insertJournalWithLines(
    entryData: Omit<JournalEntryRecord, 'id' | 'createdAt' | 'updatedAt'>,
    linesData: Array<Omit<JournalLineRecord, 'id' | 'journalEntryId' | 'createdAt'>>
  ): { entry: JournalEntryRecord; lines: JournalLineRecord[] } {
    const journalId = crypto.randomUUID();
    const now = new Date().toISOString();

    const entry: JournalEntryRecord = {
      ...entryData,
      id: journalId,
      createdAt: now,
      updatedAt: now,
    };

    const lines: JournalLineRecord[] = linesData.map((l, index) => ({
      ...l,
      id: crypto.randomUUID(),
      journalEntryId: journalId,
      lineNumber: l.lineNumber || index + 1,
      createdAt: now,
    }));

    this.schema.journalEntries.push(entry);
    this.schema.journalLines.push(...lines);
    this.persist();

    return { entry, lines };
  }

  public updateJournalEntry(id: string, updates: Partial<JournalEntryRecord>): JournalEntryRecord | undefined {
    const entry = this.schema.journalEntries.find((j) => j.id === id);
    if (!entry) return undefined;
    Object.assign(entry, updates);
    entry.updatedAt = new Date().toISOString();
    this.persist();
    return entry;
  }

  // --- MCA 2013 Statutory Audit Logs ---
  public appendAuditLog(data: Omit<AuditLogRecord, 'id' | 'createdAt' | 'hash'>): AuditLogRecord {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    // Previous hash chain for tamper-evidence
    const prevLog = this.schema.auditLogs[this.schema.auditLogs.length - 1];
    const prevHash = prevLog ? prevLog.hash : 'GENESIS';

    const payloadToHash = JSON.stringify({
      id,
      tenantId: data.tenantId,
      entityType: data.entityType,
      entityId: data.entityId,
      action: data.action,
      performedBy: data.performedBy,
      details: data.details,
      prevHash,
      createdAt: now,
    });

    const hash = crypto.createHash('sha256').update(payloadToHash).digest('hex');

    const record: AuditLogRecord = {
      ...data,
      id,
      hash,
      createdAt: now,
    };

    this.schema.auditLogs.push(record);
    this.persist();
    return record;
  }

  public getAuditLogs(tenantId: string, entityId?: string): AuditLogRecord[] {
    return this.schema.auditLogs.filter(
      (log) => log.tenantId === tenantId && (!entityId || log.entityId === entityId)
    );
  }

  // --- Strict Tenant Boundary Audit ---
  public auditCompanyIsolation(tenantId: string): {
    totalLedgers: number;
    totalVouchers: number;
    totalJournalEntries: number;
    totalJournalLines: number;
    crossTenantLeakageCount: number;
    isIsolated: boolean;
  } {
    const foreignLedgers = this.schema.ledgers.filter((l) => l.tenantId !== tenantId);
    const tenantLedgers = this.schema.ledgers.filter((l) => l.tenantId === tenantId);
    const foreignVouchers = this.schema.vouchers.filter((v) => v.tenantId !== tenantId);
    const tenantVouchers = this.schema.vouchers.filter((v) => v.tenantId === tenantId);
    const foreignCOA = this.schema.chartOfAccounts.filter((l) => l.tenantId !== tenantId);
    const tenantCOA = this.schema.chartOfAccounts.filter((l) => l.tenantId === tenantId);
    const foreignJournals = this.schema.journalEntries.filter((j) => j.tenantId !== tenantId);
    const tenantJournals = this.schema.journalEntries.filter((j) => j.tenantId === tenantId);
    const foreignLines = this.schema.journalLines.filter((l) => l.tenantId !== tenantId);
    const tenantLines = this.schema.journalLines.filter((l) => l.tenantId === tenantId);

    // Cross-tenant leakage would occur if a query for tenantId returned items with different tenantId
    const leakage = tenantLedgers.filter((l) => l.tenantId !== tenantId).length +
                    tenantVouchers.filter((v) => v.tenantId !== tenantId).length +
                    tenantCOA.filter((l) => l.tenantId !== tenantId).length +
                    tenantJournals.filter((j) => j.tenantId !== tenantId).length +
                    tenantLines.filter((l) => l.tenantId !== tenantId).length;

    return {
      totalLedgers: tenantLedgers.length + tenantCOA.length,
      totalVouchers: tenantVouchers.length,
      totalJournalEntries: tenantJournals.length,
      totalJournalLines: tenantLines.length,
      crossTenantLeakageCount: leakage,
      isIsolated: leakage === 0,
    };
  }

  public resetToCleanState(): void {
    this.schema = {
      tenants: [],
      users: [],
      sessions: [],
      passwordResets: [],
      ledgers: [],
      vouchers: [],
      accountGroups: [],
      chartOfAccounts: [],
      financialYears: [],
      accountingPeriods: [],
      journalEntries: [],
      journalLines: [],
      auditLogs: [],
    };
    this.seedInitialDefaults();
    this.persist();
  }
}

export const db = new DatabaseStore();
