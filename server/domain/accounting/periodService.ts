/**
 * Accounting Period & Financial Year Governance Service
 * Phase 06 Deliverable — Double-Entry Accounting Engine
 *
 * Enforces period locks, financial year closure, and freeze date rules.
 * Governs the Statutory Authorized Adjustment workflow (MCA 2013 / ICAI compliance).
 */

import { db } from '../../db/store';
import { FinancialYearRecord, AccountingPeriodRecord } from '../../db/types';

export class AccountingPeriodError extends Error {
  public code: string;
  constructor(message: string, code = 'PERIOD_ERROR') {
    super(message);
    this.name = 'AccountingPeriodError';
    this.code = code;
  }
}

export interface PeriodValidationResult {
  financialYear: FinancialYearRecord;
  accountingPeriod: AccountingPeriodRecord;
  isAuthorizedAdjustment: boolean;
  adjustmentReason?: string;
}

export class PeriodService {
  /**
   * Validates if a transaction date can be posted into.
   * Rejects closed financial years, locked periods, and freeze dates unless an authorized
   * adjustment workflow is validated (Auditor / Super Admin role + documented justification).
   */
  public validatePostingPeriod(
    tenantId: string,
    entryDate: string,
    isAuthorizedAdjustment = false,
    userRole?: string,
    adjustmentReason?: string
  ): PeriodValidationResult {
    if (!entryDate || !/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
      throw new AccountingPeriodError(`Invalid transaction date format: "${entryDate}". Expected YYYY-MM-DD.`, 'INVALID_DATE');
    }

    const txDate = new Date(entryDate);
    if (isNaN(txDate.getTime())) {
      throw new AccountingPeriodError(`Invalid calendar date: "${entryDate}".`, 'INVALID_DATE');
    }

    // 1. Locate Financial Year covering transaction date
    let fy = db.findFinancialYearByDate(tenantId, entryDate);
    if (!fy) {
      // Fallback check on tenant record
      const tenant = db.findTenantById(tenantId);
      if (tenant?.financialYear && entryDate >= tenant.financialYear.startDate && entryDate <= tenant.financialYear.endDate) {
        fy = {
          id: `fy-${tenantId.substring(0, 8)}-derived`,
          tenantId,
          code: tenant.financialYear.name,
          name: tenant.financialYear.name,
          startDate: tenant.financialYear.startDate,
          endDate: tenant.financialYear.endDate,
          isClosed: !!tenant.financialYear.isLocked,
          freezeDate: tenant.financialYear.freezeDate,
          createdAt: tenant.createdAt,
          updatedAt: tenant.updatedAt,
        };
      } else {
        throw new AccountingPeriodError(
          `No open Financial Year defined for transaction date ${entryDate} in tenant ${tenantId}.`,
          'NO_FINANCIAL_YEAR'
        );
      }
    }

    // 2. Locate Accounting Period covering transaction date
    let period = db.findAccountingPeriodByDate(tenantId, entryDate);
    if (!period) {
      // Create a default monthly period dynamically if missing
      const [yearStr, monthStr] = entryDate.split('-');
      const monthNum = parseInt(monthStr, 10);
      const lastDay = new Date(parseInt(yearStr, 10), monthNum, 0).getDate();
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      period = db.createAccountingPeriod({
        tenantId,
        financialYearId: fy.id,
        periodNumber: monthNum,
        name: `${monthNames[monthNum - 1]} ${yearStr}`,
        startDate: `${yearStr}-${monthStr}-01`,
        endDate: `${yearStr}-${monthStr}-${lastDay.toString().padStart(2, '0')}`,
        isLocked: false,
      });
    }

    // Helper: Validates authorized statutory adjustment credentials
    const checkAuthorizedAdjustment = (reasonPrefix: string): boolean => {
      if (!isAuthorizedAdjustment) {
        return false;
      }
      const isAuthorizedRole = userRole === 'SUPER_ADMIN' || userRole === 'AUDITOR';
      if (!isAuthorizedRole) {
        throw new AccountingPeriodError(
          `Statutory adjustment rejected: Role "${userRole || 'ANONYMOUS'}" lacks statutory adjustment authority. Only SUPER_ADMIN or AUDITOR may post into closed/locked periods.`,
          'UNAUTHORIZED_ADJUSTMENT_ROLE'
        );
      }
      if (!adjustmentReason || adjustmentReason.trim().length < 10) {
        throw new AccountingPeriodError(
          `Statutory adjustment rejected: A comprehensive documented reason is mandatory (minimum 10 characters). Received: "${adjustmentReason || ''}".`,
          'ADJUSTMENT_REASON_MANDATORY'
        );
      }
      return true;
    };

    // 3. Evaluate Closed Financial Year
    if (fy.isClosed) {
      if (!checkAuthorizedAdjustment('Financial Year is closed')) {
        throw new AccountingPeriodError(
          `Posting rejected: Financial Year "${fy.code}" is closed. Transactions cannot be posted into closed financial years without statutory audit authorization.`,
          'FINANCIAL_YEAR_CLOSED'
        );
      }
    }

    // 4. Evaluate Locked Accounting Period
    if (period.isLocked) {
      if (!checkAuthorizedAdjustment(`Accounting period "${period.name}" is locked`)) {
        throw new AccountingPeriodError(
          `Posting rejected: Accounting Period "${period.name}" (${period.startDate} to ${period.endDate}) is locked against regular journal postings.`,
          'ACCOUNTING_PERIOD_LOCKED'
        );
      }
    }

    // 5. Evaluate Compliance Freeze Date
    const freezeDate = fy.freezeDate;
    if (freezeDate && entryDate <= freezeDate) {
      if (!checkAuthorizedAdjustment(`Entry date is prior to freeze date (${freezeDate})`)) {
        throw new AccountingPeriodError(
          `Posting rejected: Transaction date ${entryDate} is on or prior to statutory freeze date ${freezeDate}. Backdating is strictly locked.`,
          'FREEZE_DATE_BREACH'
        );
      }
    }

    return {
      financialYear: fy,
      accountingPeriod: period,
      isAuthorizedAdjustment,
      adjustmentReason: isAuthorizedAdjustment ? adjustmentReason?.trim() : undefined,
    };
  }

  public lockPeriod(tenantId: string, periodId: string, userId: string): AccountingPeriodRecord {
    const period = db.findAccountingPeriodById(tenantId, periodId);
    if (!period) {
      throw new AccountingPeriodError(`Accounting Period "${periodId}" not found.`, 'NOT_FOUND');
    }
    const updated = db.updateAccountingPeriod(periodId, {
      isLocked: true,
      lockedAt: new Date().toISOString(),
      lockedBy: userId,
    });
    if (!updated) {
      throw new AccountingPeriodError(`Failed to lock period ${periodId}.`, 'UPDATE_FAILED');
    }
    db.appendAuditLog({
      tenantId,
      entityType: 'ACCOUNTING_PERIOD',
      entityId: periodId,
      action: 'PERIOD_LOCKED',
      performedBy: userId,
      details: { periodNumber: period.periodNumber, name: period.name },
    });
    return updated;
  }

  public unlockPeriod(tenantId: string, periodId: string, userId: string): AccountingPeriodRecord {
    const period = db.findAccountingPeriodById(tenantId, periodId);
    if (!period) {
      throw new AccountingPeriodError(`Accounting Period "${periodId}" not found.`, 'NOT_FOUND');
    }
    const updated = db.updateAccountingPeriod(periodId, {
      isLocked: false,
      lockedAt: undefined,
      lockedBy: undefined,
    });
    if (!updated) {
      throw new AccountingPeriodError(`Failed to unlock period ${periodId}.`, 'UPDATE_FAILED');
    }
    db.appendAuditLog({
      tenantId,
      entityType: 'ACCOUNTING_PERIOD',
      entityId: periodId,
      action: 'PERIOD_UNLOCKED',
      performedBy: userId,
      details: { periodNumber: period.periodNumber, name: period.name },
    });
    return updated;
  }

  public closeFinancialYear(tenantId: string, fyId: string, userId: string): FinancialYearRecord {
    const fy = db.findFinancialYearById(tenantId, fyId);
    if (!fy) {
      throw new AccountingPeriodError(`Financial Year "${fyId}" not found.`, 'NOT_FOUND');
    }
    const updated = db.updateFinancialYear(fyId, {
      isClosed: true,
      closedAt: new Date().toISOString(),
      closedBy: userId,
    });
    if (!updated) {
      throw new AccountingPeriodError(`Failed to close FY ${fyId}.`, 'UPDATE_FAILED');
    }
    // Also lock all constituent periods
    const periods = db.getAccountingPeriods(tenantId, fyId);
    for (const p of periods) {
      db.updateAccountingPeriod(p.id, {
        isLocked: true,
        lockedAt: new Date().toISOString(),
        lockedBy: userId,
      });
    }
    db.appendAuditLog({
      tenantId,
      entityType: 'FINANCIAL_YEAR',
      entityId: fyId,
      action: 'FINANCIAL_YEAR_CLOSED',
      performedBy: userId,
      details: { code: fy.code, name: fy.name },
    });
    return updated;
  }

  public reopenFinancialYear(tenantId: string, fyId: string, userId: string): FinancialYearRecord {
    const fy = db.findFinancialYearById(tenantId, fyId);
    if (!fy) {
      throw new AccountingPeriodError(`Financial Year "${fyId}" not found.`, 'NOT_FOUND');
    }
    const updated = db.updateFinancialYear(fyId, {
      isClosed: false,
      closedAt: undefined,
      closedBy: undefined,
    });
    if (!updated) {
      throw new AccountingPeriodError(`Failed to reopen FY ${fyId}.`, 'UPDATE_FAILED');
    }
    db.appendAuditLog({
      tenantId,
      entityType: 'FINANCIAL_YEAR',
      entityId: fyId,
      action: 'FINANCIAL_YEAR_REOPENED',
      performedBy: userId,
      details: { code: fy.code },
    });
    return updated;
  }
}

export const periodService = new PeriodService();
