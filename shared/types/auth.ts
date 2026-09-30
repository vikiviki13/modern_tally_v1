/**
 * Shared Authentication & Tenant Types
 * Used across Frontend (src/) and Backend (server/)
 */

import { CompanyCurrency } from './company';

export type UserRole = 'SUPER_ADMIN' | 'AUDITOR' | 'SR_ACCOUNTANT' | 'SALES' | 'WAREHOUSE';

export interface UserDTO {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  tenantId: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface TenantDTO {
  id: string;
  name: string;
  legalName: string;
  gstin?: string;
  stateCode: string;
  currency: string | CompanyCurrency;
  createdAt: string;
}

export interface SessionDTO {
  id: string;
  token: string;
  userId: string;
  tenantId: string;
  expiresAt: string;
  createdAt: string;
}

export interface AuthSuccessData {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
  };
  tenant: {
    id: string;
    name: string;
    gstin?: string;
    stateCode: string;
    currency: string | CompanyCurrency;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  organizationName: string;
  legalName?: string;
  stateCode?: string;
  gstin?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface PasswordResetRequestPayload {
  email: string;
}

export interface PasswordResetConfirmPayload {
  token: string;
  newPassword: string;
}
