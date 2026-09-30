/**
 * Security & Audit Logger
 * Records tamper-evident security events: logins, failures, registrations, revocations.
 */

export type SecurityEventType =
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILED'
  | 'AUTH_REGISTER_ORGANIZATION'
  | 'AUTH_LOGOUT'
  | 'AUTH_SESSION_EXPIRED'
  | 'AUTH_UNAUTHORIZED_ACCESS'
  | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_RESET_SUCCESS'
  | 'PASSWORD_RESET_FAILED'
  | 'TENANT_SWITCH';

export interface SecurityLogEntry {
  id: string;
  timestamp: string;
  eventType: SecurityEventType;
  userId?: string;
  tenantId?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

class SecurityAuditLogger {
  private inMemoryLogs: SecurityLogEntry[] = [];
  private maxLogs = 500;

  public log(entry: Omit<SecurityLogEntry, 'id' | 'timestamp'>): SecurityLogEntry {
    const record: SecurityLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry,
    };

    this.inMemoryLogs.unshift(record);
    if (this.inMemoryLogs.length > this.maxLogs) {
      this.inMemoryLogs.pop();
    }

    // Console output for server terminal observability
    const prefix = `[SECURITY AUDIT - ${record.eventType}]`;
    const userContext = record.email || record.userId ? `User: ${record.email || record.userId}` : 'Anonymous';
    console.info(`${prefix} ${record.timestamp} | ${userContext} | IP: ${record.ipAddress || 'unknown'}`);

    return record;
  }

  public getRecentLogs(limit: number = 50): SecurityLogEntry[] {
    return this.inMemoryLogs.slice(0, limit);
  }

  public clearLogs(): void {
    this.inMemoryLogs = [];
  }
}

export const securityLogger = new SecurityAuditLogger();
