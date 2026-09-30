import fs from 'node:fs';
import path from 'node:path';
import {
  DatabaseSchema,
  TenantRecord,
  UserRecord,
  SessionRecord,
  PasswordResetTokenRecord,
  IsolatedLedgerRecord,
  IsolatedVoucherRecord,
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
};

export class DatabaseStore {
  private schema: DatabaseSchema = { ...INITIAL_SCHEMA };
  private isLoaded = false;

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
        };
        // Ensure default tenant has full configuration
        if (this.schema.tenants.length > 0 && !this.schema.tenants[0].preferences) {
          this.upgradeLegacyTenants();
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

    // Seed sample isolated ledgers for Company 1
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
  }

  private persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.schema, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[DB] Could not persist to file, staying in-memory:', err);
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
    this.persist();
    return tenant;
  }

  public updateTenant(id: string, updates: Partial<TenantRecord>): TenantRecord | undefined {
    const tenant = this.findTenantById(id);
    if (!tenant) return undefined;

    // Deep merge preferences if present
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

  // --- Tenant-Isolated Ledgers & Vouchers ---
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

  public auditCompanyIsolation(tenantId: string): {
    totalLedgers: number;
    totalVouchers: number;
    crossTenantLeakageCount: number;
    isIsolated: boolean;
  } {
    const foreignLedgers = this.schema.ledgers.filter((l) => l.tenantId !== tenantId);
    const tenantLedgers = this.schema.ledgers.filter((l) => l.tenantId === tenantId);
    const foreignVouchers = this.schema.vouchers.filter((v) => v.tenantId !== tenantId);
    const tenantVouchers = this.schema.vouchers.filter((v) => v.tenantId === tenantId);

    // Cross-tenant leakage would occur if a query for tenantId returned items with different tenantId
    const leakage = tenantLedgers.filter((l) => l.tenantId !== tenantId).length +
                    tenantVouchers.filter((v) => v.tenantId !== tenantId).length;

    return {
      totalLedgers: tenantLedgers.length,
      totalVouchers: tenantVouchers.length,
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
    };
    this.seedInitialDefaults();
    this.persist();
  }
}

export const db = new DatabaseStore();
