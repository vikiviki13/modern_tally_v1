import {
  ApiResponse,
  AuthSuccessData,
  LoginPayload,
  RegisterPayload,
  PasswordResetRequestPayload,
  PasswordResetConfirmPayload,
  TenantDTO,
  UserDTO,
} from '../../shared/types/auth';

const TOKEN_KEY = 'ledgerpulse_auth_token';

class AuthClient {
  private token: string | null = null;

  constructor() {
    this.token = this.getStoredToken();
  }

  public getStoredToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  public setStoredToken(token: string | null): void {
    this.token = token;
    try {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch (e) {
      console.warn('Could not access localStorage for token storage', e);
    }
  }

  private getAuthHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const activeToken = this.token || this.getStoredToken();
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }
    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = {
      ...this.getAuthHeaders(),
      ...(options.headers || {}),
    };

    const res = await fetch(endpoint, {
      ...options,
      headers,
    });

    const json: ApiResponse<T> = await res.json();

    if (!res.ok || !json.success) {
      const errorMsg = json.error?.message || `Request failed with status ${res.status}`;
      throw new Error(errorMsg);
    }

    return json.data as T;
  }

  public async login(payload: LoginPayload): Promise<AuthSuccessData> {
    const data = await this.request<AuthSuccessData>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    this.setStoredToken(data.token);
    return data;
  }

  public async register(payload: RegisterPayload): Promise<AuthSuccessData> {
    const data = await this.request<AuthSuccessData>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    this.setStoredToken(data.token);
    return data;
  }

  public async logout(): Promise<void> {
    try {
      await this.request<{ message: string }>('/api/auth/logout', {
        method: 'POST',
      });
    } finally {
      this.setStoredToken(null);
    }
  }

  public async getMe(): Promise<{ user: UserDTO; tenant: TenantDTO }> {
    return this.request<{ user: UserDTO; tenant: TenantDTO }>('/api/auth/me');
  }

  public async getTenants(): Promise<{ tenants: TenantDTO[]; currentTenantId?: string }> {
    return this.request<{ tenants: TenantDTO[]; currentTenantId?: string }>('/api/auth/tenants');
  }

  public async switchTenant(targetTenantId: string): Promise<AuthSuccessData> {
    const data = await this.request<AuthSuccessData>('/api/auth/switch-tenant', {
      method: 'POST',
      body: JSON.stringify({ targetTenantId }),
    });
    this.setStoredToken(data.token);
    return data;
  }

  public async requestPasswordReset(payload: PasswordResetRequestPayload): Promise<{ message: string; resetToken?: string }> {
    return this.request<{ message: string; resetToken?: string }>('/api/auth/password-reset-request', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async confirmPasswordReset(payload: PasswordResetConfirmPayload): Promise<{ message: string }> {
    return this.request<{ message: string }>('/api/auth/password-reset-confirm', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getSecurityLogs(): Promise<Array<{ id: string; timestamp: string; eventType: string; email?: string; ipAddress?: string; details?: unknown }>> {
    return this.request<Array<{ id: string; timestamp: string; eventType: string; email?: string; ipAddress?: string; details?: unknown }>>('/api/auth/security-logs');
  }

  public async runTestSuite(): Promise<{ passed: boolean; total: number; passedCount: number; results: Array<{ name: string; category: string; passed: boolean; message: string; durationMs: number }> }> {
    return this.request<{ passed: boolean; total: number; passedCount: number; results: Array<{ name: string; category: string; passed: boolean; message: string; durationMs: number }> }>('/api/auth/test-suite');
  }
}

export const authClient = new AuthClient();
