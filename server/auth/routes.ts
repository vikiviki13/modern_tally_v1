import { Router, Request, Response } from 'express';
import { authService } from '../domain/authService';
import { authenticateToken, AuthenticatedRequest, requireRole } from './middleware';
import { securityLogger } from '../infra/logger';
import { runAuthTests } from '../../tests/auth.test';

export const authRouter = Router();

/**
 * GET /api/auth/test-suite
 * Executes the full test matrix and returns structured test results.
 */
authRouter.get('/test-suite', async (_req: Request, res: Response): Promise<void> => {
  try {
    const summary = await runAuthTests();
    res.json({
      success: true,
      data: summary,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Test suite execution error';
    res.status(500).json({ success: false, error: { code: 'TEST_EXECUTION_ERROR', message } });
  }
});

/**
 * POST /api/auth/register
 * Creates a new organization/company (Tenant) and first Super Admin user.
 */
authRouter.post('/register', (req: Request, res: Response): void => {
  try {
    const result = authService.register(req.body, req.ip, req.headers['user-agent']);
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    const status = message.includes('already exists') ? 409 : 400;
    res.status(status).json({
      success: false,
      error: { code: 'REGISTRATION_ERROR', message },
    });
  }
});

/**
 * POST /api/auth/login
 * Validates credentials and returns a secure session token.
 */
authRouter.post('/login', (req: Request, res: Response): void => {
  try {
    const result = authService.login(req.body, req.ip, req.headers['user-agent']);
    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Login failed';
    const status = message.includes('deactivated') ? 403 : 401;
    res.status(status).json({
      success: false,
      error: { code: 'AUTHENTICATION_ERROR', message },
    });
  }
});

/**
 * POST /api/auth/logout
 * Revokes current session token.
 */
authRouter.post('/logout', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  if (req.token) {
    authService.logout(req.token, req.user?.id, req.ip);
  }
  res.json({
    success: true,
    data: { message: 'Signed out successfully. Session invalidated.' },
  });
});

/**
 * GET /api/auth/me
 * Returns current authenticated user, role, and organization.
 */
authRouter.get('/me', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not logged in' } });
      return;
    }
    const current = authService.getCurrentUser(req.user.id);
    res.json({
      success: true,
      data: current,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch current user';
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message } });
  }
});

/**
 * POST /api/auth/password-reset-request
 * Generates an unguessable password reset token valid for 15 minutes.
 */
authRouter.post('/password-reset-request', (req: Request, res: Response): void => {
  try {
    const result = authService.requestPasswordReset(req.body.email, req.ip);
    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Password reset request failed';
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message },
    });
  }
});

/**
 * POST /api/auth/password-reset-confirm
 * Resets user password using a valid reset token.
 */
authRouter.post('/password-reset-confirm', (req: Request, res: Response): void => {
  try {
    const { token, newPassword } = req.body;
    const result = authService.confirmPasswordReset(token, newPassword, req.ip);
    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Password reset failed';
    res.status(400).json({
      success: false,
      error: { code: 'PASSWORD_RESET_FAILED', message },
    });
  }
});

/**
 * GET /api/auth/tenants
 * Lists available tenants for multi-tenant switching.
 */
authRouter.get('/tenants', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  const tenants = authService.getAllTenants();
  res.json({
    success: true,
    data: {
      tenants,
      currentTenantId: req.user?.tenantId,
    },
  });
});

/**
 * POST /api/auth/switch-tenant
 * Switches active organization tenant for the authenticated user.
 */
authRouter.post('/switch-tenant', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { targetTenantId } = req.body;
    if (!targetTenantId) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'targetTenantId is required.' } });
      return;
    }
    const result = authService.switchTenant(req.user!.id, targetTenantId, req.ip);
    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Tenant switch failed';
    res.status(400).json({ success: false, error: { code: 'TENANT_SWITCH_ERROR', message } });
  }
});

/**
 * GET /api/auth/security-logs
 * Protected endpoint for Auditors and Super Admins to view security audit trail.
 */
authRouter.get(
  '/security-logs',
  authenticateToken,
  requireRole(['SUPER_ADMIN', 'AUDITOR']),
  (req: AuthenticatedRequest, res: Response): void => {
    const logs = securityLogger.getRecentLogs(30);
    res.json({
      success: true,
      data: logs,
    });
  }
);
