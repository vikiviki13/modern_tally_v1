import {
  ApiResponse,
  CompanyDTO,
  CreateCompanyPayload,
  UpdateCompanyPayload,
  CompanyIsolationAuditDTO,
} from '../../shared/types/company';
import { authClient } from './authClient';

class CompanyClient {
  private getAuthHeaders(): HeadersInit {
    const token = authClient.getStoredToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
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

  public async getAllCompanies(): Promise<CompanyDTO[]> {
    return this.request<CompanyDTO[]>('/api/companies');
  }

  public async getCompany(id: string): Promise<CompanyDTO> {
    return this.request<CompanyDTO>(`/api/companies/${id}`);
  }

  public async createCompany(payload: CreateCompanyPayload): Promise<CompanyDTO> {
    return this.request<CompanyDTO>('/api/companies', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async updateCompany(id: string, payload: UpdateCompanyPayload): Promise<CompanyDTO> {
    return this.request<CompanyDTO>(`/api/companies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  public async getIsolationAudit(id: string): Promise<CompanyIsolationAuditDTO> {
    return this.request<CompanyIsolationAuditDTO>(`/api/companies/${id}/isolation-audit`);
  }

  public async runTestSuite(): Promise<{
    passed: boolean;
    total: number;
    passedCount: number;
    results: Array<{ name: string; category: string; passed: boolean; message: string; durationMs: number }>;
  }> {
    return this.request<{
      passed: boolean;
      total: number;
      passedCount: number;
      results: Array<{ name: string; category: string; passed: boolean; message: string; durationMs: number }>;
    }>('/api/companies/test-suite');
  }
}

export const companyClient = new CompanyClient();
