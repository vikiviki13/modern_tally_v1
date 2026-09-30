# SECURITY ARCHITECTURE & GOVERNANCE SPECIFICATION
**Platform:** Modern Enterprise Accounting & Business Management Platform  
**Target:** Financial-Grade Security, Tenant Isolation & MCA Statutory Non-Tamperability  
**Document:** Security & Access Control Architecture (Phase 02 Deliverable)  
**Author:** Technical Lead & Senior Security Architect

---

## 1. Multi-Tenant Isolation Architecture

Financial data requires absolute, zero-leakage isolation. Our platform implements **Defense-in-Depth Multi-Tenancy**:

```
[ Incoming HTTP Request ]
          │
          ▼
[ 1. JWT Verification ] ────────── Validates user identity & assigned tenant IDs
          │
          ▼
[ 2. Tenant Context Middleware ] ── Checks X-Tenant-ID belongs to user; injects context
          │
          ▼
[ 3. DB Connection Hook ] ──────── Executes: SET LOCAL app.current_tenant_id = 'uuid';
          │
          ▼
[ 4. PostgreSQL Engine (RLS) ] ─── Enforces Row-Level Security policy on every SELECT,
                                   INSERT, UPDATE, DELETE query automatically
```

### PostgreSQL Row-Level Security (RLS) Implementation
```sql
-- Enable RLS on core tables
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policy
CREATE POLICY tenant_isolation_journal_entries ON journal_entries
FOR ALL
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_journal_lines ON journal_lines
FOR ALL
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_ledgers ON ledgers
FOR ALL
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
```
*Guarantee:* Even if an application-layer bug fails to include `WHERE tenant_id = ?`, the PostgreSQL engine itself discards any row not matching the current connection's session variable.

---

## 2. Role-Based Access Control (RBAC) & Segregation of Duties

### 2.1 Role Definitions
1. **Super Admin / Business Owner:** Full read/write access across all modules, fiscal year close, company settings, and user management.
2. **Chartered Accountant / Statutory Auditor:** Full read access to all books, vouchers, and audit trails; write access to adjustment journal entries and period lock controls. No access to delete users or modify system config.
3. **Senior Accountant:** Full access to create, post, and reconcile vouchers (Sales, Purchases, Payments, Receipts, Contra, BRS); access to standard operational reports. Cannot unlock closed periods.
4. **Sales Executive:** Create quotations, sales orders, and invoices; view customer receivables. **Strictly restricted from viewing purchase costs, profit margins, P&L, or vendor ledgers.**
5. **Inventory / Warehouse Clerk:** Record Goods Receipts (GRN), delivery notes, physical counts, and stock transfers. **No access to financial books, general ledgers, or customer balances.**
6. **Read-Only Executive / Investor:** View-only access to high-level financial dashboards, P&L, and Balance Sheet.

### 2.2 Permissions Matrix

| Feature / Domain | Super Admin | Auditor / CA | Sr. Accountant | Sales Rep | Warehouse Clerk |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **View Balance Sheet & P&L** | Allowed | Allowed | Allowed | **DENIED** | **DENIED** |
| **View Purchase Costs & Margins**| Allowed | Allowed | Allowed | **DENIED** | **DENIED** |
| **Post Sales Invoices** | Allowed | Allowed | Allowed | Allowed | **DENIED** |
| **Post Purchase Bills** | Allowed | Allowed | Allowed | **DENIED** | **DENIED** |
| **Post General Journal Entries**| Allowed | Allowed | Allowed | **DENIED** | **DENIED** |
| **Bank Reconciliation (BRS)** | Allowed | Allowed | Allowed | **DENIED** | **DENIED** |
| **Lock / Unlock Fiscal Periods** | Allowed | Allowed | **DENIED** | **DENIED** | **DENIED** |
| **View Audit Trail Log** | Allowed | Allowed | **DENIED** | **DENIED** | **DENIED** |
| **Perform Stock Adjustments** | Allowed | Allowed | Allowed | **DENIED** | Allowed |

---

## 3. Statutory MCA Audit Trail & Tamper-Proof Architecture

Under the **Companies (Accounts) Rules, 2014 (Rule 3)** in India:
> *"Every company which uses accounting software for maintaining its books of account, shall use only such accounting software which has a feature of recording audit trail of each and every transaction, creating an edit log of each change made in books of account along with the date when such changes were made and ensuring that the audit trail cannot be disabled."*

### 3.1 Immutable Engine-Level Protections
1. **Append-Only Trigger:**
   As defined in `DATABASE_DESIGN.md`, the PostgreSQL trigger `trg_audit_logs_immutable` intercepts any `UPDATE` or `DELETE` executed against `audit_logs` and raises an uncatchable SQL exception.
2. **Cryptographic Hash Chaining (Audit Blockchain):**
   Each record in `audit_logs` stores a cryptographic hash computed as:
   $$\text{Hash}_n = \text{SHA256}(\text{Record ID}_n \parallel \text{Timestamp}_n \parallel \text{Action}_n \parallel \text{Diff}_n \parallel \text{Hash}_{n-1})$$
   - This forms an immutable chain. If an attacker with superuser database credentials manually tampers with an older row, all subsequent hashes in the chain break, providing verifiable evidence of tampering during statutory audit.

---

## 4. Authentication, Session & Token Lifecycle

- **Access Tokens (JWT):** Short-lived (15 minutes), containing user ID, tenant ID, and permissions array.
- **Refresh Tokens:** Long-lived (7 days), stored in an `HttpOnly`, `SameSite=Strict`, `Secure` browser cookie.
- **Token Rotation & Invalidation:** On every refresh token exchange, the old refresh token is invalidated. A logout or security event revokes all active family tokens.
- **Idempotency Protection:** Every financial voucher submission requires an `X-Idempotency-Key` UUID. The server stores this key for 24 hours. Retried requests return the original response without re-executing accounting entries.

---

## 5. Data Encryption & Financial Privacy

1. **In Transit:** TLS 1.3 with strict modern cipher suites (`AES-256-GCM`, `ChaCha20-Poly1305`). HTTP Strict Transport Security (HSTS) enforced.
2. **At Rest:** Full database volume encryption via AWS KMS / Cloud KMS (AES-256).
3. **Field-Level Encryption (Application Layer):** Sensitive party attributes—such as Bank Account Numbers, Net Banking API credentials, and Tax Identifiers—are encrypted with AES-256-GCM before database insertion.
