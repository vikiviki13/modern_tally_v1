/**
 * Chart of Accounts & Ledger Domain Service
 * Phase 07 Deliverable — Chart of Accounts and Ledger Management
 *
 * Implements:
 * - Hierarchical parent-child account group tree
 * - Standard classifications (Asset, Liability, Equity, Revenue, Expense)
 * - Ledger CRUD, archiving, bank & tax configuration
 * - Dynamic balance derivation from journal data and approved opening balances
 * - Opening balance reconciliation & suspense workflow
 * - Bulk import with dry-run validation
 */

import { db } from '../../db/store';
import { FinancialAmount } from './precision';
import {
  AccountGroupDTO,
  LedgerMasterDTO,
  CreateLedgerPayload,
  UpdateLedgerPayload,
  CreateAccountGroupPayload,
  UpdateAccountGroupPayload,
  BulkImportLedgerRow,
  BulkImportResultDTO,
  OpeningBalanceSummaryDTO,
  ReconcileOpeningBalancePayload,
  TaxConfig,
  BankConfig,
} from '../../../shared/types/ledger';
import { AccountClassification, AccountNormalBalance, EntryDirection } from '../../../shared/types/accounting';
import { AccountGroupRecord, LedgerAccountRecord } from '../../db/types';

export class LedgerValidationError extends Error {
  public code: string;
  constructor(message: string, code = 'LEDGER_VALIDATION_ERROR') {
    super(message);
    this.name = 'LedgerValidationError';
    this.code = code;
  }
}

export class LedgerService {
  public static IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

  // ==========================================================================
  // 1. Account Group Management
  // ==========================================================================

  public getAccountGroups(tenantId: string): AccountGroupDTO[] {
    const records = db.getAccountGroups(tenantId);
    const ledgers = db.getChartOfAccounts(tenantId);

    return records.map((g) => {
      const groupLedgers = ledgers.filter((l) => l.groupId === g.id);
      let totalBal = FinancialAmount.zero();

      for (const l of groupLedgers) {
        const bal = FinancialAmount.from(l.currentBalance || l.openingBalance || '0.00');
        totalBal = totalBal.add(bal);
      }

      return {
        id: g.id,
        tenantId: g.tenantId,
        parentId: g.parentId,
        name: g.name,
        code: g.code,
        classification: g.classification,
        affectsGrossProfit: g.affectsGrossProfit,
        isPrimary: !!g.isPrimary,
        sortOrder: g.sortOrder,
        ledgerCount: groupLedgers.length,
        totalBalance: totalBal.toString(2),
        totalBalanceType: this.getNormalBalanceForClassification(g.classification),
      };
    });
  }

  public getAccountGroupTree(tenantId: string): AccountGroupDTO[] {
    const flatGroups = this.getAccountGroups(tenantId);
    const groupMap = new Map<string, AccountGroupDTO>();
    const roots: AccountGroupDTO[] = [];

    // Clone into map with empty children
    for (const g of flatGroups) {
      groupMap.set(g.id, { ...g, children: [] });
    }

    // Build hierarchy
    for (const g of flatGroups) {
      const node = groupMap.get(g.id)!;
      if (g.parentId && groupMap.has(g.parentId)) {
        groupMap.get(g.parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    }

    // Sort roots & children by sortOrder
    const sortTree = (nodes: AccountGroupDTO[]) => {
      nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      for (const n of nodes) {
        if (n.children && n.children.length > 0) {
          sortTree(n.children);
        }
      }
    };

    sortTree(roots);
    return roots;
  }

  public createAccountGroup(
    tenantId: string,
    payload: CreateAccountGroupPayload,
    userId: string
  ): AccountGroupDTO {
    if (!payload.name || payload.name.trim().length < 2) {
      throw new LedgerValidationError('Account group name must be at least 2 characters.', 'INVALID_GROUP_NAME');
    }

    const trimmedName = payload.name.trim();

    // Check duplicate name
    const existing = db.findAccountGroupByName(tenantId, trimmedName);
    if (existing) {
      throw new LedgerValidationError(`An account group named "${trimmedName}" already exists.`, 'DUPLICATE_GROUP_NAME');
    }

    let classification = payload.classification;

    if (payload.parentId) {
      const parent = db.findAccountGroupById(tenantId, payload.parentId);
      if (!parent) {
        throw new LedgerValidationError(`Parent account group "${payload.parentId}" not found.`, 'PARENT_NOT_FOUND');
      }

      // Accounting Rule: A child group MUST inherit or match parent group's classification
      if (classification && classification !== parent.classification) {
        throw new LedgerValidationError(
          `Invalid group assignment: Child group classification (${classification}) must match parent group classification (${parent.classification}).`,
          'INVALID_GROUP_CLASSIFICATION'
        );
      }
      classification = parent.classification;
    } else {
      if (!classification) {
        throw new LedgerValidationError('Classification is required for primary account groups.', 'MISSING_CLASSIFICATION');
      }
    }

    const code = payload.code?.trim() || this.generateGroupCode(tenantId, classification);

    const record = db.createAccountGroup({
      tenantId,
      parentId: payload.parentId,
      name: trimmedName,
      code,
      classification,
      affectsGrossProfit: !!payload.affectsGrossProfit,
      isPrimary: !payload.parentId,
      sortOrder: payload.sortOrder || 100,
    });

    db.appendAuditLog({
      tenantId,
      entityType: 'ACCOUNT_GROUP',
      entityId: record.id,
      action: 'GROUP_CREATED',
      performedBy: userId,
      details: { name: record.name, code: record.code, classification: record.classification },
    });

    return {
      id: record.id,
      tenantId: record.tenantId,
      parentId: record.parentId,
      name: record.name,
      code: record.code,
      classification: record.classification,
      affectsGrossProfit: record.affectsGrossProfit,
      isPrimary: !!record.isPrimary,
      sortOrder: record.sortOrder,
      ledgerCount: 0,
      totalBalance: '0.00',
      totalBalanceType: this.getNormalBalanceForClassification(record.classification),
    };
  }

  public updateAccountGroup(
    tenantId: string,
    id: string,
    payload: UpdateAccountGroupPayload,
    userId: string
  ): AccountGroupDTO {
    const group = db.findAccountGroupById(tenantId, id);
    if (!group) {
      throw new LedgerValidationError(`Account group "${id}" not found.`, 'GROUP_NOT_FOUND');
    }

    if (payload.parentId !== undefined) {
      if (payload.parentId === id) {
        throw new LedgerValidationError('An account group cannot be its own parent.', 'CYCLIC_PARENT_ASSIGNMENT');
      }

      if (payload.parentId) {
        const parent = db.findAccountGroupById(tenantId, payload.parentId);
        if (!parent) {
          throw new LedgerValidationError(`Parent account group "${payload.parentId}" not found.`, 'PARENT_NOT_FOUND');
        }

        // Prevent cyclic descendant assignment
        if (this.isDescendantOf(tenantId, payload.parentId, id)) {
          throw new LedgerValidationError(
            'Cyclic hierarchy detected: Cannot move a parent group underneath one of its own descendants.',
            'CYCLIC_HIERARCHY'
          );
        }

        // Classification matching rule
        if (group.classification !== parent.classification) {
          throw new LedgerValidationError(
            `Cannot move group: Group classification (${group.classification}) does not match new parent (${parent.classification}).`,
            'CLASSIFICATION_MISMATCH'
          );
        }
      }
    }

    const updates: Partial<AccountGroupRecord> = {};
    if (payload.name) updates.name = payload.name.trim();
    if (payload.code) updates.code = payload.code.trim();
    if (payload.parentId !== undefined) updates.parentId = payload.parentId || undefined;
    if (payload.affectsGrossProfit !== undefined) updates.affectsGrossProfit = payload.affectsGrossProfit;
    if (payload.sortOrder !== undefined) updates.sortOrder = payload.sortOrder;

    const updated = db.updateAccountGroup(id, updates);
    if (!updated) {
      throw new LedgerValidationError(`Failed to update account group "${id}".`, 'UPDATE_FAILED');
    }

    db.appendAuditLog({
      tenantId,
      entityType: 'ACCOUNT_GROUP',
      entityId: id,
      action: 'GROUP_UPDATED',
      performedBy: userId,
      details: updates,
    });

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      parentId: updated.parentId,
      name: updated.name,
      code: updated.code,
      classification: updated.classification,
      affectsGrossProfit: updated.affectsGrossProfit,
      isPrimary: !updated.parentId,
      sortOrder: updated.sortOrder,
    };
  }

  public deleteAccountGroup(tenantId: string, id: string, userId: string): boolean {
    const group = db.findAccountGroupById(tenantId, id);
    if (!group) {
      throw new LedgerValidationError(`Account group "${id}" not found.`, 'GROUP_NOT_FOUND');
    }

    // Check if child groups exist
    const childGroups = db.getAccountGroups(tenantId).filter((g) => g.parentId === id);
    if (childGroups.length > 0) {
      throw new LedgerValidationError(
        `Cannot delete group "${group.name}": It has ${childGroups.length} sub-group(s). Reassign or delete sub-groups first.`,
        'GROUP_HAS_CHILDREN'
      );
    }

    // Check if ledgers belong to this group
    const ledgers = db.getChartOfAccounts(tenantId).filter((l) => l.groupId === id);
    if (ledgers.length > 0) {
      throw new LedgerValidationError(
        `Cannot delete group "${group.name}": It contains ${ledgers.length} active ledger account(s). Reassign ledgers first.`,
        'GROUP_HAS_LEDGERS'
      );
    }

    const deleted = db.deleteAccountGroup(id);
    if (deleted) {
      db.appendAuditLog({
        tenantId,
        entityType: 'ACCOUNT_GROUP',
        entityId: id,
        action: 'GROUP_DELETED',
        performedBy: userId,
        details: { name: group.name, code: group.code },
      });
    }
    return deleted;
  }

  private isDescendantOf(tenantId: string, candidateChildId: string, potentialAncestorId: string): boolean {
    let curr: AccountGroupRecord | undefined = db.findAccountGroupById(tenantId, candidateChildId);
    while (curr && curr.parentId) {
      if (curr.parentId === potentialAncestorId) return true;
      curr = db.findAccountGroupById(tenantId, curr.parentId);
    }
    return false;
  }

  // ==========================================================================
  // 2. Ledger (Chart of Accounts) Management
  // ==========================================================================

  public getLedgers(
    tenantId: string,
    filters?: {
      groupId?: string;
      classification?: string;
      search?: string;
      isActive?: boolean;
      isBankAccount?: boolean;
      isTaxAccount?: boolean;
    }
  ): LedgerMasterDTO[] {
    let accounts = db.getChartOfAccounts(tenantId);
    const groups = db.getAccountGroups(tenantId);
    const groupMap = new Map(groups.map((g) => [g.id, g]));

    if (filters) {
      if (filters.groupId) {
        // Support querying ledgers in group and all descendant groups
        const targetGroupIds = new Set<string>([filters.groupId]);
        for (const g of groups) {
          if (this.isDescendantOf(tenantId, g.id, filters.groupId)) {
            targetGroupIds.add(g.id);
          }
        }
        accounts = accounts.filter((l) => targetGroupIds.has(l.groupId));
      }

      if (filters.classification) {
        accounts = accounts.filter((l) => l.classification === filters.classification);
      }

      if (filters.isActive !== undefined) {
        accounts = accounts.filter((l) => l.isActive === filters.isActive);
      }

      if (filters.isBankAccount !== undefined) {
        accounts = accounts.filter((l) => !!l.bankConfig?.isBankAccount === filters.isBankAccount);
      }

      if (filters.isTaxAccount !== undefined) {
        accounts = accounts.filter((l) => !!l.taxConfig?.isTaxAccount === filters.isTaxAccount);
      }

      if (filters.search && filters.search.trim() !== '') {
        const q = filters.search.toLowerCase().trim();
        accounts = accounts.filter(
          (l) =>
            l.name.toLowerCase().includes(q) ||
            l.code.toLowerCase().includes(q) ||
            (l.alias && l.alias.toLowerCase().includes(q)) ||
            l.groupName.toLowerCase().includes(q)
        );
      }
    }

    return accounts.map((l) => this.mapLedgerToDTO(tenantId, l, groupMap));
  }

  public getLedgerById(
    tenantId: string,
    id: string,
    periodStart?: string,
    periodEnd?: string
  ): LedgerMasterDTO {
    const ledger = db.findLedgerAccountById(tenantId, id);
    if (!ledger) {
      throw new LedgerValidationError(`Ledger account "${id}" not found.`, 'LEDGER_NOT_FOUND');
    }
    const groupMap = new Map(db.getAccountGroups(tenantId).map((g) => [g.id, g]));
    return this.mapLedgerToDTO(tenantId, ledger, groupMap, periodStart, periodEnd);
  }

  public createLedger(
    tenantId: string,
    payload: CreateLedgerPayload,
    userId: string
  ): LedgerMasterDTO {
    if (!payload.name || payload.name.trim().length < 2) {
      throw new LedgerValidationError('Ledger account name must be at least 2 characters.', 'INVALID_LEDGER_NAME');
    }

    const trimmedName = payload.name.trim();

    // Check duplicate name
    const existing = db.getChartOfAccounts(tenantId).find(
      (l) => l.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (existing) {
      throw new LedgerValidationError(`A ledger named "${trimmedName}" already exists in the Chart of Accounts.`, 'DUPLICATE_LEDGER_NAME');
    }

    // Validate Group exists in tenant
    const group = db.findAccountGroupById(tenantId, payload.groupId);
    if (!group) {
      throw new LedgerValidationError(`Account Group "${payload.groupId}" does not exist.`, 'GROUP_NOT_FOUND');
    }

    // Auto-derive classification and normal balance from the account group
    const classification = group.classification;
    const normalBalance = this.getNormalBalanceForClassification(classification);

    // Validate Code
    let code = payload.code?.trim();
    if (code) {
      const codeExists = db.findLedgerAccountByCode(tenantId, code);
      if (codeExists) {
        throw new LedgerValidationError(`Ledger code "${code}" is already in use by "${codeExists.name}".`, 'DUPLICATE_LEDGER_CODE');
      }
    } else {
      code = this.generateLedgerCode(tenantId, group.code);
    }

    // Validate Opening Balance
    let opBalStr = '0.00';
    let opBalType: EntryDirection = payload.openingBalanceType || normalBalance;

    if (payload.openingBalance !== undefined) {
      try {
        const amt = FinancialAmount.from(payload.openingBalance);
        if (amt.isNegative()) {
          throw new LedgerValidationError('Opening balance amount cannot be negative. Select Debit or Credit direction instead.', 'NEGATIVE_OPENING_BALANCE');
        }
        opBalStr = amt.toString(2);
      } catch (err: unknown) {
        if (err instanceof LedgerValidationError) throw err;
        throw new LedgerValidationError(`Invalid opening balance amount: "${payload.openingBalance}".`, 'INVALID_OPENING_BALANCE');
      }
    }

    // Validate Bank Configuration
    const bankConfig: BankConfig = {
      isBankAccount: !!payload.bankConfig?.isBankAccount,
      bankAccountNumber: payload.bankConfig?.bankAccountNumber?.trim(),
      bankName: payload.bankConfig?.bankName?.trim(),
      bankIfsc: payload.bankConfig?.bankIfsc?.trim().toUpperCase(),
      bankBranch: payload.bankConfig?.bankBranch?.trim(),
      accountType: payload.bankConfig?.accountType || 'CURRENT',
    };

    if (bankConfig.isBankAccount) {
      if (!bankConfig.bankAccountNumber || bankConfig.bankAccountNumber.length < 5) {
        throw new LedgerValidationError('Bank account number is required (minimum 5 digits).', 'INVALID_BANK_ACCOUNT');
      }
      if (bankConfig.bankIfsc && !LedgerService.IFSC_REGEX.test(bankConfig.bankIfsc)) {
        throw new LedgerValidationError(`Invalid IFSC code format: "${bankConfig.bankIfsc}". Expected 11 alphanumeric characters (e.g., HDFC0000060).`, 'INVALID_IFSC');
      }
    }

    // Validate Tax Configuration
    const taxConfig: TaxConfig = {
      isTaxAccount: !!payload.taxConfig?.isTaxAccount,
      gstType: payload.taxConfig?.gstType || 'NONE',
      taxRatePercent: payload.taxConfig?.taxRatePercent !== undefined ? Number(payload.taxConfig.taxRatePercent) : undefined,
      hsnSacCode: payload.taxConfig?.hsnSacCode?.trim(),
    };

    if (taxConfig.isTaxAccount) {
      if (taxConfig.taxRatePercent !== undefined && (taxConfig.taxRatePercent < 0 || taxConfig.taxRatePercent > 100)) {
        throw new LedgerValidationError('GST tax rate percent must be between 0 and 100.', 'INVALID_TAX_RATE');
      }
    }

    const tenantRec = db.findTenantById(tenantId);
    const openingDate = payload.openingBalanceDate || tenantRec?.booksBeginningDate || '2026-04-01';

    const record = db.createLedgerAccount({
      tenantId,
      groupId: group.id,
      groupName: group.name,
      code,
      name: trimmedName,
      alias: payload.alias?.trim(),
      description: payload.description?.trim(),
      classification,
      normalBalance,
      openingBalance: opBalStr,
      openingBalanceType: opBalType,
      openingBalanceDate: openingDate,
      currentBalance: opBalStr,
      isActive: true,
      isBillWise: !!payload.isBillWise,
      taxConfig,
      bankConfig,
    });

    db.appendAuditLog({
      tenantId,
      entityType: 'LEDGER_ACCOUNT',
      entityId: record.id,
      action: 'LEDGER_CREATED',
      performedBy: userId,
      details: { name: record.name, code: record.code, group: group.name, openingBalance: opBalStr, openingBalanceType: opBalType },
    });

    const groupMap = new Map(db.getAccountGroups(tenantId).map((g) => [g.id, g]));
    return this.mapLedgerToDTO(tenantId, record, groupMap);
  }

  public updateLedger(
    tenantId: string,
    id: string,
    payload: UpdateLedgerPayload,
    userId: string
  ): LedgerMasterDTO {
    const ledger = db.findLedgerAccountById(tenantId, id);
    if (!ledger) {
      throw new LedgerValidationError(`Ledger account "${id}" not found.`, 'LEDGER_NOT_FOUND');
    }

    const updates: Partial<LedgerAccountRecord> = {};

    if (payload.name) {
      const trimmedName = payload.name.trim();
      const existing = db.getChartOfAccounts(tenantId).find(
        (l) => l.name.toLowerCase() === trimmedName.toLowerCase() && l.id !== id
      );
      if (existing) {
        throw new LedgerValidationError(`A ledger named "${trimmedName}" already exists.`, 'DUPLICATE_LEDGER_NAME');
      }
      updates.name = trimmedName;
    }

    if (payload.code) {
      const trimmedCode = payload.code.trim();
      const existingCode = db.getChartOfAccounts(tenantId).find(
        (l) => l.code.toUpperCase() === trimmedCode.toUpperCase() && l.id !== id
      );
      if (existingCode) {
        throw new LedgerValidationError(`Ledger code "${trimmedCode}" is already in use.`, 'DUPLICATE_LEDGER_CODE');
      }
      updates.code = trimmedCode;
    }

    if (payload.alias !== undefined) updates.alias = payload.alias.trim() || undefined;
    if (payload.description !== undefined) updates.description = payload.description.trim() || undefined;
    if (payload.isBillWise !== undefined) updates.isBillWise = payload.isBillWise;
    if (payload.isActive !== undefined) updates.isActive = payload.isActive;

    // Group reassignment validation
    if (payload.groupId && payload.groupId !== ledger.groupId) {
      const newGroup = db.findAccountGroupById(tenantId, payload.groupId);
      if (!newGroup) {
        throw new LedgerValidationError(`Target account group "${payload.groupId}" not found.`, 'GROUP_NOT_FOUND');
      }

      // Check if posted transactions exist
      const lines = db.getJournalLinesForLedger(tenantId, id);
      if (lines.length > 0 && newGroup.classification !== ledger.classification) {
        throw new LedgerValidationError(
          `Cannot change classification from ${ledger.classification} to ${newGroup.classification}: Ledger has ${lines.length} posted transaction(s). Reclassification violates accounting standards.`,
          'RECLASSIFICATION_PROHIBITED'
        );
      }

      updates.groupId = newGroup.id;
      updates.groupName = newGroup.name;
      updates.classification = newGroup.classification;
      updates.normalBalance = this.getNormalBalanceForClassification(newGroup.classification);
    }

    if (payload.bankConfig) {
      const bConfig: BankConfig = {
        isBankAccount: payload.bankConfig.isBankAccount ?? !!ledger.bankConfig?.isBankAccount,
        bankAccountNumber: payload.bankConfig.bankAccountNumber?.trim() ?? ledger.bankConfig?.bankAccountNumber,
        bankName: payload.bankConfig.bankName?.trim() ?? ledger.bankConfig?.bankName,
        bankIfsc: payload.bankConfig.bankIfsc?.trim().toUpperCase() ?? ledger.bankConfig?.bankIfsc,
        bankBranch: payload.bankConfig.bankBranch?.trim() ?? ledger.bankConfig?.bankBranch,
        accountType: payload.bankConfig.accountType ?? ledger.bankConfig?.accountType ?? 'CURRENT',
      };
      if (bConfig.isBankAccount && bConfig.bankIfsc && !LedgerService.IFSC_REGEX.test(bConfig.bankIfsc)) {
        throw new LedgerValidationError(`Invalid IFSC code: "${bConfig.bankIfsc}".`, 'INVALID_IFSC');
      }
      updates.bankConfig = bConfig;
    }

    if (payload.taxConfig) {
      const tConfig: TaxConfig = {
        isTaxAccount: payload.taxConfig.isTaxAccount ?? !!ledger.taxConfig?.isTaxAccount,
        gstType: payload.taxConfig.gstType ?? ledger.taxConfig?.gstType ?? 'NONE',
        taxRatePercent: payload.taxConfig.taxRatePercent !== undefined ? Number(payload.taxConfig.taxRatePercent) : ledger.taxConfig?.taxRatePercent,
        hsnSacCode: payload.taxConfig.hsnSacCode?.trim() ?? ledger.taxConfig?.hsnSacCode,
      };
      updates.taxConfig = tConfig;
    }

    const updated = db.updateLedgerAccount(id, updates);
    if (!updated) {
      throw new LedgerValidationError(`Failed to update ledger "${id}".`, 'UPDATE_FAILED');
    }

    db.appendAuditLog({
      tenantId,
      entityType: 'LEDGER_ACCOUNT',
      entityId: id,
      action: 'LEDGER_UPDATED',
      performedBy: userId,
      details: updates,
    });

    const groupMap = new Map(db.getAccountGroups(tenantId).map((g) => [g.id, g]));
    return this.mapLedgerToDTO(tenantId, updated, groupMap);
  }

  public archiveLedger(tenantId: string, id: string, userId: string): LedgerMasterDTO {
    const ledger = db.findLedgerAccountById(tenantId, id);
    if (!ledger) {
      throw new LedgerValidationError(`Ledger account "${id}" not found.`, 'LEDGER_NOT_FOUND');
    }

    const updated = db.updateLedgerAccount(id, { isActive: false });
    if (!updated) throw new LedgerValidationError('Failed to archive ledger.', 'ARCHIVE_FAILED');

    db.appendAuditLog({
      tenantId,
      entityType: 'LEDGER_ACCOUNT',
      entityId: id,
      action: 'LEDGER_ARCHIVED',
      performedBy: userId,
      details: { name: ledger.name, code: ledger.code },
    });

    const groupMap = new Map(db.getAccountGroups(tenantId).map((g) => [g.id, g]));
    return this.mapLedgerToDTO(tenantId, updated, groupMap);
  }

  public reactivateLedger(tenantId: string, id: string, userId: string): LedgerMasterDTO {
    const ledger = db.findLedgerAccountById(tenantId, id);
    if (!ledger) {
      throw new LedgerValidationError(`Ledger account "${id}" not found.`, 'LEDGER_NOT_FOUND');
    }

    const updated = db.updateLedgerAccount(id, { isActive: true });
    if (!updated) throw new LedgerValidationError('Failed to reactivate ledger.', 'REACTIVATE_FAILED');

    db.appendAuditLog({
      tenantId,
      entityType: 'LEDGER_ACCOUNT',
      entityId: id,
      action: 'LEDGER_REACTIVATED',
      performedBy: userId,
      details: { name: ledger.name, code: ledger.code },
    });

    const groupMap = new Map(db.getAccountGroups(tenantId).map((g) => [g.id, g]));
    return this.mapLedgerToDTO(tenantId, updated, groupMap);
  }

  // ==========================================================================
  // 3. Opening Balance Governance & Controlled Suspense Reconciliation
  // ==========================================================================

  public getOpeningBalanceSummary(tenantId: string): OpeningBalanceSummaryDTO {
    const ledgers = db.getChartOfAccounts(tenantId);
    let totalDebits = FinancialAmount.zero();
    let totalCredits = FinancialAmount.zero();
    let unbalancedCount = 0;

    for (const l of ledgers) {
      const amt = FinancialAmount.from(l.openingBalance || '0.00');
      if (amt.isZero()) continue;

      unbalancedCount++;
      if (l.openingBalanceType === 'DEBIT') {
        totalDebits = totalDebits.add(amt);
      } else {
        totalCredits = totalCredits.add(amt);
      }
    }

    const diff = totalDebits.subtract(totalCredits);
    const absDiff = diff.abs().toString(2);
    const isBalanced = diff.isZero();

    let diffDirection: EntryDirection | 'BALANCED' = 'BALANCED';
    if (!isBalanced) {
      diffDirection = diff.compareTo('0.00') > 0 ? 'DEBIT' : 'CREDIT';
    }

    // Locate or identify suspense difference account
    const suspenseAccount = ledgers.find(
      (l) => l.name.toLowerCase().includes('opening balance difference') || l.name.toLowerCase().includes('suspense')
    );

    return {
      totalOpeningDebits: totalDebits.toString(2),
      totalOpeningCredits: totalCredits.toString(2),
      difference: absDiff,
      isBalanced,
      differenceDirection: diffDirection,
      suspenseLedgerId: suspenseAccount?.id,
      unbalancedLedgersCount: unbalancedCount,
    };
  }

  public reconcileOpeningBalanceDifference(
    tenantId: string,
    payload: ReconcileOpeningBalancePayload,
    userId: string
  ): OpeningBalanceSummaryDTO {
    const summary = this.getOpeningBalanceSummary(tenantId);
    if (summary.isBalanced) {
      return summary;
    }

    const suspenseLedger = db.findLedgerAccountById(tenantId, payload.suspenseLedgerId);
    if (!suspenseLedger) {
      throw new LedgerValidationError(
        `Selected suspense difference ledger "${payload.suspenseLedgerId}" not found.`,
        'SUSPENSE_LEDGER_NOT_FOUND'
      );
    }

    // Compensating direction:
    // If total opening debits > credits (differenceDirection = DEBIT), suspense needs CREDIT
    // If total opening credits > debits (differenceDirection = CREDIT), suspense needs DEBIT
    const compensatingDirection: EntryDirection = summary.differenceDirection === 'DEBIT' ? 'CREDIT' : 'DEBIT';

    db.runTransaction((store) => {
      store.updateLedgerAccount(suspenseLedger.id, {
        openingBalance: summary.difference,
        openingBalanceType: compensatingDirection,
        currentBalance: summary.difference,
      });

      store.appendAuditLog({
        tenantId,
        entityType: 'OPENING_BALANCE_RECONCILIATION',
        entityId: suspenseLedger.id,
        action: 'OPENING_BALANCE_DIFFERENCE_RECONCILED',
        performedBy: userId,
        details: {
          suspenseLedgerName: suspenseLedger.name,
          differenceAmount: summary.difference,
          compensatingDirection,
          notes: payload.notes?.trim(),
          originalSummary: summary,
        },
      });
    });

    return this.getOpeningBalanceSummary(tenantId);
  }

  // ==========================================================================
  // 4. Bulk Import Engine
  // ==========================================================================

  public bulkImportLedgers(
    tenantId: string,
    rows: BulkImportLedgerRow[],
    dryRun = false,
    userId: string
  ): BulkImportResultDTO {
    const groups = db.getAccountGroups(tenantId);
    const existingLedgers = db.getChartOfAccounts(tenantId);

    const groupMapByName = new Map<string, AccountGroupRecord>();
    const groupMapByCode = new Map<string, AccountGroupRecord>();
    for (const g of groups) {
      groupMapByName.set(g.name.toLowerCase().trim(), g);
      groupMapByCode.set(g.code.toUpperCase().trim(), g);
    }

    const existingNames = new Set(existingLedgers.map((l) => l.name.toLowerCase().trim()));
    const existingCodes = new Set(existingLedgers.map((l) => l.code.toUpperCase().trim()));

    const errors: Array<{ rowIndex: number; ledgerName: string; message: string }> = [];
    const validRows: Array<{
      payload: CreateLedgerPayload;
      group: AccountGroupRecord;
    }> = [];

    rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const name = row.name?.trim();

      if (!name || name.length < 2) {
        errors.push({ rowIndex: rowNum, ledgerName: name || 'UNKNOWN', message: 'Ledger name must be at least 2 characters.' });
        return;
      }

      if (existingNames.has(name.toLowerCase())) {
        errors.push({ rowIndex: rowNum, ledgerName: name, message: `Ledger "${name}" already exists in the Chart of Accounts.` });
        return;
      }

      // Group resolution
      const groupKey = row.groupNameOrCode?.trim();
      const matchedGroup = groupMapByName.get(groupKey.toLowerCase()) || groupMapByCode.get(groupKey.toUpperCase());
      if (!matchedGroup) {
        errors.push({
          rowIndex: rowNum,
          ledgerName: name,
          message: `Account Group "${groupKey}" does not exist in Chart of Accounts.`,
        });
        return;
      }

      // Code uniqueness check
      let code = row.code?.trim();
      if (code) {
        if (existingCodes.has(code.toUpperCase())) {
          errors.push({ rowIndex: rowNum, ledgerName: name, message: `Ledger code "${code}" is already in use.` });
          return;
        }
      }

      // Opening balance parsing
      let opBalStr = '0.00';
      let opBalType: EntryDirection = this.getNormalBalanceForClassification(matchedGroup.classification);

      if (row.openingBalance !== undefined) {
        try {
          const amt = FinancialAmount.from(row.openingBalance);
          if (amt.isNegative()) {
            errors.push({ rowIndex: rowNum, ledgerName: name, message: 'Opening balance cannot be negative.' });
            return;
          }
          opBalStr = amt.toString(2);
        } catch {
          errors.push({ rowIndex: rowNum, ledgerName: name, message: `Invalid opening balance amount "${row.openingBalance}".` });
          return;
        }
      }

      if (row.openingBalanceType) {
        const dir = row.openingBalanceType.toUpperCase();
        if (dir === 'DR' || dir === 'DEBIT') opBalType = 'DEBIT';
        else if (dir === 'CR' || dir === 'CREDIT') opBalType = 'CREDIT';
      }

      // Bank configuration
      let bankConfig: BankConfig | undefined;
      if (row.bankAccountNumber) {
        if (row.bankIfsc && !LedgerService.IFSC_REGEX.test(row.bankIfsc.trim().toUpperCase())) {
          errors.push({ rowIndex: rowNum, ledgerName: name, message: `Invalid IFSC code "${row.bankIfsc}".` });
          return;
        }
        bankConfig = {
          isBankAccount: true,
          bankAccountNumber: row.bankAccountNumber.trim(),
          bankName: row.bankName?.trim() || 'Bank Account',
          bankIfsc: row.bankIfsc?.trim().toUpperCase(),
        };
      }

      // Tax configuration
      let taxConfig: TaxConfig | undefined;
      if (row.gstRate !== undefined) {
        if (row.gstRate < 0 || row.gstRate > 100) {
          errors.push({ rowIndex: rowNum, ledgerName: name, message: 'GST rate must be between 0 and 100.' });
          return;
        }
        taxConfig = {
          isTaxAccount: false,
          taxRatePercent: row.gstRate,
          hsnSacCode: row.hsnCode?.trim(),
        };
      }

      existingNames.add(name.toLowerCase());
      if (code) existingCodes.add(code.toUpperCase());

      validRows.push({
        group: matchedGroup,
        payload: {
          name,
          groupId: matchedGroup.id,
          code,
          alias: row.alias,
          openingBalance: opBalStr,
          openingBalanceType: opBalType,
          bankConfig,
          taxConfig,
        },
      });
    });

    const createdLedgers: LedgerMasterDTO[] = [];

    if (!dryRun && errors.length === 0 && validRows.length > 0) {
      db.runTransaction(() => {
        for (const r of validRows) {
          const created = this.createLedger(tenantId, r.payload, userId);
          createdLedgers.push(created);
        }
      });
    }

    return {
      totalSubmitted: rows.length,
      importedCount: dryRun ? validRows.length : createdLedgers.length,
      failedCount: errors.length,
      isDryRun: dryRun,
      createdLedgers,
      errors,
    };
  }

  // ==========================================================================
  // 5. Helpers & Projections
  // ==========================================================================

  private mapLedgerToDTO(
    tenantId: string,
    ledger: LedgerAccountRecord,
    groupMap: Map<string, AccountGroupRecord>,
    periodStart?: string,
    periodEnd?: string
  ): LedgerMasterDTO {
    const group = groupMap.get(ledger.groupId);
    const parentGroup = group?.parentId ? groupMap.get(group.parentId) : undefined;

    // Derived balances from journal lines
    const postedJournals = db.getJournalEntries(tenantId, { status: 'POSTED' });
    const journalMap = new Map(postedJournals.map((j) => [j.id, j]));

    const lines = db.getJournalLinesForLedger(tenantId, ledger.id)
      .filter((l) => journalMap.has(l.journalEntryId));

    let totalDebits = FinancialAmount.zero();
    let totalCredits = FinancialAmount.zero();
    let periodDebits = FinancialAmount.zero();
    let periodCredits = FinancialAmount.zero();

    const pStart = periodStart || '2026-04-01';
    const pEnd = periodEnd || new Date().toISOString().split('T')[0];

    for (const l of lines) {
      const journal = journalMap.get(l.journalEntryId)!;
      const amt = FinancialAmount.from(l.amount);

      if (l.entryDirection === 'DEBIT') {
        totalDebits = totalDebits.add(amt);
        if (journal.entryDate >= pStart && journal.entryDate <= pEnd) {
          periodDebits = periodDebits.add(amt);
        }
      } else {
        totalCredits = totalCredits.add(amt);
        if (journal.entryDate >= pStart && journal.entryDate <= pEnd) {
          periodCredits = periodCredits.add(amt);
        }
      }
    }

    // Dynamic Net Balance
    const opAmt = FinancialAmount.from(ledger.openingBalance || '0.00');
    let running = ledger.openingBalanceType === 'DEBIT' ? opAmt : opAmt.negate();
    running = running.add(totalDebits).subtract(totalCredits);

    const currentBalDirection: EntryDirection = running.compareTo('0.00') >= 0 ? 'DEBIT' : 'CREDIT';
    const currentBalanceStr = running.abs().toString(2);

    return {
      id: ledger.id,
      tenantId: ledger.tenantId,
      groupId: ledger.groupId,
      groupName: ledger.groupName,
      parentGroupName: parentGroup?.name,
      code: ledger.code,
      name: ledger.name,
      alias: ledger.alias,
      description: ledger.description,
      classification: ledger.classification,
      normalBalance: ledger.normalBalance,
      openingBalance: ledger.openingBalance || '0.00',
      openingBalanceType: ledger.openingBalanceType || ledger.normalBalance,
      openingBalanceDate: ledger.openingBalanceDate || '2026-04-01',
      currentBalance: currentBalanceStr,
      currentBalanceType: currentBalDirection,
      isActive: ledger.isActive !== false,
      isBillWise: !!ledger.isBillWise,
      taxConfig: ledger.taxConfig || { isTaxAccount: false, gstType: 'NONE' },
      bankConfig: ledger.bankConfig || { isBankAccount: false },
      currentPeriod: {
        periodStart: pStart,
        periodEnd: pEnd,
        openingBalance: ledger.openingBalance || '0.00',
        openingBalanceType: ledger.openingBalanceType || ledger.normalBalance,
        periodDebit: periodDebits.toString(2),
        periodCredit: periodCredits.toString(2),
        closingBalance: currentBalanceStr,
        closingBalanceType: currentBalDirection,
      },
      createdAt: ledger.createdAt,
      updatedAt: ledger.updatedAt,
    };
  }

  private getNormalBalanceForClassification(classification: AccountClassification): AccountNormalBalance {
    switch (classification) {
      case 'ASSET':
      case 'EXPENSE':
        return 'DEBIT';
      case 'LIABILITY':
      case 'EQUITY':
      case 'REVENUE':
        return 'CREDIT';
    }
  }

  private generateGroupCode(tenantId: string, classification: AccountClassification): string {
    const classPrefixMap: Record<AccountClassification, string> = {
      ASSET: '1',
      LIABILITY: '2',
      EQUITY: '3',
      REVENUE: '4',
      EXPENSE: '5',
    };
    const prefix = classPrefixMap[classification] || '9';
    const existing = db.getAccountGroups(tenantId).filter((g) => g.code.startsWith(prefix));
    const nextNum = existing.length + 1;
    return `${prefix}${nextNum.toString().padStart(3, '0')}`;
  }

  private generateLedgerCode(tenantId: string, groupCode: string): string {
    const prefix = groupCode.substring(0, 2);
    const existing = db.getChartOfAccounts(tenantId).filter((l) => l.code.startsWith(prefix));
    const nextNum = existing.length + 1;
    return `${prefix}${nextNum.toString().padStart(3, '0')}`;
  }
}

export const ledgerService = new LedgerService();
