import { Router, Response } from 'express';
import { postingService } from '../domain/accounting/postingService';
import { periodService } from '../domain/accounting/periodService';
import { ledgerService } from '../domain/accounting/ledgerService';
import { db } from '../db/store';
import { authenticateToken, AuthenticatedRequest } from '../auth/middleware';
import { runAccountingTests } from '../../tests/accounting.test';

export const accountingRouter = Router();

/**
 * GET /api/accounting/test-suite
 * Executes Phase 06 Double-Entry Accounting Engine Test Suite
 */
accountingRouter.get('/test-suite', async (_req, res: Response): Promise<void> => {
  try {
    const summary = await runAccountingTests();
    res.json({
      success: true,
      data: summary,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Test suite execution error';
    res.status(500).json({ success: false, error: { code: 'TEST_ERROR', message } });
  }
});

// ============================================================================
// 1. ACCOUNT GROUPS (PHASE 07)
// ============================================================================

/**
 * GET /api/accounting/groups
 * Retrieves all account groups for the active tenant
 */
accountingRouter.get('/groups', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const tenantId = req.user!.tenantId;
    const groups = ledgerService.getAccountGroups(tenantId);
    res.json({
      success: true,
      data: groups,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch account groups';
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message } });
  }
});

/**
 * GET /api/accounting/groups/tree
 * Retrieves nested hierarchical tree of account groups
 */
accountingRouter.get('/groups/tree', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const tenantId = req.user!.tenantId;
    const tree = ledgerService.getAccountGroupTree(tenantId);
    res.json({
      success: true,
      data: tree,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch account group tree';
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message } });
  }
});

/**
 * POST /api/accounting/groups
 * Creates a new account group
 */
accountingRouter.post('/groups', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const tenantId = req.user!.tenantId;
    const group = ledgerService.createAccountGroup(tenantId, req.body, req.user!.id);
    res.status(201).json({
      success: true,
      data: group,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create account group';
    const code = (error as { code?: string }).code || 'GROUP_CREATION_ERROR';
    res.status(400).json({ success: false, error: { code, message } });
  }
});

/**
 * PUT /api/accounting/groups/:id
 * Updates an existing account group
 */
accountingRouter.put('/groups/:id', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const tenantId = req.user!.tenantId;
    const updated = ledgerService.updateAccountGroup(tenantId, req.params.id, req.body, req.user!.id);
    res.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update account group';
    const code = (error as { code?: string }).code || 'GROUP_UPDATE_ERROR';
    res.status(400).json({ success: false, error: { code, message } });
  }
});

/**
 * DELETE /api/accounting/groups/:id
 * Deletes an empty account group
 */
accountingRouter.delete('/groups/:id', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const tenantId = req.user!.tenantId;
    const deleted = ledgerService.deleteAccountGroup(tenantId, req.params.id, req.user!.id);
    res.json({
      success: true,
      data: { deleted },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete account group';
    const code = (error as { code?: string }).code || 'GROUP_DELETE_ERROR';
    res.status(400).json({ success: false, error: { code, message } });
  }
});

// ============================================================================
// 2. LEDGERS / CHART OF ACCOUNTS (PHASE 07)
// ============================================================================

/**
 * GET /api/accounting/ledgers
 * Retrieves ledgers for tenant with search, filtering, and running balances
 */
accountingRouter.get('/ledgers', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const tenantId = req.user!.tenantId;
    const { groupId, classification, search, isActive, isBankAccount, isTaxAccount } = req.query;

    const ledgers = ledgerService.getLedgers(tenantId, {
      groupId: groupId as string | undefined,
      classification: classification as string | undefined,
      search: search as string | undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      isBankAccount: isBankAccount !== undefined ? isBankAccount === 'true' : undefined,
      isTaxAccount: isTaxAccount !== undefined ? isTaxAccount === 'true' : undefined,
    });

    res.json({
      success: true,
      data: ledgers,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch ledgers';
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message } });
  }
});

/**
 * GET /api/accounting/ledgers/:id
 * Retrieves detailed ledger master with period summary
 */
accountingRouter.get('/ledgers/:id', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const tenantId = req.user!.tenantId;
    const { periodStart, periodEnd } = req.query;
    const ledger = ledgerService.getLedgerById(
      tenantId,
      req.params.id,
      periodStart as string | undefined,
      periodEnd as string | undefined
    );

    res.json({
      success: true,
      data: ledger,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch ledger';
    const code = (error as { code?: string }).code || 'FETCH_ERROR';
    res.status(404).json({ success: false, error: { code, message } });
  }
});

/**
 * POST /api/accounting/ledgers
 * Creates a new ledger in the Chart of Accounts
 */
accountingRouter.post('/ledgers', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const tenantId = req.user!.tenantId;
    const ledger = ledgerService.createLedger(tenantId, req.body, req.user!.id);
    res.status(201).json({
      success: true,
      data: ledger,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create ledger';
    const code = (error as { code?: string }).code || 'LEDGER_CREATION_ERROR';
    res.status(400).json({ success: false, error: { code, message } });
  }
});

/**
 * PUT /api/accounting/ledgers/:id
 * Updates an existing ledger
 */
accountingRouter.put('/ledgers/:id', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const tenantId = req.user!.tenantId;
    const updated = ledgerService.updateLedger(tenantId, req.params.id, req.body, req.user!.id);
    res.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update ledger';
    const code = (error as { code?: string }).code || 'LEDGER_UPDATE_ERROR';
    res.status(400).json({ success: false, error: { code, message } });
  }
});

/**
 * POST /api/accounting/ledgers/:id/archive
 * Archives / deactivates a ledger
 */
accountingRouter.post('/ledgers/:id/archive', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const tenantId = req.user!.tenantId;
    const updated = ledgerService.archiveLedger(tenantId, req.params.id, req.user!.id);
    res.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to archive ledger';
    const code = (error as { code?: string }).code || 'ARCHIVE_ERROR';
    res.status(400).json({ success: false, error: { code, message } });
  }
});

/**
 * POST /api/accounting/ledgers/:id/reactivate
 * Reactivates an archived ledger
 */
accountingRouter.post('/ledgers/:id/reactivate', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const tenantId = req.user!.tenantId;
    const updated = ledgerService.reactivateLedger(tenantId, req.params.id, req.user!.id);
    res.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to reactivate ledger';
    const code = (error as { code?: string }).code || 'REACTIVATE_ERROR';
    res.status(400).json({ success: false, error: { code, message } });
  }
});

/**
 * POST /api/accounting/ledgers/bulk-import
 * Bulk imports ledgers with dry-run validation support
 */
accountingRouter.post('/ledgers/bulk-import', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const tenantId = req.user!.tenantId;
    const { ledgers, dryRun } = req.body;
    const result = ledgerService.bulkImportLedgers(tenantId, ledgers || [], !!dryRun, req.user!.id);
    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to execute bulk import';
    res.status(400).json({ success: false, error: { code: 'BULK_IMPORT_ERROR', message } });
  }
});

// ============================================================================
// 3. OPENING BALANCES GOVERNANCE (PHASE 07)
// ============================================================================

/**
 * GET /api/accounting/opening-balances/summary
 * Analyzes opening balance debits vs credits and returns imbalance difference
 */
accountingRouter.get('/opening-balances/summary', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const tenantId = req.user!.tenantId;
    const summary = ledgerService.getOpeningBalanceSummary(tenantId);
    res.json({
      success: true,
      data: summary,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to calculate opening balances summary';
    res.status(500).json({ success: false, error: { code: 'CALC_ERROR', message } });
  }
});

/**
 * POST /api/accounting/opening-balances/reconcile
 * Reconciles opening balance difference into a designated suspense account
 */
accountingRouter.post('/opening-balances/reconcile', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const tenantId = req.user!.tenantId;
    const summary = ledgerService.reconcileOpeningBalanceDifference(tenantId, req.body, req.user!.id);
    res.json({
      success: true,
      data: summary,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to reconcile opening balances difference';
    const code = (error as { code?: string }).code || 'RECONCILE_ERROR';
    res.status(400).json({ success: false, error: { code, message } });
  }
});

// ============================================================================
// 4. JOURNALS & REVERSAL (PHASE 06)
// ============================================================================

/**
 * POST /api/accounting/journals
 * Posts a new balanced double-entry journal
 */
accountingRouter.post('/journals', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const journal = await postingService.postJournal(tenantId, req.body, {
      userId: req.user!.id,
      userRole: req.user!.role,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      isAuthorizedAdjustment: req.body.isAuthorizedAdjustment,
      adjustmentReason: req.body.adjustmentReason,
    });

    res.status(201).json({
      success: true,
      data: journal,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to post journal entry';
    const code = (error as { code?: string }).code || 'POSTING_ERROR';
    res.status(400).json({ success: false, error: { code, message } });
  }
});

/**
 * GET /api/accounting/journals
 * Retrieves journal entries for current tenant with optional filters
 */
accountingRouter.get('/journals', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const tenantId = req.user!.tenantId;
    const { status, voucherType, fromDate, toDate } = req.query;

    const journals = postingService.getJournals(tenantId, {
      status: status as string | undefined,
      voucherType: voucherType as string | undefined,
      fromDate: fromDate as string | undefined,
      toDate: toDate as string | undefined,
    });

    res.json({
      success: true,
      data: journals,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch journals';
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message } });
  }
});

/**
 * GET /api/accounting/journals/:id
 * Retrieves a single journal entry by ID
 */
accountingRouter.get('/journals/:id', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const tenantId = req.user!.tenantId;
    const journal = postingService.getJournalById(tenantId, req.params.id);

    if (!journal) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Journal entry not found' } });
      return;
    }

    res.json({
      success: true,
      data: journal,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch journal';
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message } });
  }
});

/**
 * POST /api/accounting/journals/:id/reverse
 * Reverses a posted journal entry
 */
accountingRouter.post('/journals/:id/reverse', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const result = await postingService.reverseJournal(
      tenantId,
      req.params.id,
      {
        reversalReason: req.body.reversalReason,
        reversalDate: req.body.reversalDate,
        isAuthorizedAdjustment: req.body.isAuthorizedAdjustment,
        adjustmentReason: req.body.adjustmentReason,
      },
      {
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        isAuthorizedAdjustment: req.body.isAuthorizedAdjustment,
        adjustmentReason: req.body.adjustmentReason,
      }
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to reverse journal entry';
    const code = (error as { code?: string }).code || 'REVERSAL_ERROR';
    res.status(400).json({ success: false, error: { code, message } });
  }
});

// ============================================================================
// 5. REPORTS & DRILL-DOWN (PHASE 06 & 07)
// ============================================================================

/**
 * GET /api/accounting/trial-balance
 * Computes Trial Balance from posted journal lines
 */
accountingRouter.get('/trial-balance', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const tenantId = req.user!.tenantId;
    const asOfDate = req.query.asOfDate as string | undefined;

    const trialBalance = postingService.getTrialBalance(tenantId, asOfDate);
    res.json({
      success: true,
      data: trialBalance,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to compute trial balance';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
});

/**
 * GET /api/accounting/ledgers/:ledgerId/statement
 * Computes chronological statement of account
 */
accountingRouter.get('/ledgers/:ledgerId/statement', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const tenantId = req.user!.tenantId;
    const { fromDate, toDate } = req.query;

    const statement = postingService.getLedgerStatement(
      tenantId,
      req.params.ledgerId,
      fromDate as string | undefined,
      toDate as string | undefined
    );

    res.json({
      success: true,
      data: statement,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate ledger statement';
    res.status(400).json({ success: false, error: { code: 'STATEMENT_ERROR', message } });
  }
});

/**
 * GET /api/accounting/chart-of-accounts
 * Retrieves Chart of Accounts for current tenant (legacy compatibility)
 */
accountingRouter.get('/chart-of-accounts', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const tenantId = req.user!.tenantId;
    const accounts = db.getChartOfAccounts(tenantId);
    res.json({
      success: true,
      data: accounts,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch accounts';
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message } });
  }
});

// ============================================================================
// 6. PERIOD CONTROLS (PHASE 06)
// ============================================================================

/**
 * GET /api/accounting/periods
 * Retrieves accounting periods for current tenant
 */
accountingRouter.get('/periods', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const tenantId = req.user!.tenantId;
    const periods = db.getAccountingPeriods(tenantId);
    res.json({
      success: true,
      data: periods,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch periods';
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message } });
  }
});

/**
 * POST /api/accounting/periods/:id/lock
 * Locks an accounting period
 */
accountingRouter.post('/periods/:id/lock', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const tenantId = req.user!.tenantId;
    const updated = periodService.lockPeriod(tenantId, req.params.id, req.user!.id);
    res.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to lock period';
    res.status(400).json({ success: false, error: { code: 'LOCK_ERROR', message } });
  }
});

/**
 * POST /api/accounting/periods/:id/unlock
 * Unlocks an accounting period
 */
accountingRouter.post('/periods/:id/unlock', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const tenantId = req.user!.tenantId;
    const updated = periodService.unlockPeriod(tenantId, req.params.id, req.user!.id);
    res.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to unlock period';
    res.status(400).json({ success: false, error: { code: 'UNLOCK_ERROR', message } });
  }
});
