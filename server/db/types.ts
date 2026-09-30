import {
  BusinessType,
  CompanyAddress,
  CompanyCurrency,
  CompanyPreferences,
  FinancialYearConfig,
} from '../../shared/types/company';

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

export interface DatabaseSchema {
  tenants: TenantRecord[];
  users: UserRecord[];
  sessions: SessionRecord[];
  passwordResets: PasswordResetTokenRecord[];
  ledgers: IsolatedLedgerRecord[];
  vouchers: IsolatedVoucherRecord[];
}
