import { db, DEFAULT_PREFERENCES } from '../db/store';
import { hashPassword, verifyPassword, signTokenPayload, generateSecureToken } from '../auth/crypto';
import { JWT_SECRET } from '../auth/middleware';
import { securityLogger } from '../infra/logger';
import {
  RegisterPayload,
  LoginPayload,
  AuthSuccessData,
  UserRole,
  TenantDTO,
  UserDTO,
} from '../../shared/types/auth';

const DEFAULT_SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const EXTENDED_SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class AuthService {
  /**
   * Register a new organization tenant and its first Super Administrator user.
   */
  public register(payload: RegisterPayload, ip?: string, userAgent?: string): AuthSuccessData {
    const { email, password, fullName, organizationName, legalName, stateCode = '27', gstin } = payload;

    // 1. Validations
    if (!email || !password || !fullName || !organizationName) {
      throw new Error('All fields (email, password, fullName, organizationName) are required.');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 2. Check uniqueness
    const existing = db.findUserByEmail(normalizedEmail);
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    // 3. Create Tenant
    const cleanGstin = gstin ? gstin.trim().toUpperCase() : undefined;
    const cleanPan = cleanGstin && cleanGstin.length >= 12 ? cleanGstin.substring(2, 12) : undefined;

    const tenant = db.createTenant({
      name: organizationName.trim(),
      legalName: legalName ? legalName.trim() : `${organizationName.trim()} Private Limited`,
      businessType: 'PVT_LTD',
      industry: 'General Enterprise',
      country: 'India',
      state: stateCode === '27' ? 'Maharashtra' : 'India',
      stateCode: stateCode.trim(),
      address: {
        street: 'Registered Corporate Office',
        city: 'Commercial Capital',
        state: stateCode === '27' ? 'Maharashtra' : 'State',
        stateCode: stateCode.trim(),
        country: 'India',
        pincode: '400001',
      },
      gstin: cleanGstin,
      pan: cleanPan,
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
      },
      booksBeginningDate: '2026-04-01',
      preferences: DEFAULT_PREFERENCES,
    });

    // 4. Cryptographically hash password using scrypt + salt
    const { hash, salt } = hashPassword(password);

    // 5. Create Super Admin User
    const user = db.createUser({
      email: normalizedEmail,
      fullName: fullName.trim(),
      passwordHash: hash,
      salt,
      role: 'SUPER_ADMIN',
      tenantId: tenant.id,
      isActive: true,
    });

    // 6. Issue Session & Signed Token
    const duration = DEFAULT_SESSION_DURATION_MS;
    const token = signTokenPayload(
      { userId: user.id, tenantId: tenant.id, role: user.role },
      JWT_SECRET,
      duration
    );

    db.createSession({
      token,
      userId: user.id,
      tenantId: tenant.id,
      expiresAt: new Date(Date.now() + duration).toISOString(),
      ipAddress: ip,
      userAgent,
    });

    securityLogger.log({
      eventType: 'AUTH_REGISTER_ORGANIZATION',
      userId: user.id,
      tenantId: tenant.id,
      email: user.email,
      ipAddress: ip,
      userAgent,
      details: { organizationName: tenant.name, gstin: tenant.gstin },
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role as UserRole,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        gstin: tenant.gstin,
        stateCode: tenant.stateCode,
        currency: tenant.currency,
      },
    };
  }

  /**
   * Authenticate user with email and password.
   */
  public login(payload: LoginPayload, ip?: string, userAgent?: string): AuthSuccessData {
    const { email, password, rememberMe } = payload;

    if (!email || !password) {
      throw new Error('Both email and password are required.');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = db.findUserByEmail(normalizedEmail);

    if (!user) {
      securityLogger.log({
        eventType: 'AUTH_LOGIN_FAILED',
        email: normalizedEmail,
        ipAddress: ip,
        userAgent,
        details: { reason: 'User not found' },
      });
      throw new Error('Invalid email or password.');
    }

    if (!user.isActive) {
      securityLogger.log({
        eventType: 'AUTH_LOGIN_FAILED',
        userId: user.id,
        email: normalizedEmail,
        ipAddress: ip,
        userAgent,
        details: { reason: 'Account suspended' },
      });
      throw new Error('This account has been deactivated. Please contact your company administrator.');
    }

    // Verify password with timing-safe comparison
    const isValid = verifyPassword(password, user.passwordHash, user.salt);
    if (!isValid) {
      securityLogger.log({
        eventType: 'AUTH_LOGIN_FAILED',
        userId: user.id,
        email: normalizedEmail,
        ipAddress: ip,
        userAgent,
        details: { reason: 'Password mismatch' },
      });
      throw new Error('Invalid email or password.');
    }

    // Resolve tenant
    const tenant = db.findTenantById(user.tenantId);
    if (!tenant) {
      throw new Error('Tenant organization associated with this account is missing.');
    }

    // Update last login
    db.updateUser(user.id, { lastLoginAt: new Date().toISOString() });

    // Issue Token
    const duration = rememberMe ? EXTENDED_SESSION_DURATION_MS : DEFAULT_SESSION_DURATION_MS;
    const token = signTokenPayload(
      { userId: user.id, tenantId: tenant.id, role: user.role },
      JWT_SECRET,
      duration
    );

    db.createSession({
      token,
      userId: user.id,
      tenantId: tenant.id,
      expiresAt: new Date(Date.now() + duration).toISOString(),
      ipAddress: ip,
      userAgent,
    });

    securityLogger.log({
      eventType: 'AUTH_LOGIN_SUCCESS',
      userId: user.id,
      tenantId: tenant.id,
      email: user.email,
      ipAddress: ip,
      userAgent,
      details: { role: user.role, rememberMe: !!rememberMe },
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role as UserRole,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        gstin: tenant.gstin,
        stateCode: tenant.stateCode,
        currency: tenant.currency,
      },
    };
  }

  /**
   * Revoke session on logout.
   */
  public logout(token: string, userId?: string, ip?: string): void {
    db.deleteSession(token);
    securityLogger.log({
      eventType: 'AUTH_LOGOUT',
      userId,
      ipAddress: ip,
      details: { tokenRevoked: true },
    });
  }

  /**
   * Request password reset token.
   */
  public requestPasswordReset(email: string, ip?: string): { message: string; resetToken?: string } {
    if (!email) {
      throw new Error('Email address is required.');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = db.findUserByEmail(normalizedEmail);

    if (user) {
      const resetToken = generateSecureToken(32);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

      db.createPasswordReset({
        userId: user.id,
        token: resetToken,
        expiresAt,
      });

      securityLogger.log({
        eventType: 'PASSWORD_RESET_REQUEST',
        userId: user.id,
        email: normalizedEmail,
        ipAddress: ip,
        details: { resetTokenIssued: true },
      });

      return {
        message: 'Password reset code generated and issued.',
        resetToken,
      };
    }

    return {
      message: 'If an account exists with this email, a reset token has been issued.',
    };
  }

  /**
   * Confirm password reset with token and new password.
   */
  public confirmPasswordReset(token: string, newPassword: string, ip?: string): { message: string } {
    if (!token || !newPassword) {
      throw new Error('Both reset token and new password are required.');
    }

    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long.');
    }

    const resetRecord = db.findPasswordResetByToken(token);
    if (!resetRecord) {
      securityLogger.log({
        eventType: 'PASSWORD_RESET_FAILED',
        ipAddress: ip,
        details: { reason: 'Invalid or already used token' },
      });
      throw new Error('Invalid or already used password reset token.');
    }

    if (new Date(resetRecord.expiresAt) < new Date()) {
      securityLogger.log({
        eventType: 'PASSWORD_RESET_FAILED',
        userId: resetRecord.userId,
        ipAddress: ip,
        details: { reason: 'Token expired' },
      });
      throw new Error('This password reset token has expired. Please request a new one.');
    }

    // Hash new password
    const { hash, salt } = hashPassword(newPassword);

    // Update user
    db.updateUser(resetRecord.userId, { passwordHash: hash, salt });

    // Mark token used
    db.markPasswordResetUsed(resetRecord.id);

    // Invalidate all existing active sessions
    db.deleteSessionsForUser(resetRecord.userId);

    securityLogger.log({
      eventType: 'PASSWORD_RESET_SUCCESS',
      userId: resetRecord.userId,
      ipAddress: ip,
      details: { allPreviousSessionsRevoked: true },
    });

    return {
      message: 'Password updated successfully. Please sign in with your new password.',
    };
  }

  /**
   * Switch active tenant context for the user.
   */
  public switchTenant(userId: string, targetTenantId: string, ip?: string): AuthSuccessData {
    const user = db.findUserById(userId);
    if (!user) {
      throw new Error('User not found.');
    }

    const tenant = db.findTenantById(targetTenantId);
    if (!tenant) {
      throw new Error('Target company tenant does not exist.');
    }

    // Update user active tenant
    db.updateUser(user.id, { tenantId: tenant.id });

    // Invalidate current sessions and issue new token with updated tenant context
    const duration = DEFAULT_SESSION_DURATION_MS;
    const token = signTokenPayload(
      { userId: user.id, tenantId: tenant.id, role: user.role },
      JWT_SECRET,
      duration
    );

    db.createSession({
      token,
      userId: user.id,
      tenantId: tenant.id,
      expiresAt: new Date(Date.now() + duration).toISOString(),
      ipAddress: ip,
    });

    securityLogger.log({
      eventType: 'TENANT_SWITCH',
      userId: user.id,
      tenantId: tenant.id,
      ipAddress: ip,
      details: { newTenantName: tenant.name },
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role as UserRole,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        gstin: tenant.gstin,
        stateCode: tenant.stateCode,
        currency: tenant.currency,
      },
    };
  }

  /**
   * Retrieve all tenants in the system.
   */
  public getAllTenants(): TenantDTO[] {
    return db.getAllTenants().map((t) => ({
      id: t.id,
      name: t.name,
      legalName: t.legalName,
      gstin: t.gstin,
      stateCode: t.stateCode,
      currency: t.currency,
      createdAt: t.createdAt,
    }));
  }

  /**
   * Retrieve user profile and tenant by ID.
   */
  public getCurrentUser(userId: string): { user: UserDTO; tenant: TenantDTO } {
    const user = db.findUserById(userId);
    if (!user) throw new Error('User not found');
    const tenant = db.findTenantById(user.tenantId);
    if (!tenant) throw new Error('Tenant not found');

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role as UserRole,
        tenantId: user.tenantId,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        legalName: tenant.legalName,
        gstin: tenant.gstin,
        stateCode: tenant.stateCode,
        currency: tenant.currency,
        createdAt: tenant.createdAt,
      },
    };
  }
}

export const authService = new AuthService();
