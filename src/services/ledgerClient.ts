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
} from '../../shared/types/ledger';
import { LedgerStatementDTO, JournalEntryDTO } from '../../shared/types/accounting';
import { authClient } from './authClient';

class LedgerClient {
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

    const json = await res.json();
    if (!res.ok || !json.success) {
      const errorMsg = json.error?.message || `Request failed with status ${res.status}`;
      throw new Error(errorMsg);
    }

    return json.data as T;
  }

  // --- Account Groups ---
  public async getGroups(): Promise<AccountGroupDTO[]> {
    return this.request<AccountGroupDTO[]>('/api/accounting/groups');
  }

  public async getGroupTree(): Promise<AccountGroupDTO[]> {
    return this.request<AccountGroupDTO[]>('/api/accounting/groups/tree');
  }

  public async createGroup(payload: CreateAccountGroupPayload): Promise<AccountGroupDTO> {
    return this.request<AccountGroupDTO>('/api/accounting/groups', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async updateGroup(id: string, payload: UpdateAccountGroupPayload): Promise<AccountGroupDTO> {
    return this.request<AccountGroupDTO>(`/api/accounting/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  public async deleteGroup(id: string): Promise<{ deleted: boolean }> {
    return this.request<{ deleted: boolean }>(`/api/accounting/groups/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Ledgers ---
  public async getLedgers(filters?: {
    groupId?: string;
    classification?: string;
    search?: string;
    isActive?: boolean;
    isBankAccount?: boolean;
    isTaxAccount?: boolean;
  }): Promise<LedgerMasterDTO[]> {
    const params = new URLSearchParams();
    if (filters?.groupId) params.append('groupId', filters.groupId);
    if (filters?.classification) params.append('classification', filters.classification);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));
    if (filters?.isBankAccount !== undefined) params.append('isBankAccount', String(filters.isBankAccount));
    if (filters?.isTaxAccount !== undefined) params.append('isTaxAccount', String(filters.isTaxAccount));

    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<LedgerMasterDTO[]>(`/api/accounting/ledgers${qs}`);
  }

  public async getLedger(id: string, periodStart?: string, periodEnd?: string): Promise<LedgerMasterDTO> {
    const params = new URLSearchParams();
    if (periodStart) params.append('periodStart', periodStart);
    if (periodEnd) params.append('periodEnd', periodEnd);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<LedgerMasterDTO>(`/api/accounting/ledgers/${id}${qs}`);
  }

  public async createLedger(payload: CreateLedgerPayload): Promise<LedgerMasterDTO> {
    return this.request<LedgerMasterDTO>('/api/accounting/ledgers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async updateLedger(id: string, payload: UpdateLedgerPayload): Promise<LedgerMasterDTO> {
    return this.request<LedgerMasterDTO>(`/api/accounting/ledgers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  public async archiveLedger(id: string): Promise<LedgerMasterDTO> {
    return this.request<LedgerMasterDTO>(`/api/accounting/ledgers/${id}/archive`, {
      method: 'POST',
    });
  }

  public async reactivateLedger(id: string): Promise<LedgerMasterDTO> {
    return this.request<LedgerMasterDTO>(`/api/accounting/ledgers/${id}/reactivate`, {
      method: 'POST',
    });
  }

  // --- Statement & Drill-Down ---
  public async getLedgerStatement(
    ledgerId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<LedgerStatementDTO> {
    const params = new URLSearchParams();
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<LedgerStatementDTO>(`/api/accounting/ledgers/${ledgerId}/statement${qs}`);
  }

  public async getJournal(id: string): Promise<JournalEntryDTO> {
    return this.request<JournalEntryDTO>(`/api/accounting/journals/${id}`);
  }

  // --- Opening Balance Governance ---
  public async getOpeningBalanceSummary(): Promise<OpeningBalanceSummaryDTO> {
    return this.request<OpeningBalanceSummaryDTO>('/api/accounting/opening-balances/summary');
  }

  public async reconcileOpeningBalances(payload: ReconcileOpeningBalancePayload): Promise<OpeningBalanceSummaryDTO> {
    return this.request<OpeningBalanceSummaryDTO>('/api/accounting/opening-balances/reconcile', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- Bulk Import ---
  public async bulkImport(rows: BulkImportLedgerRow[], dryRun = false): Promise<BulkImportResultDTO> {
    return this.request<BulkImportResultDTO>('/api/accounting/ledgers/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ ledgers: rows, dryRun }),
    });
  }

  // --- Test Suite ---
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
    }>('/api/accounting/test-suite');
  }
}

export const ledgerClient = new LedgerClient();
