import { Router, Response } from 'express';
import { companyService } from '../domain/companyService';
import { authenticateToken, AuthenticatedRequest } from '../auth/middleware';
import { runCompanyTests } from '../../tests/company.test';

export const companyRouter = Router();

/**
 * GET /api/companies/test-suite
 * Executes Phase 05 Company Management & Financial Configuration Test Suite.
 */
companyRouter.get('/test-suite', async (_req, res: Response): Promise<void> => {
  try {
    const summary = await runCompanyTests();
    res.json({
      success: true,
      data: summary,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Test suite execution error';
    res.status(500).json({ success: false, error: { code: 'TEST_ERROR', message } });
  }
});

/**
 * GET /api/companies
 * Retrieves all registered company tenants.
 */
companyRouter.get('/', authenticateToken, (_req: AuthenticatedRequest, res: Response): void => {
  try {
    const companies = companyService.getAllCompanies();
    res.json({
      success: true,
      data: companies,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch companies';
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message } });
  }
});

/**
 * GET /api/companies/:id
 * Retrieves full configuration for a single company.
 */
companyRouter.get('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const company = companyService.getCompanyById(req.params.id);
    res.json({
      success: true,
      data: company,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Company not found';
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message } });
  }
});

/**
 * POST /api/companies
 * Onboards and provisions a new company with financial calendar and preferences.
 */
companyRouter.post('/', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const company = companyService.createCompany(req.user!.id, req.body, req.ip);
    res.status(201).json({
      success: true,
      data: company,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Company creation failed';
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message } });
  }
});

/**
 * PUT /api/companies/:id
 * Updates company profile and financial preferences.
 */
companyRouter.put('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const updated = companyService.updateCompany(req.params.id, req.body, req.user!.id, req.ip);
    res.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Company update failed';
    res.status(400).json({ success: false, error: { code: 'UPDATE_ERROR', message } });
  }
});

/**
 * GET /api/companies/:id/isolation-audit
 * Verifies that zero cross-tenant ledgers or transactions leak into this company.
 */
companyRouter.get('/:id/isolation-audit', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const audit = companyService.auditCompanyIsolation(req.params.id);
    res.json({
      success: true,
      data: audit,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Isolation audit failed';
    res.status(404).json({ success: false, error: { code: 'AUDIT_ERROR', message } });
  }
});
