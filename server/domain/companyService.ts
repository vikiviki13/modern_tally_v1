import { db, DEFAULT_PREFERENCES } from '../db/store';
import { securityLogger } from '../infra/logger';
import {
  CompanyDTO,
  CreateCompanyPayload,
  UpdateCompanyPayload,
  CompanyIsolationAuditDTO,
  BusinessType,
} from '../../shared/types/company';

export class CompanyService {
  /**
   * GSTIN Validation regex (15 alphanumeric characters as per GST rules)
   * 2 digits (State) + 5 letters + 4 digits + 1 letter (PAN) + 1 digit (entity) + 'Z' + 1 check digit
   */
  public static GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  public static PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

  public validateCreatePayload(payload: CreateCompanyPayload): void {
    if (!payload.name || payload.name.trim().length < 2) {
      throw new Error('Business Name is required (minimum 2 characters).');
    }

    if (!payload.state || !payload.stateCode) {
      throw new Error('State and State Code are required for statutory compliance.');
    }

    if (!payload.financialYearStart || !payload.financialYearEnd) {
      throw new Error('Financial Year Start and End dates are required.');
    }

    const fyStart = new Date(payload.financialYearStart);
    const fyEnd = new Date(payload.financialYearEnd);
    if (isNaN(fyStart.getTime()) || isNaN(fyEnd.getTime())) {
      throw new Error('Invalid Financial Year date format (use YYYY-MM-DD).');
    }

    if (fyEnd <= fyStart) {
      throw new Error('Financial Year End date must be strictly after Financial Year Start date.');
    }

    if (!payload.booksBeginningDate) {
      throw new Error('Books Beginning Date is required.');
    }

    const booksStart = new Date(payload.booksBeginningDate);
    if (isNaN(booksStart.getTime())) {
      throw new Error('Invalid Books Beginning Date format (use YYYY-MM-DD).');
    }

    if (booksStart < fyStart) {
      throw new Error('Books Beginning Date cannot be earlier than Financial Year Start Date.');
    }

    // GSTIN Validation & Duplicate Check
    if (payload.gstin && payload.gstin.trim() !== '') {
      const gstinClean = payload.gstin.trim().toUpperCase();
      if (!CompanyService.GSTIN_REGEX.test(gstinClean)) {
        throw new Error('Invalid GSTIN format. Expected 15 characters (e.g., 27AABCA1234F1Z1).');
      }

      // Ensure state code matches GSTIN prefix
      const gstinState = gstinClean.substring(0, 2);
      if (payload.stateCode.trim() !== gstinState) {
        throw new Error(`GSTIN state prefix (${gstinState}) does not match selected State Code (${payload.stateCode}).`);
      }

      const existing = db.findTenantByGstin(gstinClean);
      if (existing) {
        throw new Error(`A company with GSTIN ${gstinClean} is already registered (${existing.name}).`);
      }
    }

    // PAN Validation
    if (payload.pan && payload.pan.trim() !== '') {
      const panClean = payload.pan.trim().toUpperCase();
      if (!CompanyService.PAN_REGEX.test(panClean)) {
        throw new Error('Invalid PAN format. Expected 10 alphanumeric characters (e.g., AABCA1234F).');
      }
    }
  }

  public createCompany(userId: string, payload: CreateCompanyPayload, ip?: string): CompanyDTO {
    this.validateCreatePayload(payload);

    const name = payload.name.trim();
    const legalName = payload.legalName?.trim() || `${name} ${payload.businessType === 'PVT_LTD' ? 'Private Limited' : 'Ltd'}`;
    const gstin = payload.gstin?.trim().toUpperCase();
    // Auto-extract PAN from GSTIN if omitted
    const pan = payload.pan?.trim().toUpperCase() || (gstin ? gstin.substring(2, 12) : undefined);

    const currencyCode = payload.currencyCode || 'INR';
    const currency = {
      code: currencyCode,
      symbol: currencyCode === 'INR' ? '₹' : currencyCode === 'USD' ? '$' : currencyCode === 'EUR' ? '€' : currencyCode === 'GBP' ? '£' : currencyCode,
      decimalPlaces: 2,
      formatLocale: currencyCode === 'INR' ? 'en-IN' : 'en-US',
    };

    const fyStartYear = new Date(payload.financialYearStart).getFullYear();
    const fyEndYear = new Date(payload.financialYearEnd).getFullYear();
    const fyName = `FY ${fyStartYear}-${String(fyEndYear).slice(-2)}`;

    // Build merged preferences with sensible defaults
    const preferences = {
      accounting: { ...DEFAULT_PREFERENCES.accounting, ...(payload.preferences?.accounting || {}) },
      inventory: { ...DEFAULT_PREFERENCES.inventory, ...(payload.preferences?.inventory || {}) },
      tax: { ...DEFAULT_PREFERENCES.tax, ...(payload.preferences?.tax || {}) },
      invoicing: { ...DEFAULT_PREFERENCES.invoicing, ...(payload.preferences?.invoicing || {}) },
    };

    const tenant = db.createTenant({
      name,
      legalName,
      businessType: payload.businessType || 'PVT_LTD',
      industry: payload.industry || 'General Business',
      country: payload.country || 'India',
      state: payload.state,
      stateCode: payload.stateCode,
      address: {
        street: payload.street?.trim() || 'Head Office',
        city: payload.city?.trim() || 'Commercial Hub',
        state: payload.state,
        stateCode: payload.stateCode,
        country: payload.country || 'India',
        pincode: payload.pincode?.trim() || '400001',
      },
      gstin,
      pan,
      currency,
      financialYear: {
        name: fyName,
        startDate: payload.financialYearStart,
        endDate: payload.financialYearEnd,
        isLocked: false,
      },
      booksBeginningDate: payload.booksBeginningDate,
      preferences,
    });

    // Seed default baseline isolated accounts for this new company
    db.createLedgerForTenant({
      tenantId: tenant.id,
      name: 'Cash Account',
      groupName: 'Cash-in-Hand',
      openingBalance: 0,
      balanceType: 'DR',
    });

    db.createLedgerForTenant({
      tenantId: tenant.id,
      name: 'Profit & Loss A/c',
      groupName: 'Primary',
      openingBalance: 0,
      balanceType: 'CR',
    });

    securityLogger.log({
      eventType: 'AUTH_REGISTER_ORGANIZATION',
      userId,
      tenantId: tenant.id,
      ipAddress: ip,
      details: {
        action: 'COMPANY_CREATED',
        companyName: tenant.name,
        gstin: tenant.gstin,
        businessType: tenant.businessType,
      },
    });

    return tenant;
  }

  public updateCompany(companyId: string, payload: UpdateCompanyPayload, userId?: string, ip?: string): CompanyDTO {
    const existing = db.findTenantById(companyId);
    if (!existing) {
      throw new Error(`Company with ID ${companyId} not found.`);
    }

    if (payload.name && payload.name.trim().length < 2) {
      throw new Error('Company name must be at least 2 characters.');
    }

    if (payload.gstin && payload.gstin.trim() !== '') {
      const gstinClean = payload.gstin.trim().toUpperCase();
      if (!CompanyService.GSTIN_REGEX.test(gstinClean)) {
        throw new Error('Invalid GSTIN format (15 alphanumeric characters).');
      }
      const duplicate = db.findTenantByGstin(gstinClean);
      if (duplicate && duplicate.id !== companyId) {
        throw new Error(`Another company is already registered with GSTIN ${gstinClean}.`);
      }
    }

    if (payload.pan && payload.pan.trim() !== '') {
      const panClean = payload.pan.trim().toUpperCase();
      if (!CompanyService.PAN_REGEX.test(panClean)) {
        throw new Error('Invalid PAN format (10 alphanumeric characters).');
      }
    }

    const updated = db.updateTenant(companyId, {
      ...(payload.name ? { name: payload.name.trim() } : {}),
      ...(payload.legalName ? { legalName: payload.legalName.trim() } : {}),
      ...(payload.businessType ? { businessType: payload.businessType } : {}),
      ...(payload.industry ? { industry: payload.industry.trim() } : {}),
      ...(payload.gstin !== undefined ? { gstin: payload.gstin.trim().toUpperCase() || undefined } : {}),
      ...(payload.pan !== undefined ? { pan: payload.pan.trim().toUpperCase() || undefined } : {}),
      ...(payload.booksBeginningDate ? { booksBeginningDate: payload.booksBeginningDate } : {}),
      ...(payload.address ? { address: payload.address as any } : {}),
      ...(payload.financialYear ? { financialYear: payload.financialYear as any } : {}),
      ...(payload.preferences ? { preferences: payload.preferences as any } : {}),
    } as any);

    if (!updated) {
      throw new Error('Failed to update company.');
    }

    securityLogger.log({
      eventType: 'TENANT_SWITCH',
      userId,
      tenantId: companyId,
      ipAddress: ip,
      details: { action: 'COMPANY_CONFIGURATION_UPDATED', companyName: updated.name },
    });

    return updated;
  }

  public getCompanyById(companyId: string): CompanyDTO {
    const tenant = db.findTenantById(companyId);
    if (!tenant) {
      throw new Error(`Company with ID ${companyId} not found.`);
    }
    return tenant;
  }

  public getAllCompanies(): CompanyDTO[] {
    return db.getAllTenants();
  }

  public auditCompanyIsolation(companyId: string): CompanyIsolationAuditDTO {
    const company = db.findTenantById(companyId);
    if (!company) {
      throw new Error(`Company with ID ${companyId} not found.`);
    }

    const audit = db.auditCompanyIsolation(companyId);

    return {
      companyId,
      companyName: company.name,
      totalLedgersCount: audit.totalLedgers,
      totalTransactionsCount: audit.totalVouchers,
      isIsolated: audit.isIsolated,
      crossTenantLeakageCount: audit.crossTenantLeakageCount,
      auditTimestamp: new Date().toISOString(),
    };
  }
}

export const companyService = new CompanyService();
